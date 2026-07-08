/**
 * 左右分割布局
 *
 * 中间分隔条可拖拽调整左右面板宽度比例。
 *
 * @author yuchenxi
 */
import { useCallback, useRef, useState, type ReactNode } from "react";

interface SplitPaneProps {
  left: ReactNode;
  right: ReactNode;
  /** 左面板初始占比（0-1） */
  initialRatio?: number;
}

/**
 * 可拖拽分割面板组件
 *
 * @param props left/right 两侧内容；initialRatio 左侧初始占比
 */
export function SplitPane({ left, right, initialRatio = 0.55 }: SplitPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [ratio, setRatio] = useState(initialRatio);

  /**
   * 按下分隔条后跟踪指针移动，把横向位置换算为占比
   */
  const onDividerPointerDown = useCallback((e: React.PointerEvent) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const move = (ev: PointerEvent) => {
      const next = (ev.clientX - rect.left) / rect.width;
      setRatio(Math.min(0.8, Math.max(0.2, next)));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    e.preventDefault();
  }, []);

  return (
    <div className="split-pane" ref={containerRef}>
      <div className="split-left" style={{ flexBasis: `${ratio * 100}%` }}>
        {left}
      </div>
      <div className="split-divider" onPointerDown={onDividerPointerDown} />
      <div className="split-right">{right}</div>
    </div>
  );
}
