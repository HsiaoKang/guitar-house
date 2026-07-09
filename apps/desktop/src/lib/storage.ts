/**
 * 持久化存储层
 *
 * Tauri 环境使用 tauri-plugin-store（应用数据目录 JSON 文件），
 * 纯浏览器环境（开发调试）降级为 localStorage，保证 UI 流程可独立验证。
 *
 * 存储内容：课程库、学习进度（视频续播位置）、应用设置。
 */
import type { AppSettings, Course } from "../types";

/** 是否运行在 Tauri 窗口内 */
const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** store 文件名（Tauri）/ localStorage key 前缀（浏览器） */
const STORE_FILE = "learning-house.json";
const KEY_COURSES = "courses";
const KEY_SETTINGS = "settings";
const KEY_PLAYBACK = "playbackPositions";

/** 默认设置（主题默认跟随系统外观） */
export const DEFAULT_SETTINGS: AppSettings = { swapPanes: false, theme: "system" };

/** 视频续播位置表：resourcePath -> 秒 */
export type PlaybackPositions = Record<string, number>;

type StoreShape = {
  [KEY_COURSES]: Course[];
  [KEY_SETTINGS]: AppSettings;
  [KEY_PLAYBACK]: PlaybackPositions;
};

/**
 * 读取一个存储键（内部统一入口）
 *
 * @param key 存储键名
 * @param fallback 键不存在时的默认值
 */
async function readKey<K extends keyof StoreShape>(key: K, fallback: StoreShape[K]): Promise<StoreShape[K]> {
  if (IS_TAURI) {
    const { load } = await import("@tauri-apps/plugin-store");
    const store = await load(STORE_FILE);
    const value = await store.get<StoreShape[K]>(key);
    return value ?? fallback;
  }
  const raw = localStorage.getItem(`lh:${key}`);
  return raw ? (JSON.parse(raw) as StoreShape[K]) : fallback;
}

/**
 * 写入一个存储键（内部统一入口）
 *
 * @param key 存储键名
 * @param value 要写入的值
 */
async function writeKey<K extends keyof StoreShape>(key: K, value: StoreShape[K]): Promise<void> {
  if (IS_TAURI) {
    const { load } = await import("@tauri-apps/plugin-store");
    const store = await load(STORE_FILE);
    await store.set(key, value);
    await store.save();
    return;
  }
  localStorage.setItem(`lh:${key}`, JSON.stringify(value));
}

/**
 * 读取课程库
 */
export function loadCourses(): Promise<Course[]> {
  return readKey(KEY_COURSES, []);
}

/**
 * 保存课程库（整体覆盖）
 *
 * @param courses 全量课程列表
 */
export function saveCourses(courses: Course[]): Promise<void> {
  return writeKey(KEY_COURSES, courses);
}

/**
 * 读取应用设置
 */
export function loadSettings(): Promise<AppSettings> {
  return readKey(KEY_SETTINGS, DEFAULT_SETTINGS);
}

/**
 * 保存应用设置
 *
 * @param settings 设置对象
 */
export function saveSettings(settings: AppSettings): Promise<void> {
  return writeKey(KEY_SETTINGS, settings);
}

/**
 * 读取全部视频续播位置
 */
export function loadPlaybackPositions(): Promise<PlaybackPositions> {
  return readKey(KEY_PLAYBACK, {});
}

/**
 * 更新单个资源的续播位置（节流写盘由调用方控制）
 *
 * @param path 资源路径
 * @param position 播放位置（秒）
 */
export async function savePlaybackPosition(path: string, position: number): Promise<void> {
  const all = await loadPlaybackPositions();
  all[path] = position;
  await writeKey(KEY_PLAYBACK, all);
}
