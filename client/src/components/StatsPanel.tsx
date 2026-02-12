import { useState } from 'react';
import { GraphNode, GraphLink, getNodeColor } from '../types';
import { ExtractionProgress } from '../services/api';

interface Props {
  nodes: GraphNode[];
  links: GraphLink[];
  progress: ExtractionProgress | null;
  onExtract: (forceRefresh: boolean) => void;
  onNodeSelect: (nodeId: string | null) => void;
  selectedNodeId: string | null;
}

export default function StatsPanel({
  nodes,
  links,
  progress,
  onExtract,
  onNodeSelect,
  selectedNodeId,
}: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'stats' | 'nodes' | 'detail'>('stats');

  // 统计节点类型分布
  const typeStats = nodes.reduce<Record<string, number>>((acc, node) => {
    acc[node.type] = (acc[node.type] || 0) + 1;
    return acc;
  }, {});

  // 排序后的节点列表
  const sortedNodes = [...nodes]
    .sort((a, b) => b.weight - a.weight)
    .filter(
      (n) =>
        !searchTerm ||
        n.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        n.type.includes(searchTerm)
    );

  // 选中节点的详情
  const selectedNode = selectedNodeId
    ? nodes.find((n) => n.id === selectedNodeId)
    : null;

  const connectedLinks = selectedNodeId
    ? links.filter((l) => {
        const sourceId = typeof l.source === 'string' ? l.source : l.source.id;
        const targetId = typeof l.target === 'string' ? l.target : l.target.id;
        return sourceId === selectedNodeId || targetId === selectedNodeId;
      })
    : [];

  const isRunning = progress?.status === 'running';

  return (
    <div className="w-80 h-full glass-dark flex flex-col overflow-hidden border-l border-white/5">
      {/* 标题 */}
      <div className="p-4 border-b border-white/10">
        <h2 className="text-lg font-bold gradient-text">知识图谱</h2>
        <p className="text-xs text-gray-500 mt-1">Knowledge Graph Explorer</p>
      </div>

      {/* 操作按钮 */}
      <div className="p-4 border-b border-white/10 space-y-2">
        <button
          onClick={() => onExtract(false)}
          disabled={isRunning}
          className={`w-full py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
            isRunning
              ? 'bg-indigo-500/20 text-indigo-300 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white btn-glow'
          }`}
        >
          {isRunning ? '抽取进行中...' : '增量抽取'}
        </button>
        <button
          onClick={() => onExtract(true)}
          disabled={isRunning}
          className={`w-full py-2 px-4 rounded-lg text-xs font-medium transition-all ${
            isRunning
              ? 'bg-white/5 text-gray-600 cursor-not-allowed'
              : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white'
          }`}
        >
          全量重新抽取
        </button>

        {/* 抽取状态面板：只要有过抽取操作就始终显示 */}
        {progress && progress.status !== 'idle' && (
          <div className="mt-2 bg-white/5 rounded-lg p-2.5 space-y-2">
            {/* 状态标题行 */}
            <div className="flex items-center gap-2">
              {progress.status === 'running' && (
                <>
                  <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                  <span className="text-[11px] text-indigo-300 font-medium">抽取进行中</span>
                </>
              )}
              {progress.status === 'completed' && (
                <>
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-[11px] text-emerald-400 font-medium">抽取完成</span>
                </>
              )}
              {progress.status === 'error' && (
                <>
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                  <span className="text-[11px] text-red-400 font-medium">抽取失败</span>
                </>
              )}
              {progress.totalDocuments > 0 && (
                <span className="text-[10px] text-gray-500 ml-auto">
                  {progress.processedDocuments}/{progress.totalDocuments} 文档
                </span>
              )}
            </div>

            {/* 进度条 */}
            {progress.totalDocuments > 0 && (
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    progress.status === 'completed'
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                      : progress.status === 'error'
                      ? 'bg-gradient-to-r from-red-500 to-red-400'
                      : 'bg-gradient-to-r from-indigo-500 to-purple-500'
                  }`}
                  style={{
                    width: `${progress.totalDocuments > 0 ? (progress.processedDocuments / progress.totalDocuments) * 100 : 0}%`,
                  }}
                />
              </div>
            )}

            {/* 详细信息 */}
            {progress.message && (
              <p className={`text-[10px] truncate ${
                progress.status === 'completed' ? 'text-emerald-400/70' :
                progress.status === 'error' ? 'text-red-400/70' :
                'text-gray-500'
              }`}>
                {progress.message}
              </p>
            )}

            {/* 当前正在处理的文档 */}
            {progress.status === 'running' && progress.currentDocument && (
              <p className="text-[10px] text-indigo-300/60 truncate">
                📄 {progress.currentDocument}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Tab 切换 */}
      <div className="flex border-b border-white/10">
        {(['stats', 'nodes', 'detail'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-xs font-medium transition-all ${
              activeTab === tab
                ? 'text-indigo-400 border-b-2 border-indigo-400'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab === 'stats' ? '统计' : tab === 'nodes' ? '实体' : '详情'}
          </button>
        ))}
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'stats' && (
          <div className="p-4 space-y-4">
            {/* 概览数据 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-indigo-400">{nodes.length}</div>
                <div className="text-[10px] text-gray-500">实体数量</div>
              </div>
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-purple-400">{links.length}</div>
                <div className="text-[10px] text-gray-500">关系数量</div>
              </div>
            </div>

            {/* 类型分布 */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 mb-2">类型分布</h3>
              <div className="space-y-1.5">
                {Object.entries(typeStats)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, count]) => (
                    <div key={type} className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: getNodeColor(type) }}
                      />
                      <span className="text-xs text-gray-400 flex-1">{type}</span>
                      <span className="text-xs text-gray-600">{count}</span>
                      <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(count / nodes.length) * 100}%`,
                            backgroundColor: getNodeColor(type),
                          }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Top 节点 */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 mb-2">核心实体 Top 10</h3>
              <div className="space-y-1">
                {[...nodes]
                  .sort((a, b) => b.weight - a.weight)
                  .slice(0, 10)
                  .map((node, i) => (
                    <button
                      key={node.id}
                      onClick={() => {
                        onNodeSelect(node.id);
                        setActiveTab('detail');
                      }}
                      className="w-full flex items-center gap-2 p-1.5 rounded hover:bg-white/5 transition-colors text-left"
                    >
                      <span className="text-[10px] text-gray-600 w-4">{i + 1}</span>
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: getNodeColor(node.type) }}
                      />
                      <span className="text-xs text-gray-300 flex-1 truncate">
                        {node.name}
                      </span>
                      <span className="text-[10px] text-gray-600">{node.weight}</span>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'nodes' && (
          <div className="p-4">
            {/* 搜索 */}
            <div className="relative mb-3">
              <input
                type="text"
                placeholder="搜索实体..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/50"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs"
                >
                  ×
                </button>
              )}
            </div>

            <div className="text-[10px] text-gray-600 mb-2">
              共 {sortedNodes.length} 个实体
            </div>

            {/* 节点列表 */}
            <div className="space-y-0.5">
              {sortedNodes.map((node) => (
                <button
                  key={node.id}
                  onClick={() => {
                    onNodeSelect(node.id === selectedNodeId ? null : node.id);
                    if (node.id !== selectedNodeId) setActiveTab('detail');
                  }}
                  className={`w-full flex items-center gap-2 p-2 rounded-lg transition-colors text-left ${
                    selectedNodeId === node.id
                      ? 'bg-indigo-500/20 border border-indigo-500/30'
                      : 'hover:bg-white/5'
                  }`}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: getNodeColor(node.type),
                      boxShadow:
                        selectedNodeId === node.id
                          ? `0 0 8px ${getNodeColor(node.type)}`
                          : 'none',
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-200 truncate">{node.name}</div>
                    <div className="text-[10px] text-gray-600">{node.type}</div>
                  </div>
                  <span className="text-[10px] text-gray-600 flex-shrink-0">
                    ×{node.weight}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'detail' && (
          <div className="p-4">
            {selectedNode ? (
              <div className="space-y-4">
                {/* 节点信息 */}
                <div className="bg-white/5 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{
                        backgroundColor: getNodeColor(selectedNode.type),
                        boxShadow: `0 0 12px ${getNodeColor(selectedNode.type)}`,
                      }}
                    />
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        {selectedNode.name}
                      </h3>
                      <span className="text-[10px] text-gray-500">
                        {selectedNode.type}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="bg-black/20 rounded p-2">
                      <div className="text-gray-500">权重</div>
                      <div className="text-indigo-400 font-bold">{selectedNode.weight}</div>
                    </div>
                    <div className="bg-black/20 rounded p-2">
                      <div className="text-gray-500">关联文档</div>
                      <div className="text-purple-400 font-bold">
                        {selectedNode.sourceDocuments.length}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 关联关系 */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 mb-2">
                    关联关系 ({connectedLinks.length})
                  </h4>
                  <div className="space-y-1">
                    {connectedLinks.map((link, i) => {
                      const sourceId =
                        typeof link.source === 'string'
                          ? link.source
                          : link.source.id;
                      const targetId =
                        typeof link.target === 'string'
                          ? link.target
                          : link.target.id;
                      const sourceName =
                        typeof link.source === 'string'
                          ? nodes.find((n) => n.id === link.source)?.name || link.source
                          : link.source.name;
                      const targetName =
                        typeof link.target === 'string'
                          ? nodes.find((n) => n.id === link.target)?.name || link.target
                          : link.target.name;
                      const isSource = sourceId === selectedNodeId;
                      const otherName = isSource ? targetName : sourceName;
                      const otherId = isSource ? targetId : sourceId;

                      return (
                        <button
                          key={i}
                          onClick={() => onNodeSelect(otherId)}
                          className="w-full bg-white/5 rounded-lg p-2 text-left hover:bg-white/10 transition-colors"
                        >
                          <div className="flex items-center gap-1 text-[11px]">
                            <span className="text-indigo-300 truncate max-w-[80px]">
                              {isSource ? selectedNode.name : otherName}
                            </span>
                            <span className="text-yellow-400/80 flex-shrink-0">
                              →{link.relation}→
                            </span>
                            <span className="text-purple-300 truncate max-w-[80px]">
                              {isSource ? otherName : selectedNode.name}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  onClick={() => onNodeSelect(null)}
                  className="w-full py-1.5 text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
                >
                  取消选中
                </button>
              </div>
            ) : (
              <div className="text-center text-gray-600 text-xs py-8">
                <p>点击图谱中的节点</p>
                <p className="mt-1">查看详细信息</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 底部信息 */}
      <div className="p-3 border-t border-white/5 text-center">
        <p className="text-[9px] text-gray-700">
          Powered by Coze + LLM Knowledge Extraction
        </p>
      </div>
    </div>
  );
}
