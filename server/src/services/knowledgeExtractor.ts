import { cozeApi } from './cozeApi.js';
import {
  GraphData,
  loadGraph,
  saveGraph,
  createEmptyGraph,
  mergeTriples,
  mergeGraphs,
} from './graphStore.js';

// 知识抽取的系统 Prompt — 只抽取核心实体与关系
const EXTRACTION_SYSTEM_PROMPT = `你是一个知识图谱核心实体关系抽取专家。你的任务是从给定文本中**只抽取最核心、最重要的知识三元组**，忽略所有细枝末节。

**严格限制：**
- 每段文本最多输出 **5-8 个**三元组，绝不超过 10 个
- 只抽取文档的**核心主题实体**和它们之间的**直接关键关系**
- 实体必须是**有独立意义的专有名词**（如具体的人名、组织名、产品名、技术名称、重要概念），不要抽取普通词汇或泛化描述

**必须忽略的内容（不要抽取）：**
- 修饰性描述、形容词短语（如"高效的"、"先进的"）
- 过于笼统的上位概念（如"系统"、"方案"、"方法"、"技术"、"平台"、"服务"等单独作为实体时）
- 文档格式相关信息（章节号、页码、作者署名等）
- 时间戳、版本号等临时性信息
- 同义重复关系（一对实体只保留一个最核心的关系）

**输出格式：**
JSON 数组，每个元素包含：
- subject: 主体实体（简短专有名词，2-8个字）
- subjectType: 类型（人物/组织/技术/概念/产品/事件/地点/方法/工具/标准/指标）
- relation: 关系（2-4个字的动词短语，如"属于"、"开发了"、"包含"、"依赖"）
- object: 客体实体（简短专有名词，2-8个字）
- objectType: 类型（同上）

只输出 JSON 数组，无其他内容。没有核心知识时返回 []。

**示例（注意精简程度）：**
[
  {"subject": "TensorFlow", "subjectType": "工具", "relation": "开发者是", "object": "Google", "objectType": "组织"},
  {"subject": "BERT", "subjectType": "技术", "relation": "基于", "object": "Transformer", "objectType": "技术"}
]`;

interface ExtractionProgress {
  status: 'idle' | 'running' | 'completed' | 'error';
  totalDocuments: number;
  processedDocuments: number;
  currentDocument: string;
  message: string;
}

let extractionProgress: ExtractionProgress = {
  status: 'idle',
  totalDocuments: 0,
  processedDocuments: 0,
  currentDocument: '',
  message: '',
};

export function getExtractionProgress(): ExtractionProgress {
  // 如果当前是 idle 状态，检查是否有已抽取的数据，返回上次抽取摘要
  if (extractionProgress.status === 'idle') {
    const datasetIds = cozeApi.getDatasetIds();
    const graphs: GraphData[] = [];
    for (const id of datasetIds) {
      const g = loadGraph(id);
      if (g) graphs.push(g);
    }
    if (graphs.length > 0) {
      const totalNodes = graphs.reduce((s, g) => s + g.nodes.length, 0);
      const totalLinks = graphs.reduce((s, g) => s + g.links.length, 0);
      const totalDocs = graphs.reduce((s, g) => s + g.metadata.extractedDocIds.length, 0);
      return {
        status: 'completed',
        totalDocuments: totalDocs,
        processedDocuments: totalDocs,
        currentDocument: '',
        message: `已有图谱：${totalNodes} 个实体，${totalLinks} 个关系（来自 ${totalDocs} 篇文档）`,
      };
    }
  }
  return { ...extractionProgress };
}

/**
 * 从 Coze 知识库中抽取知识图谱（支持多个知识库）
 * 1. 遍历所有配置的知识库
 * 2. 获取每个知识库的文档列表
 * 3. 对每个文档下载内容并调用 LLM 抽取三元组
 * 4. 合并到对应知识库的图谱并保存
 * 5. 最终返回所有知识库的合并图谱
 */
export async function extractKnowledgeGraph(forceRefresh = false): Promise<GraphData> {
  const datasetIds = cozeApi.getDatasetIds();
  if (datasetIds.length === 0) {
    throw new Error('KNOWLEDGE_DATASET_IDS not configured');
  }

  extractionProgress = {
    status: 'running',
    totalDocuments: 0,
    processedDocuments: 0,
    currentDocument: '',
    message: `正在获取 ${datasetIds.length} 个知识库的文档列表...`,
  };

  let globalProcessed = 0;
  let globalTotal = 0;

  try {
    // 逐个知识库处理
    for (let dsIdx = 0; dsIdx < datasetIds.length; dsIdx++) {
      const datasetId = datasetIds[dsIdx];
      console.log(`\n📚 Processing dataset [${dsIdx + 1}/${datasetIds.length}]: ${datasetId}`);

      // 加载该知识库已有图谱
      let graph = loadGraph(datasetId);
      if (!graph || forceRefresh) {
        graph = createEmptyGraph(datasetId);
      }

      // 1. 获取该知识库所有文档
      const allDocuments: any[] = [];
      let page = 1;
      while (true) {
        const res = await cozeApi.listDocuments(datasetId, { page, size: 100 });
        const docs = res.document_infos || [];
        allDocuments.push(...docs);
        if (docs.length < 100) break;
        page++;
      }

      console.log(`  📄 Found ${allDocuments.length} documents in dataset ${datasetId}`);

      // 过滤已完成的文档
      const completedDocs = allDocuments.filter((doc: any) => doc.status === 1);

      const docsToProcess = forceRefresh
        ? completedDocs
        : completedDocs.filter(
            (doc: any) => !graph!.metadata.extractedDocIds.includes(doc.document_id)
          );

      globalTotal += docsToProcess.length;
      extractionProgress.totalDocuments = globalTotal;
      extractionProgress.message = `知识库 ${dsIdx + 1}/${datasetIds.length}，待处理 ${docsToProcess.length} 个文档`;

      if (docsToProcess.length === 0) {
        console.log(`  ⏭️ No new documents to process in dataset ${datasetId}`);
        continue;
      }

      // 2. 逐个文档处理
      for (let i = 0; i < docsToProcess.length; i++) {
        const doc = docsToProcess[i];
        globalProcessed++;
        extractionProgress.processedDocuments = globalProcessed;
        extractionProgress.currentDocument = doc.name;
        extractionProgress.message = `[知识库 ${dsIdx + 1}/${datasetIds.length}] 正在处理: ${doc.name} (总进度 ${globalProcessed}/${globalTotal})`;
        console.log(`  🔍 Processing [${i + 1}/${docsToProcess.length}]: ${doc.name}`);

        try {
          const webUrl = doc.web_url || doc.preview_tos_url;
          if (!webUrl) {
            console.log(`    ⚠️ No download URL for: ${doc.name}`);
            continue;
          }

          const combinedText = await cozeApi.downloadDocumentContent(webUrl);
          if (!combinedText.trim()) {
            console.log(`    ⚠️ Empty content for: ${doc.name}`);
            continue;
          }

          const textSegments = splitText(combinedText, 8000);
          let allTriples: any[] = [];

          for (const segment of textSegments) {
            const triples = await extractTriplesFromText(segment);
            allTriples.push(...triples);
          }

          console.log(`    ✅ Extracted ${allTriples.length} triples from: ${doc.name}`);

          if (allTriples.length > 0) {
            graph = mergeTriples(graph, allTriples, doc.document_id);
          }

          if (!graph.metadata.extractedDocIds.includes(doc.document_id)) {
            graph.metadata.extractedDocIds.push(doc.document_id);
          }

          // 每处理完一个文档就保存一次（断点续传）
          graph.metadata.documentCount = allDocuments.length;
          saveGraph(datasetId, graph);

        } catch (err: any) {
          console.error(`    ❌ Error processing ${doc.name}:`, err.message);
        }

        await sleep(1000);
      }
    }

    // 合并所有知识库的图谱
    const mergedGraph = getMergedGraph(datasetIds);

    extractionProgress = {
      status: 'completed',
      totalDocuments: globalTotal,
      processedDocuments: globalProcessed,
      currentDocument: '',
      message: `抽取完成！${datasetIds.length} 个知识库，${mergedGraph.nodes.length} 个实体，${mergedGraph.links.length} 个关系`,
    };

    return mergedGraph;

  } catch (err: any) {
    extractionProgress.status = 'error';
    extractionProgress.message = `抽取失败: ${err.message}`;
    throw err;
  }
}

/**
 * 获取所有知识库的合并图谱
 */
export function getMergedGraph(datasetIds: string[]): GraphData {
  const graphs: GraphData[] = [];
  for (const id of datasetIds) {
    const g = loadGraph(id);
    if (g) graphs.push(g);
  }
  if (graphs.length === 0) {
    return createEmptyGraph(datasetIds.join(','));
  }
  if (graphs.length === 1) {
    return graphs[0];
  }
  return mergeGraphs(graphs);
}

/**
 * 调用 LLM 从文本中抽取三元组
 */
async function extractTriplesFromText(text: string): Promise<any[]> {
  try {
    const response = await cozeApi.callLLM(
      EXTRACTION_SYSTEM_PROMPT,
      `请从以下文本中抽取**最核心的**知识三元组（最多8个，只要最重要的）：\n\n${text}`
    );

    // 尝试解析 JSON
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (t: any) => t.subject && t.relation && t.object
        );
      }
    }

    return [];
  } catch (err: any) {
    console.error('LLM extraction error:', err.message);
    return [];
  }
}

/**
 * 将长文本分割为多个段落
 */
function splitText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];

  const segments: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxChars) {
      segments.push(remaining);
      break;
    }

    // 尝试在段落或句子边界切分
    let cutPoint = remaining.lastIndexOf('\n\n', maxChars);
    if (cutPoint < maxChars * 0.5) {
      cutPoint = remaining.lastIndexOf('。', maxChars);
    }
    if (cutPoint < maxChars * 0.5) {
      cutPoint = remaining.lastIndexOf('.', maxChars);
    }
    if (cutPoint < maxChars * 0.3) {
      cutPoint = maxChars;
    }

    segments.push(remaining.substring(0, cutPoint + 1));
    remaining = remaining.substring(cutPoint + 1);
  }

  return segments;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
