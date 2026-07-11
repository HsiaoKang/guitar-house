/**
 * 下拉选择（Radix Select：自绘弹层，规避原生 select 引发的
 * WebView 合成层重绘问题，三端外观一致）
 */
import { forwardRef, type ComponentPropsWithoutRef, type ComponentRef, type ReactNode } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { cn } from "../lib/utils";
import { Icon } from "./icon";

/** 选项定义 */
export interface SelectOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<ComponentPropsWithoutRef<typeof SelectPrimitive.Root>, "value" | "onValueChange" | "children"> {
  /** 当前值（受控） */
  value: string;
  /** 值变化回调 */
  onChange: (value: string) => void;
  /** 选项列表 */
  options: SelectOption[];
  /** 触发器额外类名（如 max-w-*） */
  className?: string;
  /** 触发器 title 提示 */
  title?: string;
  /** 无选中值时触发器显示的占位文案（动作式下拉可长期显示） */
  placeholder?: ReactNode;
}

/**
 * 下拉选择组件
 *
 * @param props value/onChange 受控值；options 选项列表
 */
export const Select = forwardRef<ComponentRef<typeof SelectPrimitive.Trigger>, SelectProps>(
  ({ value, onChange, options, className, title, placeholder, ...props }, ref) => (
    <SelectPrimitive.Root value={value} onValueChange={onChange} {...props}>
      <SelectPrimitive.Trigger
        ref={ref}
        title={title}
        className={cn(
          "inline-flex h-8 items-center justify-between gap-1.5 rounded-md border border-border bg-secondary px-2.5 text-[13px] text-foreground transition-colors hover:border-muted-foreground/40 focus-visible:outline-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-45 [&>span]:truncate",
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon asChild>
          <span className="text-muted-foreground">
            <Icon name="chevronDown" size="sm" />
          </span>
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className="z-50 max-h-[min(24rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((opt) => (
              <SelectPrimitive.Item
                key={opt.value}
                value={opt.value}
                disabled={opt.disabled}
                className="relative flex cursor-pointer select-none items-center rounded-sm py-1.5 pl-2 pr-7 text-[13px] outline-none data-[highlighted]:bg-secondary data-[disabled]:pointer-events-none data-[disabled]:opacity-45"
              >
                <SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-1.5 text-primary">
                  <Icon name="check" size="sm" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  ),
);
Select.displayName = "Select";
