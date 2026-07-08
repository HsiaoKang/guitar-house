/**
 * 本地视频播放器
 *
 * 使用 HTML5 video 播放 Tauri asset 协议暴露的本地文件，
 * 提供倍速控制，并把媒体事件转发给节拍器实现联动：
 * 播放 -> 节拍器按视频时间轴启动；暂停/结束 -> 停止；
 * 跳转/倍速变化/周期性 timeupdate -> 重新对齐。
 *
 * @author yuchenxi
 */
import { type RefObject } from "react";
import type { MediaEngineControl } from "../hooks/useMetronome";

/** 可选倍速档位（慢速练习是核心场景） */
const PLAYBACK_RATES = [0.5, 0.65, 0.75, 0.85, 1, 1.25, 1.5];

interface VideoPlayerProps {
  /** asset 协议 URL，null 表示尚未打开视频 */
  src: string | null;
  /** 展示用文件名 */
  fileName: string | null;
  /** 当前倍速 */
  playbackRate: number;
  /** 倍速变更回调 */
  onRateChange: (rate: number) => void;
  /** 触发文件选择 */
  onOpenFile: () => void;
  /** 视频元素引用（供 App 层查询播放状态） */
  videoRef: RefObject<HTMLVideoElement | null>;
  /** 节拍器联动控制接口（video 源） */
  engineControl: MediaEngineControl;
}

/**
 * 视频播放区组件
 *
 * @param props 见 VideoPlayerProps 字段说明
 */
export function VideoPlayer(props: VideoPlayerProps) {
  const { src, fileName, playbackRate, onRateChange, onOpenFile, videoRef, engineControl } = props;

  /**
   * 读取视频元素当前进度并执行回调（元素不存在时忽略）
   *
   * @param fn 拿到 (currentTime, playbackRate) 后的处理函数
   */
  const withVideo = (fn: (time: number, rate: number) => void) => {
    const el = videoRef.current;
    if (el) fn(el.currentTime, el.playbackRate);
  };

  if (!src) {
    return (
      <div className="panel-empty">
        <div className="panel-empty-icon">▶</div>
        <p>还没有打开视频</p>
        <button className="btn btn-primary" onClick={onOpenFile}>
          打开本地视频
        </button>
        <p className="panel-empty-hint">支持 mp4 / mov / m4v / webm</p>
      </div>
    );
  }

  return (
    <div className="video-player">
      <div className="panel-toolbar">
        <span className="panel-title" title={fileName ?? ""}>
          {fileName}
        </span>
        <div className="rate-group">
          {PLAYBACK_RATES.map((rate) => (
            <button
              key={rate}
              className={`rate-btn ${rate === playbackRate ? "active" : ""}`}
              onClick={() => onRateChange(rate)}
            >
              {rate}x
            </button>
          ))}
        </div>
        <button className="btn btn-ghost" onClick={onOpenFile}>
          换视频
        </button>
      </div>
      <div className="video-stage">
        <video
          ref={videoRef}
          src={src}
          controls
          playsInline
          onPlay={() => withVideo(engineControl.startSynced)}
          onPause={() => engineControl.stopFromMedia()}
          onEnded={() => engineControl.stopFromMedia()}
          onSeeked={() => withVideo(engineControl.align)}
          onRateChange={() => withVideo(engineControl.align)}
          onTimeUpdate={() => withVideo(engineControl.align)}
        />
      </div>
    </div>
  );
}
