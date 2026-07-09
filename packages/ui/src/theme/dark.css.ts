/**
 * 暗色主题（默认）
 */
import { createTheme } from "@vanilla-extract/css";
import { vars } from "./contract.css";
import { baseFontFamily, sharedScale } from "./shared";

export const darkThemeClass = createTheme(vars, {
  color: {
    bg: "#121417",
    panel: "#1b1f24",
    panel2: "#22272e",
    border: "#2d333b",
    borderStrong: "#3a424c",
    text: "#e6e8ea",
    textDim: "#9aa4af",
    accent: "#e8a44c",
    accentStrong: "#f2b866",
    accentContrast: "#1a1409",
    danger: "#e5534b",
    overlay: "rgba(0, 0, 0, 0.55)",
    scrollThumb: "#3a424c",
    paper: "#ffffff",
    stage: "#000000",
  },
  font: {
    family: baseFontFamily,
    size: sharedScale.fontSize,
  },
  space: sharedScale.space,
  radius: sharedScale.radius,
  shadow: {
    modal: "0 12px 40px rgba(0, 0, 0, 0.5)",
    card: "0 2px 10px rgba(0, 0, 0, 0.4)",
  },
});
