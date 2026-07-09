/**
 * 主题间共享的尺度常量（间距/圆角/字号/字体栈）
 *
 * 单独放普通 ts 文件（非 .css.ts），供两套主题复用。
 */

/** 跨平台中文字体栈：macOS PingFang / Windows 微软雅黑 / Linux Noto 兜底 */
export const baseFontFamily =
  '-apple-system, "PingFang SC", "Microsoft YaHei", "Segoe UI", "Noto Sans CJK SC", "Helvetica Neue", system-ui, sans-serif';

/** 两套主题共用的尺度值 */
export const sharedScale = {
  fontSize: {
    xs: "11px",
    sm: "12px",
    md: "13px",
    lg: "14px",
    xl: "15px",
  },
  space: {
    xs: "4px",
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "20px",
  },
  radius: {
    sm: "4px",
    md: "6px",
    lg: "10px",
    xl: "12px",
  },
};
