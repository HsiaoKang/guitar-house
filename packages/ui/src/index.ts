/**
 * @learning-house/ui 包入口
 *
 * 设计系统：主题 token 契约、暗/亮主题、全局样式、
 * 跨端一致的基础组件与统一图标。
 */
// 主题
export { vars } from "./theme/contract.css";
export { darkThemeClass } from "./theme/dark.css";
export { lightThemeClass } from "./theme/light.css";
import "./theme/global.css";

// 工具
export { cx } from "./cx";

// 组件
export { Button, IconButton, type ButtonProps, type IconButtonProps } from "./components/Button";
export { Slider, type SliderProps } from "./components/Slider";
export { Select, type SelectProps } from "./components/Select";
export { Checkbox, type CheckboxProps } from "./components/Checkbox";
export { Tabs, type TabItem, type TabsProps } from "./components/Tabs";
export { Modal, type ModalProps } from "./components/Modal";
export { ProgressBar, type ProgressBarProps } from "./components/ProgressBar";
export { EmptyState, type EmptyStateProps } from "./components/EmptyState";
export { Icon, type IconName, type IconProps } from "./components/Icon";
export { BrandLogo } from "./components/BrandLogo";
