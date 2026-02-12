import fs from 'fs';
import path from 'path';

/**
 * 知识图谱本地 JSON 存储
 * 存储路径: server/data/{datasetId}/graph.json
 * 结构: { nodes: [...], links: [...], metadata: {...} }
 */

export interface GraphNode {
  id: string;
  name: string;
  type: string;       // 实体类型：人物、概念、技术、事件、地点、组织等
  description?: string;
  sourceDocuments: string[];  // 来源文档ID列表
  weight: number;      // 节点权重（出现频次）
}

export interface GraphLink {
  source: string;
  target: string;
  relation: string;    // 关系描述
  weight: number;      // 关系权重
  sourceDocuments: string[];
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  metadata: {
    datasetId: string;
    lastUpdated: string;
    documentCount: number;
    extractedDocIds: string[];   // 已抽取过的文档ID
  };
}

const DATA_DIR = path.resolve(__dirname, '../../data');

function getGraphPath(datasetId: string): string {
  return path.join(DATA_DIR, datasetId, 'graph.json');
}

export function loadGraph(datasetId: string): GraphData | null {
  const filePath = getGraphPath(datasetId);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as GraphData;
  } catch (e) {
    console.error('Failed to load graph:', e);
    return null;
  }
}

export function saveGraph(datasetId: string, data: GraphData): void {
  const dir = path.join(DATA_DIR, datasetId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const filePath = getGraphPath(datasetId);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`✅ Graph saved: ${data.nodes.length} nodes, ${data.links.length} links`);
}

export function createEmptyGraph(datasetId: string): GraphData {
  return {
    nodes: [],
    links: [],
    metadata: {
      datasetId,
      lastUpdated: new Date().toISOString(),
      documentCount: 0,
      extractedDocIds: [],
    },
  };
}

/**
 * 合并新抽取的三元组到现有图谱
 */
export function mergeTriples(
  graph: GraphData,
  triples: Array<{
    subject: string;
    subjectType: string;
    relation: string;
    object: string;
    objectType: string;
  }>,
  documentId: string
): GraphData {
  const nodeMap = new Map<string, GraphNode>();
  const linkMap = new Map<string, GraphLink>();

  // 加载现有节点和链接到 Map
  for (const node of graph.nodes) {
    nodeMap.set(node.id, { ...node });
  }
  for (const link of graph.links) {
    const key = `${link.source}|${link.relation}|${link.target}`;
    linkMap.set(key, { ...link });
  }

  // 合并新三元组
  for (const triple of triples) {
    const subjectId = normalizeId(triple.subject);
    const objectId = normalizeId(triple.object);

    // 合并 subject 节点
    if (nodeMap.has(subjectId)) {
      const existing = nodeMap.get(subjectId)!;
      existing.weight += 1;
      if (!existing.sourceDocuments.includes(documentId)) {
        existing.sourceDocuments.push(documentId);
      }
    } else {
      nodeMap.set(subjectId, {
        id: subjectId,
        name: triple.subject,
        type: triple.subjectType,
        sourceDocuments: [documentId],
        weight: 1,
      });
    }

    // 合并 object 节点
    if (nodeMap.has(objectId)) {
      const existing = nodeMap.get(objectId)!;
      existing.weight += 1;
      if (!existing.sourceDocuments.includes(documentId)) {
        existing.sourceDocuments.push(documentId);
      }
    } else {
      nodeMap.set(objectId, {
        id: objectId,
        name: triple.object,
        type: triple.objectType,
        sourceDocuments: [documentId],
        weight: 1,
      });
    }

    // 合并链接
    const linkKey = `${subjectId}|${triple.relation}|${objectId}`;
    if (linkMap.has(linkKey)) {
      const existing = linkMap.get(linkKey)!;
      existing.weight += 1;
      if (!existing.sourceDocuments.includes(documentId)) {
        existing.sourceDocuments.push(documentId);
      }
    } else {
      linkMap.set(linkKey, {
        source: subjectId,
        target: objectId,
        relation: triple.relation,
        weight: 1,
        sourceDocuments: [documentId],
      });
    }
  }

  return {
    nodes: Array.from(nodeMap.values()),
    links: Array.from(linkMap.values()),
    metadata: {
      ...graph.metadata,
      lastUpdated: new Date().toISOString(),
    },
  };
}

/**
 * 合并多个知识库的图谱为一个统一图谱
 * 节点按 id 去重合并，链接按 key 去重合并
 */
export function mergeGraphs(graphs: GraphData[]): GraphData {
  const nodeMap = new Map<string, GraphNode>();
  const linkMap = new Map<string, GraphLink>();
  const allDocIds: string[] = [];
  let totalDocCount = 0;

  for (const g of graphs) {
    for (const node of g.nodes) {
      if (nodeMap.has(node.id)) {
        const existing = nodeMap.get(node.id)!;
        existing.weight += node.weight;
        for (const docId of node.sourceDocuments) {
          if (!existing.sourceDocuments.includes(docId)) {
            existing.sourceDocuments.push(docId);
          }
        }
      } else {
        nodeMap.set(node.id, { ...node, sourceDocuments: [...node.sourceDocuments] });
      }
    }

    for (const link of g.links) {
      const key = `${link.source}|${link.relation}|${link.target}`;
      if (linkMap.has(key)) {
        const existing = linkMap.get(key)!;
        existing.weight += link.weight;
        for (const docId of link.sourceDocuments) {
          if (!existing.sourceDocuments.includes(docId)) {
            existing.sourceDocuments.push(docId);
          }
        }
      } else {
        linkMap.set(key, { ...link, sourceDocuments: [...link.sourceDocuments] });
      }
    }

    for (const docId of g.metadata.extractedDocIds) {
      if (!allDocIds.includes(docId)) allDocIds.push(docId);
    }
    totalDocCount += g.metadata.documentCount;
  }

  return {
    nodes: Array.from(nodeMap.values()),
    links: Array.from(linkMap.values()),
    metadata: {
      datasetId: graphs.map(g => g.metadata.datasetId).join(','),
      lastUpdated: new Date().toISOString(),
      documentCount: totalDocCount,
      extractedDocIds: allDocIds,
    },
  };
}

function normalizeId(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '_');
}
