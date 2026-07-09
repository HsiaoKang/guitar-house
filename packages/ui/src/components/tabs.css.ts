/**
 * 资源 tab 样式
 */
import { style } from "@vanilla-extract/css";
import { vars } from "../theme/contract.css";

export const tabList = style({
  flex: 1,
  minWidth: 0,
  display: "flex",
  gap: vars.space.xs,
  overflowX: "auto",
});

export const tabItem = style({
  border: "1px solid transparent",
  background: "transparent",
  color: vars.color.textDim,
  fontSize: vars.font.size.sm,
  padding: "4px 10px",
  borderRadius: "5px",
  cursor: "pointer",
  whiteSpace: "nowrap",
  maxWidth: "180px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  transition: "background 0.12s, color 0.12s",
  selectors: {
    "&:hover": {
      color: vars.color.text,
      background: vars.color.panel2,
    },
    "&[data-active='true']": {
      color: vars.color.accent,
      background: vars.color.panel2,
      borderColor: vars.color.border,
    },
  },
});
