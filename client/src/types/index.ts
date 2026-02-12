// 知识图谱节点
export interface GraphNode {
  id: string;
  name: string;
  type: string;
  description?: string;
  sourceDocuments: string[];
  weight: number;
  // 3D 渲染时由 force-graph 添加
  x?: number;
  y?: number;
  z?: number;
  color?: string;
}

// 知识图谱边
export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  relation: string;
  weight: number;
  sourceDocuments: string[];
}

// 节点类型配色方案
export const NODE_TYPE_COLORS: Record<string, string> = {
  '人物': '#ff6b6b',
  '组织': '#4ecdc4',
  '技术': '#45b7d1',
  '概念': '#96ceb4',
  '产品': '#feca57',
  '事件': '#ff9ff3',
  '地点': '#54a0ff',
  '时间': '#c8d6e5',
  '方法': '#ff6348',
  '工具': '#ffa502',
  '标准': '#2ed573',
  '指标': '#a29bfe',
  'default': '#dfe6e9',
};

export function getNodeColor(type: string): string {
  return NODE_TYPE_COLORS[type] || NODE_TYPE_COLORS['default'];
}
