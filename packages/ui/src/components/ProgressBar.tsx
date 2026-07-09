/**
 * 进度条（课程学习进度）
 */
import { progressFill, progressTrack } from "./progress.css";

export interface ProgressBarProps {
  /** 进度百分比 0-100 */
  percent: number;
}

/**
 * 进度条组件
 *
 * @param props percent 进度百分比
 */
export function ProgressBar({ percent }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div className={progressTrack} role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
      <div className={progressFill} style={{ width: `${clamped}%` }} />
    </div>
  );
}
