/**
 * 媒体快捷键 Hook
 *
 * 空格：播放/暂停；← →：快退/快进 5 秒；↑ ↓：音量增减。
 * 捕获阶段拦截，避免焦点残留在按钮/下拉/复选框上时空格误触发控件
 * （如课节下拉被空格展开）。仅对以下场景让位：
 * 文本输入聚焦、浮窗（dialog）打开、下拉/菜单展开中。
 */
import { useEffect, type RefObject } from "react";

/** 单次快进/快退步长（秒） */
const SEEK_STEP_SEC = 5;
/** 单次音量步长 */
const VOLUME_STEP = 0.1;

/** 本 Hook 接管的按键 */
const HANDLED_CODES = new Set(["Space", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);

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
 * 为媒体元素绑定全局键盘快捷键
 *
 * @param mediaRef 目标媒体元素（视频优先，无视频时可传音频）
 */
export function useMediaShortcuts(mediaRef: RefObject<HTMLVideoElement | HTMLAudioElement | null>): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const media = mediaRef.current;
      if (!media || !HANDLED_CODES.has(e.code)) return;
      // 文本输入聚焦时让位（数字/搜索框等）
      if (isTextInput(e.target as HTMLElement | null)) return;
      // 浮窗打开时让位（Tap Tempo 空格击打、弹窗内交互）
      if (document.querySelector("[role='dialog']")) return;
      // 下拉/菜单展开中让位（方向键导航、空格选中由 Radix 处理）
      if (document.querySelector("[role='listbox'],[role='menu']")) return;

      // 关键节点：捕获阶段抢先消费按键，焦点残留的按钮/下拉不再被空格触发
      e.preventDefault();
      e.stopPropagation();

      switch (e.code) {
        case "Space":
          if (media.paused) void media.play();
          else media.pause();
          break;
        case "ArrowLeft":
          media.currentTime = Math.max(0, media.currentTime - SEEK_STEP_SEC);
          break;
        case "ArrowRight":
          media.currentTime = Math.min(media.duration || Infinity, media.currentTime + SEEK_STEP_SEC);
          break;
        case "ArrowUp": {
          const before = media.volume;
          media.muted = false;
          media.volume = Math.min(1, before + VOLUME_STEP);
          // 关键节点：已在边界时值不变、原生不发事件，手动补发保证操作有反馈
          if (media.volume === before) media.dispatchEvent(new Event("volumechange"));
          break;
        }
        case "ArrowDown": {
          const before = media.volume;
          media.volume = Math.max(0, before - VOLUME_STEP);
          if (media.volume === before) media.dispatchEvent(new Event("volumechange"));
          break;
        }
      }
    };
    // 捕获阶段注册：先于控件自身的键盘处理执行
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [mediaRef]);
}
