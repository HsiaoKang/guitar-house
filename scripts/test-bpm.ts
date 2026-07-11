/**
 * BPM 倍频判别与相位定位的离线回归测试
 *
 * 用合成包络模拟典型伴奏节奏形态，验证 refineTempoAndPhase 的
 * 倍频修正（150->75、50->100）与首拍相位定位是否符合预期。
 *
 * 用法: pnpm dlx tsx scripts/test-bpm.ts
 */
import { refineTempoAndPhase } from "../apps/desktop/src/lib/bpmDetect";

/** 包络格宽（与 bpmDetect 的 ENVELOPE_WIN_SEC 一致） */
const STEP_SEC = 0.01;

/**
 * 合成一条包络：主拍脉冲强、可选半拍脉冲弱、底噪
 *
 * @param bpm 真实节奏
 * @param durationSec 时长（秒）
 * @param phaseSec 首拍时刻（秒）
 * @param halfBeatLevel 半拍（八分音符位置）能量（0 表示无半拍律动）
 */
function synthesize(bpm: number, durationSec: number, phaseSec: number, halfBeatLevel: number): Float32Array {
  const env = new Float32Array(Math.round(durationSec / STEP_SEC)).fill(0.05);
  const periodSteps = 60 / bpm / STEP_SEC;
  for (let t = phaseSec / STEP_SEC; t < env.length; t += periodSteps) {
    env[Math.round(t)] = 1.0;
  }
  if (halfBeatLevel > 0) {
    for (let t = phaseSec / STEP_SEC + periodSteps / 2; t < env.length; t += periodSteps) {
      env[Math.round(t)] = halfBeatLevel;
    }
  }
  return env;
}

/** 断言并打印结果 */
function check(name: string, actual: { bpm: number; phaseSec: number }, wantBpm: number, wantPhase: number): boolean {
  const bpmOk = Math.abs(actual.bpm - wantBpm) < 1;
  const phaseOk = Math.abs(actual.phaseSec - wantPhase) <= 0.03;
  const status = bpmOk && phaseOk ? "PASS" : "FAIL";
  console.log(
    `[${status}] ${name} -> bpm ${actual.bpm.toFixed(1)}（期望 ${wantBpm}）,首拍 ${actual.phaseSec.toFixed(2)}s（期望 ${wantPhase}）`,
  );
  return bpmOk && phaseOk;
}

const results = [
  // 梦的出口场景：真 75，半拍律动强导致库报 150
  check("真75被报150", refineTempoAndPhase(synthesize(75, 180, 0, 0.5), 150), 75, 0),
  // 常规场景：真 100 无半拍律动，库报对
  check("真100报100", refineTempoAndPhase(synthesize(100, 180, 0.3, 0), 100), 100, 0.3),
  // 减半误判场景：真 100，库报 50（候选翻倍应能纠回）
  check("真100被报50", refineTempoAndPhase(synthesize(100, 180, 0.3, 0), 50), 100, 0.3),
  // 33 课场景：真 100 且带弱半拍，库报对时不应被先验拉走
  check("真100带弱半拍", refineTempoAndPhase(synthesize(100, 180, 0.2, 0.35), 100), 100, 0.2),
];

process.exit(results.every(Boolean) ? 0 : 1);
