import { Router, Request, Response } from 'express';
import { cozeApi } from '../services/cozeApi.js';
import { loadGraph } from '../services/graphStore.js';
import {
  extractKnowledgeGraph,
  getExtractionProgress,
  getMergedGraph,
} from '../services/knowledgeExtractor.js';

const router = Router();

/**
 * GET /api/graph/data
 * 获取所有知识库的合并知识图谱数据
 */
router.get('/data', async (req: Request, res: Response) => {
  try {
    const datasetIds = cozeApi.getDatasetIds();
    const graph = getMergedGraph(datasetIds);

    if (graph.nodes.length === 0) {
      return res.json({
        nodes: [],
        links: [],
        metadata: { datasetIds, lastUpdated: null, documentCount: 0, extractedDocIds: [] },
        message: '尚未进行知识抽取，请先触发抽取',
      });
    }

    res.json(graph);
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * POST /api/graph/extract
 * 触发知识抽取（异步执行，返回即时响应）
 * Body: { forceRefresh?: boolean }
 */
router.post('/extract', async (req: Request, res: Response) => {
  try {
    const { forceRefresh = false } = req.body || {};
    const progress = getExtractionProgress();

    if (progress.status === 'running') {
      return res.json({
        message: '抽取任务正在进行中',
        progress,
      });
    }

    // 异步执行抽取，不等待完成
    extractKnowledgeGraph(forceRefresh).catch((err) => {
      console.error('Extraction failed:', err);
    });

    res.json({
      message: '知识抽取任务已启动',
      progress: getExtractionProgress(),
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/**
 * GET /api/graph/progress
 * 查询抽取进度
 */
router.get('/progress', (req: Request, res: Response) => {
  res.json(getExtractionProgress());
});

/**
 * GET /api/graph/stats
 * 获取知识图谱统计信息
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const datasetIds = cozeApi.getDatasetIds();
    const graph = getMergedGraph(datasetIds);

    if (graph.nodes.length === 0) {
      return res.json({
        nodeCount: 0,
        linkCount: 0,
        documentCount: 0,
        datasetCount: datasetIds.length,
        nodeTypes: {},
        topNodes: [],
      });
    }

    // 统计节点类型分布
    const nodeTypes: Record<string, number> = {};
    for (const node of graph.nodes) {
      nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;
    }

    // 找出权重最高的节点
    const topNodes = [...graph.nodes]
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 20)
      .map((n) => ({ name: n.name, type: n.type, weight: n.weight }));

    res.json({
      nodeCount: graph.nodes.length,
      linkCount: graph.links.length,
      documentCount: graph.metadata.documentCount,
      extractedDocCount: graph.metadata.extractedDocIds.length,
      datasetCount: datasetIds.length,
      lastUpdated: graph.metadata.lastUpdated,
      nodeTypes,
      topNodes,
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

export default router;
