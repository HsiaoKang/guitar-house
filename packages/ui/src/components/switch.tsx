/**
 * 开关（自绘，二元状态切换）
 *
 * 适用于"开/关"语义的设置项（如节拍器跟随伴奏），
 * 相比下拉框少一次展开操作、状态一目了然。
 */
import { cn } from "../lib/utils";
import { Tooltip } from "./tooltip";

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** 右侧文字标签（点击同样切换） */
  label?: string;
  disabled?: boolean;
  /** 悬停提示 */
  title?: string;
}

/**
 * 开关组件
 *
 * @param props checked/onChange 受控状态；label 文字标签；title 悬停提示
 */
export function Switch({ checked, onChange, label, disabled, title }: SwitchProps) {
  return (
    <Tooltip content={title}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "inline-flex cursor-pointer select-none items-center gap-1.5 text-[13px] text-foreground transition-opacity",
          "disabled:pointer-events-none disabled:opacity-45",
        )}
      >
        <span
          className={cn(
            "relative inline-block h-[18px] w-8 shrink-0 rounded-full border transition-colors",
            checked ? "border-primary bg-primary" : "border-border bg-secondary",
          )}
        >
          <span
            className={cn(
              "absolute top-1/2 size-3.5 -translate-y-1/2 rounded-full bg-white shadow transition-[left] duration-150",
              checked ? "left-[calc(100%-15px)]" : "left-px",
            )}
          />
        </span>
        {label && <span className={cn(!checked && "text-muted-foreground")}>{label}</span>}
      </button>
    </Tooltip>
  );
}
