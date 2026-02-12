import { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { GraphNode, GraphLink, getNodeColor, NODE_TYPE_COLORS } from '../types';

interface Props {
  nodes: GraphNode[];
  links: GraphLink[];
  onNodeClick?: (node: GraphNode) => void;
  highlightNodeId?: string | null;
  focusNodeId?: string | null;
}

export default function KnowledgeGraph3D({
  nodes,
  links,
  onNodeClick,
  highlightNodeId,
  focusNodeId,
}: Props) {
  const fgRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const prevFocusRef = useRef<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // 响应式尺寸
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // 节点大小
  const getNodeSize = useCallback((node: GraphNode) => {
    return Math.max(4, Math.min(14, node.weight * 1.5 + 3));
  }, []);

  // 活跃节点集合
  const activeNodeId = focusNodeId || highlightNodeId || hoveredNode;

  const connectedNodes = useMemo(() => {
    if (!activeNodeId) return new Set<string>();
    const connected = new Set<string>();
    connected.add(activeNodeId);
    links.forEach((link) => {
      const sId = typeof link.source === 'string' ? link.source : link.source?.id;
      const tId = typeof link.target === 'string' ? link.target : link.target?.id;
      if (sId === activeNodeId) connected.add(tId);
      if (tId === activeNodeId) connected.add(sId);
    });
    return connected;
  }, [activeNodeId, links]);

  // ============ 轻量节点绘制 ============
  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const size = getNodeSize(node);
    const color = getNodeColor(node.type);
    const isActive = node.id === activeNodeId;
    const isConnected = connectedNodes.has(node.id);
    const dimmed = activeNodeId && !isConnected;

    const x = node.x || 0;
    const y = node.y || 0;

    ctx.save();
    ctx.globalAlpha = dimmed ? 0.15 : 1;

    // 选中节点加一圈光晕（只有选中时才画，开销极小）
    if (isActive) {
      ctx.beginPath();
      ctx.arc(x, y, size * 2, 0, Math.PI * 2);
      ctx.fillStyle = color + '25';
      ctx.fill();
    }

    // 主体圆
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fillStyle = color + (isActive ? 'ee' : 'bb');
    ctx.fill();
    ctx.strokeStyle = isActive ? '#ffffff' : color;
    ctx.lineWidth = isActive ? 1.5 : 0.5;
    ctx.stroke();

    // 文字标签（分级显示）
    const showLabel = isActive || isConnected || node.weight >= 3 || globalScale > 1.5;
    if (showLabel) {
      const fontSize = Math.max(2.5, Math.min(4.5, 11 / globalScale));
      let label = node.name;
      if (label.length > 8 && globalScale < 1.2) label = label.substring(0, 7) + '…';
      else if (label.length > 12) label = label.substring(0, 11) + '…';

      ctx.font = `600 ${fontSize}px "Noto Sans SC", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      // 文字背景
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(5, 5, 20, 0.65)';
      ctx.fillRect(x - tw / 2 - 1.5, y + size + 1, tw + 3, fontSize + 2);

      ctx.fillStyle = isActive ? '#ffffff' : (dimmed ? '#555' : '#d0d0e0');
      ctx.fillText(label, x, y + size + 2);
    }

    ctx.restore();
  }, [getNodeSize, activeNodeId, connectedNodes]);

  // ============ 连线颜色（用内置渲染，不自定义 Canvas） ============
  const linkColor = useCallback((link: any) => {
    if (!activeNodeId) return 'rgba(255, 255, 255, 0.2)';
    const sId = typeof link.source === 'object' ? link.source.id : link.source;
    const tId = typeof link.target === 'object' ? link.target.id : link.target;
    const isHighlighted = connectedNodes.has(sId) && connectedNodes.has(tId);
    if (isHighlighted) return 'rgba(255, 255, 255, 0.75)';
    return 'rgba(255, 255, 255, 0.04)';
  }, [activeNodeId, connectedNodes]);

  const linkWidth = useCallback((link: any) => {
    if (!activeNodeId) return 0.5;
    const sId = typeof link.source === 'object' ? link.source.id : link.source;
    const tId = typeof link.target === 'object' ? link.target.id : link.target;
    const isHighlighted = connectedNodes.has(sId) && connectedNodes.has(tId);
    return isHighlighted ? 1.5 : 0.3;
  }, [activeNodeId, connectedNodes]);

  // 节点点击
  const handleNodeClick = useCallback((node: any) => {
    if (onNodeClick) onNodeClick(node as GraphNode);
  }, [onNodeClick]);

  // 飞向指定节点
  const flyToNode = useCallback((nodeId: string) => {
    if (!fgRef.current || typeof fgRef.current.graphData !== 'function') return;
    const gd = fgRef.current.graphData();
    const target = gd?.nodes?.find((n: any) => n.id === nodeId);
    if (!target) return;
    fgRef.current.centerAt(target.x, target.y, 1000);
    fgRef.current.zoom(4, 1000);
  }, []);

  // 外部 focusNodeId 变化 -> 飞到节点
  useEffect(() => {
    if (!focusNodeId) {
      if (prevFocusRef.current) {
        prevFocusRef.current = null;
        setTimeout(() => {
          if (fgRef.current && typeof fgRef.current.zoomToFit === 'function') {
            fgRef.current.zoomToFit(800, 40);
          }
        }, 300);
      }
      return;
    }
    if (focusNodeId === prevFocusRef.current) return;
    prevFocusRef.current = focusNodeId;
    flyToNode(focusNodeId);
  }, [focusNodeId, flyToNode]);

  // 初始化：力参数
  useEffect(() => {
    if (!fgRef.current || nodes.length === 0) return;
    if (typeof fgRef.current.d3Force !== 'function') return;

    const fg = fgRef.current;

    fg.d3Force('link')?.distance(15);
    fg.d3Force('charge')?.strength(-30).distanceMax(60);
    fg.d3Force('center')?.strength(0.4);

    // 轻量漫游力
    fg.d3Force('wander', () => {
      if (typeof fg.graphData !== 'function') return;
      const gd = fg.graphData();
      if (!gd?.nodes) return;

      let cx = 0, cy = 0;
      for (const n of gd.nodes) { cx += (n.x || 0); cy += (n.y || 0); }
      cx /= gd.nodes.length || 1;
      cy /= gd.nodes.length || 1;
      const boundaryR = Math.max(100, gd.nodes.length * 0.5);

      for (const node of gd.nodes) {
        if ((node as any).fx != null) continue;
        if ((node as any).__wa == null) (node as any).__wa = Math.random() * Math.PI * 2;

        (node as any).__wa += (Math.random() - 0.5) * 0.02;
        let a = (node as any).__wa;

        const dx = (node.x || 0) - cx;
        const dy = (node.y || 0) - cy;
        if (dx * dx + dy * dy > boundaryR * boundaryR) {
          a = (node as any).__wa = Math.atan2(-dy, -dx) + (Math.random() - 0.5) * 0.5;
        }

        (node as any).vx = ((node as any).vx || 0) + Math.cos(a) * 0.03;
        (node as any).vy = ((node as any).vy || 0) + Math.sin(a) * 0.03;
      }
    });

    // 初始视角
    setTimeout(() => {
      fg.zoomToFit?.(800, 60);
      setTimeout(() => {
        const z = fg.zoom?.();
        if (z && z < 1.5) fg.zoom?.(Math.max(z * 1.8, 1.2), 600);
      }, 900);
    }, 600);
  }, [nodes.length]);

  // 增量合并图谱数据
  const nodeMapRef = useRef<Map<string, any>>(new Map());
  const prevNodeCountRef = useRef(0);
  const [graphData, setGraphData] = useState<{ nodes: any[]; links: any[] }>({ nodes: [], links: [] });

  useEffect(() => {
    if (nodes.length === 0 && links.length === 0) return;

    const existingMap = nodeMapRef.current;
    const mergedNodes: any[] = [];

    for (const n of nodes) {
      const existing = existingMap.get(n.id);
      if (existing) {
        Object.assign(existing, { name: n.name, type: n.type, weight: n.weight, sourceDocuments: n.sourceDocuments });
        mergedNodes.push(existing);
      } else {
        const newNode = { ...n };
        existingMap.set(n.id, newNode);
        mergedNodes.push(newNode);
      }
    }

    const currentIds = new Set(nodes.map(n => n.id));
    for (const [id] of existingMap) {
      if (!currentIds.has(id)) existingMap.delete(id);
    }

    const newData = { nodes: mergedNodes, links: links.map(l => ({ ...l })) };
    setGraphData(newData);

    if (nodes.length > prevNodeCountRef.current) {
      setTimeout(() => {
        const fg = fgRef.current;
        if (!fg) return;
        fg.zoomToFit?.(600, 60);
        setTimeout(() => {
          const z = fg.zoom?.();
          if (z && z < 1.5) fg.zoom?.(Math.max(z * 1.8, 1.2), 400);
        }, 700);
      }, 300);
    }
    prevNodeCountRef.current = nodes.length;
  }, [nodes, links]);

  return (
    <div ref={containerRef} className="w-full h-full relative kg-background">
      <ForceGraph2D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeId="id"
        nodeCanvasObject={nodeCanvasObject}
        nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
          const size = getNodeSize(node);
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(node.x || 0, node.y || 0, size + 2, 0, Math.PI * 2);
          ctx.fill();
        }}
        linkColor={linkColor}
        linkWidth={linkWidth}
        onNodeClick={handleNodeClick}
        onNodeHover={(node: any) => setHoveredNode(node?.id || null)}
        backgroundColor="rgba(0,0,0,0)"
        enableNodeDrag={true}
        d3AlphaMin={0.05}
        d3AlphaDecay={0.01}
        d3VelocityDecay={0.35}
        warmupTicks={60}
        cooldownTicks={Infinity}
        cooldownTime={Infinity}
        minZoom={0.3}
        maxZoom={12}
      />

      {/* 图例 */}
      <div className="absolute bottom-4 left-4 glass rounded-xl p-3 max-w-xs">
        <h4 className="text-white text-[10px] font-semibold mb-1.5 opacity-60 uppercase tracking-wider">Entity Types</h4>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {Object.entries(NODE_TYPE_COLORS)
            .filter(([key]) => key !== 'default')
            .filter(([key]) => nodes.some(n => n.type === key))
            .map(([type, color]) => (
              <div key={type} className="flex items-center gap-1">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
                />
                <span className="text-[9px] text-gray-500">{type}</span>
              </div>
            ))}
        </div>
      </div>

      {/* 操作提示 */}
      <div className="absolute bottom-4 right-4 text-[9px] text-gray-700 pointer-events-none">
        滚轮缩放 · 拖拽平移 · 拖拽节点 · 悬停/点击节点聚焦
      </div>
    </div>
  );
}
