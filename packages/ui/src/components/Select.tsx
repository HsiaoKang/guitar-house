/**
 * 下拉选择（收起态自绘外观 + 自定义箭头）
 *
 * 保留原生 select 的弹层与键盘交互（各端弹层样式不同但可用性最佳），
 * 收起态外观与箭头统一绘制，抹平主要视觉差异。
 */
import type { CSSProperties, SelectHTMLAttributes } from "react";
import { cx } from "../cx";
import { Icon } from "./Icon";
import { selectArrow, selectEl, selectWrap } from "./select.css";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** 控件最大宽度（超出省略） */
  maxWidth?: CSSProperties["maxWidth"];
}

/**
 * 下拉选择组件
 *
 * @param props 见 SelectProps 字段说明（children 传 option 元素）
 */
export function Select({ maxWidth, className, style, children, ...rest }: SelectProps) {
  return (
    <span className={selectWrap} style={{ maxWidth }}>
      <select className={cx(selectEl, className)} style={style} {...rest}>
        {children}
      </select>
      <span className={selectArrow}>
        <Icon name="chevronDown" size="sm" />
      </span>
    </span>
  );
}
