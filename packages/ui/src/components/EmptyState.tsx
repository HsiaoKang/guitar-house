/**
 * 空态占位
 */
import type { ReactNode } from "react";
import { emptyHint, emptyIcon, emptyRoot } from "./empty.css";
import { Icon, type IconName } from "./Icon";

export interface EmptyStateProps {
  /** 顶部图标名（用大号渲染） */
  icon?: IconName;
  /** 主文案 */
  title: ReactNode;
  /** 辅助说明 */
  hint?: ReactNode;
  /** 操作区（如按钮） */
  children?: ReactNode;
}

/**
 * 空态组件
 *
 * @param props 见 EmptyStateProps 字段说明
 */
export function EmptyState({ icon, title, hint, children }: EmptyStateProps) {
  return (
    <div className={emptyRoot}>
      {icon && (
        <span className={emptyIcon}>
          <Icon name={icon} size="xl" />
        </span>
      )}
      <p>{title}</p>
      {children}
      {hint && <p className={emptyHint}>{hint}</p>}
    </div>
  );
}
