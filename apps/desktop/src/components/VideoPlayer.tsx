/**
 * 课节视频播放器
 *
 * 播放当前课节内的视频资源（Tauri asset 协议访问本地文件），
 * 多个视频时提供 tab 切换；播放位置记忆（续播）、默认展示首帧封面、
 * 自定义右键菜单，并把媒体事件转发给节拍器实现"跟随视频"联动。
 * 倍速调节使用视频原生控制条（不再重复放置）。
 */
import { useEffect, useRef, useState, type RefObject } from "react";
import { ContextMenu, EmptyState, Tabs } from "@learning-house/ui";
import { mediaSrc } from "../lib/platform";
import type { MediaEngineControl } from "../hooks/useMetronome";
import type { LessonResource } from "../types";

/** 续播位置保存节流间隔（毫秒） */
const POSITION_SAVE_INTERVAL_MS = 3000;

/** 右键菜单项 */
const VIDEO_MENU_ITEMS = [
  { key: "toggle", label: "播放 / 暂停", icon: "play" as const },
  { key: "back30", label: "后退 30 秒", icon: "back" as const },
  { key: "fwd30", label: "前进 30 秒", icon: "chevronDown" as const },
  { key: "sep", label: "", separator: true },
  { key: "mute", label: "静音 / 取消静音", icon: "music" as const },
];

interface VideoPlayerProps {
  /** 当前课节的视频资源列表（可为空） */
  resources: LessonResource[];
  /** 视频元素引用（供外层查询播放状态） */
  videoRef: RefObject<HTMLVideoElement | null>;
  /** 节拍器联动控制接口（video 源） */
  engineControl: MediaEngineControl;
  /** 查询资源的续播位置（秒），无记录返回 0 */
  getSavedPosition: (path: string) => number;
  /** 播放位置变化回调（已节流），用于持久化续播 */
  onPositionSave: (path: string, position: number) => void;
}

/**
 * 视频播放区组件
 *
 * @param props 见 VideoPlayerProps 字段说明
 */
export function VideoPlayer(props: VideoPlayerProps) {
  const { resources, videoRef, engineControl, getSavedPosition, onPositionSave } = props;
  const [activeIndex, setActiveIndex] = useState(0);
  const lastSaveRef = useRef(0);
  /** 封面渲染 hack 进行中（此期间的 play/pause 事件不触发联动与进度保存） */
  const coverHackRef = useRef(false);

  // 课节切换（资源列表变化）时回到第一个视频
  useEffect(() => {
    setActiveIndex(0);
  }, [resources]);

  const active = resources[Math.min(activeIndex, resources.length - 1)] ?? null;

  /**
   * 读取视频元素当前进度并执行回调（元素不存在时忽略）
   *
   * @param fn 拿到 (currentTime, playbackRate) 后的处理函数
   */
  const withVideo = (fn: (time: number, rate: number) => void) => {
    const el = videoRef.current;
    if (el) fn(el.currentTime, el.playbackRate);
  };

  /**
   * 首帧数据就绪（loadeddata）：恢复续播位置并渲染封面。
   * 关键节点：WKWebView 不渲染未播放视频的画面帧（Safari 内核行为），
   * 通过"静音瞬时播放一帧后暂停"触发首帧上屏；期间挂起联动与进度保存
   */
  const restorePosition = async () => {
    const el = videoRef.current;
    if (!el || !active) return;
    const saved = getSavedPosition(active.path);
    if (saved > 1 && saved < el.duration - 3) {
      el.currentTime = saved;
    }
    if (!el.paused) return;
    coverHackRef.current = true;
    const wasMuted = el.muted;
    el.muted = true;
    try {
      await el.play();
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      el.pause();
    } catch {
      // 自动播放被环境拒绝时放弃封面渲染，不影响正常播放
    } finally {
      el.muted = wasMuted;
      coverHackRef.current = false;
    }
  };

  /**
   * timeupdate 驱动：节流保存续播位置 + 节拍器对齐
   */
  const handleTimeUpdate = () => {
    withVideo(engineControl.align);
    const el = videoRef.current;
    if (!el || !active) return;
    const now = Date.now();
    if (now - lastSaveRef.current >= POSITION_SAVE_INTERVAL_MS && !el.paused) {
      lastSaveRef.current = now;
      onPositionSave(active.path, el.currentTime);
    }
  };

  /**
   * 处理右键菜单动作
   *
   * @param key 菜单项标识
   */
  const handleMenu = (key: string) => {
    const el = videoRef.current;
    if (!el) return;
    if (key === "toggle") {
      if (el.paused) void el.play();
      else el.pause();
    } else if (key === "back30") {
      el.currentTime = Math.max(0, el.currentTime - 30);
    } else if (key === "fwd30") {
      el.currentTime = Math.min(el.duration || Infinity, el.currentTime + 30);
    } else if (key === "mute") {
      el.muted = !el.muted;
    }
  };

  if (!active) {
    return <EmptyState icon="video" title="本课节没有视频资源" />;
  }

  return (
    <div className="flex h-full flex-col">
      {resources.length > 1 && (
        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-card px-2">
          <Tabs
            items={resources.map((res) => ({ key: res.path, label: res.name }))}
            activeKey={active.path}
            onChange={(key) => setActiveIndex(resources.findIndex((r) => r.path === key))}
          />
        </div>
      )}
      <ContextMenu items={VIDEO_MENU_ITEMS} onSelect={handleMenu}>
        <div className="flex min-h-0 flex-1 items-center justify-center bg-stage">
          <video
            key={active.path}
            ref={videoRef}
            className="h-full w-full object-contain"
            src={mediaSrc(active.path)}
            controls
            playsInline
            preload="auto"
            onLoadedData={() => void restorePosition()}
            onPlay={() => {
              if (coverHackRef.current) return;
              withVideo(engineControl.startSynced);
            }}
            onPause={() => {
              if (coverHackRef.current) return;
              engineControl.stopFromMedia();
              // 暂停时立即落一次续播位置
              const el = videoRef.current;
              if (el && active) onPositionSave(active.path, el.currentTime);
            }}
            onEnded={() => engineControl.stopFromMedia()}
            onSeeked={() => withVideo(engineControl.align)}
            onRateChange={() => withVideo(engineControl.align)}
            onTimeUpdate={handleTimeUpdate}
          />
        </div>
      </ContextMenu>
    </div>
  );
}
