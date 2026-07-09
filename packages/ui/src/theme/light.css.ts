/**
 * 亮色主题
 *
 * 主题色沿用琥珀色系但加深，保证浅底上的对比度。
 */
import { createTheme } from "@vanilla-extract/css";
import { vars } from "./contract.css";
import { baseFontFamily, sharedScale } from "./shared";

export const lightThemeClass = createTheme(vars, {
  color: {
    bg: "#f2f3f5",
    panel: "#ffffff",
    panel2: "#e9ecef",
    border: "#d5dae0",
    borderStrong: "#bfc7cf",
    text: "#22262b",
    textDim: "#647080",
    accent: "#c07a16",
    accentStrong: "#a3670f",
    accentContrast: "#ffffff",
    danger: "#d1242f",
    overlay: "rgba(15, 18, 22, 0.4)",
    scrollThumb: "#c4cbd3",
    paper: "#ffffff",
    stage: "#14161a",
  },
  font: {
    family: baseFontFamily,
    size: sharedScale.fontSize,
  },
  space: sharedScale.space,
  radius: sharedScale.radius,
  shadow: {
    modal: "0 12px 40px rgba(30, 40, 50, 0.25)",
    card: "0 2px 10px rgba(30, 40, 50, 0.12)",
  },
});
