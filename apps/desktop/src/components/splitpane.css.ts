/**
 * 左右分割布局样式
 */
import { style } from "@vanilla-extract/css";
import { vars } from "@learning-house/ui";

export const splitPane = style({
  display: "flex",
  height: "100%",
});

export const splitLeft = style({
  minWidth: 0,
  flexShrink: 0,
});

export const splitRight = style({
  flex: 1,
  minWidth: 0,
});

export const splitDivider = style({
  width: "5px",
  cursor: "col-resize",
  background: vars.color.border,
  flexShrink: 0,
  transition: "background 0.15s",
  selectors: {
    "&:hover": {
      background: vars.color.accent,
    },
  },
});
