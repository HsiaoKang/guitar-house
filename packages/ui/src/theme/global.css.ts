/**
 * 全局样式：跨端一致性的基座
 *
 * 统一 reset、字体渲染、滚动条、焦点态与表单控件默认外观，
 * 抹平 WKWebView / WebView2 / WebKitGTK 的默认差异。
 */
import { globalStyle } from "@vanilla-extract/css";
import { vars } from "./contract.css";

// 盒模型与间距 reset
globalStyle("*, *::before, *::after", {
  boxSizing: "border-box",
  margin: 0,
  padding: 0,
});

globalStyle("html, body, #root", {
  height: "100%",
});

globalStyle("body", {
  fontFamily: vars.font.family,
  fontSize: vars.font.size.lg,
  background: vars.color.bg,
  color: vars.color.text,
  overflow: "hidden",
  userSelect: "none",
  WebkitUserSelect: "none",
  WebkitFontSmoothing: "antialiased",
  textRendering: "optimizeLegibility",
});

// 表单控件：去掉各端原生外观，继承字体
globalStyle("button, input, select, textarea", {
  appearance: "none",
  WebkitAppearance: "none",
  font: "inherit",
  color: "inherit",
});

globalStyle("button", {
  cursor: "pointer",
  background: "none",
  border: "none",
});

// 统一焦点态（仅键盘导航展示）
globalStyle(":focus", {
  outline: "none",
});

globalStyle(":focus-visible", {
  outline: `2px solid ${vars.color.accent}`,
  outlineOffset: "1px",
});

// 统一细滚动条（三端 WebView 均为 WebKit/Chromium 系，支持该伪元素）
globalStyle("::-webkit-scrollbar", {
  width: "8px",
  height: "8px",
});

globalStyle("::-webkit-scrollbar-thumb", {
  background: vars.color.scrollThumb,
  borderRadius: "4px",
});

globalStyle("::-webkit-scrollbar-thumb:hover", {
  background: vars.color.borderStrong,
});

globalStyle("::-webkit-scrollbar-corner", {
  background: "transparent",
});

// 媒体元素默认块级化（不限制宽度，谱面渲染需要真实尺寸溢出滚动）
globalStyle("img, video", {
  display: "block",
});
