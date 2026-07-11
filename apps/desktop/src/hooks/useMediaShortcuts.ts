/**
 * 媒体快捷键 Hook
 *
 * 空格：作用于"最近操作的域"（视频 / 伴奏 / 节拍器）——
 * 点过节拍器后空格启停节拍器，点过伴奏条后空格播停伴奏；
 * ← →：快退/快进 5 秒；↑ ↓：音量增减（作用于当前域的媒体）。
 * 捕获阶段拦截，避免焦点残留在按钮/下拉上时空格误触发控件。
 * 文本输入聚焦、浮窗打开、下拉/菜单展开中让位。
 */
import { useEffect } from "react";

/** 单次快进/快退步长（秒） */
const SEEK_STEP_SEC = 5;
/** 单次音量步长 */
const VOLUME_STEP = 0.1;

/** 本 Hook 接管的按键 */
const HANDLED_CODES = new Set(["Space", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);

/** 快捷键的当前作用目标（由调用方按"最近操作的域"解析） */
export interface ShortcutTarget {
  /** 方向键作用的媒体元素（无媒体的域可为 null，方向键忽略） */
  media: HTMLVideoElement | HTMLAudioElement | null;
  /** 空格动作（媒体播停或节拍器启停） */
  onSpace: () => void;
}

/**
 * 判断元素是否为需要键盘输入的文本控件
 *
 * @param el 事件目标元素
 */
function isTextInput(el: HTMLElement | null): boolean {
  if (!el) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable;
}

/**
 * 绑定全局媒体快捷键
 *
 * @param resolve 返回当前快捷键作用目标（每次按键时求值，跟随最近操作的域）
 */
export function useMediaShortcuts(resolve: () => ShortcutTarget): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!HANDLED_CODES.has(e.code)) return;
      // 文本输入聚焦时让位（数字/搜索框等）
      if (isTextInput(e.target as HTMLElement | null)) return;
      // 浮窗打开时让位（Tap Tempo 空格击打、弹窗内交互）
      if (document.querySelector("[role='dialog']")) return;
      // 下拉/菜单展开中让位（方向键导航、空格选中由 Radix 处理）
      if (document.querySelector("[role='listbox'],[role='menu']")) return;

      const target = resolve();
      if (e.code !== "Space" && !target.media) return;

      // 关键节点：捕获阶段抢先消费按键，焦点残留的按钮/下拉不再被空格触发
      e.preventDefault();
      e.stopPropagation();

      const media = target.media;
      switch (e.code) {
        case "Space":
          target.onSpace();
          break;
        case "ArrowLeft":
          if (media) media.currentTime = Math.max(0, media.currentTime - SEEK_STEP_SEC);
          break;
        case "ArrowRight":
          if (media) media.currentTime = Math.min(media.duration || Infinity, media.currentTime + SEEK_STEP_SEC);
          break;
        case "ArrowUp": {
          if (!media) break;
          media.muted = false;
          media.volume = Math.min(1, media.volume + VOLUME_STEP);
          // 关键节点：快捷键专属反馈信号（含已到边界的情况）
          media.dispatchEvent(new CustomEvent("app:volumeflash"));
          break;
        }
        case "ArrowDown": {
          if (!media) break;
          media.volume = Math.max(0, media.volume - VOLUME_STEP);
          media.dispatchEvent(new CustomEvent("app:volumeflash"));
          break;
        }
      }
    };
    // 捕获阶段注册：先于控件自身的键盘处理执行
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [resolve]);
}
