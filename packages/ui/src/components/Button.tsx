/**
 * 按钮与图标按钮
 */
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "../cx";
import { button, iconButton } from "./button.css";
import { Icon, type IconName, type IconProps } from "./Icon";

type NativeButton = ButtonHTMLAttributes<HTMLButtonElement>;

export interface ButtonProps extends NativeButton {
  /** 视觉变体：solid（默认面板底）/ primary（主题色）/ ghost（透明） */
  variant?: "solid" | "primary" | "ghost";
  /** 语气：danger 时悬停变红 */
  tone?: "default" | "danger";
  size?: "sm" | "md" | "lg";
  /** 激活态（如节拍器运行中） */
  active?: boolean;
  /** 左侧图标 */
  icon?: IconName;
}

/**
 * 通用按钮
 *
 * @param props 见 ButtonProps 字段说明
 */
export function Button({ variant, tone, size, active, icon, children, className, ...rest }: ButtonProps) {
  return (
    <button className={cx(button({ variant, tone, size, active }), className)} {...rest}>
      {icon && <Icon name={icon} size={size === "sm" ? "sm" : "md"} />}
      {children}
    </button>
  );
}

export interface IconButtonProps extends NativeButton {
  /** 图标名 */
  name: IconName;
  size?: "sm" | "md" | "lg";
  /** 图标尺寸（默认随按钮尺寸） */
  iconSize?: IconProps["size"];
  /** 无障碍标签 */
  label: string;
}

/**
 * 纯图标按钮（关闭/返回/缩放等）
 *
 * @param props 见 IconButtonProps 字段说明
 */
export function IconButton({ name, size, iconSize, label, className, title, ...rest }: IconButtonProps) {
  return (
    <button className={cx(iconButton({ size }), className)} aria-label={label} title={title ?? label} {...rest}>
      <Icon name={name} size={iconSize ?? (size === "lg" ? "lg" : "md")} />
    </button>
  );
}

/** 让业务侧无需另行导入 ReactNode 类型的便捷别名 */
export type { ReactNode };
