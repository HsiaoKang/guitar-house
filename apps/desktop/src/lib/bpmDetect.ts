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
  /** BPM 是否取自文件名标注（作者标注为最高可信来源，跳过声学估计） */
  fromFilename?: boolean;
}

/** 节拍器可接受的 BPM 范围 */
const BPM_MIN = 20;
const BPM_MAX = 300;

/** 倍频候选下限（低于此值的减半提议不成立） */
const CANDIDATE_MIN = 40;

/** 包络计算窗口（秒），同时是相位搜索精度 */
const ENVELOPE_WIN_SEC = 0.01;

/** 拍点采样容差（包络格数）：拍点 ± 2 格内取最大值，容忍网格微漂 */
const BEAT_TOLERANCE_STEPS = 2;

/** 练习伴奏拍速（tactus）合理上限：检测值超出一律减半。
 * 三门真实课程的谱面拍速均在 60-120，>140 的检测值都是倍频错判 */
const TACTUS_MAX = 140;

/** 奇偶拍强弱比阈值：低于此值疑似半拍网格（提议减半，由拍速先验裁决）。
 * 校准：75 被报 150 时 0.72；真 100 网格因二四拍天然偏弱也会到 0.73，
 * 两者能量特征无法区分，最终取舍交给 TEMPO_PRIOR_CENTER */
const ALTERNATION_THRESHOLD = 0.75;

/** 翻倍兜底阈值：反拍与拍点几乎同强（>0.95）才提议翻倍。
 * 校准：33 课伴奏 0.91（不触发）、sol 指型 0.97（触发但被先验/区间拦下） */
const OFFBEAT_THRESHOLD = 0.95;

/** 拍速先验中心：结构信号发出倍频提议时，取对数尺度上离中心更近的一档。
 * 校准依据两组真实对决：75 vs 150 应选 75、100 vs 50 应选 100，
 * 中心取两组几何均值区间 (71, 106) 的居中值 */
const TEMPO_PRIOR_CENTER = 95;

/** 路径 -> 识别结果缓存（解码整首歌成本高，同文件只算一次） */
const cache = new Map<string, BpmDetectResult>();

/** 最近一次分析的中间产物（TAP 吸附校正复用，免重复解码） */
let lastAnalysis: { path: string; envelope: Float32Array; rawBpm: number } | null = null;

/**
 * 从文件名解析作者标注的 BPM（如「压小指练习（180速度）」「即兴创作（120bpm）」）。
 * 作者标注是最高可信来源，命中时跳过声学节奏估计。
 * （导出亦供离线回归测试）
 *
 * @param path 音频文件路径
 * @returns 标注的 BPM；无标注或超出可用区间时返回 null
 */
export function bpmFromFilename(path: string): number | null {
  const name = (path.split(/[\\/]/).pop() ?? path).normalize("NFC");
  const m = /(\d{2,3})\s*(?:bpm|速度)/i.exec(name);
  if (!m) return null;
  const value = Number(m[1]);
  return value >= BPM_MIN && value <= BPM_MAX ? value : null;
}

/**
 * 识别音频文件的 BPM 与首拍偏移。
 * 文件名带作者速度标注时直接采用（只做声学首拍定位），
 * 否则走完整声学估计（粗估 + 倍频修正 + 相位搜索）。
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
    const envelope = computeEnvelope(audioBuffer);

    const tagged = bpmFromFilename(path);
    let result: BpmDetectResult;
    if (tagged !== null) {
      // 作者标注直接可信，声学只负责在该拍速下定位首拍
      lastAnalysis = { path, envelope, rawBpm: tagged };
      result = {
        bpm: tagged,
        offset: Math.max(0, +alignPhaseForBpm(envelope, tagged).toFixed(2)),
        octaveAdjusted: false,
        fromFilename: true,
      };
    } else {
      const { guess } = await import("web-audio-beat-detector");
      const guessed = await guess(audioBuffer);
      const analyzed = analyzeEnvelope(envelope, guessed.bpm);
      lastAnalysis = { path, envelope, rawBpm: guessed.bpm };
      result = {
        bpm: Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(analyzed.bpm))),
        offset: Math.max(0, +analyzed.offset.toFixed(2)),
        octaveAdjusted: Math.round(analyzed.bpm) !== Math.round(guessed.bpm),
      };
    }
    cache.set(path, result);
    return result;
  } finally {
    void ctx.close();
  }
}

/** 节奏估计的经典混淆比率族（倍频 + 附点/三连音关系） */
const SNAP_RATIOS = [1 / 3, 1 / 2, 2 / 3, 3 / 4, 1, 4 / 3, 3 / 2, 2, 3];

/** TAP 吸附容差（对数距离）：手拍精度约 ±8% */
const SNAP_TOLERANCE = Math.log(1.08);

/**
 * 把用户 TAP 拍出的粗略 BPM 吸附到检测网格的比率候选上。
 * 场景：伴奏律动与谱面拍速是 4/3 等非倍频关系时（如附点八分鼓型），
 * 纯信号无法判定，人拍出大致节奏、机器给出精确数值。
 * （导出亦供离线回归测试）
 *
 * @param rawBpm 检测器给出的原始 BPM（网格基准）
 * @param tapBpm 用户 TAP 的粗略 BPM
 * @returns 吸附后的精确 BPM；无足够接近的候选时返回 null
 */
export function snapBpmToRatios(rawBpm: number, tapBpm: number): number | null {
  let best: number | null = null;
  let bestDist = SNAP_TOLERANCE;
  for (const ratio of SNAP_RATIOS) {
    const candidate = rawBpm * ratio;
    if (candidate < BPM_MIN || candidate > BPM_MAX) continue;
    const dist = Math.abs(Math.log(tapBpm / candidate));
    if (dist <= bestDist) {
      bestDist = dist;
      best = candidate;
    }
  }
  return best !== null ? Math.round(best) : null;
}

/**
 * TAP 校正：吸附 BPM 后用该拍速在伴奏上重新做相位搜索与拍点回溯，
 * 返回精确的 BPM 与首拍偏移
 *
 * @param path 伴奏文件绝对路径（需已做过识别，复用其分析产物）
 * @param tapBpm 用户 TAP 的粗略 BPM
 * @returns 校正结果；该伴奏未识别过或 TAP 与网格族相距过远时返回 null
 */
export function snapTapToGrid(path: string, tapBpm: number): { bpm: number; offset: number } | null {
  if (!lastAnalysis || lastAnalysis.path !== path) return null;
  const snapped = snapBpmToRatios(lastAnalysis.rawBpm, tapBpm);
  if (snapped === null) return null;
  const aligned = alignPhaseForBpm(lastAnalysis.envelope, snapped);
  return { bpm: snapped, offset: Math.max(0, +aligned.toFixed(2)) };
}

/** 谱面标注的交叉验证容差（对数距离）：谱面是精确数字，仅接受与
 * 声学网格比率候选几乎相等（约 ±2%），无关曲谱的标注会被拒绝 */
const SCORE_VERIFY_TOLERANCE = Math.log(1.02);

/**
 * 谱面标注交叉验证：标注值须几乎精确命中声学网格的比率族才采纳。
 * 谱面与伴奏可能不对应（课节引用了其他曲子的谱），声学网格是
 * 这首伴奏的物理事实——两者互证通过才可信，否则判定非本曲谱面。
 * （导出亦供离线回归测试）
 *
 * @param rawBpm 声学检测的原始 BPM（网格基准）
 * @param scoreBpm 谱面标注的 BPM
 * @returns 验证通过返回谱面值，否则 null
 */
export function verifyScoreBpm(rawBpm: number, scoreBpm: number): number | null {
  for (const ratio of SNAP_RATIOS) {
    const candidate = rawBpm * ratio;
    if (candidate < BPM_MIN || candidate > BPM_MAX) continue;
    if (Math.abs(Math.log(scoreBpm / candidate)) <= SCORE_VERIFY_TOLERANCE) {
      return scoreBpm;
    }
  }
  return null;
}

/**
 * 用通过验证的谱面拍速在伴奏上做相位搜索定位首拍
 *
 * @param path 伴奏文件绝对路径（需已做过识别，复用其分析产物）
 * @param scoreBpm 谱面标注的 BPM
 * @returns 验证通过时的定位结果；未识别过或验证失败时返回 null
 */
export function alignToScoreBpm(path: string, scoreBpm: number): { bpm: number; offset: number } | null {
  if (!lastAnalysis || lastAnalysis.path !== path) return null;
  if (verifyScoreBpm(lastAnalysis.rawBpm, scoreBpm) === null) return null;
  const aligned = alignPhaseForBpm(lastAnalysis.envelope, scoreBpm);
  return { bpm: scoreBpm, offset: Math.max(0, +aligned.toFixed(2)) };
}

/**
 * 用指定 BPM 在包络上做相位搜索并回溯知觉拍点
 *
 * @param envelope 全曲包络
 * @param bpm 拍速
 * @returns 首拍时刻（秒）
 */
function alignPhaseForBpm(envelope: Float32Array, bpm: number): number {
  const aligned = alignPhase(envelope, 60 / bpm / ENVELOPE_WIN_SEC);
  return refineToRise(envelope, aligned.phaseStep * ENVELOPE_WIN_SEC);
}

/**
 * 包络分析全流程（倍频修正 + 相位定位 + 知觉拍点回溯）。
 * 从 detectBpmFromFile 拆出的纯函数，供离线端到端测试直接调用
 *
 * @param envelope 全曲包络
 * @param rawBpm 库粗估的 BPM
 * @returns 修正后的 BPM 与首拍时刻（秒，未取整）
 */
export function analyzeEnvelope(envelope: Float32Array, rawBpm: number): { bpm: number; offset: number } {
  const refined = refineTempoAndPhase(envelope, rawBpm);
  return { bpm: refined.bpm, offset: refineToRise(envelope, refined.phaseSec) };
}

/**
 * 节拍对齐度：沿「offset + k*拍长」的节拍器拍点序列采样包络，
 * 返回拍点能量相对反拍能量的对比度（0-1，越高说明拍点越踩在波峰上）。
 * 端到端验收指标：识别结果打出的每一拍都应命中伴奏的能量峰
 *
 * @param envelope 全曲包络
 * @param bpm 识别出的 BPM
 * @param offsetSec 识别出的首拍时刻（秒）
 * @returns 对齐对比度（真拍网格通常 > 0.1，错位网格趋近 0 或为负）
 */
export function beatAlignmentScore(envelope: Float32Array, bpm: number, offsetSec: number): number {
  const periodSteps = 60 / bpm / ENVELOPE_WIN_SEC;
  const startStep = offsetSec / ENVELOPE_WIN_SEC;
  const onBeat = meanBeatEnergy(envelope, startStep, periodSteps);
  const offBeat = meanBeatEnergy(envelope, startStep + periodSteps / 2, periodSteps);
  return (onBeat - offBeat) / (onBeat + offBeat + 1e-9);
}

/**
 * 计算全曲起始检测函数（Onset Detection Function）
 *
 * 混音为单声道后走频谱通量：STFT 逐帧取对数幅度谱，
 * 对各频点能量增量的正部求和。相比 RMS 响度包络，
 * 它响应"新声音的出现"（含音高/音色变化），拨弦类素材的
 * 拍点在通量域是尖锐脉冲，网格对齐信号远强于能量域。
 *
 * @param buffer 解码后的音频
 * @returns ODF 序列（ENVELOPE_WIN_SEC 一格）
 */
function computeEnvelope(buffer: AudioBuffer): Float32Array {
  const mono = new Float32Array(buffer.length);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < mono.length; i++) mono[i] += data[i];
  }
  if (buffer.numberOfChannels > 1) {
    for (let i = 0; i < mono.length; i++) mono[i] /= buffer.numberOfChannels;
  }
  return computeOnsetEnvelope(mono, buffer.sampleRate);
}

/** STFT 帧长（2 的幂；44.1kHz 下约 23ms，频率分辨率约 43Hz） */
const FFT_FRAME = 1024;

/**
 * 从单声道样本计算频谱通量 ODF（导出供离线诊断/回归共用同一实现）
 *
 * @param samples 单声道样本
 * @param sampleRate 采样率
 * @returns ODF 序列（ENVELOPE_WIN_SEC 一格）
 */
export function computeOnsetEnvelope(samples: Float32Array, sampleRate: number): Float32Array {
  const hop = Math.max(1, Math.round(sampleRate * ENVELOPE_WIN_SEC));
  const frames = Math.max(0, Math.floor((samples.length - FFT_FRAME) / hop) + 1);
  const odf = new Float32Array(frames);
  if (frames === 0) return odf;

  // 汉宁窗（预计算）
  const window = new Float32Array(FFT_FRAME);
  for (let i = 0; i < FFT_FRAME; i++) {
    window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT_FRAME - 1));
  }

  const re = new Float32Array(FFT_FRAME);
  const im = new Float32Array(FFT_FRAME);
  const bins = FFT_FRAME / 2;
  const prevMag = new Float32Array(bins);

  for (let f = 0; f < frames; f++) {
    const start = f * hop;
    for (let i = 0; i < FFT_FRAME; i++) {
      re[i] = samples[start + i] * window[i];
      im[i] = 0;
    }
    fftInPlace(re, im);
    let flux = 0;
    for (let k = 1; k < bins; k++) {
      const mag = Math.log1p(Math.hypot(re[k], im[k]));
      const diff = mag - prevMag[k];
      if (diff > 0) flux += diff;
      prevMag[k] = mag;
    }
    // 首帧无前帧可比，置 0 避免开头伪 onset
    odf[f] = f === 0 ? 0 : flux;
  }
  return odf;
}

/**
 * 原地 radix-2 快速傅里叶变换（长度必须为 2 的幂）
 *
 * @param re 实部（原地修改）
 * @param im 虚部（原地修改）
 */
function fftInPlace(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  // 位反转重排
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }
  // 蝶形运算
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let j = 0; j < len / 2; j++) {
        const aRe = re[i + j];
        const aIm = im[i + j];
        const bRe = re[i + j + len / 2] * curRe - im[i + j + len / 2] * curIm;
        const bIm = re[i + j + len / 2] * curIm + im[i + j + len / 2] * curRe;
        re[i + j] = aRe + bRe;
        im[i + j] = aIm + bIm;
        re[i + j + len / 2] = aRe - bRe;
        im[i + j + len / 2] = aIm - bIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }
}

/**
 * 用节奏结构信号迭代修正倍频错误，并定位拍网格起点。
 * （导出仅供离线回归测试）
 *
 * 分层规则（全部经真实伴奏 PCM 校准）：
 * 1. 区间硬约束：检测值超出练习伴奏拍速上限一律减半
 * 2. 结构信号只负责"提议"倍频修正（奇偶交替明显 -> 提议减半；
 *    反拍与拍点同强 -> 提议翻倍），是否采纳由拍速先验裁决——
 *    能量特征无法区分"八分网格"与"二四拍偏弱的真拍网格"
 *    （实测两者奇偶比同为 0.72），只有先验能决断
 *
 * @param envelope 全曲包络
 * @param rawBpm 库粗估的 BPM
 * @returns 修正后的 BPM 与拍网格起点（秒）
 */
export function refineTempoAndPhase(envelope: Float32Array, rawBpm: number): { bpm: number; phaseSec: number } {
  let bpm = rawBpm;

  // 最多修正两级（400->100 类极端场景），防止信号冲突时振荡
  for (let iter = 0; iter < 3; iter++) {
    if (bpm > TACTUS_MAX && bpm / 2 >= CANDIDATE_MIN) {
      bpm /= 2;
      continue;
    }
    const current = alignPhase(envelope, 60 / bpm / ENVELOPE_WIN_SEC);
    let proposal: number | null = null;
    if (current.oddRatio < ALTERNATION_THRESHOLD && bpm / 2 >= CANDIDATE_MIN) {
      proposal = bpm / 2;
    } else if (current.offbeatRatio > OFFBEAT_THRESHOLD && bpm * 2 <= TACTUS_MAX) {
      proposal = bpm * 2;
    }
    // 关键节点：先验裁决——提议值在对数尺度上更接近先验中心才采纳
    if (proposal !== null && priorDistance(proposal) < priorDistance(bpm)) {
      bpm = proposal;
      continue;
    }
    break;
  }

  const finalAlign = alignPhase(envelope, 60 / bpm / ENVELOPE_WIN_SEC);
  return { bpm, phaseSec: finalAlign.phaseStep * ENVELOPE_WIN_SEC };
}

/**
 * 候选拍速与先验中心的对数距离（越小越接近常见练习拍速）
 *
 * @param bpm 候选 BPM
 */
function priorDistance(bpm: number): number {
  return Math.abs(Math.log(bpm / TEMPO_PRIOR_CENTER));
}

/**
 * 全相位搜索对齐拍网格，并给出倍频判别所需的结构比值。
 * 关键节点：搜索目标就是最终验收指标（拍点/反拍对比度），
 * 保证选出的相位在对齐度上全局最优——搜索与验收目标一致，
 * 避免"强拍能量最大"与"拍点踩峰"在复杂音型上选出不同相位
 *
 * @param envelope 全曲包络
 * @param periodSteps 拍间隔（包络格数，可为小数）
 * @returns phaseStep 最优相位(格)；oddRatio 弱/强拍能量比（period*2 网格）；
 *          offbeatRatio 反拍/拍点能量比
 */
function alignPhase(
  envelope: Float32Array,
  periodSteps: number,
): { phaseStep: number; oddRatio: number; offbeatRatio: number } {
  const phaseCount = Math.max(1, Math.floor(periodSteps));
  let bestPhase = 0;
  let bestContrast = -Infinity;
  let bestOn = -Infinity;
  for (let phase = 0; phase < phaseCount; phase++) {
    const on = meanBeatEnergy(envelope, phase, periodSteps);
    const off = meanBeatEnergy(envelope, phase + periodSteps / 2, periodSteps);
    const contrast = on - off;
    // 对比度为主；同强音型下各相位对比度同为 0，用拍点能量决胜
    if (contrast > bestContrast + 1e-9 || (Math.abs(contrast - bestContrast) <= 1e-9 && on > bestOn)) {
      bestContrast = contrast;
      bestOn = on;
      bestPhase = phase;
    }
  }

  // 倍频判别信号：在 period*2 网格上比较相邻两拍强弱（强者视为强拍）
  const beatA = meanBeatEnergy(envelope, bestPhase, periodSteps * 2);
  const beatB = meanBeatEnergy(envelope, bestPhase + periodSteps, periodSteps * 2);
  const onBeat = meanBeatEnergy(envelope, bestPhase, periodSteps);
  const offBeat = meanBeatEnergy(envelope, bestPhase + periodSteps / 2, periodSteps);
  return {
    phaseStep: bestPhase,
    oddRatio: Math.min(beatA, beatB) / (Math.max(beatA, beatB) + 1e-9),
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

/** 首拍回溯搜索窗（秒）：相位已由全曲网格搜索定准，只在拍点近旁找峰 */
const RISE_LOOKBACK_SEC = 0.02;
const RISE_LOOKAHEAD_SEC = 0.06;

/** 攻击补偿的最大偏移（秒）：超过此量级的移动会拖歪整个节拍网格 */
const RISE_MAX_SHIFT_SEC = 0.06;

/**
 * 把网格相位修正到知觉拍点：能量峰值晚于听感（攻击爬升数十毫秒），
 * 在相位近旁找包络峰值并回溯到爬升至 50% 的时刻。
 * 关键节点：修正量限制在攻击时间量级，网格对齐（全曲拍点命中）优先于
 * 单点听感——回溯过多会平移整个节拍网格导致后续拍全部脱靶
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
  const refined = riseIdx * ENVELOPE_WIN_SEC;
  return Math.abs(refined - phaseSec) <= RISE_MAX_SHIFT_SEC ? refined : phaseSec;
}
