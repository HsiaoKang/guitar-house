/**
 * 课程文件夹扫描器
 *
 * 整理规则（按优先级）：
 * 1. 清单模式：根文件夹下存在 learning-house.json 清单时，
 *    按清单声明的课节与资源列表组课（顺序即清单顺序，原文件无需移动）
 * 2. 启发式：识别"根目录平铺编号视频 + 独立资料文件夹"的网课结构，
 *    每个编号视频归纳为一个课节并自动匹配配套资料（见 heuristic.ts）
 * 3. 默认规则：
 *    - 根文件夹下的每个子文件夹归纳为一个课节（按名称排序），
 *      课节内收录该文件夹里（含其子层级）所有可识别资源
 *    - 根文件夹下的散落文件归纳为一个"未分组"课节
 *    - 无任何子文件夹时，整个根文件夹视为单课节课程
 */
import { exists, mkdir, readDir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import {
  basename,
  genId,
  resourceKindOf,
  type Course,
  type CourseType,
  type Lesson,
  type LessonResource,
} from "../types";
import { buildHeuristicLessons, type DirNode, type HeuristicLesson } from "./heuristic";
import { COURSE_DATA_DIR } from "./progress";

/** 扫描的最大目录深度（相对根目录），防止误选巨大目录 */
const MAX_DEPTH = 4;

/** 课节清单文件路径（课程数据目录内）；根目录 learning-house.json 为旧版兼容位置 */
export const MANIFEST_FILENAME = `${COURSE_DATA_DIR}/manifest.json`;
const LEGACY_MANIFEST_FILENAME = "learning-house.json";

/** 清单中的一个课节声明 */
interface ManifestLesson {
  /** 课节名 */
  name: string;
  /** 资源路径列表（相对课程根文件夹，也支持绝对路径） */
  resources: string[];
}

/** 课节清单文件结构 */
export interface CourseManifest {
  /** 课程名（缺省时取根文件夹名） */
  name?: string;
  /** 课节列表（顺序即展示顺序） */
  lessons: ManifestLesson[];
}

/** 清单与磁盘文件的对照结果（贴回导入前的体检报告） */
export interface ManifestAudit {
  /** 清单引用了但磁盘上不存在的路径（AI 写错/虚构的路径） */
  missingPaths: string[];
  /** 磁盘上存在但未被任何课节引用的视频（AI 遗漏的视频） */
  unreferencedVideos: string[];
}

/** 扫描选项 */
export interface ScanOptions {
  /** 忽略清单文件，强制走启发式/默认规则（用于清单质量差时重新识别） */
  ignoreManifest?: boolean;
}

/**
 * 扫描一个根文件夹并生成课程对象，按优先级分发：
 * 清单模式 > 平铺视频启发式 > 默认整理规则
 *
 * @param rootDir 课程根文件夹绝对路径
 * @param type 课程类型
 * @param options 扫描选项（ignoreManifest 时跳过清单直接自动识别）
 * @returns 生成的课程（可能包含空课节列表，由调用方决定如何提示）
 */
export async function scanCourseFolder(rootDir: string, type: CourseType, options?: ScanOptions): Promise<Course> {
  if (!options?.ignoreManifest) {
    // 清单查找顺序：.learninghouse/manifest.json > 旧版根目录 learning-house.json
    for (const candidate of [MANIFEST_FILENAME, LEGACY_MANIFEST_FILENAME]) {
      const manifestPath = joinPath(rootDir, candidate);
      if (await exists(manifestPath)) {
        return scanByManifest(rootDir, type, manifestPath);
      }
    }
  }
  const tree = await readDirTree(rootDir, 0);
  const heuristic = buildHeuristicLessons(tree);
  const lessons = heuristic ? lessonsFromHeuristic(rootDir, heuristic) : lessonsByDefaultRule(rootDir, tree);
  return {
    id: genId(),
    name: rootNameOf(rootDir),
    type,
    rootDir,
    lessons,
    createdAt: Date.now(),
    scanRule: heuristic ? "heuristic" : "default",
  };
}

/**
 * 轻量读取课程清单中声明的课程名（不解析课节，供启动时同步展示名）
 *
 * @param rootDir 课程根文件夹绝对路径
 * @returns 清单声明的课程名；无清单或未声明时返回 null
 */
export async function readManifestName(rootDir: string): Promise<string | null> {
  for (const candidate of [MANIFEST_FILENAME, LEGACY_MANIFEST_FILENAME]) {
    const manifestPath = joinPath(rootDir, candidate);
    try {
      if (await exists(manifestPath)) {
        const data = JSON.parse(await readTextFile(manifestPath)) as { name?: unknown };
        return typeof data.name === "string" && data.name.trim() ? data.name.trim() : null;
      }
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * 解析贴回的清单 JSON 文本（容忍 AI 常见的 markdown 代码块包裹），不合法时抛错
 *
 * @param manifestJson 清单 JSON 文本
 * @returns 校验通过的清单对象
 */
export function parseManifestText(manifestJson: string): CourseManifest {
  const cleaned = manifestJson
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return parseManifest(cleaned);
}

/**
 * 对照磁盘文件体检清单质量：找出"引用了不存在的路径"与"被遗漏的视频"。
 * 全程纯字符串集合比较（统一 NFC 规范化，规避 macOS NFD 文件名差异）。
 *
 * @param rootDir 课程根文件夹绝对路径
 * @param manifest 已解析的清单对象
 * @returns 体检报告（两个列表都为空即视为清单健康）
 */
export async function auditManifest(rootDir: string, manifest: CourseManifest): Promise<ManifestAudit> {
  const tree = await readDirTree(rootDir, 0);
  const diskPaths = flattenTreePaths(tree, "");
  const diskSet = new Set(diskPaths.map((p) => p.normalize("NFC")));
  const diskVideos = new Set(
    diskPaths.filter((p) => resourceKindOf(p) === "video").map((p) => p.normalize("NFC")),
  );

  const missingPaths: string[] = [];
  const referenced = new Set<string>();
  for (const lesson of manifest.lessons) {
    for (const raw of lesson.resources) {
      // 绝对路径不参与相对路径对照（交给导入时的 exists 检查兜底）
      if (isAbsolutePath(raw)) continue;
      const rel = raw.normalize("NFC").replace(/\\/g, "/").replace(/^\.\//, "");
      referenced.add(rel);
      if (!diskSet.has(rel)) missingPaths.push(raw);
    }
  }
  const unreferencedVideos = [...diskVideos].filter((v) => !referenced.has(v)).sort();
  return { missingPaths, unreferencedVideos };
}

/**
 * 写入课节清单到课程数据目录（.learninghouse/manifest.json）
 *
 * @param rootDir 课程根文件夹绝对路径
 * @param manifest 清单对象
 */
export async function writeManifest(rootDir: string, manifest: CourseManifest): Promise<void> {
  const dataDir = joinPath(rootDir, COURSE_DATA_DIR);
  if (!(await exists(dataDir))) {
    await mkdir(dataDir, { recursive: true });
  }
  await writeTextFile(joinPath(rootDir, MANIFEST_FILENAME), JSON.stringify(manifest, null, 2));
}

/**
 * 把扫描结果固化为清单写回课程数据目录（"重新识别"后覆盖劣质清单用），
 * 资源路径以相对课程根目录的形式写入，保持清单可随文件夹迁移。
 *
 * @param course 扫描得到的课程对象（rootDir 必须存在）
 */
export async function persistCourseManifest(course: Course): Promise<void> {
  if (!course.rootDir) return;
  const rootPrefix = course.rootDir.endsWith("/") ? course.rootDir : `${course.rootDir}/`;
  const manifest: CourseManifest = {
    name: course.name,
    lessons: course.lessons.map((l) => ({
      name: l.name,
      resources: l.resources.map((r) => (r.path.startsWith(rootPrefix) ? r.path.slice(rootPrefix.length) : r.path)),
    })),
  };
  await writeManifest(course.rootDir, manifest);
}

/**
 * 列出课程文件夹内全部受支持格式文件的相对路径（按名称自然排序），
 * 供课节管理页对照"未引用文件"使用
 *
 * @param rootDir 课程根文件夹绝对路径
 * @returns 相对路径列表
 */
export async function listCourseFiles(rootDir: string): Promise<string[]> {
  const tree = await readDirTree(rootDir, 0);
  return flattenTreePaths(tree, "").sort((a, b) => a.localeCompare(b, "zh-CN", { numeric: true }));
}

/**
 * 展平目录树为相对路径列表（仅受支持格式的文件）
 *
 * @param node 目录树节点
 * @param prefix 相对路径前缀（根为空串）
 */
function flattenTreePaths(node: DirNode, prefix: string): string[] {
  const paths = node.files
    .filter((f) => resourceKindOf(f) !== null)
    .map((f) => (prefix ? `${prefix}/${f}` : f));
  for (const dir of node.dirs) {
    paths.push(...flattenTreePaths(dir, prefix ? `${prefix}/${dir.name}` : dir.name));
  }
  return paths;
}

/**
 * 读取目录树（限深），供启发式组课与 AI 提示词生成消费
 *
 * @param dirPath 目录绝对路径
 * @param depth 当前深度（根为 0）
 * @returns 目录树节点（忽略隐藏文件与超深层级）
 */
export async function readDirTree(dirPath: string, depth: number): Promise<DirNode> {
  const entries = await readDir(dirPath);
  const files = entries.filter((e) => e.isFile && !e.name.startsWith(".")).map((e) => e.name);
  const dirs: DirNode[] = [];
  if (depth < MAX_DEPTH) {
    for (const sub of entries.filter((e) => e.isDirectory && !e.name.startsWith("."))) {
      dirs.push(await readDirTree(joinPath(dirPath, sub.name), depth + 1));
    }
  }
  return { name: rootNameOf(dirPath), files, dirs };
}

/**
 * 清单模式：读取清单文件并按声明构建课程
 *
 * @param rootDir 课程根文件夹绝对路径
 * @param type 课程类型
 * @param manifestPath 清单文件绝对路径
 * @returns 生成的课程
 * @throws 清单内容不是合法 JSON 或结构不符合约定时抛出带说明的错误
 */
async function scanByManifest(rootDir: string, type: CourseType, manifestPath: string): Promise<Course> {
  const manifest = parseManifest(await readTextFile(manifestPath));
  const lessons: Lesson[] = [];

  for (const item of manifest.lessons) {
    const resources = await resolveManifestResources(rootDir, item.resources);
    // 资源全部缺失/不支持的课节直接丢弃，避免出现空课节
    if (resources.length > 0) {
      lessons.push({ id: genId(), name: item.name, resources, completed: false });
    }
  }

  return {
    id: genId(),
    name: manifest.name?.trim() || rootNameOf(rootDir),
    type,
    rootDir,
    lessons,
    createdAt: Date.now(),
    scanRule: "manifest",
  };
}

/**
 * 解析并校验清单文本
 *
 * @param raw 清单文件原始文本
 * @returns 校验通过的清单对象
 * @throws JSON 语法错误或结构不合法时抛出带说明的错误
 */
function parseManifest(raw: string): CourseManifest {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error(`清单 ${MANIFEST_FILENAME} 不是合法的 JSON：${e instanceof Error ? e.message : e}`);
  }

  const manifest = data as Partial<CourseManifest>;
  if (!Array.isArray(manifest.lessons)) {
    throw new Error(`清单 ${MANIFEST_FILENAME} 缺少 lessons 数组`);
  }
  for (const [i, lesson] of manifest.lessons.entries()) {
    if (typeof lesson?.name !== "string" || !lesson.name.trim()) {
      throw new Error(`清单第 ${i + 1} 个课节缺少有效的 name`);
    }
    if (!Array.isArray(lesson.resources) || lesson.resources.some((r) => typeof r !== "string")) {
      throw new Error(`清单课节「${lesson.name}」的 resources 必须是字符串数组`);
    }
  }
  return manifest as CourseManifest;
}

/**
 * 把清单里的资源路径解析为资源列表：
 * 相对路径基于课程根文件夹展开；跳过不支持的格式与不存在的文件
 *
 * @param rootDir 课程根文件夹绝对路径
 * @param paths 清单声明的资源路径列表
 * @returns 有效资源列表（保持清单顺序）
 */
async function resolveManifestResources(rootDir: string, paths: string[]): Promise<LessonResource[]> {
  const resources: LessonResource[] = [];
  for (const p of paths) {
    const absPath = isAbsolutePath(p) ? p : joinPath(rootDir, p);
    const kind = resourceKindOf(absPath);
    if (kind && (await exists(absPath))) {
      resources.push({ path: absPath, name: basename(absPath), kind });
    }
  }
  return resources;
}

/**
 * 启发式结果转课节列表（相对路径转绝对路径与资源对象）
 *
 * @param rootDir 课程根文件夹绝对路径
 * @param items 启发式归纳出的课节
 * @returns 课节列表
 */
function lessonsFromHeuristic(rootDir: string, items: HeuristicLesson[]): Lesson[] {
  return items
    .map((item) => ({
      id: genId(),
      name: item.name,
      resources: toResourcesByRelPaths(rootDir, item.resources),
      completed: false,
    }))
    .filter((l) => l.resources.length > 0);
}

/**
 * 默认整理规则：子文件夹归纳为课节，散落文件归为"未分组"
 *
 * @param rootDir 课程根文件夹绝对路径
 * @param tree 课程根目录树
 * @returns 课节列表
 */
function lessonsByDefaultRule(rootDir: string, tree: DirNode): Lesson[] {
  const lessons: Lesson[] = [];

  // 关键节点：每个子文件夹 -> 一个课节（按名称自然排序，兼容 01/02 前缀）
  for (const dir of [...tree.dirs].sort((a, b) => a.name.localeCompare(b.name, "zh-CN", { numeric: true }))) {
    const resources = collectTreeResources(dir, joinPath(rootDir, dir.name));
    if (resources.length > 0) {
      lessons.push({ id: genId(), name: dir.name, resources, completed: false });
    }
  }

  // 根目录散文件 -> "未分组"课节；若没有任何子文件夹课节，则作为唯一课节（取根文件夹名）
  const looseResources = toResources(rootDir, tree.files);
  if (looseResources.length > 0) {
    lessons.push({
      id: genId(),
      name: lessons.length === 0 ? rootNameOf(rootDir) : "未分组",
      resources: looseResources,
      completed: false,
    });
  }
  return lessons;
}

/**
 * 收集目录树节点内所有可识别资源（视频/音频/图片/PDF/GP）
 *
 * @param node 目录树节点
 * @param dirPath 节点对应的绝对路径
 * @returns 资源列表（按文件名自然排序）
 */
function collectTreeResources(node: DirNode, dirPath: string): LessonResource[] {
  const resources = toResources(dirPath, node.files);
  for (const sub of node.dirs) {
    resources.push(...collectTreeResources(sub, joinPath(dirPath, sub.name)));
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
 * 把相对课程根目录的路径列表转换为资源列表（过滤不支持的格式）
 *
 * @param rootDir 课程根文件夹绝对路径
 * @param relPaths 相对路径列表
 */
function toResourcesByRelPaths(rootDir: string, relPaths: string[]): LessonResource[] {
  const resources: LessonResource[] = [];
  for (const rel of relPaths) {
    const kind = resourceKindOf(rel);
    if (kind) {
      const absPath = joinPath(rootDir, rel);
      resources.push({ path: absPath, name: basename(absPath), kind });
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

/**
 * 提取根文件夹路径的文件夹名（课程默认名）
 *
 * @param rootDir 根文件夹绝对路径
 */
function rootNameOf(rootDir: string): string {
  return rootDir.split(/[\\/]/).filter(Boolean).pop() ?? rootDir;
}

/**
 * 判断路径是否为绝对路径（POSIX 的 / 开头或 Windows 盘符开头）
 *
 * @param path 待判断路径
 */
function isAbsolutePath(path: string): boolean {
  return path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(path);
}
