/**
 * 音量控制（收纳式）
 *
 * 一个静音切换按钮 + hover 弹出的纵向音量条浮层；
 * 外部音量变化（如 ↑↓ 快捷键）通过 flashSignal 触发浮层短暂显示，
 * 把音量调节反馈到视觉上。
 */
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { IconButton, Slider, cn } from "@learning-house/ui";

/** 快捷键触发的浮层显示时长（毫秒） */
const FLASH_MS = 1200;

interface VolumeControlProps {
  /** 当前音量 0-1 */
  volume: number;
  /** 是否静音 */
  muted: boolean;
  /** 音量调整（0 时由调用方决定是否静音） */
  onVolumeChange: (volume: number) => void;
  /** 静音切换 */
  onToggleMute: () => void;
  /** 外部音量变化信号（每次变化递增），触发浮层短暂显示 */
  flashSignal?: number;
  /** 深色浮层变体（视频控制栏使用） */
  onDark?: boolean;
}

/**
 * 音量控制组件
 *
 * @param props 见 VolumeControlProps 字段说明
 */
export function VolumeControl(props: VolumeControlProps) {
  const { volume, muted, onVolumeChange, onToggleMute, flashSignal = 0, onDark } = props;
  const [hovering, setHovering] = useState(false);
  const [flashing, setFlashing] = useState(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 外部音量变化（快捷键等）时短暂点亮浮层
  useEffect(() => {
    if (flashSignal === 0) return;
    setFlashing(true);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlashing(false), FLASH_MS);
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, [flashSignal]);

  const open = hovering || flashing;
  const percent = Math.round((muted ? 0 : volume) * 100);

  return (
    <div
      className="relative flex items-center"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <IconButton
        name={muted || volume === 0 ? "volumeMute" : "volume"}
        label={muted ? "取消静音" : "静音"}
        size="sm"
        className={cn(onDark && "text-white hover:bg-white/15 hover:text-white")}
        onClick={onToggleMute}
      />
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.12 }}
            className={cn(
              "absolute bottom-full left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-1.5 rounded-md border px-2 py-2.5 pb-1.5 shadow-lg",
              onDark ? "border-white/15 bg-black/80 text-white backdrop-blur" : "border-border bg-popover",
            )}
          >
            <Slider
              orientation="vertical"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={onVolumeChange}
              aria-label="音量"
            />
            <span
              className={cn(
                "w-[3ch] text-center text-[10px] tabular-nums",
                onDark ? "text-white/80" : "text-muted-foreground",
              )}
            >
              {percent}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
