/**
 * 设计 token 契约
 *
 * 用 createThemeContract 声明全部 token 的形状，
 * 暗/亮主题分别为契约提供具体值；组件样式只引用契约变量，
 * 与具体主题解耦，是主题切换能力的根基。
 */
import { createThemeContract } from "@vanilla-extract/css";

export const vars = createThemeContract({
  color: {
    /** 应用背景 */
    bg: null,
    /** 面板背景（顶栏/工具栏/卡片） */
    panel: null,
    /** 次级面板背景（输入框/内容区） */
    panel2: null,
    /** 描边 */
    border: null,
    /** 悬停态描边 */
    borderStrong: null,
    /** 主文本 */
    text: null,
    /** 次要文本 */
    textDim: null,
    /** 主题色（琥珀） */
    accent: null,
    /** 主题色（亮态/悬停） */
    accentStrong: null,
    /** 主题色上的前景色（按钮文字） */
    accentContrast: null,
    /** 危险色 */
    danger: null,
    /** 浮层遮罩 */
    overlay: null,
    /** 滚动条滑块 */
    scrollThumb: null,
    /** 文档渲染纸面（PDF/GP 白底） */
    paper: null,
    /** 视频舞台背景 */
    stage: null,
  },
  font: {
    family: null,
    size: {
      /** 11px 辅助标签 */
      xs: null,
      /** 12px 次要信息 */
      sm: null,
      /** 13px 控件默认 */
      md: null,
      /** 14px 正文 */
      lg: null,
      /** 15px 标题 */
      xl: null,
    },
  },
  space: {
    /** 4px */
    xs: null,
    /** 8px */
    sm: null,
    /** 12px */
    md: null,
    /** 16px */
    lg: null,
    /** 20px */
    xl: null,
  },
  radius: {
    /** 4px 小元素 */
    sm: null,
    /** 6px 按钮/输入框 */
    md: null,
    /** 10px 卡片 */
    lg: null,
    /** 12px 浮窗 */
    xl: null,
  },
  shadow: {
    /** 浮窗投影 */
    modal: null,
    /** 卡片投影 */
    card: null,
  },
});
