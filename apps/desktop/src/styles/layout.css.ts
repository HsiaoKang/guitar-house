/**
 * 应用级共享布局样式（壳、顶栏、面板工具条）
 */
import { style } from "@vanilla-extract/css";
import { vars } from "@learning-house/ui";

/** 全屏纵向壳布局 */
export const appShell = style({
  display: "flex",
  flexDirection: "column",
  height: "100vh",
});

/** 顶栏 */
export const topBar = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  height: "48px",
  padding: `0 ${vars.space.md}`,
  background: vars.color.panel,
  borderBottom: `1px solid ${vars.color.border}`,
  flexShrink: 0,
  gap: vars.space.md,
});

/** 品牌区（logo + 名称） */
export const brand = style({
  display: "flex",
  alignItems: "center",
  gap: vars.space.sm,
  color: vars.color.accent,
});

export const brandName = style({
  fontWeight: 700,
  letterSpacing: "0.5px",
  fontSize: vars.font.size.xl,
});

/** 主内容区 */
export const mainArea = style({
  flex: 1,
  minHeight: 0,
});

/** 面板顶部工具条（视频区/文档区共用） */
export const panelToolbar = style({
  display: "flex",
  alignItems: "center",
  gap: vars.space.sm,
  height: "40px",
  padding: `0 ${vars.space.sm}`,
  background: vars.color.panel,
  borderBottom: `1px solid ${vars.color.border}`,
  flexShrink: 0,
});

/** 工具条内的标题（超长省略） */
export const panelTitle = style({
  flex: 1,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: vars.font.size.md,
  color: vars.color.textDim,
});

/** 应用加载态 */
export const appLoading = style({
  height: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: vars.color.textDim,
});
