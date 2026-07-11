/**
 * @learning-house/ui 包入口
 *
 * shadcn 风格设计系统：Radix primitives + Tailwind v4 + CVA，
 * 主题由 CSS 变量驱动（apps/desktop/src/globals.css）。
 */
export { cn } from "./lib/utils";

export { Button, IconButton, type ButtonProps, type IconButtonProps } from "./components/button";
export { Slider, type SliderProps } from "./components/slider";
export { Select, type SelectOption, type SelectProps } from "./components/select";
export { Checkbox, type CheckboxProps } from "./components/checkbox";
export { Modal, type ModalProps } from "./components/dialog";
export { ProgressBar, type ProgressBarProps } from "./components/progress";
export { Tabs, type TabItem, type TabsProps } from "./components/tabs";
export { EmptyState, type EmptyStateProps } from "./components/empty-state";
export { ContextMenu, type ContextMenuItem, type ContextMenuProps } from "./components/context-menu";
export { Icon, type IconName, type IconProps } from "./components/icon";
export { BrandLogo } from "./components/brand-logo";
export { Toaster, toast } from "./components/toast";
