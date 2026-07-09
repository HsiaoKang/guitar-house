/**
 * 平台适配层
 *
 * 统一封装依赖 Tauri 运行时的能力，并为纯浏览器环境（开发调试）
 * 提供降级实现，保证 UI 流程可以脱离 Tauri 窗口独立验证。
 */
import { convertFileSrc } from "@tauri-apps/api/core";

/** 是否运行在 Tauri 窗口内 */
export const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/**
 * 把本地文件路径转换为媒体元素可用的 URL。
 * Tauri 环境走 asset 协议；浏览器环境原样返回（配合相对路径测试数据）。
 *
 * @param path 文件绝对路径（或浏览器调试用的相对 URL）
 */
export function mediaSrc(path: string): string {
  return IS_TAURI ? convertFileSrc(path) : path;
}

/**
 * 读取文件二进制内容。
 * Tauri 环境用 fs 插件；浏览器环境 fetch 相对 URL。
 *
 * @param path 文件路径
 * @returns 文件字节
 */
export async function readBinary(path: string): Promise<Uint8Array> {
  if (IS_TAURI) {
    const { readFile } = await import("@tauri-apps/plugin-fs");
    return readFile(path);
  }
  const res = await fetch(path);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}
