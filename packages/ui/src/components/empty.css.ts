/**
 * 空态样式
 */
import { style } from "@vanilla-extract/css";
import { vars } from "../theme/contract.css";

export const emptyRoot = style({
  height: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: vars.space.md,
  color: vars.color.textDim,
  fontSize: vars.font.size.lg,
  padding: vars.space.xl,
  textAlign: "center",
});

export const emptyIcon = style({
  opacity: 0.4,
  display: "inline-flex",
});

export const emptyHint = style({
  fontSize: vars.font.size.sm,
  opacity: 0.6,
});
