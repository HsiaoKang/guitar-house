/**
 * 滑块样式：appearance:none 全自绘
 *
 * 轨道用双色渐变绘制已填充进度（fillVar 由组件注入百分比），
 * thumb 用伪元素统一绘制，三端 WebView 渲染完全一致。
 */
import { createVar, style } from "@vanilla-extract/css";
import { vars } from "../theme/contract.css";

/** 已填充进度百分比（如 "35%"） */
export const fillVar = createVar();

const thumb = {
  appearance: "none",
  WebkitAppearance: "none",
  width: "14px",
  height: "14px",
  borderRadius: "50%",
  background: vars.color.accent,
  border: "none",
  cursor: "pointer",
  transition: "transform 0.1s",
} as const;

export const slider = style({
  appearance: "none",
  WebkitAppearance: "none",
  height: "4px",
  borderRadius: "2px",
  background: `linear-gradient(to right, ${vars.color.accent} ${fillVar}, ${vars.color.panel2} ${fillVar})`,
  cursor: "pointer",
  vars: {
    [fillVar]: "0%",
  },
  selectors: {
    "&::-webkit-slider-thumb": thumb,
    "&::-webkit-slider-thumb:hover": {
      transform: "scale(1.15)",
    },
    "&:disabled": {
      opacity: 0.4,
      cursor: "not-allowed",
    },
  },
});
