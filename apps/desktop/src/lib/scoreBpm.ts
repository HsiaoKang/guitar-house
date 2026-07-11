/**
 * 曲谱 BPM 标注读取
 *
 * Guitar Pro 导出的 PDF 谱面文本层含速度标注（如「♩ = 90」），
 * 提取第一页的「= N」标记作为该曲的权威拍速——谱面是作者写下的
 * 真值，可靠性仅次于音频文件名里的显式标注，高于声学估计。
 */
import { readBinary } from "./platform";
// legacy 构建兼容较旧的 WebView 内核（与 PdfScore 同款）
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

/** 可信的 BPM 标注范围 */
const BPM_MIN = 20;
const BPM_MAX = 300;

/** 路径 -> 标注缓存（null 表示确认无标注） */
const cache = new Map<string, number | null>();

/**
 * 从曲谱 PDF 第一页提取 BPM 标注
 *
 * @param path PDF 文件绝对路径
 * @returns 标注的 BPM；无标注、解析失败或数值越界时返回 null
 */
export async function bpmFromScorePdf(path: string): Promise<number | null> {
  const cached = cache.get(path);
  if (cached !== undefined) return cached;

  let result: number | null = null;
  try {
    const bytes = await readBinary(path);
    const loadingTask = pdfjsLib.getDocument({ data: bytes.slice() });
    try {
      const doc = await loadingTask.promise;
      const page = await doc.getPage(1);
      const textContent = await page.getTextContent();
      const text = textContent.items.map((item) => ("str" in item ? item.str : "")).join(" ");
      const m = /=\s*(\d{2,3})\b/.exec(text);
      if (m) {
        const value = Number(m[1]);
        if (value >= BPM_MIN && value <= BPM_MAX) result = value;
      }
    } finally {
      // 释放 worker 侧文档资源（与 PdfScore 卸载时同款清理）
      void loadingTask.destroy();
    }
  } catch {
    result = null;
  }
  cache.set(path, result);
  return result;
}

/**
 * 按"与伴奏的对应可能性"给曲谱排序：与伴奏同目录的优先
 * （课程资料中谱与伴奏通常同住一个课件目录，引用来的无关谱在别处），
 * 其余按文件名最长公共子串长度降序。
 * （导出亦供离线回归测试）
 *
 * @param audioPath 伴奏绝对路径
 * @param pdfPaths 候选曲谱绝对路径列表
 * @returns 按对应可能性降序的新数组
 */
export function rankScoresForAudio(audioPath: string, pdfPaths: string[]): string[] {
  const audioDir = dirOf(audioPath);
  const audioStem = stemOf(audioPath);
  return [...pdfPaths].sort((a, b) => {
    const dirScore = Number(dirOf(b) === audioDir) - Number(dirOf(a) === audioDir);
    if (dirScore !== 0) return dirScore;
    return commonSubstringLength(stemOf(b), audioStem) - commonSubstringLength(stemOf(a), audioStem);
  });
}

/** 提取文件所在目录 */
function dirOf(path: string): string {
  return path.slice(0, path.lastIndexOf("/"));
}

/** 提取文件名主干（去目录与扩展名，NFC 归一化） */
function stemOf(path: string): string {
  const name = path.split(/[\\/]/).pop() ?? path;
  const dot = name.lastIndexOf(".");
  return (dot > 0 ? name.slice(0, dot) : name).normalize("NFC");
}

/**
 * 最长公共子串长度（动态规划；文件名长度短，开销可忽略）
 *
 * @param a 字符串 A
 * @param b 字符串 B
 */
function commonSubstringLength(a: string, b: string): number {
  let best = 0;
  let prev = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array<number>(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        cur[j] = prev[j - 1] + 1;
        if (cur[j] > best) best = cur[j];
      }
    }
    prev = cur;
  }
  return best;
}
