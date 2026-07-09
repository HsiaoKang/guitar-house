/**
 * Tap Tempo 浮窗样式
 */
import { style } from "@vanilla-extract/css";
import { vars } from "@learning-house/ui";

export const bpmDisplay = style({
  display: "flex",
  alignItems: "baseline",
  justifyContent: "center",
  gap: vars.space.sm,
  minHeight: "64px",
});

export const bpmValue = style({
  fontSize: "56px",
  fontWeight: 700,
  color: vars.color.accent,
  fontVariantNumeric: "tabular-nums",
  lineHeight: 1,
});

export const bpmUnit = style({
  fontSize: vars.font.size.lg,
  color: vars.color.textDim,
});

export const bpmHint = style({
  fontSize: vars.font.size.lg,
  color: vars.color.textDim,
  alignSelf: "center",
});

export const tapPad = style({
  height: "110px",
  width: "100%",
  border: `2px dashed ${vars.color.border}`,
  borderRadius: vars.radius.lg,
  background: vars.color.panel2,
  color: vars.color.textDim,
  fontSize: vars.font.size.xl,
  cursor: "pointer",
  transition: "background 0.08s, border-color 0.08s, color 0.08s",
  userSelect: "none",
  WebkitUserSelect: "none",
  selectors: {
    "&:hover": {
      borderColor: vars.color.accent,
      color: vars.color.text,
    },
    "&[data-flash='true']": {
      background: vars.color.accent,
      borderColor: vars.color.accentStrong,
      color: vars.color.accentContrast,
    },
  },
});

export const tapFooter = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
});

export const tapCount = style({
  fontSize: vars.font.size.sm,
  color: vars.color.textDim,
});

export const tapActions = style({
  display: "flex",
  gap: vars.space.sm,
});
