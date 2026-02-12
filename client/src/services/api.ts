import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 300000, // 5min，抽取可能耗时较长
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// 知识图谱数据类型
export interface GraphNode {
  id: string;
  name: string;
  type: string;
  description?: string;
  sourceDocuments: string[];
  weight: number;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  relation: string;
  weight: number;
  sourceDocuments: string[];
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  metadata: {
    datasetId: string;
    lastUpdated: string | null;
    documentCount: number;
    extractedDocIds: string[];
  };
  message?: string;
}

export interface ExtractionProgress {
  status: 'idle' | 'running' | 'completed' | 'error';
  totalDocuments: number;
  processedDocuments: number;
  currentDocument: string;
  message: string;
}

export interface GraphStats {
  nodeCount: number;
  linkCount: number;
  documentCount: number;
  extractedDocCount: number;
  lastUpdated: string;
  nodeTypes: Record<string, number>;
  topNodes: Array<{ name: string; type: string; weight: number }>;
}

/**
 * 获取知识图谱数据
 */
export async function getGraphData(): Promise<GraphData> {
  const { data } = await api.get('/graph/data');
  return data;
}

/**
 * 触发知识抽取
 */
export async function triggerExtraction(forceRefresh = false): Promise<any> {
  const { data } = await api.post('/graph/extract', { forceRefresh });
  return data;
}

/**
 * 获取抽取进度
 */
export async function getExtractionProgress(): Promise<ExtractionProgress> {
  const { data } = await api.get('/graph/progress');
  return data;
}

/**
 * 获取图谱统计信息
 */
export async function getGraphStats(): Promise<GraphStats> {
  const { data } = await api.get('/graph/stats');
  return data;
}
