/**
 * 音频播放条样式
 */
import { style } from "@vanilla-extract/css";
import { vars } from "@learning-house/ui";

export const audioBar = style({
  display: "flex",
  alignItems: "center",
  gap: vars.space.sm,
  height: "46px",
  padding: `0 ${vars.space.md}`,
  background: vars.color.panel2,
  borderTop: `1px solid ${vars.color.border}`,
  flexShrink: 0,
  overflowX: "auto",
});

/** "音频" 标签徽章 */
export const audioTag = style({
  fontSize: vars.font.size.sm,
  fontWeight: 600,
  color: vars.color.accent,
  border: `1px solid ${vars.color.accent}`,
  borderRadius: vars.radius.sm,
  padding: "1px 6px",
  flexShrink: 0,
});

export const audioTime = style({
  fontSize: vars.font.size.sm,
  color: vars.color.textDim,
  fontVariantNumeric: "tabular-nums",
  flexShrink: 0,
});

export const audioProgress = style({
  flex: 1,
  minWidth: "120px",
});

export const audioName = style({
  flex: "0 1 auto",
  maxWidth: "200px",
});

/** 控件间的小组 */
export const controlGroup = style({
  display: "flex",
  alignItems: "center",
  gap: vars.space.sm,
  flexShrink: 0,
});

export const controlLabel = style({
  fontSize: vars.font.size.sm,
  color: vars.color.textDim,
});
