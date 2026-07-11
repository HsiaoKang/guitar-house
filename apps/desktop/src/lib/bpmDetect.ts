/**
 * 伴奏 BPM 自动识别
 *
 * 读取音频文件解码为 PCM，用 web-audio-beat-detector
 * （低通滤波 + 峰值间隔统计）估算 BPM 与第一拍出现时刻，
 * 供节拍器"跟随伴奏"一键卡点。结果按文件路径缓存，避免重复解码。
 */
import { readBinary } from "./platform";

/** 识别结果 */
export interface BpmDetectResult {
  /** 估算的 BPM（四舍五入到整数，范围约束到节拍器可用区间） */
  bpm: number;
  /** 第一拍出现时刻（秒，保留两位小数） */
  offset: number;
}

/** 节拍器可接受的 BPM 范围 */
const BPM_MIN = 20;
const BPM_MAX = 300;

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
    const result: BpmDetectResult = {
      bpm: Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(guessed.bpm))),
      offset: Math.max(0, +refineOffset(audioBuffer, guessed.offset).toFixed(2)),
    };
    cache.set(path, result);
    return result;
  } finally {
    void ctx.close();
  }
}

/** 修正回溯的搜索窗（秒）：拍点只会比检测值早，向前看得多、向后看得少 */
const REFINE_LOOKBACK_SEC = 0.2;
const REFINE_LOOKAHEAD_SEC = 0.1;

/** 包络计算窗口（秒），决定修正精度 */
const ENVELOPE_WIN_SEC = 0.005;

/** 修正幅度上限（秒），超过视为回溯异常、保留原值 */
const REFINE_MAX_SHIFT_SEC = 0.15;

/**
 * 把检测到的首拍时刻修正到知觉拍点：
 * 检测值来自"低通信号冲过阈值"，天然晚于听感（鼓点攻击爬升
 * 数十毫秒 + 滤波器群延迟 + 编码前置静音）。在原始波形上计算
 * 能量包络，从峰值向前回溯到爬升至 50% 的时刻作为拍点。
 *
 * @param buffer 解码后的音频
 * @param rawOffset 库检测的首拍时刻（秒）
 * @returns 修正后的首拍时刻（秒）
 */
function refineOffset(buffer: AudioBuffer, rawOffset: number): number {
  const sr = buffer.sampleRate;
  const winSamples = Math.max(1, Math.round(sr * ENVELOPE_WIN_SEC));
  const startSec = Math.max(0, rawOffset - REFINE_LOOKBACK_SEC);
  const startSample = Math.floor(startSec * sr);
  const endSample = Math.min(buffer.length, Math.ceil((rawOffset + REFINE_LOOKAHEAD_SEC) * sr));
  if (endSample - startSample < winSamples * 4) return rawOffset;

  const mono = mixdown(buffer, startSample, endSample);
  // RMS 包络
  const envelope: number[] = [];
  for (let i = 0; i + winSamples <= mono.length; i += winSamples) {
    let sum = 0;
    for (let j = i; j < i + winSamples; j++) sum += mono[j] * mono[j];
    envelope.push(Math.sqrt(sum / winSamples));
  }
  if (envelope.length === 0) return rawOffset;

  // 窗口内能量峰值
  let peakIdx = 0;
  for (let i = 1; i < envelope.length; i++) {
    if (envelope[i] > envelope[peakIdx]) peakIdx = i;
  }
  const peak = envelope[peakIdx];
  if (peak <= 0) return rawOffset;

  // 从峰值向前回溯：停在包络仍不低于 50% 峰值的最早位置（即爬升过半的时刻）
  let riseIdx = peakIdx;
  for (let i = peakIdx; i >= 0 && envelope[i] >= peak * 0.5; i--) {
    riseIdx = i;
  }
  const refined = startSec + (riseIdx * winSamples) / sr;
  return Math.abs(refined - rawOffset) <= REFINE_MAX_SHIFT_SEC ? refined : rawOffset;
}

/**
 * 混合多声道为单声道片段
 *
 * @param buffer 解码后的音频
 * @param start 起始采样
 * @param end 结束采样（不含）
 * @returns 单声道样本
 */
function mixdown(buffer: AudioBuffer, start: number, end: number): Float32Array {
  const length = end - start;
  const mono = new Float32Array(length);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) mono[i] += data[start + i];
  }
  if (buffer.numberOfChannels > 1) {
    for (let i = 0; i < length; i++) mono[i] /= buffer.numberOfChannels;
  }
  return mono;
}
