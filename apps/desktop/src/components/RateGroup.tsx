/**
 * 倍速档位按钮组（视频与音频共用）
 */
import { rateBtn, rateGroup } from "./videoplayer.css";

/** 可选倍速档位（慢速练习是核心场景） */
export const PLAYBACK_RATES = [0.5, 0.65, 0.75, 0.85, 1, 1.25, 1.5];

interface RateGroupProps {
  /** 当前倍速 */
  value: number;
  /** 切换倍速 */
  onChange: (rate: number) => void;
}

/**
 * 倍速按钮组组件
 *
 * @param props value 当前倍速；onChange 切换回调
 */
export function RateGroup({ value, onChange }: RateGroupProps) {
  return (
    <div className={rateGroup}>
      {PLAYBACK_RATES.map((rate) => (
        <button key={rate} className={rateBtn} data-active={rate === value ? "true" : undefined} onClick={() => onChange(rate)}>
          {rate}x
        </button>
      ))}
    </div>
  );
}
