/**
 * 课节视频播放器
 *
 * 播放当前课节内的视频资源（Tauri asset 协议访问本地文件），
 * 多个视频时提供 tab 切换；支持倍速、播放位置记忆（续播），
 * 并把媒体事件转发给节拍器实现"跟随视频"联动。
 */
import { useEffect, useRef, useState, type RefObject } from "react";
import { EmptyState, Tabs } from "@learning-house/ui";
import { mediaSrc } from "../lib/platform";
import type { MediaEngineControl } from "../hooks/useMetronome";
import type { LessonResource } from "../types";
import { panelTitle, panelToolbar } from "../styles/layout.css";
import { videoEl, videoPlayer, videoStage } from "./videoplayer.css";
import { RateGroup } from "./RateGroup";

/** 续播位置保存节流间隔（毫秒） */
const POSITION_SAVE_INTERVAL_MS = 3000;

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
  const [playbackRate, setPlaybackRate] = useState(1);
  const lastSaveRef = useRef(0);

  // 课节切换（资源列表变化）时回到第一个视频
  useEffect(() => {
    setActiveIndex(0);
    setPlaybackRate(1);
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
   * 修改倍速并同步到 video 元素（节拍器经 ratechange 事件自动对齐）
   *
   * @param rate 目标倍速
   */
  const changeRate = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) videoRef.current.playbackRate = rate;
  };

  /**
   * 元数据加载完成后恢复续播位置并应用当前倍速
   */
  const restorePosition = () => {
    const el = videoRef.current;
    if (!el || !active) return;
    el.playbackRate = playbackRate;
    const saved = getSavedPosition(active.path);
    // 接近结尾的记录不恢复，避免一打开就结束
    if (saved > 1 && saved < el.duration - 3) {
      el.currentTime = saved;
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

  if (!active) {
    return <EmptyState icon="video" title="本课节没有视频资源" />;
  }

  return (
    <div className={videoPlayer}>
      <div className={panelToolbar}>
        {resources.length > 1 ? (
          <Tabs
            items={resources.map((res) => ({ key: res.path, label: res.name }))}
            activeKey={active.path}
            onChange={(key) => setActiveIndex(resources.findIndex((r) => r.path === key))}
          />
        ) : (
          <span className={panelTitle} title={active.name}>
            {active.name}
          </span>
        )}
        <RateGroup value={playbackRate} onChange={changeRate} />
      </div>
      <div className={videoStage}>
        <video
          key={active.path}
          ref={videoRef}
          className={videoEl}
          src={mediaSrc(active.path)}
          controls
          playsInline
          onLoadedMetadata={restorePosition}
          onPlay={() => withVideo(engineControl.startSynced)}
          onPause={() => {
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
    </div>
  );
}
