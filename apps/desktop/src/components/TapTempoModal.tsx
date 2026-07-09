/**
 * Tap Tempo 浮窗
 *
 * 点击 TAP 后弹出的浮层：通过鼠标点击大按钮或敲击空格键打拍，
 * 实时计算并显示 BPM（取最近 8 次间隔平均，超过 2 秒未击打自动重新计数），
 * 可一键把结果应用到节拍器。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Modal } from "@learning-house/ui";
import { bpmDisplay, bpmHint, bpmUnit, bpmValue, tapActions, tapCount, tapFooter, tapPad } from "./tap.css";

/** 判定重新计数的静默间隔（毫秒） */
const RESET_GAP_MS = 2000;
/** 参与平均的最近击打数 */
const MAX_TAPS = 8;

interface TapTempoModalProps {
  /** 是否显示浮窗 */
  open: boolean;
  /** 关闭浮窗 */
  onClose: () => void;
  /** 应用计算出的 BPM 到节拍器 */
  onApply: (bpm: number) => void;
}

/**
 * Tap Tempo 浮窗组件
 *
 * @param props 见 TapTempoModalProps 字段说明
 */
export function TapTempoModal({ open, onClose, onApply }: TapTempoModalProps) {
  const tapsRef = useRef<number[]>([]);
  const [bpm, setBpm] = useState<number | null>(null);
  const [taps, setTaps] = useState(0);
  const [flash, setFlash] = useState(false);

  /**
   * 记录一次击打并实时更新 BPM
   */
  const tap = useCallback(() => {
    const now = performance.now();
    const list = tapsRef.current;
    if (list.length > 0 && now - list[list.length - 1] > RESET_GAP_MS) {
      list.length = 0;
    }
    list.push(now);
    if (list.length > MAX_TAPS) list.shift();
    setTaps(list.length);
    if (list.length >= 2) {
      const avgMs = (list[list.length - 1] - list[0]) / (list.length - 1);
      setBpm(Math.round(Math.min(300, Math.max(20, 60000 / avgMs))));
    }
    // 击打视觉反馈
    setFlash(true);
    setTimeout(() => setFlash(false), 80);
  }, []);

  /**
   * 清空击打记录重新开始
   */
  const reset = useCallback(() => {
    tapsRef.current = [];
    setBpm(null);
    setTaps(0);
  }, []);

  // 浮窗打开期间监听空格键打拍、Esc 关闭；关闭时清空记录
  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (!e.repeat) tap();
      } else if (e.code === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, tap, reset, onClose]);

  return (
    <Modal open={open} onClose={onClose} title="Tap Tempo">
      <div className={bpmDisplay}>
        {bpm !== null ? (
          <>
            <span className={bpmValue}>{bpm}</span>
            <span className={bpmUnit}>BPM</span>
          </>
        ) : (
          <span className={bpmHint}>连续击打测速</span>
        )}
      </div>

      <button className={tapPad} data-flash={flash ? "true" : undefined} onClick={tap}>
        点击 或 敲空格
      </button>

      <div className={tapFooter}>
        <span className={tapCount}>{taps > 0 ? `已击打 ${taps} 次` : "\u00a0"}</span>
        <div className={tapActions}>
          <Button variant="ghost" onClick={reset}>
            重来
          </Button>
          <Button
            variant="primary"
            disabled={bpm === null}
            onClick={() => {
              if (bpm !== null) {
                onApply(bpm);
                onClose();
              }
            }}
          >
            应用到节拍器
          </Button>
        </div>
      </div>
    </Modal>
  );
}
