/**
 * BPM 倍频判别与相位定位的离线回归测试
 *
 * 用合成包络模拟典型伴奏节奏形态，验证端到端识别结果
 * （analyzeEnvelope：倍频修正 + 相位定位 + 拍点回溯）：
 * 1. BPM 与首拍数值符合期望
 * 2. 节拍对齐度：按识别结果打拍，每一拍都应命中包络能量峰
 *    （等价于把节拍器与伴奏叠放对波峰）
 *
 * 用法: pnpm dlx tsx scripts/test-bpm.ts
 */
import {
  analyzeEnvelope,
  beatAlignmentScore,
  bpmFromFilename,
  snapBpmToRatios,
  verifyScoreBpm,
} from "../apps/desktop/src/lib/bpmDetect";

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

/** 对齐度合格线：识别拍点的能量对比度低于此值视为没踩上波峰 */
const MIN_ALIGNMENT = 0.05;

/**
 * 端到端断言：数值符合期望 + 拍点对齐（节拍器叠放伴奏能对上波峰）
 *
 * @param minAlign 对齐度合格线；全曲同强素材物理上无强弱差异可传 0 豁免
 */
function check(
  name: string,
  env: Float32Array,
  rawBpm: number,
  wantBpm: number,
  wantPhase: number,
  minAlign = MIN_ALIGNMENT,
): boolean {
  const actual = analyzeEnvelope(env, rawBpm);
  const alignment = beatAlignmentScore(env, actual.bpm, actual.offset);
  const bpmOk = Math.abs(actual.bpm - wantBpm) < 1;
  const phaseOk = Math.abs(actual.offset - wantPhase) <= 0.05;
  const alignOk = alignment >= minAlign;
  const status = bpmOk && phaseOk && alignOk ? "PASS" : "FAIL";
  console.log(
    `[${status}] ${name} -> bpm ${actual.bpm.toFixed(1)}（期望 ${wantBpm}）,首拍 ${actual.offset.toFixed(2)}s（期望 ${wantPhase}）,对齐度 ${alignment.toFixed(3)}`,
  );
  return bpmOk && phaseOk && alignOk;
}

const results = [
  // 梦的出口场景：真 75，半拍律动强导致库报 150（真实样本奇偶比 0.72）
  check("真75被报150", synthesize(75, 180, 0, 0.5), 150, 75, 0),
  // 常规场景：真 100 无半拍律动，库报对
  check("真100报100", synthesize(100, 180, 0.3, 0), 100, 100, 0.3),
  // 减半误判场景：真 100，库报 50（反拍与拍点同强，应翻倍纠回）
  check("真100被报50", synthesize(100, 180, 0.3, 0), 50, 100, 0.3),
  // 33 课场景：真 100 且带弱半拍，库报对时不应被改动
  check("真100带弱半拍", synthesize(100, 180, 0.2, 0.35), 100, 100, 0.2),
  // 33 课真实形态：连续八分音型反拍能量高（真实样本反拍比 0.91），不得误翻倍
  check("真100反拍强不翻倍", synthesize(100, 180, 0.2, 0.9), 100, 100, 0.2),
  // sol 指型场景：真 100 全曲同强八分，库报 200（能量域无法区分，靠区间硬约束拉回；
  // 同强八分下拍点与反拍物理等强，对齐度必然为 0，豁免该项断言）
  check("真100同强八分被报200", synthesize(100, 60, 0.35, 1.0), 200, 100, 0.35, 0),
];

/** TAP 吸附纯函数断言 */
function checkSnap(name: string, rawBpm: number, tapBpm: number, want: number | null): boolean {
  const got = snapBpmToRatios(rawBpm, tapBpm);
  const ok = got === want;
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name} -> snap(${rawBpm}, tap ${tapBpm}) = ${got}（期望 ${want}）`);
  return ok;
}

results.push(
  // 推弦练习场景：鼓型 4/3 律动被识别为 120，人拍 ~88 吸附回谱面 90
  checkSnap("识别120人拍88吸附90", 120, 88, 90),
  // 倍频场景：识别 100 人拍 ~52 吸附到 50
  checkSnap("识别100人拍52吸附50", 100, 52, 50),
  // 人拍与识别一致：保持
  checkSnap("识别100人拍97保持100", 100, 97, 100),
  // 人拍远离一切比率候选：不吸附（调用方按原值应用）
  checkSnap("识别120人拍70不吸附", 120, 70, null),
);

/** 文件名 BPM 标注解析断言 */
function checkTag(name: string, path: string, want: number | null): boolean {
  const got = bpmFromFilename(path);
  const ok = got === want;
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name} -> ${got}（期望 ${want}）`);
  return ok;
}

results.push(
  // 核心课压小指场景：作者以「速度」标注（真 180，声学域被误判 90 的根治）
  checkTag("文件名·速度标注", "/x/第四集：压小指练习（180速度不带节拍器）.wav", 180),
  checkTag("文件名·bpm标注", "/x/第十二集：即兴创作（120bpm）.mp3", 120),
  checkTag("文件名·原速标注", "/x/第一集：16分音符（原速100bpm）.mp3", 100),
  checkTag("文件名·无标注", "/x/全闷音练习曲伴奏.mp3", null),
  checkTag("文件名·课号非速度", "/x/33：击勾弦进阶练习曲伴奏 .mp3", null),
);

/** 谱面标注交叉验证断言 */
function checkScore(name: string, rawBpm: number, scoreBpm: number, want: number | null): boolean {
  const got = verifyScoreBpm(rawBpm, scoreBpm);
  const ok = got === want;
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name} -> verify(声学${rawBpm}, 谱${scoreBpm}) = ${got}（期望 ${want}）`);
  return ok;
}

results.push(
  // 推弦场景：谱 90 精确命中声学 120 网格的 3/4 候选，互证通过
  checkScore("谱90×声学120通过", 120, 90, 90),
  // 错谱场景：课节引用了无关曲子的谱（标 76），与 120 网格族无关，拒绝
  checkScore("错谱76×声学120拒绝", 120, 76, null),
  // 一致场景：谱面校正声学的小误差（98.5 -> 100）
  checkScore("谱100×声学98.5校正", 98.5, 100, 100),
  // 差距过大：接近但超出 2% 容差（谱 84 vs 候选 80/90 均差 5%+），拒绝
  checkScore("谱84×声学120拒绝", 120, 84, null),
);

process.exit(results.every(Boolean) ? 0 : 1);
