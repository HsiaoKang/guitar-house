/**
 * 课程库页样式
 */
import { style } from "@vanilla-extract/css";
import { vars } from "@learning-house/ui";

export const libraryBody = style({
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  padding: vars.space.xl,
});

export const courseGrid = style({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
  gap: vars.space.lg,
});

export const courseCard = style({
  background: vars.color.panel,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.lg,
  padding: vars.space.lg,
  cursor: "pointer",
  transition: "border-color 0.15s, transform 0.1s",
  display: "flex",
  flexDirection: "column",
  gap: vars.space.sm,
  selectors: {
    "&:hover": {
      borderColor: vars.color.accent,
      transform: "translateY(-2px)",
    },
  },
});

export const courseCardHead = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: vars.space.sm,
});

export const courseName = style({
  fontWeight: 600,
  fontSize: vars.font.size.xl,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

export const courseTypeTag = style({
  fontSize: vars.font.size.xs,
  color: vars.color.accent,
  border: `1px solid ${vars.color.accent}`,
  borderRadius: vars.radius.sm,
  padding: "1px 6px",
  flexShrink: 0,
});

export const courseMeta = style({
  fontSize: vars.font.size.sm,
  color: vars.color.textDim,
});

export const courseProgressLabel = style({
  fontSize: vars.font.size.xs,
  color: vars.color.textDim,
  textAlign: "right",
});

export const courseCardActions = style({
  display: "flex",
  justifyContent: "flex-end",
  gap: "6px",
  borderTop: `1px solid ${vars.color.border}`,
  paddingTop: vars.space.sm,
});

/** 导入浮窗提示文案 */
export const importHint = style({
  fontSize: vars.font.size.md,
  color: vars.color.textDim,
  lineHeight: 1.6,
});

export const importActions = style({
  display: "flex",
  gap: vars.space.sm,
});

export const importTypeBtn = style({
  flex: 1,
});
