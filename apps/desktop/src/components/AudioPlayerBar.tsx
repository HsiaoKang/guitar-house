/**
 * 伴奏/音频播放条
 *
 * 位于主区与工具栏之间的横向控制条，播放当前课节的音频资源，
 * 多个音频时提供下拉切换；提供进度拖动、倍速、循环与音量控制，
 * 并把媒体事件转发给节拍器实现"跟随音频"联动。
 */
import { useEffect, useState, type RefObject } from "react";
import { Checkbox, IconButton, Select, Slider } from "@learning-house/ui";
import { mediaSrc } from "../lib/platform";
import { formatTime } from "../lib/format";
import type { MediaEngineControl } from "../hooks/useMetronome";
import type { LessonResource } from "../types";
import { RateSelect } from "./RateSelect";
import { VolumeControl } from "./VolumeControl";

interface AudioPlayerBarProps {
  /** 当前课节的音频资源列表（非空时才渲染本组件） */
  resources: LessonResource[];
  /** audio 元素引用（供外层查询播放进度） */
  audioRef: RefObject<HTMLAudioElement | null>;
  /** 节拍器联动控制接口（audio 源） */
  engineControl: MediaEngineControl;
  /** 当前选中的伴奏路径变化时上报（无伴奏时为 null） */
  onActiveResourceChange?: (path: string | null) => void;
}

/**
 * 音频播放条组件
 *
 * @param props 见 AudioPlayerBarProps 字段说明
 */
export function AudioPlayerBar(props: AudioPlayerBarProps) {
  const { resources, audioRef, engineControl, onActiveResourceChange } = props;
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const [loop, setLoop] = useState(false);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  /** 音量变化信号（递增），驱动音量浮层的视觉反馈 */
  const [volumeFlash, setVolumeFlash] = useState(0);

  // 课节切换时回到第一个音频，并重置播放进度
  // （多个课节共用同一份伴奏时元素不重建，进度与播放状态会残留）
  useEffect(() => {
    setActiveIndex(0);
    setPlaying(false);
    setRate(1);
    setCurrentTime(0);
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
      el.playbackRate = 1;
    }
  }, [resources, audioRef]);

  const active = resources[Math.min(activeIndex, resources.length - 1)] ?? null;

  // 快捷键音量调整的反馈信号（自定义事件；程序性 volumechange 不触发浮层）
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onFlash = () => setVolumeFlash((n) => n + 1);
    el.addEventListener("app:volumeflash", onFlash);
    return () => el.removeEventListener("app:volumeflash", onFlash);
  }, [audioRef, active?.path]);

  // 当前伴奏变化时上报（BPM 识别等外部功能需要知道正在用哪个伴奏）
  useEffect(() => {
    onActiveResourceChange?.(active?.path ?? null);
  }, [active?.path, onActiveResourceChange]);

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
    const el = audioRef.current;
    if (el) {
      el.volume = next;
      el.muted = next === 0;
    }
  };

  if (!active) return null;

  return (
    <div className="flex h-[46px] shrink-0 items-center gap-2 overflow-x-auto border-t border-border bg-secondary/60 px-3.5">
      <audio
        key={active.path}
        ref={audioRef}
        src={mediaSrc(active.path)}
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
        onLoadedMetadata={() => {
          setDuration(audioRef.current?.duration ?? 0);
          if (audioRef.current) audioRef.current.playbackRate = rate;
        }}
        onVolumeChange={() => {
          const el = audioRef.current;
          if (el) {
            setVolume(el.volume);
            setMuted(el.muted);
          }
        }}
      />

      <span className="shrink-0 rounded border border-primary px-1.5 py-px text-xs font-semibold text-primary">
        音频
      </span>
      <IconButton name={playing ? "pause" : "play"} label={playing ? "暂停" : "播放"} onClick={togglePlay} />

      {resources.length > 1 && (
        <Select
          value={String(activeIndex)}
          onChange={(v) => setActiveIndex(Number(v))}
          options={resources.map((res, i) => ({ value: String(i), label: res.name }))}
          className="max-w-45"
          title="切换音频"
        />
      )}

      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatTime(currentTime)}</span>
      <Slider
        className="w-auto min-w-30 flex-1"
        min={0}
        max={duration || 0}
        step={0.01}
        value={currentTime}
        onChange={seekTo}
        aria-label="播放进度"
      />
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatTime(duration)}</span>

      <RateSelect value={rate} onChange={changeRate} />

      <Checkbox checked={loop} onChange={setLoop} label="循环" title="播放到结尾自动从头循环" />

      <VolumeControl
        volume={volume}
        muted={muted}
        flashSignal={volumeFlash}
        onVolumeChange={changeVolume}
        onToggleMute={() => {
          const el = audioRef.current;
          if (el) el.muted = !el.muted;
        }}
      />

      {resources.length === 1 && (
        <span className="min-w-0 max-w-50 truncate text-xs text-muted-foreground" title={active.name}>
          {active.name}
        </span>
      )}
    </div>
  );
}
