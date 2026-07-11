/**
 * 左右分割布局
 *
 * 中间分隔条可拖拽调整左右面板宽度比例。
 * 拖动中用 rAF 合帧直改 DOM flexBasis（零 React 重渲染），
 * 两侧内容实时跟随（即时反馈原则）；昂贵内容的精绘由各渲染器
 * 自身防抖（如 PDF 虚拟化 + CSS 即时拉伸 + 停顿精绘）
 */
import { useCallback, useRef, useState, type ReactNode } from "react";

interface SplitPaneProps {
  left: ReactNode;
  right: ReactNode;
  /** 左面板初始占比（0-1） */
  initialRatio?: number;
}

/** 拖动占比范围 */
const MIN_RATIO = 0.2;
const MAX_RATIO = 0.8;

/**
 * 可拖拽分割面板组件
 *
 * @param props left/right 两侧内容；initialRatio 左侧初始占比
 */
export function SplitPane({ left, right, initialRatio = 0.55 }: SplitPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const leftPaneRef = useRef<HTMLDivElement | null>(null);
  const [ratio, setRatio] = useState(initialRatio);
  const [dragging, setDragging] = useState(false);

  /**
   * 按下分隔条：rAF 合帧直改容器占比，两侧内容实时跟随，松手提交 state
   */
  const onDividerPointerDown = useCallback((e: React.PointerEvent) => {
    const container = containerRef.current;
    const leftPane = leftPaneRef.current;
    if (!container || !leftPane) return;
    const rect = container.getBoundingClientRect();
    let latest = (e.clientX - rect.left) / rect.width;
    let frame = 0;
    setDragging(true);

    const apply = () => {
      frame = 0;
      leftPane.style.flexBasis = `${latest * 100}%`;
    };
    const move = (ev: PointerEvent) => {
      latest = Math.min(MAX_RATIO, Math.max(MIN_RATIO, (ev.clientX - rect.left) / rect.width));
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (frame) cancelAnimationFrame(frame);
      apply();
      setDragging(false);
      setRatio(latest);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    e.preventDefault();
  }, []);

  return (
    <div className="flex h-full" ref={containerRef} style={dragging ? { cursor: "col-resize" } : undefined}>
      <div
        ref={leftPaneRef}
        className="min-w-0 shrink-0 overflow-hidden"
        style={{ flexBasis: `${ratio * 100}%`, pointerEvents: dragging ? "none" : undefined }}
      >
        {left}
      </div>
      <div
        className="w-[5px] shrink-0 cursor-col-resize bg-border transition-colors hover:bg-primary"
        onPointerDown={onDividerPointerDown}
      />
      <div className="min-w-0 flex-1 overflow-hidden" style={{ pointerEvents: dragging ? "none" : undefined }}>
        {right}
      </div>
    </div>
  );
}
