/**
 * 底部工具栏样式
 */
import { style } from "@vanilla-extract/css";
import { vars } from "@learning-house/ui";

export const toolBar = style({
  display: "flex",
  alignItems: "center",
  background: vars.color.panel,
  borderTop: `1px solid ${vars.color.border}`,
  flexShrink: 0,
});

export const toolSwitcher = style({
  display: "flex",
  alignItems: "center",
  gap: vars.space.sm,
  padding: `0 ${vars.space.md}`,
  height: "56px",
  borderRight: `1px solid ${vars.color.border}`,
  flexShrink: 0,
});

export const toolPanel = style({
  flex: 1,
  minWidth: 0,
});

export const toolEmptyHint = style({
  display: "block",
  padding: `0 ${vars.space.md}`,
  color: vars.color.textDim,
  fontSize: vars.font.size.md,
});

export const toolLabel = style({
  fontSize: vars.font.size.sm,
  color: vars.color.textDim,
});
