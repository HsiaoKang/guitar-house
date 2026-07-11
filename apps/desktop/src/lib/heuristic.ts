/**
 * 网课目录结构的启发式组课
 *
 * 针对下载类网课的两种主流打包结构,不依赖清单文件自动归纳课节:
 *
 * 1. 平铺视频型:根目录平铺编号视频 + 独立资料文件夹
 *    - 每个视频文件即一个课节,与文件夹原样一一对应(课节数=视频数),
 *      不做上/中/下等多集合并,保证用户能按文件数量直接核对
 * 2. 嵌套课时型:根目录只有一个"视频容器"文件夹(内含一批课时子文件夹),
 *    其余是纯资料文件夹
 *    - 容器下每个含视频的课时子文件夹归纳为一个课节(课时内讲义等资源随课节)
 *
 * 两种结构共用资料匹配:资料文件夹自顶向下匹配课节
 * (课号前缀 > 集号 > 主题文本子串/子序列),命中后整个子树归入全部命中课节
 * (同课号的多节各挂一份),未命中则下钻子文件夹继续;
 * 全部未命中的归入末尾"未分组资料"课节。
 *
 * 本模块为纯函数,输入目录树、输出相对路径课节,便于脱离 Tauri 环境测试。
 */
import { resourceKindOf } from "../types";

/** 目录树节点(由 scanner 从磁盘读取) */
export interface DirNode {
  /** 文件夹名 */
  name: string;
  /** 一层文件名列表 */
  files: string[];
  /** 一层子文件夹列表 */
  dirs: DirNode[];
}

/** 启发式归纳出的课节(资源为相对课程根目录的路径) */
export interface HeuristicLesson {
  /** 课节名 */
  name: string;
  /** 资源相对路径列表 */
  resources: string[];
}

/** 触发平铺视频启发式的根目录最少视频数(低于此值不视为平铺结构) */
const FLAT_VIDEO_MIN = 5;

/** 触发嵌套课时启发式的容器内最少课时文件夹数 */
const NESTED_LESSON_DIR_MIN = 3;

/** 文本模糊匹配(子序列兜底)要求的主题最短长度,避免过短主题误命中 */
const SUBSEQUENCE_MIN_LENGTH = 4;

/** 参与文本匹配的课节标题最短归一化长度 */
const TITLE_MATCH_MIN_LENGTH = 3;

/** 组课中间态课节(含资料匹配所需的元信息) */
interface LessonDraft {
  /** 课节名 */
  name: string;
  /** 视频文件名内的课号(嵌套课时型恒为 null) */
  lessonNo: number | null;
  /** 「第X集/课」集号(嵌套课时型恒为 null) */
  episode: number | null;
  /** 参与文本匹配的标题集合 */
  titles: string[];
  /** 资源相对路径 */
  resources: string[];
}

/** 解析后的视频信息 */
interface ParsedVideo {
  /** 文件名 */
  file: string;
  /** 文件名前导序号(无序号时为 MAX_SAFE_INTEGER,排序垫底) */
  num: number;
  /** 文件名内的课号(如「-12：」中的 12),无则 null */
  lessonNo: number | null;
  /** 「第X集/课」的集号,无则 null */
  episode: number | null;
  /** 标题(去除序号与系列前缀) */
  title: string;
}

/**
 * 启发式组课统一入口:识别目录结构并归纳课节,
 * 两种结构都不匹配时返回 null(调用方回退默认规则)
 *
 * @param tree 课程根目录树
 * @returns 课节列表,不适用启发式时为 null
 */
export function buildHeuristicLessons(tree: DirNode): HeuristicLesson[] | null {
  if (detectFlatVideoCourse(tree)) return buildFlatVideoLessons(tree);
  const container = detectNestedLessonCourse(tree);
  if (container) return buildNestedLessons(tree, container);
  return null;
}

// ---------------------------------------------------------------------------
// 结构识别
// ---------------------------------------------------------------------------

/**
 * 判断是否为"平铺视频"结构:
 * 根目录一层视频足够多,且所有子文件夹内(递归)不含视频
 *
 * @param tree 课程根目录树
 */
export function detectFlatVideoCourse(tree: DirNode): boolean {
  const rootVideoCount = tree.files.filter((f) => resourceKindOf(f) === "video").length;
  if (rootVideoCount < FLAT_VIDEO_MIN) return false;
  return tree.dirs.every((dir) => !subtreeHasVideo(dir));
}

/**
 * 判断是否为"嵌套课时"结构并返回视频容器:
 * 根目录散视频不多、恰好一个子文件夹内含成批课时子文件夹(含视频),
 * 其余子文件夹均为纯资料。多个容器(合集目录)不触发,交给默认规则
 *
 * @param tree 课程根目录树
 * @returns 唯一的视频容器节点,不符合结构时为 null
 */
export function detectNestedLessonCourse(tree: DirNode): DirNode | null {
  const rootVideoCount = tree.files.filter((f) => resourceKindOf(f) === "video").length;
  if (rootVideoCount >= FLAT_VIDEO_MIN) return null;

  const containers = tree.dirs.filter(
    (dir) => dir.dirs.filter(subtreeHasVideo).length >= NESTED_LESSON_DIR_MIN,
  );
  if (containers.length !== 1) return null;

  const container = containers[0];
  // 关键节点:容器外的其他子文件夹必须是纯资料,否则结构不明确,不冒险
  const othersAreMaterials = tree.dirs.every((dir) => dir === container || !subtreeHasVideo(dir));
  return othersAreMaterials ? container : null;
}

// ---------------------------------------------------------------------------
// 平铺视频型组课
// ---------------------------------------------------------------------------

/**
 * 平铺视频结构组课:每个视频文件一节,课节数与视频文件数严格一致
 * (不合并上/中/下多集,便于用户按文件数量核对);
 * 资料文件夹匹配归入(同课号多节各挂一份),未命中进"未分组资料"
 *
 * @param tree 课程根目录树
 * @returns 课节列表
 */
export function buildFlatVideoLessons(tree: DirNode): HeuristicLesson[] {
  const lessons: LessonDraft[] = parseVideos(tree).map((video) => ({
    lessonNo: video.lessonNo,
    episode: video.episode,
    titles: [video.title],
    name: videoLessonName(video),
    resources: [video.file],
  }));

  const unmatched: string[] = [];
  for (const dir of tree.dirs) {
    assignMaterials(dir, dir.name, lessons, unmatched);
  }
  // 根目录散落的非视频文件(封面图、说明文档等)兜底进未分组
  unmatched.push(...tree.files.filter((f) => resourceKindOf(f) !== null && resourceKindOf(f) !== "video"));

  return finalizeLessons(lessons, unmatched);
}

/**
 * 计算单个视频课节的展示名:
 * 有课号用「M：标题」;标题自带集号信息则直接用标题;否则「N. 标题」
 *
 * @param video 解析后的视频
 * @returns 课节名
 */
function videoLessonName(video: ParsedVideo): string {
  if (video.lessonNo !== null) return `${video.lessonNo}：${video.title}`;
  if (video.episode !== null) return video.title;
  return video.num === Number.MAX_SAFE_INTEGER ? video.title : `${video.num}. ${video.title}`;
}

/**
 * 解析根目录一层全部视频文件名
 *
 * @param tree 课程根目录树
 * @returns 解析结果(按序号排序)
 */
function parseVideos(tree: DirNode): ParsedVideo[] {
  return tree.files
    .filter((f) => resourceKindOf(f) === "video")
    .map(parseVideoName)
    .sort((a, b) => a.num - b.num || a.file.localeCompare(b.file, "zh-CN", { numeric: true }));
}

/**
 * 解析单个视频文件名:提取序号、课号、集号与标题
 * 兼容「N--系列_标题」「N_系列-M：标题」「N--系列_第X集：标题」等常见形态
 *
 * @param file 视频文件名
 * @returns 解析结果
 */
function parseVideoName(file: string): ParsedVideo {
  const stem = stripExt(file).normalize("NFC");
  const numMatch = /^(\d+)\s*[-_—.、:：]*\s*(.*)$/.exec(stem);
  const num = numMatch ? Number(numMatch[1]) : Number.MAX_SAFE_INTEGER;
  let rest = (numMatch ? numMatch[2] : stem).trim();

  // 「系列名_标题」时取下划线后的标题段;
  // 切分结果为空说明下划线只是尾部符号(如「?」被下载器替换),保留原段
  const underscore = rest.indexOf("_");
  if (underscore >= 0) {
    const after = rest.slice(underscore + 1).trim();
    if (after) rest = after;
  }

  // 「系列-M：标题」中的课号
  const lessonMatch = /[-—]\s*(\d+)\s*[:：]\s*(.*)$/.exec(rest);
  const lessonNo = lessonMatch ? Number(lessonMatch[1]) : null;
  let title = ((lessonMatch ? lessonMatch[2] : rest) || stem).trim();
  title = title.replace(/[_\s]+$/u, "") || stem;
  title = dedupeDashTitle(title);

  return { file, num, lessonNo, episode: episodeNumberOf(title), title };
}

/**
 * 精简「A-B」形式的重复标题:当 A 与 B 归一化后相同时只保留 B
 * (如「中级课详细介绍！-中级课详细介绍」→「中级课详细介绍」)
 *
 * @param title 原标题
 * @returns 精简后的标题
 */
function dedupeDashTitle(title: string): string {
  const idx = title.indexOf("-");
  if (idx <= 0) return title;
  const before = normalizeText(title.slice(0, idx));
  const after = title.slice(idx + 1).trim();
  return before.length > 0 && before === normalizeText(after) ? after : title;
}

// ---------------------------------------------------------------------------
// 嵌套课时型组课
// ---------------------------------------------------------------------------

/**
 * 嵌套课时结构组课:容器下每个含视频的课时子文件夹一节
 * (课时文件夹内讲义等全部资源随课节),资料文件夹匹配归入
 *
 * @param tree 课程根目录树
 * @param container 视频容器节点(detectNestedLessonCourse 的返回值)
 * @returns 课节列表
 */
export function buildNestedLessons(tree: DirNode, container: DirNode): HeuristicLesson[] {
  const lessonDirs = container.dirs
    .filter(subtreeHasVideo)
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN", { numeric: true }));

  const lessons: LessonDraft[] = lessonDirs.map((dir) => ({
    name: dir.name,
    // 课时文件夹的前导编号是顺序号而非"课号",不参与课号匹配,避免全册资料误挂
    lessonNo: null,
    episode: null,
    titles: [stripLeadingIndex(dir.name)],
    resources: collectSupportedFiles(dir, `${container.name}/${dir.name}`),
  }));

  const unmatched: string[] = [];
  // 容器内的纯资料子文件夹与散文件
  for (const dir of container.dirs.filter((d) => !subtreeHasVideo(d))) {
    assignMaterials(dir, `${container.name}/${dir.name}`, lessons, unmatched);
  }
  unmatched.push(
    ...container.files.filter((f) => resourceKindOf(f) !== null).map((f) => `${container.name}/${f}`),
  );
  // 容器外的资料文件夹与根目录散文件
  for (const dir of tree.dirs.filter((d) => d !== container)) {
    assignMaterials(dir, dir.name, lessons, unmatched);
  }
  unmatched.push(...tree.files.filter((f) => resourceKindOf(f) !== null));

  return finalizeLessons(lessons, unmatched);
}

/**
 * 去掉课时文件夹名的前导编号与分隔符,得到参与文本匹配的标题
 * (如「02.Lesson1Aprivateconversation」→「Lesson1Aprivateconversation」)
 *
 * @param name 课时文件夹名
 * @returns 标题(全编号名字时返回原名)
 */
function stripLeadingIndex(name: string): string {
  const stripped = name.normalize("NFC").replace(/^\d+\s*[-_—.、:：]*\s*/u, "").trim();
  return stripped || name;
}

// ---------------------------------------------------------------------------
// 资料匹配(两种结构共用)
// ---------------------------------------------------------------------------

/**
 * 资料文件夹自顶向下匹配课节:
 * 当前文件夹整体命中则子树全部资源归入命中课节;
 * 未命中时本层文件计入未分组,并逐个下钻子文件夹
 *
 * @param node 当前资料文件夹节点
 * @param relPath 该文件夹相对课程根目录的路径
 * @param lessons 课节列表
 * @param unmatched 未匹配资源收集器(原地追加)
 */
function assignMaterials(node: DirNode, relPath: string, lessons: LessonDraft[], unmatched: string[]): void {
  const targets = matchFolderToLessons(node.name, lessons);
  if (targets.length > 0) {
    const files = collectSupportedFiles(node, relPath);
    for (const lesson of targets) lesson.resources.push(...files);
    return;
  }
  unmatched.push(...node.files.filter((f) => resourceKindOf(f) !== null).map((f) => `${relPath}/${f}`));
  for (const dir of node.dirs) {
    assignMaterials(dir, `${relPath}/${dir.name}`, lessons, unmatched);
  }
}

/**
 * 把资料文件夹名匹配到课节,优先级:课号前缀 > 集号 > 主题文本
 *
 * @param folderName 资料文件夹名
 * @param lessons 课节列表
 * @returns 命中的课节(文本匹配可能命中多个;未命中返回空数组)
 */
function matchFolderToLessons(folderName: string, lessons: LessonDraft[]): LessonDraft[] {
  const name = folderName.normalize("NFC");

  // 「12：xxx」式课号前缀,与视频课号精确对应
  const lessonNoMatch = /^(\d+)\s*[:：.、]/.exec(name);
  if (lessonNoMatch) {
    const hits = lessons.filter((l) => l.lessonNo === Number(lessonNoMatch[1]));
    if (hits.length > 0) return hits;
  }

  // 「第X集课程资料」式集号
  const episode = episodeNumberOf(name);
  if (episode !== null) {
    const hits = lessons.filter((l) => l.episode === episode);
    if (hits.length > 0) return hits;
  }

  // 主题文本:剥掉「（NO.x）」及「课件/课程资料/资料」类尾缀后模糊匹配标题
  const topic = normalizeText(name.replace(/（[^（）]*）\s*$/u, "").replace(/(课件|课程资料|资料)\s*$/u, ""));
  if (topic.length === 0) return [];
  const bySubstring = lessons.filter((l) => l.titles.some((t) => titleIncludes(t, topic)));
  if (bySubstring.length > 0) return bySubstring;
  if (topic.length < SUBSEQUENCE_MIN_LENGTH) return [];
  return lessons.filter((l) => l.titles.some((t) => titleSubsequence(t, topic)));
}

/**
 * 课节标题子串匹配(标题过短时不参与,避免误命中)
 *
 * @param title 课节标题
 * @param topic 归一化后的资料主题
 */
function titleIncludes(title: string, topic: string): boolean {
  const normTitle = normalizeText(title);
  return normTitle.length >= TITLE_MATCH_MIN_LENGTH && normTitle.includes(topic);
}

/**
 * 课节标题子序列匹配兜底(标题过短时不参与)
 *
 * @param title 课节标题
 * @param topic 归一化后的资料主题
 */
function titleSubsequence(title: string, topic: string): boolean {
  const normTitle = normalizeText(title);
  return normTitle.length >= TITLE_MATCH_MIN_LENGTH && isSubsequence(topic, normTitle);
}

/**
 * 把中间态课节转为输出形态,并追加"未分组资料"课节
 *
 * @param lessons 中间态课节列表
 * @param unmatched 未匹配的资料相对路径
 * @returns 输出课节列表(过滤掉无资源课节)
 */
function finalizeLessons(lessons: LessonDraft[], unmatched: string[]): HeuristicLesson[] {
  const result: HeuristicLesson[] = lessons
    .filter((l) => l.resources.length > 0)
    .map((l) => ({ name: l.name, resources: l.resources }));
  if (unmatched.length > 0) {
    result.push({ name: "未分组资料", resources: unmatched });
  }
  return result;
}

// ---------------------------------------------------------------------------
// 通用辅助
// ---------------------------------------------------------------------------

/**
 * 递归收集节点子树内所有受支持格式的文件相对路径
 *
 * @param node 目录节点
 * @param relPath 节点相对课程根目录的路径
 * @returns 相对路径列表(按文件名自然排序)
 */
function collectSupportedFiles(node: DirNode, relPath: string): string[] {
  const files = node.files
    .filter((f) => resourceKindOf(f) !== null)
    .sort((a, b) => a.localeCompare(b, "zh-CN", { numeric: true }))
    .map((f) => `${relPath}/${f}`);
  for (const dir of node.dirs) {
    files.push(...collectSupportedFiles(dir, `${relPath}/${dir.name}`));
  }
  return files;
}

/**
 * 判断子树内是否含视频文件
 *
 * @param node 目录节点
 */
function subtreeHasVideo(node: DirNode): boolean {
  return node.files.some((f) => resourceKindOf(f) === "video") || node.dirs.some(subtreeHasVideo);
}

/**
 * 从文本提取「第X集/课/章」的集号(中文数字转数值)
 *
 * @param text 待解析文本
 * @returns 集号,未找到返回 null
 */
function episodeNumberOf(text: string): number | null {
  const m = /第([一二三四五六七八九十百零\d]+)[集课章]/u.exec(text.normalize("NFC"));
  if (!m) return null;
  return /^\d+$/.test(m[1]) ? Number(m[1]) : parseChineseNumeral(m[1]);
}

/**
 * 解析中文数字(支持一~九十九,覆盖常见课程集数)
 *
 * @param text 中文数字文本,如「十二」
 * @returns 对应数值,无法解析返回 0
 */
function parseChineseNumeral(text: string): number {
  const DIGITS: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  const tenIdx = text.indexOf("十");
  if (tenIdx < 0) return DIGITS[text] ?? 0;
  const tens = tenIdx === 0 ? 1 : (DIGITS[text[tenIdx - 1]] ?? 0);
  const ones = tenIdx === text.length - 1 ? 0 : (DIGITS[text[tenIdx + 1]] ?? 0);
  return tens * 10 + ones;
}

/**
 * 去掉文件名扩展名
 *
 * @param name 文件名
 */
function stripExt(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(0, idx) : name;
}

/**
 * 归一化文本用于匹配:NFC 后去掉所有非字母/数字字符并转小写
 *
 * @param text 原文本
 */
function normalizeText(text: string): string {
  return text.normalize("NFC").replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
}

/**
 * 判断 needle 是否为 haystack 的子序列(字符按序出现,可不连续)
 *
 * @param needle 待查找序列
 * @param haystack 目标文本
 */
function isSubsequence(needle: string, haystack: string): boolean {
  let i = 0;
  for (const ch of haystack) {
    if (ch === needle[i]) i++;
    if (i === needle.length) return true;
  }
  return needle.length === 0;
}
