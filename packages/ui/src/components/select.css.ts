/**
 * 下拉选择样式：收起态自绘，弹层保留系统渲染
 */
import { style } from "@vanilla-extract/css";
import { vars } from "../theme/contract.css";

export const selectWrap = style({
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
});

export const selectEl = style({
  appearance: "none",
  WebkitAppearance: "none",
  background: vars.color.panel2,
  border: `1px solid ${vars.color.border}`,
  color: vars.color.text,
  borderRadius: vars.radius.md,
  padding: "5px 26px 5px 8px",
  fontSize: vars.font.size.md,
  cursor: "pointer",
  maxWidth: "100%",
  selectors: {
    "&:hover:not(:disabled)": {
      borderColor: vars.color.borderStrong,
    },
    "&:disabled": {
      opacity: 0.45,
      cursor: "not-allowed",
    },
  },
});

export const selectArrow = style({
  position: "absolute",
  right: "7px",
  pointerEvents: "none",
  color: vars.color.textDim,
  display: "inline-flex",
});
