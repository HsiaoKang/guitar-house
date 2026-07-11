/**
 * BPM 判别信号诊断工具
 *
 * 读取 ffmpeg 解码的 f32le 单声道 PCM，计算 RMS 包络后打印
 * 各倍频候选的判别信号（奇偶拍比、反拍比、修正结果），
 * 用真实伴奏数据校准判别阈值。
 *
 * 用法: ffmpeg -i xx.mp3 -ac 1 -ar 44100 -f f32le /tmp/xx.pcm
 *      pnpm dlx tsx scripts/diag-bpm.ts /tmp/xx.pcm <库粗估BPM>
 */
import fs from "node:fs";
import { refineTempoAndPhase } from "../apps/desktop/src/lib/bpmDetect";

const SAMPLE_RATE = 44100;
const WIN_SEC = 0.01;

const [pcmPath, rawBpmArg] = process.argv.slice(2);
if (!pcmPath || !rawBpmArg) {
  console.error("用法: tsx scripts/diag-bpm.ts <pcm文件> <库粗估BPM>");
  process.exit(1);
}
const rawBpm = Number(rawBpmArg);

const buf = fs.readFileSync(pcmPath);
const samples = new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4));

// RMS 包络（与 bpmDetect.computeEnvelope 相同参数）
const win = Math.round(SAMPLE_RATE * WIN_SEC);
const frames = Math.floor(samples.length / win);
const envelope = new Float32Array(frames);
for (let f = 0; f < frames; f++) {
  let sum = 0;
  for (let i = f * win; i < (f + 1) * win; i++) sum += samples[i] * samples[i];
  envelope[f] = Math.sqrt(sum / win);
}
console.log(`时长 ${(frames * WIN_SEC).toFixed(1)}s，包络 ${frames} 格`);

/**
 * 打印某个候选 BPM 的判别信号（复制 bpmDetect.alignPhase 的口径）
 */
function inspect(bpm: number): void {
  const periodSteps = 60 / bpm / WIN_SEC;
  const phaseCount = Math.max(1, Math.floor(periodSteps * 2));
  let bestPhase = 0;
  let bestEven = -Infinity;
  for (let phase = 0; phase < phaseCount; phase++) {
    const even = mean(envelope, phase, periodSteps * 2);
    if (even > bestEven) {
      bestEven = even;
      bestPhase = phase;
    }
  }
  const even = mean(envelope, bestPhase, periodSteps * 2);
  const odd = mean(envelope, bestPhase + periodSteps, periodSteps * 2);
  const on = mean(envelope, bestPhase, periodSteps);
  const off = mean(envelope, bestPhase + periodSteps / 2, periodSteps);
  console.log(
    `BPM ${bpm}: 相位 ${(bestPhase * WIN_SEC).toFixed(2)}s | 奇/偶拍比 ${(odd / even).toFixed(3)} | 反拍/拍点比 ${(off / on).toFixed(3)}`,
  );
}

/** 拍网格能量均值（±2 格取峰） */
function mean(env: Float32Array, startStep: number, periodSteps: number): number {
  let sum = 0;
  let count = 0;
  for (let t = startStep; t < env.length; t += periodSteps) {
    const c = Math.round(t);
    let peak = 0;
    for (let i = c - 2; i <= c + 2; i++) {
      if (i >= 0 && i < env.length && env[i] > peak) peak = env[i];
    }
    sum += peak;
    count++;
  }
  return count > 0 ? sum / count : 0;
}

inspect(rawBpm / 2);
inspect(rawBpm);
inspect(rawBpm * 2);

const result = refineTempoAndPhase(envelope, rawBpm);
console.log(`refineTempoAndPhase(${rawBpm}) -> BPM ${result.bpm}，首拍 ${result.phaseSec.toFixed(2)}s`);
