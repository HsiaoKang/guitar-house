/**
 * 复选框（自绘勾选框）
 *
 * 原生 input 视觉隐藏保留可访问性，勾选框与对勾统一绘制。
 */
import type { ReactNode } from "react";
import { checkboxBox, checkboxInput, checkboxLabel } from "./checkbox.css";
import { Icon } from "./Icon";

export interface CheckboxProps {
  checked: boolean;
  /** 勾选状态变化回调 */
  onChange: (checked: boolean) => void;
  /** 右侧文案 */
  label?: ReactNode;
  disabled?: boolean;
  title?: string;
}

/**
 * 复选框组件
 *
 * @param props 见 CheckboxProps 字段说明
 */
export function Checkbox({ checked, onChange, label, disabled, title }: CheckboxProps) {
  return (
    <label className={checkboxLabel} data-disabled={disabled ? "true" : undefined} title={title}>
      <input
        type="checkbox"
        className={checkboxInput}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={checkboxBox}>
        <Icon name="check" size="sm" />
      </span>
      {label}
    </label>
  );
}
