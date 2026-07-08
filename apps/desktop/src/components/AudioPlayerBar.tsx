/**
 * 伴奏播放条
 *
 * 位于主区与节拍器条之间的横向控制条，播放本地伴奏音频
 * （mp3 / m4a / wav / flac 等），提供进度拖动、倍速、循环与音量控制，
 * 并把媒体事件转发给节拍器实现"跟随伴奏"联动。
 *
 * @author yuchenxi
 */
import { useState, type RefObject } from "react";
import type { MediaEngineControl } from "../hooks/useMetronome";

/** 可选倍速档位（与视频一致，慢速扒歌/合奏场景） */
const PLAYBACK_RATES = [0.5, 0.65, 0.75, 0.85, 1, 1.25, 1.5];

interface AudioPlayerBarProps {
  /** asset 协议音频 URL */
  src: string;
  /** 展示用文件名 */
  fileName: string;
  /** 触发文件选择 */
  onOpenFile: () => void;
  /** 关闭伴奏（清空当前文件） */
  onClose: () => void;
  /** audio 元素引用（供 App 层查询播放进度） */
  audioRef: RefObject<HTMLAudioElement | null>;
  /** 节拍器联动控制接口（audio 源） */
  engineControl: MediaEngineControl;
}

/**
 * 把秒数格式化为 m:ss 形式
 *
 * @param sec 秒数
 * @returns 格式化字符串，如 3:07
 */
function formatTime(sec: number): string {
  if (!Number.isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * 伴奏播放条组件
 *
 * @param props 见 AudioPlayerBarProps 字段说明
 */
export function AudioPlayerBar(props: AudioPlayerBarProps) {
  const { src, fileName, onOpenFile, onClose, audioRef, engineControl } = props;
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const [loop, setLoop] = useState(false);
  const [volume, setVolume] = useState(1);

  /**
   * 读取音频元素当前进度并执行回调（元素不存在时忽略）
   *
   * @param fn 拿到 (currentTime, playbackRate) 后的处理函数
   */
  const withAudio = (fn: (time: number, rate: number) => void) => {
    const el = audioRef.current;
    if (el) fn(el.currentTime, el.playbackRate);
  };

  /**
   * 播放/暂停切换
   */
  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  };

  /**
   * 拖动进度条跳转到指定秒数
   *
   * @param time 目标时间（秒）
   */
  const seekTo = (time: number) => {
    const el = audioRef.current;
    if (el) el.currentTime = time;
  };

  /**
   * 修改倍速并同步到 audio 元素
   *
   * @param next 目标倍速
   */
  const changeRate = (next: number) => {
    setRate(next);
    const el = audioRef.current;
    if (el) el.playbackRate = next;
  };

  /**
   * 修改音量并同步到 audio 元素
   *
   * @param next 目标音量 0-1
   */
  const changeVolume = (next: number) => {
    setVolume(next);
    const el = audioRef.current;
    if (el) el.volume = next;
  };

  return (
    <div className="audio-bar">
      <audio
        ref={audioRef}
        src={src}
        loop={loop}
        onPlay={() => {
          setPlaying(true);
          withAudio(engineControl.startSynced);
        }}
        onPause={() => {
          setPlaying(false);
          engineControl.stopFromMedia();
        }}
        onEnded={() => {
          setPlaying(false);
          engineControl.stopFromMedia();
        }}
        onSeeked={() => withAudio(engineControl.align)}
        onRateChange={() => withAudio(engineControl.align)}
        onTimeUpdate={() => {
          setCurrentTime(audioRef.current?.currentTime ?? 0);
          withAudio(engineControl.align);
        }}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
      />

      <span className="audio-tag">伴奏</span>
      <button className="btn btn-ghost audio-play-btn" onClick={togglePlay}>
        {playing ? "⏸" : "▶"}
      </button>

      <span className="audio-time">{formatTime(currentTime)}</span>
      <input
        className="audio-progress"
        type="range"
        min={0}
        max={duration || 0}
        step={0.01}
        value={currentTime}
        onChange={(e) => seekTo(Number(e.target.value))}
      />
      <span className="audio-time">{formatTime(duration)}</span>

      <div className="rate-group">
        {PLAYBACK_RATES.map((r) => (
          <button key={r} className={`rate-btn ${r === rate ? "active" : ""}`} onClick={() => changeRate(r)}>
            {r}x
          </button>
        ))}
      </div>

      <label className="metro-check" title="播放到结尾自动从头循环">
        <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
        循环
      </label>

      <div className="metro-group">
        <span className="metro-label">音量</span>
        <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => changeVolume(Number(e.target.value))} />
      </div>

      <span className="panel-title audio-name" title={fileName}>
        {fileName}
      </span>
      <button className="btn btn-ghost" onClick={onOpenFile}>
        换伴奏
      </button>
      <button className="btn btn-ghost" onClick={onClose} title="关闭伴奏">
        ✕
      </button>
    </div>
  );
}
