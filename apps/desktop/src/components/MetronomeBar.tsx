/**
 * 节拍器控制条
 *
 * 底部固定条，提供：启停、Tap 测速、BPM 调节、拍号、重音、
 * 音量、视频联动开关与首拍偏移设置、拍点指示灯。
 *
 * @author yuchenxi
 */
import type { MetronomeOptions } from "@guitar-house/metronome-core";
import type { SyncConfig, SyncSource } from "../hooks/useMetronome";

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
  tapTempo: () => void;
  /** 是否已打开视频（决定联动源可选性） */
  hasVideo: boolean;
  /** 是否已打开伴奏（决定联动源可选性） */
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
  const { options, updateOptions, running, toggle, activeBeat, sync, setSync, tapTempo, hasVideo, hasAudio, getMediaTime } = props;

  /**
   * 把联动源媒体当前播放位置记录为首拍偏移
   */
  const captureOffsetFromMedia = () => {
    const time = getMediaTime();
    if (time !== null) setSync({ firstBeatOffset: +time.toFixed(2) });
  };

  return (
    <div className="metronome-bar">
      <button className={`btn btn-metro ${running ? "running" : ""}`} onClick={toggle} title="启动/停止节拍器（自由模式）">
        {running ? "■ 停止" : "▶ 节拍"}
      </button>
      <button className="btn btn-ghost" onClick={tapTempo} title="按节奏连点几下自动测出 BPM">
        TAP
      </button>

      <div className="metro-group bpm-group">
        <input
          type="range"
          min={20}
          max={300}
          value={options.bpm}
          onChange={(e) => updateOptions({ bpm: Number(e.target.value) })}
        />
        <input
          className="bpm-input"
          type="number"
          min={20}
          max={300}
          value={options.bpm}
          onChange={(e) => updateOptions({ bpm: Math.min(300, Math.max(20, Number(e.target.value) || 20)) })}
        />
        <span className="metro-label">BPM</span>
      </div>

      <div className="metro-group">
        <select
          value={options.beatsPerBar}
          onChange={(e) => updateOptions({ beatsPerBar: Number(e.target.value) })}
          title="拍号（每小节拍数）"
        >
          {BEATS_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}/4
            </option>
          ))}
        </select>
        <label className="metro-check">
          <input
            type="checkbox"
            checked={options.accentFirstBeat}
            onChange={(e) => updateOptions({ accentFirstBeat: e.target.checked })}
          />
          重音
        </label>
      </div>

      <div className="metro-group">
        <span className="metro-label">音量</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={options.volume}
          onChange={(e) => updateOptions({ volume: Number(e.target.value) })}
        />
      </div>

      <div className={`metro-group sync-group ${hasVideo || hasAudio ? "" : "disabled"}`}>
        <span className="metro-label">联动</span>
        <select
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
            跟随伴奏
          </option>
        </select>
        {sync.source !== "none" && (
          <>
            <span className="metro-label">首拍</span>
            <input
              className="bpm-input offset-input"
              type="number"
              min={0}
              step={0.1}
              value={sync.firstBeatOffset}
              onChange={(e) => setSync({ firstBeatOffset: Math.max(0, Number(e.target.value) || 0) })}
              title="媒体里第一拍出现的秒数"
            />
            <button className="btn btn-ghost" onClick={captureOffsetFromMedia} title="把当前播放位置设为第一拍">
              取当前
            </button>
          </>
        )}
      </div>

      <div className="beat-lights">
        {Array.from({ length: options.beatsPerBar }, (_, i) => (
          <span
            key={i}
            className={`beat-dot ${i === activeBeat ? (i === 0 && options.accentFirstBeat ? "hit accent" : "hit") : ""}`}
          />
        ))}
      </div>
    </div>
  );
}
