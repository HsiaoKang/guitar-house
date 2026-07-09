/**
 * 前端共享类型与文件工具
 */

/** 文档类渲染类别（右侧文档区） */
export type DocKind = "image" | "pdf" | "guitarpro";

/** 资源类别：视频（左区）/ 音频（伴奏条）/ 文档（右区） */
export type ResourceKind = "video" | "audio" | DocKind;

/** 课节内的一个资源文件 */
export interface LessonResource {
  /** 文件绝对路径（同时作为资源唯一标识） */
  path: string;
  /** 文件名（展示用） */
  name: string;
  /** 资源类别 */
  kind: ResourceKind;
}

/** 课节：一组资源 + 完成状态 */
export interface Lesson {
  id: string;
  /** 课节名（默认取文件夹名） */
  name: string;
  resources: LessonResource[];
  /** 是否已标记完成 */
  completed: boolean;
}

/** 课程类型：决定上课页默认工具 */
export type CourseType = "guitar" | "general";

/** 课程 */
export interface Course {
  id: string;
  /** 课程名（默认取根文件夹名） */
  name: string;
  type: CourseType;
  /** 导入时的根文件夹（手动创建的课程可为空） */
  rootDir: string | null;
  lessons: Lesson[];
  /** 创建时间戳（毫秒） */
  createdAt: number;
}

/** 实际渲染主题 */
export type ResolvedTheme = "dark" | "light";

/** 主题偏好：system 表示跟随系统外观 */
export type ThemeKind = "system" | ResolvedTheme;

/** 应用设置 */
export interface AppSettings {
  /** 是否交换左右区域（false=视频左文档右） */
  swapPanes: boolean;
  /** 界面主题偏好 */
  theme: ThemeKind;
}

/** 底部工具栏可用工具 */
export type ToolKind = "metronome" | "none";

/** 各课程类型的默认工具 */
export const DEFAULT_TOOL_BY_COURSE_TYPE: Record<CourseType, ToolKind> = {
  guitar: "metronome",
  general: "none",
};

/** 课程类型显示名 */
export const COURSE_TYPE_LABELS: Record<CourseType, string> = {
  guitar: "吉他",
  general: "通用",
};

/** 支持的视频扩展名（受 WKWebView 解码能力限制） */
export const VIDEO_EXTENSIONS = ["mp4", "m4v", "mov", "webm"];

/** 支持的音频扩展名（受 WKWebView 解码能力限制） */
export const AUDIO_EXTENSIONS = ["mp3", "m4a", "aac", "wav", "flac", "aiff"];

/** 支持的图片扩展名 */
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
 * 根据扩展名判断资源类别
 *
 * @param path 文件路径
 * @returns 资源类别，不支持的格式返回 null
 */
export function resourceKindOf(path: string): ResourceKind | null {
  const ext = extOf(path);
  if (VIDEO_EXTENSIONS.includes(ext)) return "video";
  if (AUDIO_EXTENSIONS.includes(ext)) return "audio";
  if (IMAGE_EXTENSIONS.includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  if (GP_EXTENSIONS.includes(ext)) return "guitarpro";
  return null;
}

/**
 * 判断资源是否属于右侧文档区
 *
 * @param kind 资源类别
 */
export function isDocKind(kind: ResourceKind): kind is DocKind {
  return kind === "image" || kind === "pdf" || kind === "guitarpro";
}

/**
 * 生成短随机 id（课程/课节标识）
 */
export function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
