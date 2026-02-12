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

  // 全局时钟，驱动所有动画
  const timeRef = useRef(0);
  useEffect(() => {
    let running = true;
    const tick = () => {
      if (!running) return;
      timeRef.current = performance.now() / 1000; // 秒
      requestAnimationFrame(tick);
    };
    tick();
    return () => { running = false; };
  }, []);

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
    return Math.max(4, Math.min(16, node.weight * 1.8 + 3));
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

  // ============ Canvas 绘制：动态科技感节点 ============
  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const size = getNodeSize(node);
    const color = getNodeColor(node.type);
    const isActive = node.id === activeNodeId;
    const isConnected = connectedNodes.has(node.id);
    const dimmed = activeNodeId && !isConnected;
    const t = timeRef.current;

    const x = node.x || 0;
    const y = node.y || 0;

    ctx.save();
    ctx.globalAlpha = dimmed ? 0.12 : 1;

    // === 呼吸光晕 ===
    if (!dimmed) {
      // 每个节点用自己的 hash 做相位偏移，避免同步闪烁
      const phase = (node.id?.charCodeAt(0) || 0) * 0.37;
      const breathe = 0.5 + 0.5 * Math.sin(t * 1.5 + phase);
      const glowR = isActive ? size * 3.5 : size * (1.8 + breathe * 0.6);
      const glowAlpha = isActive ? 0.35 : (0.08 + breathe * 0.12);

      const gradient = ctx.createRadialGradient(x, y, size * 0.2, x, y, glowR);
      gradient.addColorStop(0, color + Math.round(glowAlpha * 255).toString(16).padStart(2, '0'));
      gradient.addColorStop(1, color + '00');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, glowR, 0, Math.PI * 2);
      ctx.fill();
    }

    // === 主体：发光圆形 ===
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    // 径向渐变填充
    const bodyGrad = ctx.createRadialGradient(x - size * 0.3, y - size * 0.3, size * 0.1, x, y, size);
    bodyGrad.addColorStop(0, '#ffffff44');
    bodyGrad.addColorStop(0.4, color + (isActive ? 'ee' : 'bb'));
    bodyGrad.addColorStop(1, color + '66');
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // 边缘光
    ctx.strokeStyle = color;
    ctx.lineWidth = isActive ? 1.2 : 0.4;
    ctx.globalAlpha = dimmed ? 0.12 : (isActive ? 1 : 0.7);
    ctx.stroke();

    // === 选中节点：旋转虚线环 ===
    if (isActive) {
      ctx.globalAlpha = 0.6;
      const ringR = size * 1.8 + Math.sin(t * 2) * size * 0.2;
      ctx.beginPath();
      ctx.arc(x, y, ringR, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.6;
      ctx.setLineDash([4, 4]);
      ctx.lineDashOffset = -t * 20; // 旋转动画
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    // === 文字标签 ===
    ctx.globalAlpha = dimmed ? 0.12 : 1;
    const fontSize = Math.max(3, Math.min(5, 12 / globalScale));
    let label = node.name;
    if (label.length > 10) label = label.substring(0, 9) + '…';

    ctx.font = `600 ${fontSize}px "Noto Sans SC", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillText(label, x + 0.3, y + size + 2.3);
    // 正文
    ctx.fillStyle = isActive ? '#ffffff' : (dimmed ? '#555' : '#c8c8d8');
    ctx.fillText(label, x, y + size + 2);

    ctx.restore();
  }, [getNodeSize, activeNodeId, connectedNodes]);

  // ============ Canvas 绘制：动态连线 + 流动粒子 ============
  const linkCanvasObject = useCallback((link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const sId = typeof link.source === 'object' ? link.source.id : link.source;
    const tId = typeof link.target === 'object' ? link.target.id : link.target;
    const isHighlighted = activeNodeId && connectedNodes.has(sId) && connectedNodes.has(tId);
    const dimmed = activeNodeId && !isHighlighted;
    const t = timeRef.current;

    const sx = link.source.x || 0;
    const sy = link.source.y || 0;
    const tx = link.target.x || 0;
    const ty = link.target.y || 0;

    ctx.save();

    // === 连线 ===
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(tx, ty);

    if (isHighlighted) {
      ctx.strokeStyle = 'rgba(160, 140, 255, 0.7)';
      ctx.lineWidth = Math.max(1, link.weight * 0.6);
    } else if (dimmed) {
      ctx.strokeStyle = 'rgba(80, 80, 140, 0.04)';
      ctx.lineWidth = 0.2;
    } else {
      // 默认连线也有微弱脉动
      const pulse = 0.12 + 0.06 * Math.sin(t * 0.8 + (link.source.x || 0) * 0.01);
      ctx.strokeStyle = `rgba(100, 100, 200, ${pulse})`;
      ctx.lineWidth = 0.4;
    }
    ctx.stroke();

    // === 流动粒子（所有可见连线都有，高亮的更明显） ===
    if (!dimmed) {
      const speed = isHighlighted ? 0.4 : 0.15;
      const particleCount = isHighlighted ? 2 : 1;
      const particleSize = isHighlighted ? 1.5 : 0.8;
      const particleAlpha = isHighlighted ? 0.9 : 0.3;

      for (let p = 0; p < particleCount; p++) {
        const offset = p / particleCount;
        const progress = ((t * speed + offset + (link.source.x || 0) * 0.001) % 1 + 1) % 1;
        const px = sx + (tx - sx) * progress;
        const py = sy + (ty - sy) * progress;

        ctx.beginPath();
        ctx.arc(px, py, particleSize, 0, Math.PI * 2);
        ctx.fillStyle = isHighlighted
          ? `rgba(180, 160, 255, ${particleAlpha})`
          : `rgba(130, 130, 220, ${particleAlpha})`;
        ctx.fill();
      }
    }

    // === 关系标签（仅高亮连线 + 缩放足够大时） ===
    if (isHighlighted && globalScale > 1.5) {
      const midX = (sx + tx) / 2;
      const midY = (sy + ty) / 2;
      const fontSize = Math.max(2.5, 8 / globalScale);
      ctx.font = `${fontSize}px "Noto Sans SC", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(200, 190, 255, 0.85)';
      ctx.fillText(link.relation || '', midX, midY - 2);
    }

    ctx.restore();
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

  // 初始化：力参数 + 持续动态
  useEffect(() => {
    if (!fgRef.current || nodes.length === 0) return;
    if (typeof fgRef.current.d3Force !== 'function') return;

    const fg = fgRef.current;

    // 力布局参数
    fg.d3Force('link')?.distance(30);
    fg.d3Force('charge')?.strength(-50);
    fg.d3Force('center')?.strength(0.05); // 很弱的居中力，避免拉回原点

    // 初始全图视角
    setTimeout(() => {
      fg.zoomToFit?.(800, 40);
    }, 600);
  }, [nodes.length]);

  // 图谱数据
  const graphData = useMemo(() => ({
    nodes: nodes.map(n => ({ ...n })),
    links: links.map(l => ({ ...l })),
  }), [nodes, links]);

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
        linkCanvasObject={linkCanvasObject}
        onNodeClick={handleNodeClick}
        onNodeHover={(node: any) => setHoveredNode(node?.id || null)}
        backgroundColor="rgba(0,0,0,0)"
        enableNodeDrag={true}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
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
