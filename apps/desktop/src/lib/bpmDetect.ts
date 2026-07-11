/**
 * 伴奏 BPM 自动识别
 *
 * 流程：web-audio-beat-detector 粗估 BPM（低通滤波 + 峰值间隔统计）
 * -> 全曲 RMS 包络上做拍网格评分，判别倍频错误（75 被识别成 150 类，
 * 用拍点/反拍能量对比 + 感知节奏先验选出正确档）
 * -> 全相位搜索定位首拍，再回溯到能量爬升过半的知觉拍点。
 * 结果按文件路径缓存，避免重复解码。
 */
import { readBinary } from "./platform";

/** 识别结果 */
export interface BpmDetectResult {
  /** 估算的 BPM（四舍五入到整数，范围约束到节拍器可用区间） */
  bpm: number;
  /** 第一拍出现时刻（秒，保留两位小数） */
  offset: number;
  /** 是否对库的原始检测做了倍频修正（减半/翻倍） */
  octaveAdjusted: boolean;
}

/** 节拍器可接受的 BPM 范围 */
const BPM_MIN = 20;
const BPM_MAX = 300;

/** 倍频候选的合理区间（超出的候选不参与评分） */
const CANDIDATE_MIN = 40;
const CANDIDATE_MAX = 220;

/** 包络计算窗口（秒），同时是相位搜索精度 */
const ENVELOPE_WIN_SEC = 0.01;

/** 拍点采样容差（包络格数）：拍点 ± 2 格内取最大值，容忍网格微漂 */
const BEAT_TOLERANCE_STEPS = 2;

/** 奇偶拍强弱比阈值：低于此值说明网格是半拍网格（真节奏应减半） */
const ALTERNATION_THRESHOLD = 0.75;

/** 反拍/拍点能量比阈值：高于此值说明网格漏拍（真节奏应翻倍） */
const OFFBEAT_THRESHOLD = 0.8;

/** 路径 -> 识别结果缓存（解码整首歌成本高，同文件只算一次） */
const cache = new Map<string, BpmDetectResult>();

/**
 * 识别音频文件的 BPM 与首拍偏移
 *
 * @param path 音频文件绝对路径
 * @returns 识别结果
 * @throws 文件读取失败、解码失败或节奏特征不明显无法估算时抛错
 */
export async function detectBpmFromFile(path: string): Promise<BpmDetectResult> {
  const cached = cache.get(path);
  if (cached) return cached;

  const bytes = await readBinary(path);
  // 关键节点：decodeAudioData 会转移（detach）传入的 buffer，拷贝一份独立内存
  const arrayBuffer = bytes.slice().buffer as ArrayBuffer;
  const ctx = new AudioContext();
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const { guess } = await import("web-audio-beat-detector");
    const guessed = await guess(audioBuffer);

    const envelope = computeEnvelope(audioBuffer);
    const refined = refineTempoAndPhase(envelope, guessed.bpm);
    const offset = refineToRise(envelope, refined.phaseSec);

    const result: BpmDetectResult = {
      bpm: Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(refined.bpm))),
      offset: Math.max(0, +offset.toFixed(2)),
      octaveAdjusted: Math.round(refined.bpm) !== Math.round(guessed.bpm),
    };
    cache.set(path, result);
    return result;
  } finally {
    void ctx.close();
  }
}

/**
 * 计算全曲单声道 RMS 包络（ENVELOPE_WIN_SEC 一格）
 *
 * @param buffer 解码后的音频
 * @returns 包络数组
 */
function computeEnvelope(buffer: AudioBuffer): Float32Array {
  const win = Math.max(1, Math.round(buffer.sampleRate * ENVELOPE_WIN_SEC));
  const frames = Math.floor(buffer.length / win);
  const envelope = new Float32Array(frames);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let f = 0; f < frames; f++) {
      let sum = 0;
      const start = f * win;
      for (let i = start; i < start + win; i++) sum += data[i] * data[i];
      envelope[f] += sum;
    }
  }
  for (let f = 0; f < frames; f++) {
    envelope[f] = Math.sqrt(envelope[f] / (win * buffer.numberOfChannels));
  }
  return envelope;
}

/**
 * 用节奏结构信号迭代修正倍频错误，并定位拍网格起点。
 * （导出仅供离线回归测试）
 *
 * 两个判别信号：
 * - 奇偶拍强弱交替（奇拍明显弱于偶拍）：当前网格是半拍网格，
 *   真节奏应减半——75 的曲子按 150 检测时，八分位能量低于四分位
 * - 反拍与拍点同强：当前网格漏拍，真节奏应翻倍
 *
 * @param envelope 全曲包络
 * @param rawBpm 库粗估的 BPM
 * @returns 修正后的 BPM 与拍网格起点（秒）
 */
export function refineTempoAndPhase(envelope: Float32Array, rawBpm: number): { bpm: number; phaseSec: number } {
  let bpm = rawBpm;
  let phaseStep = 0;

  // 最多修正两级（150->75、50->100 都是一级；防止交替信号振荡）
  for (let iter = 0; iter < 3; iter++) {
    const periodSteps = 60 / bpm / ENVELOPE_WIN_SEC;
    const aligned = alignPhase(envelope, periodSteps);
    phaseStep = aligned.phaseStep;

    if (aligned.oddRatio < ALTERNATION_THRESHOLD && bpm / 2 >= CANDIDATE_MIN) {
      bpm /= 2;
      continue;
    }
    if (aligned.offbeatRatio > OFFBEAT_THRESHOLD && bpm * 2 <= CANDIDATE_MAX) {
      bpm *= 2;
      continue;
    }
    break;
  }
  return { bpm, phaseSec: phaseStep * ENVELOPE_WIN_SEC };
}

/**
 * 全相位搜索对齐拍网格（以偶数拍能量最大化把强拍放在偶位），
 * 并给出倍频判别所需的结构比值
 *
 * @param envelope 全曲包络
 * @param periodSteps 拍间隔（包络格数，可为小数）
 * @returns phaseStep 强拍相位（格）；oddRatio 奇拍/偶拍能量比；
 *          offbeatRatio 反拍/拍点能量比
 */
function alignPhase(
  envelope: Float32Array,
  periodSteps: number,
): { phaseStep: number; oddRatio: number; offbeatRatio: number } {
  // 关键节点：搜索范围取两个拍长，覆盖强拍落在奇位的情况
  const phaseCount = Math.max(1, Math.floor(periodSteps * 2));
  let bestPhase = 0;
  let bestEven = -Infinity;
  for (let phase = 0; phase < phaseCount; phase++) {
    const even = meanBeatEnergy(envelope, phase, periodSteps * 2);
    if (even > bestEven) {
      bestEven = even;
      bestPhase = phase;
    }
  }

  const even = meanBeatEnergy(envelope, bestPhase, periodSteps * 2);
  const odd = meanBeatEnergy(envelope, bestPhase + periodSteps, periodSteps * 2);
  const onBeat = meanBeatEnergy(envelope, bestPhase, periodSteps);
  const offBeat = meanBeatEnergy(envelope, bestPhase + periodSteps / 2, periodSteps);
  return {
    phaseStep: bestPhase,
    oddRatio: odd / (even + 1e-9),
    offbeatRatio: offBeat / (onBeat + 1e-9),
  };
}

/**
 * 沿拍网格采样包络能量的均值（每个拍点取 ± 容差窗内最大值）
 *
 * @param envelope 全曲包络
 * @param startStep 起始相位（格）
 * @param periodSteps 拍间隔（格）
 */
function meanBeatEnergy(envelope: Float32Array, startStep: number, periodSteps: number): number {
  let sum = 0;
  let count = 0;
  for (let t = startStep; t < envelope.length; t += periodSteps) {
    const center = Math.round(t);
    let peak = 0;
    for (let i = center - BEAT_TOLERANCE_STEPS; i <= center + BEAT_TOLERANCE_STEPS; i++) {
      if (i >= 0 && i < envelope.length && envelope[i] > peak) peak = envelope[i];
    }
    sum += peak;
    count++;
  }
  return count > 0 ? sum / count : 0;
}

/** 首拍回溯搜索窗（秒） */
const RISE_LOOKBACK_SEC = 0.1;
const RISE_LOOKAHEAD_SEC = 0.1;

/**
 * 把网格相位修正到知觉拍点：能量峰值晚于听感（攻击爬升数十毫秒），
 * 在相位附近找包络峰值并回溯到爬升至 50% 的时刻
 *
 * @param envelope 全曲包络
 * @param phaseSec 拍网格起点（秒）
 * @returns 修正后的首拍时刻（秒）
 */
function refineToRise(envelope: Float32Array, phaseSec: number): number {
  const startStep = Math.max(0, Math.round((phaseSec - RISE_LOOKBACK_SEC) / ENVELOPE_WIN_SEC));
  const endStep = Math.min(envelope.length, Math.round((phaseSec + RISE_LOOKAHEAD_SEC) / ENVELOPE_WIN_SEC) + 1);
  if (endStep - startStep < 3) return phaseSec;

  let peakIdx = startStep;
  for (let i = startStep + 1; i < endStep; i++) {
    if (envelope[i] > envelope[peakIdx]) peakIdx = i;
  }
  const peak = envelope[peakIdx];
  if (peak <= 0) return phaseSec;

  let riseIdx = peakIdx;
  for (let i = peakIdx; i >= startStep && envelope[i] >= peak * 0.5; i--) {
    riseIdx = i;
  }
  return riseIdx * ENVELOPE_WIN_SEC;
}
