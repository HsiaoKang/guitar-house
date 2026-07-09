/**
 * 浮窗样式
 */
import { style } from "@vanilla-extract/css";
import { vars } from "../theme/contract.css";

export const modalMask = style({
  position: "fixed",
  inset: 0,
  background: vars.color.overlay,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 100,
});

export const modalPanel = style({
  background: vars.color.panel,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.xl,
  padding: vars.space.lg,
  display: "flex",
  flexDirection: "column",
  gap: vars.space.md,
  boxShadow: vars.shadow.modal,
});

export const modalHeader = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  fontWeight: 600,
  fontSize: vars.font.size.lg,
});
