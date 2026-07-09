/**
 * 进度条样式
 */
import { style } from "@vanilla-extract/css";
import { vars } from "../theme/contract.css";

export const progressTrack = style({
  height: "6px",
  background: vars.color.panel2,
  borderRadius: "3px",
  overflow: "hidden",
});

export const progressFill = style({
  height: "100%",
  background: vars.color.accent,
  borderRadius: "3px",
  transition: "width 0.3s",
});
