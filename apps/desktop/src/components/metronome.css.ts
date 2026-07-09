/**
 * 节拍器控制条样式
 */
import { style } from "@vanilla-extract/css";
import { vars } from "@learning-house/ui";

export const metronomeBar = style({
  display: "flex",
  alignItems: "center",
  gap: vars.space.md,
  height: "56px",
  padding: `0 ${vars.space.md}`,
  flexShrink: 0,
  overflowX: "auto",
});

/** 启停主按钮固定最小宽，避免文案切换抖动 */
export const metroToggle = style({
  minWidth: "84px",
});

export const metroGroup = style({
  display: "flex",
  alignItems: "center",
  gap: vars.space.sm,
  flexShrink: 0,
  selectors: {
    "&[data-disabled='true']": {
      opacity: 0.45,
    },
  },
});

export const metroLabel = style({
  fontSize: vars.font.size.sm,
  color: vars.color.textDim,
});

/** BPM 数字输入 */
export const bpmInput = style({
  width: "58px",
  background: vars.color.panel2,
  border: `1px solid ${vars.color.border}`,
  color: vars.color.text,
  borderRadius: "5px",
  padding: "4px 6px",
  fontSize: vars.font.size.md,
  textAlign: "center",
});

export const offsetInput = style({
  width: "64px",
});

/** 拍点指示灯 */
export const beatLights = style({
  display: "flex",
  alignItems: "center",
  gap: vars.space.sm,
  marginLeft: "auto",
  paddingRight: vars.space.xs,
});

export const beatDot = style({
  width: "14px",
  height: "14px",
  borderRadius: "50%",
  background: vars.color.panel2,
  border: `1px solid ${vars.color.border}`,
  transition: "transform 0.05s",
  selectors: {
    "&[data-hit='true']": {
      background: vars.color.text,
      transform: "scale(1.25)",
    },
    "&[data-hit='accent']": {
      background: vars.color.accent,
      boxShadow: `0 0 10px ${vars.color.accent}`,
      transform: "scale(1.25)",
    },
  },
});
