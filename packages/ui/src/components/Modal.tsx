/**
 * 浮窗容器
 *
 * 遮罩 + 面板 + 标题栏（含关闭按钮），点遮罩关闭；
 * 内容区自由排布（TAP 浮窗 / 导入课程浮窗共用）。
 */
import type { CSSProperties, ReactNode } from "react";
import { IconButton } from "./Button";
import { modalHeader, modalMask, modalPanel } from "./modal.css";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  /** 面板宽度，默认 340px */
  width?: CSSProperties["width"];
}

/**
 * 浮窗组件
 *
 * @param props 见 ModalProps 字段说明
 */
export function Modal({ open, onClose, title, children, width = "340px" }: ModalProps) {
  if (!open) return null;
  return (
    <div className={modalMask} onClick={onClose}>
      <div className={modalPanel} style={{ width }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <div className={modalHeader}>
          <span>{title}</span>
          <IconButton name="close" label="关闭" size="sm" onClick={onClose} />
        </div>
        {children}
      </div>
    </div>
  );
}
