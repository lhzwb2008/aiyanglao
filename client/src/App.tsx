import { useState, useEffect, useCallback, useRef } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import KnowledgeGraph3D from './components/KnowledgeGraph3D';
import StatsPanel from './components/StatsPanel';
import {
  getGraphData,
  triggerExtraction,
  getExtractionProgress,
  GraphData,
  ExtractionProgress,
} from './services/api';
import { GraphNode, GraphLink } from './types';

function App() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<ExtractionProgress | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showPanel, setShowPanel] = useState(true);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 加载图谱数据
  const loadGraphData = useCallback(async () => {
    try {
      const data: GraphData = await getGraphData();
      setNodes(data.nodes || []);
      setLinks(data.links || []);
    } catch (err: any) {
      console.error('Failed to load graph data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始加载
  useEffect(() => {
    loadGraphData();
    // 检查是否有正在进行的抽取
    getExtractionProgress().then((p) => {
      setProgress(p);
      if (p.status === 'running') {
        startPolling();
      }
    });
    return () => stopPolling();
  }, [loadGraphData]);

  // 轮询抽取进度
  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    pollingRef.current = setInterval(async () => {
      try {
        const p = await getExtractionProgress();
        setProgress(p);
        if (p.status !== 'running') {
          stopPolling();
          if (p.status === 'completed') {
            toast.success('知识抽取完成！');
            loadGraphData();
          } else if (p.status === 'error') {
            toast.error(`抽取失败: ${p.message}`);
          }
        } else {
          // 抽取中也刷新数据（实时看到图谱增长）
          loadGraphData();
        }
      } catch {
        // ignore polling errors
      }
    }, 3000);
  }, [loadGraphData]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // 触发抽取
  const handleExtract = useCallback(
    async (forceRefresh: boolean) => {
      try {
        const result = await triggerExtraction(forceRefresh);
        toast.success(result.message || '抽取任务已启动');
        setProgress(result.progress);
        startPolling();
      } catch (err: any) {
        toast.error(`启动失败: ${err.message}`);
      }
    },
    [startPolling]
  );

  // 节点点击
  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNodeId((prev) => (prev === node.id ? null : node.id));
    setShowPanel(true);
  }, []);

  return (
    <div className="w-full h-screen bg-gradient-to-br from-slate-950 via-indigo-950/30 to-slate-950 flex overflow-hidden">
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: 'rgba(15, 10, 40, 0.95)',
            color: '#fff',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            backdropFilter: 'blur(10px)',
            fontSize: '13px',
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#fff' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#fff' },
          },
        }}
      />

      {/* 主图谱区域 */}
      <div className="flex-1 relative">
        {/* 顶部标题 */}
        <div className="absolute top-0 left-0 right-0 z-10 p-4 pointer-events-none">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold gradient-text pointer-events-auto">
                Knowledge Graph
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {nodes.length > 0
                  ? `${nodes.length} 个实体 · ${links.length} 个关系`
                  : '暂无数据，请先执行知识抽取'}
              </p>
            </div>
            <button
              onClick={() => setShowPanel(!showPanel)}
              className="pointer-events-auto bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-all"
            >
              {showPanel ? '隐藏面板' : '显示面板'}
            </button>
          </div>
        </div>

        {/* 加载中 */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <div className="text-center">
              <div className="w-12 h-12 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-gray-400 text-sm mt-4">加载知识图谱...</p>
            </div>
          </div>
        )}

        {/* 空状态 */}
        {!loading && nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-center glass rounded-2xl p-8 max-w-md animate-fade-in">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-indigo-500/10 flex items-center justify-center animate-pulse-glow">
                <svg
                  className="w-10 h-10 text-indigo-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">知识图谱为空</h2>
              <p className="text-gray-400 text-sm mb-6">
                点击右侧面板的「增量抽取」按钮，从知识库文档中抽取实体关系
              </p>
              <div className="flex justify-center">
                <button
                  onClick={() => {
                    setShowPanel(true);
                    handleExtract(false);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-lg text-sm font-medium btn-glow transition-all"
                >
                  开始抽取
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2D 知识图谱 */}
        {!loading && nodes.length > 0 && (
          <KnowledgeGraph3D
            nodes={nodes}
            links={links}
            onNodeClick={handleNodeClick}
            highlightNodeId={selectedNodeId}
            focusNodeId={selectedNodeId}
          />
        )}

        {/* 星空背景粒子效果（CSS） */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
          {Array.from({ length: 50 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-0.5 h-0.5 bg-white rounded-full animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                opacity: Math.random() * 0.3 + 0.1,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${Math.random() * 3 + 2}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* 右侧面板 */}
      {showPanel && (
        <StatsPanel
          nodes={nodes}
          links={links}
          progress={progress}
          onExtract={handleExtract}
          onNodeSelect={setSelectedNodeId}
          selectedNodeId={selectedNodeId}
        />
      )}
    </div>
  );
}

export default App;
