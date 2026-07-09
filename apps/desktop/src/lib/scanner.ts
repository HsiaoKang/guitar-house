/**
 * 课程文件夹扫描器
 *
 * 默认整理规则：
 * - 根文件夹下的每个子文件夹归纳为一个课节（按名称排序），
 *   课节内收录该文件夹里（含其子层级）所有可识别资源
 * - 根文件夹下的散落文件归纳为一个"未分组"课节
 * - 无任何子文件夹时，整个根文件夹视为单课节课程
 */
import { readDir } from "@tauri-apps/plugin-fs";
import {
  genId,
  resourceKindOf,
  type Course,
  type CourseType,
  type Lesson,
  type LessonResource,
} from "../types";

/** 扫描的最大目录深度（相对根目录），防止误选巨大目录 */
const MAX_DEPTH = 4;

/**
 * 扫描一个根文件夹并按默认规则生成课程对象
 *
 * @param rootDir 课程根文件夹绝对路径
 * @param type 课程类型
 * @returns 生成的课程（可能包含空课节列表，由调用方决定如何提示）
 */
export async function scanCourseFolder(rootDir: string, type: CourseType): Promise<Course> {
  const rootName = rootDir.split(/[\\/]/).filter(Boolean).pop() ?? rootDir;
  const entries = await readDir(rootDir);

  const subDirs = entries.filter((e) => e.isDirectory && !e.name.startsWith("."));
  const rootFiles = entries.filter((e) => e.isFile && !e.name.startsWith("."));

  const lessons: Lesson[] = [];

  // 关键节点：每个子文件夹 -> 一个课节（按名称自然排序，兼容 01/02 前缀）
  for (const dir of subDirs.sort((a, b) => a.name.localeCompare(b.name, "zh-CN", { numeric: true }))) {
    const dirPath = joinPath(rootDir, dir.name);
    const resources = await collectResources(dirPath, 1);
    if (resources.length > 0) {
      lessons.push({ id: genId(), name: dir.name, resources, completed: false });
    }
  }

  // 根目录散文件 -> "未分组"课节；若没有任何子文件夹课节，则作为唯一课节（取根文件夹名）
  const looseResources = toResources(rootDir, rootFiles.map((f) => f.name));
  if (looseResources.length > 0) {
    lessons.push({
      id: genId(),
      name: lessons.length === 0 ? rootName : "未分组",
      resources: looseResources,
      completed: false,
    });
  }

  return { id: genId(), name: rootName, type, rootDir, lessons, createdAt: Date.now() };
}

/**
 * 递归收集目录内所有可识别资源（视频/音频/图片/PDF/GP）
 *
 * @param dirPath 目录绝对路径
 * @param depth 当前深度（相对课节根）
 * @returns 资源列表（按文件名自然排序）
 */
async function collectResources(dirPath: string, depth: number): Promise<LessonResource[]> {
  const entries = await readDir(dirPath);
  const files = entries.filter((e) => e.isFile && !e.name.startsWith("."));
  const resources = toResources(dirPath, files.map((f) => f.name));

  if (depth < MAX_DEPTH) {
    for (const sub of entries.filter((e) => e.isDirectory && !e.name.startsWith("."))) {
      resources.push(...(await collectResources(joinPath(dirPath, sub.name), depth + 1)));
    }
  }
  return resources.sort((a, b) => a.name.localeCompare(b.name, "zh-CN", { numeric: true }));
}

/**
 * 把目录下的文件名列表转换为资源列表（过滤不支持的格式）
 *
 * @param dirPath 目录绝对路径
 * @param names 文件名列表
 */
function toResources(dirPath: string, names: string[]): LessonResource[] {
  const resources: LessonResource[] = [];
  for (const name of names) {
    const kind = resourceKindOf(name);
    if (kind) {
      resources.push({ path: joinPath(dirPath, name), name, kind });
    }
  }
  return resources;
}

/**
 * 拼接路径（统一使用 / 分隔，macOS/Linux 原生，Windows 亦可识别）
 *
 * @param dir 父目录
 * @param name 子项名称
 */
function joinPath(dir: string, name: string): string {
  return dir.endsWith("/") || dir.endsWith("\\") ? `${dir}${name}` : `${dir}/${name}`;
}
