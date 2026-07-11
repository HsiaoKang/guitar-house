/**
 * 节拍器控制条
 *
 * 工具栏内的节拍器面板：启停、Tap 测速浮窗、BPM 调节（步进输入 +
 * 长按连发 + 滚轮微调）、拍号、重音、音量、媒体联动与拍点指示灯。
 */
import { useState } from "react";
import { motion } from "motion/react";
import { Button, Checkbox, NumberStepper, Select, Slider, Switch, cn } from "@learning-house/ui";
import type { MetronomeOptions } from "@learning-house/metronome-core";
import type { SyncConfig } from "../hooks/useMetronome";
import { TapTempoModal } from "./TapTempoModal";

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
  /** 是否有伴奏音频资源（决定联动可用性） */
  hasAudio: boolean;
  /** 读取当前联动源媒体的播放位置（用于一键设置首拍偏移） */
  getMediaTime: () => number | null;
  /** BPM 识别进行中 */
  detectingBpm: boolean;
  /** 识别当前伴奏 BPM 并自动卡点（自动设置 BPM 与首拍偏移） */
  onDetectBpm: () => void;
  /** TAP 测速结果应用（外层可吸附到识别网格做精确校正） */
  onTapBpm: (bpm: number) => void;
}

/**
 * 节拍器控制条组件
 *
 * @param props 见 MetronomeBarProps 字段说明
 */
export function MetronomeBar(props: MetronomeBarProps) {
  const {
    options,
    updateOptions,
    running,
    toggle,
    activeBeat,
    sync,
    setSync,
    hasAudio,
    getMediaTime,
    detectingBpm,
    onDetectBpm,
    onTapBpm,
  } = props;
  const [tapOpen, setTapOpen] = useState(false);

  /**
   * 把联动源媒体当前播放位置记录为首拍偏移
   */
  const captureOffsetFromMedia = () => {
    const time = getMediaTime();
    if (time !== null) setSync({ firstBeatOffset: +time.toFixed(2) });
  };

  /**
   * 约束 BPM 到合法范围
   *
   * @param value 原始值
   */
  const clampBpm = (value: number) => Math.min(300, Math.max(20, Math.round(value) || 20));

  return (
    <div className="flex h-14 items-center gap-3.5 overflow-x-auto px-3.5">
      <Button
        className="min-w-21"
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
      <TapTempoModal open={tapOpen} onClose={() => setTapOpen(false)} onApply={onTapBpm} />

      <div
        className="flex shrink-0 items-center gap-2"
        onWheel={(e) => {
          // 滚轮微调 BPM（±1）
          e.preventDefault();
          updateOptions({ bpm: clampBpm(options.bpm + (e.deltaY < 0 ? 1 : -1)) });
        }}
      >
        <NumberStepper
          min={20}
          max={300}
          value={options.bpm}
          onChange={(bpm) => updateOptions({ bpm: clampBpm(bpm) })}
          aria-label="BPM"
        />
        <span className="text-xs text-muted-foreground">BPM</span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Select
          value={String(options.beatsPerBar)}
          onChange={(v) => updateOptions({ beatsPerBar: Number(v) })}
          options={BEATS_OPTIONS.map((n) => ({ value: String(n), label: `${n}/4` }))}
          title="拍号（每小节拍数）"
        />
        <Checkbox
          checked={options.accentFirstBeat}
          onChange={(accentFirstBeat) => updateOptions({ accentFirstBeat })}
          label="重音"
        />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span className="text-xs text-muted-foreground">音量</span>
        <Slider
          min={0}
          max={1}
          step={0.05}
          value={options.volume}
          onChange={(volume) => updateOptions({ volume })}
          className="w-[90px]"
          aria-label="节拍器音量"
        />
      </div>

      <div className={cn("flex shrink-0 items-center gap-2", !hasAudio && "opacity-45")}>
        <Switch
          checked={sync.source === "audio"}
          disabled={!hasAudio}
          onChange={(on) => setSync({ source: on ? "audio" : "none" })}
          label="跟随伴奏"
          title="伴奏播放时节拍器自动跟随其时间轴（含倍速缩放）"
        />
        {sync.source !== "none" && (
          <>
            <Button
              variant="ghost"
              size="sm"
              disabled={detectingBpm}
              onClick={onDetectBpm}
              title="分析伴奏节奏，自动设置 BPM 与首拍偏移"
            >
              {detectingBpm ? "识别中…" : "识别 BPM"}
            </Button>
            <span className="text-xs text-muted-foreground">首拍</span>
            <NumberStepper
              min={0}
              max={9999}
              step={0.1}
              value={sync.firstBeatOffset}
              onChange={(firstBeatOffset) => setSync({ firstBeatOffset })}
              title="媒体里第一拍出现的秒数"
              aria-label="首拍偏移（秒）"
            />
            <Button variant="ghost" size="sm" onClick={captureOffsetFromMedia} title="把当前播放位置设为第一拍">
              取当前
            </Button>
          </>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2 pr-1">
        {Array.from({ length: options.beatsPerBar }, (_, i) => {
          const hit = i === activeBeat;
          const accent = hit && i === 0 && options.accentFirstBeat;
          return (
            <motion.span
              key={i}
              animate={hit ? { scale: 1.3 } : { scale: 1 }}
              transition={{ duration: 0.08 }}
              className={cn(
                "size-3.5 rounded-full border border-border bg-secondary",
                hit && !accent && "bg-foreground",
                accent && "bg-primary shadow-[0_0_10px_var(--primary)]",
              )}
            />
          );
        })}
      </div>
    </div>
  );
}
