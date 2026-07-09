/**
 * 复选框样式：input 隐藏，勾选框自绘
 */
import { style } from "@vanilla-extract/css";
import { vars } from "../theme/contract.css";

export const checkboxLabel = style({
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  fontSize: vars.font.size.md,
  cursor: "pointer",
  whiteSpace: "nowrap",
  selectors: {
    "&[data-disabled='true']": {
      opacity: 0.45,
      cursor: "not-allowed",
    },
  },
});

export const checkboxInput = style({
  position: "absolute",
  opacity: 0,
  width: "1px",
  height: "1px",
  pointerEvents: "none",
});

export const checkboxBox = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "16px",
  height: "16px",
  borderRadius: vars.radius.sm,
  border: `1px solid ${vars.color.border}`,
  background: vars.color.panel2,
  color: "transparent",
  transition: "background 0.12s, border-color 0.12s, color 0.12s",
  flexShrink: 0,
  selectors: {
    [`${checkboxInput}:checked + &`]: {
      background: vars.color.accent,
      borderColor: vars.color.accent,
      color: vars.color.accentContrast,
    },
    [`${checkboxInput}:focus-visible + &`]: {
      outline: `2px solid ${vars.color.accent}`,
      outlineOffset: "1px",
    },
  },
});
