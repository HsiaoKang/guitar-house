/**
 * 轻量 Toast（非阻塞操作反馈）
 *
 * 模块级发布订阅：任意位置调用 toast() 入队，<Toaster /> 统一渲染，
 * 自动消失，motion 进出场。用于"操作已完成"类的轻量反馈
 * （阻塞性错误仍用原生对话框）。
 */
import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";

/** 单条 toast */
interface ToastItem {
  id: number;
  message: string;
}

let nextId = 1;
let items: ToastItem[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

/**
 * 弹出一条 toast
 *
 * @param message 提示文案
 * @param durationMs 显示时长（默认 3 秒）
 */
export function toast(message: string, durationMs = 3000): void {
  const item = { id: nextId++, message };
  items = [...items, item];
  emit();
  setTimeout(() => {
    items = items.filter((i) => i.id !== item.id);
    emit();
  }, durationMs);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Toast 渲染挂载点（App 根部挂载一次）
 */
export function Toaster() {
  const list = useSyncExternalStore(subscribe, () => items);
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[70] flex flex-col items-center gap-2">
      <AnimatePresence>
        {list.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="rounded-md border border-border bg-popover px-3.5 py-2 text-[13px] text-popover-foreground shadow-lg"
          >
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
