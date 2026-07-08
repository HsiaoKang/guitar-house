/**
 * 节拍器 React Hook
 *
 * 封装 Metronome 引擎实例的生命周期，并向组件暴露响应式的
 * 参数状态、启停控制以及与媒体元素（视频/伴奏）的联动绑定。
 *
 * @author yuchenxi
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Metronome, type MetronomeOptions } from "@guitar-house/metronome-core";

/** 联动源：节拍器跟随哪个媒体的时间轴 */
export type SyncSource = "none" | "video" | "audio";

/** 联动配置 */
export interface SyncConfig {
  /** 联动源（none 表示不联动） */
  source: SyncSource;
  /** 媒体时间轴上第一拍出现的时刻（秒），用于对齐小节 */
  firstBeatOffset: number;
}

/** 供单个媒体播放器挂接的引擎控制接口（已绑定联动源） */
export interface MediaEngineControl {
  /** 媒体开始播放：按其时间轴启动节拍器 */
  startSynced: (mediaTime: number, playbackRate: number) => void;
  /** 媒体进度/倍速变化：重新对齐 */
  align: (mediaTime: number, playbackRate: number) => void;
  /** 媒体暂停/结束：停止节拍器 */
  stopFromMedia: () => void;
}

export interface UseMetronomeResult {
  /** 节拍器参数 */
  options: MetronomeOptions;
  /** 更新节拍器参数 */
  updateOptions: (patch: Partial<MetronomeOptions>) => void;
  /** 是否正在发声 */
  running: boolean;
  /** 自由模式启动/停止切换 */
  toggle: () => void;
  /** 当前拍在小节内的序号（-1 表示未运行），用于指示灯 */
  activeBeat: number;
  /** 联动配置 */
  sync: SyncConfig;
  /** 更新联动配置 */
  setSync: (patch: Partial<SyncConfig>) => void;
  /** 为指定联动源生成引擎控制接口（源不匹配时调用会被忽略） */
  bindSource: (source: Exclude<SyncSource, "none">) => MediaEngineControl;
  /** Tap Tempo：连续点按推算 BPM */
  tapTempo: () => void;
}

/**
 * 创建并管理一个节拍器实例
 *
 * @returns 节拍器状态与控制接口
 */
export function useMetronome(): UseMetronomeResult {
  const engineRef = useRef<Metronome | null>(null);
  if (engineRef.current === null) {
    engineRef.current = new Metronome();
  }
  const engine = engineRef.current;

  const [options, setOptions] = useState<MetronomeOptions>(engine.getOptions());
  const [running, setRunning] = useState(false);
  const [activeBeat, setActiveBeat] = useState(-1);
  const [sync, setSyncState] = useState<SyncConfig>({ source: "none", firstBeatOffset: 0 });
  const syncRef = useRef(sync);
  syncRef.current = sync;
  const tapTimesRef = useRef<number[]>([]);

  // 订阅拍事件驱动指示灯；组件卸载时释放音频资源
  useEffect(() => {
    const off = engine.onBeat((e) => setActiveBeat(e.beatInBar));
    return () => {
      off();
      engine.dispose();
    };
  }, [engine]);

  const updateOptions = useCallback(
    (patch: Partial<MetronomeOptions>) => {
      engine.setOptions(patch);
      setOptions(engine.getOptions());
    },
    [engine],
  );

  const toggle = useCallback(() => {
    if (engine.isRunning) {
      engine.stop();
      setRunning(false);
      setActiveBeat(-1);
    } else {
      engine.start();
      setRunning(true);
    }
  }, [engine]);

  const setSync = useCallback(
    (patch: Partial<SyncConfig>) => {
      // 切换联动源时停掉正在响的节拍，避免旧源残留的错误节拍
      if (patch.source !== undefined && patch.source !== syncRef.current.source && engine.isRunning) {
        engine.stop();
        setRunning(false);
        setActiveBeat(-1);
      }
      setSyncState((prev) => ({ ...prev, ...patch }));
    },
    [engine],
  );

  /**
   * Tap Tempo 实现：取最近 5 次点按的平均间隔换算 BPM。
   * 超过 2 秒未点按则重新计数。
   */
  const tapTempo = useCallback(() => {
    const now = performance.now();
    const taps = tapTimesRef.current;
    if (taps.length > 0 && now - taps[taps.length - 1] > 2000) {
      taps.length = 0;
    }
    taps.push(now);
    if (taps.length > 5) taps.shift();
    if (taps.length >= 2) {
      const avgMs = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
      const bpm = Math.round(Math.min(300, Math.max(20, 60000 / avgMs)));
      updateOptions({ bpm });
    }
  }, [updateOptions]);

  /**
   * 为指定媒体源生成引擎控制接口。
   * 关键节点：仅当该源是当前选中的联动源时，媒体事件才会驱动节拍器，
   * 因此视频与伴奏可以各自挂接而互不干扰。
   *
   * @param source 媒体源标识（video / audio）
   */
  const bindSource = useCallback(
    (source: Exclude<SyncSource, "none">): MediaEngineControl => ({
      startSynced: (mediaTime: number, playbackRate: number) => {
        if (syncRef.current.source !== source) return;
        engine.startSynced({
          mediaTime,
          playbackRate,
          firstBeatOffset: syncRef.current.firstBeatOffset,
        });
        setRunning(true);
      },
      align: (mediaTime: number, playbackRate: number) => {
        if (syncRef.current.source !== source) return;
        engine.align({
          mediaTime,
          playbackRate,
          firstBeatOffset: syncRef.current.firstBeatOffset,
        });
      },
      stopFromMedia: () => {
        if (syncRef.current.source !== source) return;
        engine.stop();
        setRunning(false);
        setActiveBeat(-1);
      },
    }),
    [engine],
  );

  return { options, updateOptions, running, toggle, activeBeat, sync, setSync, bindSource, tapTempo };
}
