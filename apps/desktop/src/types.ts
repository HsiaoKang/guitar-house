/**
 * 前端共享类型与文件工具
 *
 * @author yuchenxi
 */

/** 谱面渲染类别 */
export type ScoreKind = "image" | "pdf" | "guitarpro";

/** 已打开的谱面文件描述 */
export interface ScoreFile {
  /** 文件绝对路径 */
  path: string;
  /** 文件名（用于标题展示） */
  name: string;
  /** 渲染类别 */
  kind: ScoreKind;
}

/** 支持的视频扩展名（受 WKWebView 解码能力限制） */
export const VIDEO_EXTENSIONS = ["mp4", "m4v", "mov", "webm"];

/** 支持的伴奏音频扩展名（受 WKWebView 解码能力限制） */
export const AUDIO_EXTENSIONS = ["mp3", "m4a", "aac", "wav", "flac", "aiff"];

/** 支持的图片谱扩展名 */
export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "bmp"];

/** 支持的 Guitar Pro 谱扩展名 */
export const GP_EXTENSIONS = ["gp", "gp3", "gp4", "gp5", "gpx"];

/**
 * 提取文件路径的小写扩展名
 *
 * @param path 文件路径
 * @returns 不含点号的小写扩展名，无扩展名时返回空串
 */
export function extOf(path: string): string {
  const idx = path.lastIndexOf(".");
  return idx >= 0 ? path.slice(idx + 1).toLowerCase() : "";
}

/**
 * 提取路径中的文件名部分
 *
 * @param path 文件路径
 * @returns 最后一个路径分隔符之后的文件名
 */
export function basename(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

/**
 * 根据扩展名判断谱面文件的渲染类别
 *
 * @param path 文件路径
 * @returns 谱面类别，不支持的格式返回 null
 */
export function scoreKindOf(path: string): ScoreKind | null {
  const ext = extOf(path);
  if (IMAGE_EXTENSIONS.includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  if (GP_EXTENSIONS.includes(ext)) return "guitarpro";
  return null;
}
