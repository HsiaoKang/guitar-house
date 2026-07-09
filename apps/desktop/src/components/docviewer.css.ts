/**
 * 文档查看器与三类渲染器容器样式
 */
import { style } from "@vanilla-extract/css";
import { vars } from "@learning-house/ui";

export const scoreViewer = style({
  display: "flex",
  flexDirection: "column",
  height: "100%",
  background: vars.color.panel2,
});

/** 滚动容器（三类渲染器共用） */
export const scoreScroll = style({
  flex: 1,
  minHeight: 0,
  overflow: "auto",
  padding: vars.space.md,
});

/** 图片谱 */
export const scoreImage = style({
  display: "block",
  margin: "0 auto",
  borderRadius: vars.radius.sm,
});

/** PDF 页容器（纵向排列） */
export const pdfPages = style({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: vars.space.md,
});

export const pdfPageCanvas = style({
  display: "block",
  borderRadius: vars.radius.sm,
  boxShadow: vars.shadow.card,
});

/** alphaTab 渲染宿主（乐谱需要纸面白底） */
export const alphaTabHost = style({
  background: vars.color.paper,
});

/** 缩放控制组 */
export const zoomGroup = style({
  display: "flex",
  alignItems: "center",
  gap: "6px",
  flexShrink: 0,
});

export const zoomLabel = style({
  fontSize: vars.font.size.sm,
  color: vars.color.textDim,
  minWidth: "42px",
  textAlign: "center",
});
