/**
 * 上课页样式
 */
import { style } from "@vanilla-extract/css";
import { vars } from "@learning-house/ui";

export const classroomLeft = style({
  display: "flex",
  alignItems: "center",
  gap: vars.space.sm,
  minWidth: 0,
  flex: 1,
});

export const courseTitle = style({
  fontWeight: 600,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

export const lessonSwitcher = style({
  display: "flex",
  alignItems: "center",
  gap: vars.space.sm,
  flexShrink: 0,
});

export const classroomRight = style({
  display: "flex",
  alignItems: "center",
  gap: vars.space.md,
  flex: 1,
  justifyContent: "flex-end",
});
