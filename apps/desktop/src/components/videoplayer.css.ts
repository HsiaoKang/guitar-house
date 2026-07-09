/**
 * 视频播放器样式
 */
import { style } from "@vanilla-extract/css";
import { vars } from "@learning-house/ui";

export const videoPlayer = style({
  display: "flex",
  flexDirection: "column",
  height: "100%",
});

export const videoStage = style({
  flex: 1,
  minHeight: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: vars.color.stage,
});

export const videoEl = style({
  width: "100%",
  height: "100%",
  objectFit: "contain",
});

/** 倍速按钮组 */
export const rateGroup = style({
  display: "flex",
  gap: "2px",
  flexShrink: 0,
});

export const rateBtn = style({
  border: "none",
  background: "transparent",
  color: vars.color.textDim,
  fontSize: vars.font.size.sm,
  padding: "4px 7px",
  borderRadius: vars.radius.sm,
  cursor: "pointer",
  selectors: {
    "&:hover": {
      color: vars.color.text,
      background: vars.color.panel2,
    },
    "&[data-active='true']": {
      color: vars.color.accentContrast,
      background: vars.color.accent,
      fontWeight: 600,
    },
  },
});
