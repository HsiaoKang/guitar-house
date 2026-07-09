/**
 * 滑块（自绘 range 控件）
 *
 * 保留原生 input[type=range] 的拖拽/键盘/无障碍行为，
 * 外观完全自绘：轨道渐变表现进度，thumb 统一圆点。
 */
import type { CSSProperties, InputHTMLAttributes } from "react";
import { assignInlineVars } from "@vanilla-extract/dynamic";
import { cx } from "../cx";
import { fillVar, slider } from "./slider.css";

export interface SliderProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "min" | "max" | "step" | "onChange"> {
  value: number;
  min: number;
  max: number;
  step?: number;
  /** 数值变化回调（已转为 number） */
  onChange: (value: number) => void;
  /** 轨道宽度（如 "140px" / "100%"），默认 140px */
  width?: CSSProperties["width"];
}

/**
 * 滑块组件
 *
 * @param props 见 SliderProps 字段说明
 */
export function Slider({ value, min, max, step, onChange, width = "140px", className, style, ...rest }: SliderProps) {
  const percent = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <input
      type="range"
      className={cx(slider, className)}
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ width, ...assignInlineVars({ [fillVar]: `${percent}%` }), ...style }}
      {...rest}
    />
  );
}
