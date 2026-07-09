/**
 * 节拍器控制条
 *
 * 工具栏内的节拍器面板：启停、Tap 测速浮窗、BPM 调节、拍号、
 * 重音、音量、媒体联动开关与首拍偏移设置、拍点指示灯。
 */
import { useState } from "react";
import { Button, Checkbox, Select, Slider } from "@learning-house/ui";
import type { MetronomeOptions } from "@learning-house/metronome-core";
import type { SyncConfig, SyncSource } from "../hooks/useMetronome";
import { TapTempoModal } from "./TapTempoModal";
import {
  beatDot,
  beatLights,
  bpmInput,
  metroGroup,
  metroLabel,
  metronomeBar,
  metroToggle,
  offsetInput,
} from "./metronome.css";

/** 可选拍号（每小节拍数） */
const BEATS_OPTIONS = [2, 3, 4, 6];

interface MetronomeBarProps {
  options: MetronomeOptions;
  updateOptions: (patch: Partial<MetronomeOptions>) => void;
  running: boolean;
  toggle: () => void;
  activeBeat: number;
  sync: SyncConfig;
  setSync: (patch: Partial<SyncConfig>) => void;
  /** 是否有视频资源（决定联动源可选性） */
  hasVideo: boolean;
  /** 是否有音频资源（决定联动源可选性） */
  hasAudio: boolean;
  /** 读取当前联动源媒体的播放位置（用于一键设置首拍偏移） */
  getMediaTime: () => number | null;
}

/**
 * 节拍器控制条组件
 *
 * @param props 见 MetronomeBarProps 字段说明
 */
export function MetronomeBar(props: MetronomeBarProps) {
  const { options, updateOptions, running, toggle, activeBeat, sync, setSync, hasVideo, hasAudio, getMediaTime } = props;
  const [tapOpen, setTapOpen] = useState(false);

  /**
   * 把联动源媒体当前播放位置记录为首拍偏移
   */
  const captureOffsetFromMedia = () => {
    const time = getMediaTime();
    if (time !== null) setSync({ firstBeatOffset: +time.toFixed(2) });
  };

  /**
   * 计算拍点灯的命中状态标记
   *
   * @param index 灯序号
   * @returns "accent" 重拍 / "true" 普通拍 / undefined 未命中
   */
  const hitStateOf = (index: number): "accent" | "true" | undefined => {
    if (index !== activeBeat) return undefined;
    return index === 0 && options.accentFirstBeat ? "accent" : "true";
  };

  return (
    <div className={metronomeBar}>
      <Button
        className={metroToggle}
        icon={running ? "stop" : "play"}
        active={running}
        onClick={toggle}
        title="启动/停止节拍器（自由模式）"
      >
        {running ? "停止" : "节拍"}
      </Button>
      <Button variant="ghost" onClick={() => setTapOpen(true)} title="打开 Tap Tempo 浮窗测速">
        TAP
      </Button>
      <TapTempoModal open={tapOpen} onClose={() => setTapOpen(false)} onApply={(bpm) => updateOptions({ bpm })} />

      <div className={metroGroup}>
        <Slider min={20} max={300} value={options.bpm} onChange={(bpm) => updateOptions({ bpm })} aria-label="BPM" />
        <input
          className={bpmInput}
          type="number"
          min={20}
          max={300}
          value={options.bpm}
          onChange={(e) => updateOptions({ bpm: Math.min(300, Math.max(20, Number(e.target.value) || 20)) })}
        />
        <span className={metroLabel}>BPM</span>
      </div>

      <div className={metroGroup}>
        <Select
          value={options.beatsPerBar}
          onChange={(e) => updateOptions({ beatsPerBar: Number(e.target.value) })}
          title="拍号（每小节拍数）"
        >
          {BEATS_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}/4
            </option>
          ))}
        </Select>
        <Checkbox
          checked={options.accentFirstBeat}
          onChange={(accentFirstBeat) => updateOptions({ accentFirstBeat })}
          label="重音"
        />
      </div>

      <div className={metroGroup}>
        <span className={metroLabel}>音量</span>
        <Slider
          min={0}
          max={1}
          step={0.05}
          value={options.volume}
          onChange={(volume) => updateOptions({ volume })}
          width="90px"
          aria-label="节拍器音量"
        />
      </div>

      <div className={metroGroup} data-disabled={!hasVideo && !hasAudio ? "true" : undefined}>
        <span className={metroLabel}>联动</span>
        <Select
          value={sync.source}
          disabled={!hasVideo && !hasAudio}
          onChange={(e) => setSync({ source: e.target.value as SyncSource })}
          title="媒体播放时节拍器自动跟随其时间轴（含倍速缩放）"
        >
          <option value="none">不联动</option>
          <option value="video" disabled={!hasVideo}>
            跟随视频
          </option>
          <option value="audio" disabled={!hasAudio}>
            跟随音频
          </option>
        </Select>
        {sync.source !== "none" && (
          <>
            <span className={metroLabel}>首拍</span>
            <input
              className={`${bpmInput} ${offsetInput}`}
              type="number"
              min={0}
              step={0.1}
              value={sync.firstBeatOffset}
              onChange={(e) => setSync({ firstBeatOffset: Math.max(0, Number(e.target.value) || 0) })}
              title="媒体里第一拍出现的秒数"
            />
            <Button variant="ghost" size="sm" onClick={captureOffsetFromMedia} title="把当前播放位置设为第一拍">
              取当前
            </Button>
          </>
        )}
      </div>

      <div className={beatLights}>
        {Array.from({ length: options.beatsPerBar }, (_, i) => (
          <span key={i} className={beatDot} data-hit={hitStateOf(i)} />
        ))}
      </div>
    </div>
  );
}
