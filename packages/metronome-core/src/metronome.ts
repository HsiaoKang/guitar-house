/**
 * 节拍器引擎
 *
 * 基于经典的 lookahead 调度模型（"A Tale of Two Clocks"）：
 * 用 setInterval 做粗粒度轮询，每次向前扫描一小段时间窗口，
 * 把窗口内的拍子用 AudioContext 的采样级时钟精准调度，
 * 从而避免 JS 定时器抖动带来的节拍不稳。
 *
 * 支持两种模式：
 * - free：自由模式，按 BPM 独立打拍
 * - sync：联动模式，拍点锚定在视频时间轴上，随视频起停/倍速/跳转
 */
import type { BeatEvent, MetronomeOptions, TimelineAlignment } from "./types";

/** 调度轮询间隔（毫秒） */
const LOOKAHEAD_INTERVAL_MS = 25;
/** 每次轮询向前调度的时间窗口（秒） */
const SCHEDULE_AHEAD_SEC = 0.12;
/** 联动模式下允许的时钟漂移阈值（秒），超过则重新锚定 */
const DRIFT_TOLERANCE_SEC = 0.035;

export class Metronome {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private timerId: ReturnType<typeof setInterval> | null = null;

  private options: MetronomeOptions = {
    bpm: 90,
    beatsPerBar: 4,
    accentFirstBeat: true,
    volume: 0.8,
  };

  /** 下一拍的全局拍序号（从第一拍起算） */
  private nextBeatIndex = 0;
  /** 下一拍的 AudioContext 时间（仅自由模式使用） */
  private nextBeatTime = 0;

  /** 联动模式锚点：ctx 时间与媒体时间的映射关系 */
  private anchorCtxTime = 0;
  private anchorMediaTime = 0;
  private playbackRate = 1;
  private firstBeatOffset = 0;
  private syncMode = false;

  /** 已调度但尚未发声的音频节点，用于跳转时取消 */
  private scheduledNodes: { osc: OscillatorNode; time: number }[] = [];
  /** 等待通知 UI 的拍事件队列 */
  private pendingEvents: BeatEvent[] = [];
  private beatListeners = new Set<(e: BeatEvent) => void>();

  private running = false;

  /**
   * 获取节拍器是否正在运行
   */
  get isRunning(): boolean {
    return this.running;
  }

  /**
   * 获取当前参数快照
   */
  getOptions(): MetronomeOptions {
    return { ...this.options };
  }

  /**
   * 更新节拍器参数（BPM、拍号、重音、音量），运行中即时生效
   *
   * @param patch 需要变更的参数子集
   */
  setOptions(patch: Partial<MetronomeOptions>): void {
    const prevBpm = this.options.bpm;
    this.options = { ...this.options, ...patch };
    if (this.masterGain && patch.volume !== undefined) {
      this.masterGain.gain.value = patch.volume;
    }
    // 自由模式下改 BPM：保持下一拍时刻不变，后续拍距按新 BPM 计算即可。
    // 联动模式下改 BPM 会改变拍点在媒体时间轴上的分布，需要清掉已调度的拍重新计算
    if (this.syncMode && patch.bpm !== undefined && patch.bpm !== prevBpm) {
      this.cancelScheduled();
      this.recomputeNextBeatFromMediaTime(this.currentMediaTime());
    }
  }

  /**
   * 订阅拍事件（用于 UI 拍点指示灯），返回取消订阅函数
   *
   * @param listener 拍事件回调
   */
  onBeat(listener: (e: BeatEvent) => void): () => void {
    this.beatListeners.add(listener);
    return () => this.beatListeners.delete(listener);
  }

  /**
   * 以自由模式启动：立刻从第一拍开始按 BPM 打拍
   */
  start(): void {
    this.ensureContext();
    if (this.running) this.stopInternal();
    this.syncMode = false;
    this.nextBeatIndex = 0;
    this.nextBeatTime = this.ctx!.currentTime + 0.06;
    this.startScheduler();
  }

  /**
   * 以联动模式启动：拍点锚定到视频时间轴，跟随视频进度发声
   *
   * @param alignment 视频当前进度、倍速与首拍偏移
   */
  startSynced(alignment: TimelineAlignment): void {
    this.ensureContext();
    if (this.running) this.stopInternal();
    this.syncMode = true;
    this.applyAlignment(alignment);
    this.startScheduler();
  }

  /**
   * 联动模式下重新对齐时间轴。
   * 视频 seek / 倍速变化 / 周期性漂移校正时由宿主调用；
   * 小于漂移阈值的偏差会被忽略，避免频繁重锚引起的节拍抖动。
   *
   * @param alignment 视频当前进度、倍速与首拍偏移
   */
  align(alignment: TimelineAlignment): void {
    if (!this.running || !this.syncMode || !this.ctx) return;
    const rateChanged = alignment.playbackRate !== this.playbackRate;
    const offsetChanged = alignment.firstBeatOffset !== this.firstBeatOffset;
    const drift = Math.abs(this.currentMediaTime() - alignment.mediaTime);
    if (!rateChanged && !offsetChanged && drift < DRIFT_TOLERANCE_SEC) return;
    // 关键节点：偏差超阈值（seek/倍速变化），取消未发声的拍并重建锚点
    this.cancelScheduled();
    this.applyAlignment(alignment);
  }

  /**
   * 停止节拍器并取消所有未发声的拍
   */
  stop(): void {
    this.stopInternal();
  }

  /**
   * 释放音频资源（组件卸载时调用）
   */
  dispose(): void {
    this.stopInternal();
    this.beatListeners.clear();
    void this.ctx?.close();
    this.ctx = null;
    this.masterGain = null;
  }

  /**
   * 惰性创建 AudioContext（需在用户手势后调用才能发声）
   */
  private ensureContext(): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    this.ctx = new AudioContext({ latencyHint: "interactive" });
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.options.volume;
    this.masterGain.connect(this.ctx.destination);
  }

  /**
   * 启动调度轮询循环
   */
  private startScheduler(): void {
    this.running = true;
    this.schedulerTick();
    this.timerId = setInterval(() => this.schedulerTick(), LOOKAHEAD_INTERVAL_MS);
  }

  /**
   * 停止调度循环并清理已排队的音频节点与事件
   */
  private stopInternal(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.cancelScheduled();
    this.pendingEvents = [];
    this.running = false;
  }

  /**
   * 调度循环单次 tick：调度时间窗口内的拍子 + 派发到期的 UI 拍事件
   */
  private schedulerTick(): void {
    if (!this.ctx) return;
    const horizon = this.ctx.currentTime + SCHEDULE_AHEAD_SEC;
    while (this.nextBeatCtxTime() < horizon) {
      this.scheduleBeat(this.nextBeatCtxTime(), this.nextBeatIndex);
      this.nextBeatIndex += 1;
      if (!this.syncMode) {
        this.nextBeatTime += 60 / this.options.bpm;
      }
    }
    this.flushDueEvents();
  }

  /**
   * 计算下一拍对应的 AudioContext 时间。
   * 自由模式直接返回累加值；联动模式把媒体时间轴上的拍点换算到 ctx 时间轴
   */
  private nextBeatCtxTime(): number {
    if (!this.syncMode) return this.nextBeatTime;
    const beatDur = 60 / this.options.bpm;
    const mediaBeatTime = this.firstBeatOffset + this.nextBeatIndex * beatDur;
    return this.mediaTimeToCtxTime(mediaBeatTime);
  }

  /**
   * 将媒体时间换算为 AudioContext 时间（考虑倍速）
   *
   * @param mediaTime 视频时间轴上的时刻（秒）
   */
  private mediaTimeToCtxTime(mediaTime: number): number {
    return this.anchorCtxTime + (mediaTime - this.anchorMediaTime) / this.playbackRate;
  }

  /**
   * 根据锚点推算当前媒体时间
   */
  private currentMediaTime(): number {
    if (!this.ctx) return 0;
    return this.anchorMediaTime + (this.ctx.currentTime - this.anchorCtxTime) * this.playbackRate;
  }

  /**
   * 建立联动锚点并计算下一拍序号
   *
   * @param alignment 对齐参数
   */
  private applyAlignment(alignment: TimelineAlignment): void {
    this.anchorCtxTime = this.ctx!.currentTime;
    this.anchorMediaTime = alignment.mediaTime;
    this.playbackRate = Math.max(0.1, alignment.playbackRate);
    this.firstBeatOffset = alignment.firstBeatOffset;
    this.recomputeNextBeatFromMediaTime(alignment.mediaTime);
  }

  /**
   * 从指定媒体时间起找到下一个拍点序号（首拍之前从 0 号拍开始）
   *
   * @param mediaTime 视频时间轴上的时刻（秒）
   */
  private recomputeNextBeatFromMediaTime(mediaTime: number): void {
    const beatDur = 60 / this.options.bpm;
    this.nextBeatIndex = Math.max(0, Math.ceil((mediaTime - this.firstBeatOffset - 1e-6) / beatDur));
  }

  /**
   * 在指定时间点合成一次 click 音，并把拍事件压入 UI 通知队列
   *
   * @param time 目标 AudioContext 时间
   * @param beatIndex 全局拍序号
   */
  private scheduleBeat(time: number, beatIndex: number): void {
    const ctx = this.ctx!;
    if (time < ctx.currentTime - 0.01) return; // 已过期的拍直接丢弃
    const beatInBar = beatIndex % this.options.beatsPerBar;
    const isAccent = this.options.accentFirstBeat && beatInBar === 0;

    // 木鱼风格短音：重拍用更高音高与音量
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = isAccent ? 1568 : 1046;
    const peak = isAccent ? 1 : 0.6;
    gain.gain.setValueAtTime(peak, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
    osc.connect(gain).connect(this.masterGain!);
    osc.start(time);
    osc.stop(time + 0.035);

    this.scheduledNodes.push({ osc, time });
    this.pendingEvents.push({ beatInBar, isAccent, time });
  }

  /**
   * 取消所有尚未发声的音频节点（用于 seek/停止场景）
   */
  private cancelScheduled(): void {
    const now = this.ctx?.currentTime ?? 0;
    for (const node of this.scheduledNodes) {
      if (node.time > now) {
        try {
          node.osc.stop();
          node.osc.disconnect();
        } catch {
          // 节点可能已自然结束，忽略
        }
      }
    }
    this.scheduledNodes = [];
    this.pendingEvents = [];
  }

  /**
   * 把已到期的拍事件派发给 UI 监听者，并顺带清理过期音频节点引用
   */
  private flushDueEvents(): void {
    const now = this.ctx!.currentTime;
    while (this.pendingEvents.length > 0 && this.pendingEvents[0].time <= now) {
      const event = this.pendingEvents.shift()!;
      this.beatListeners.forEach((listener) => listener(event));
    }
    this.scheduledNodes = this.scheduledNodes.filter((n) => n.time > now - 0.1);
  }
}
