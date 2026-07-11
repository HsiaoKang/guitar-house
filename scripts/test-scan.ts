/**
 * 课程扫描逻辑离线测试工具
 *
 * 在 Node 环境模拟 scanner.ts 的调度(清单 > 平铺视频启发式 > 默认规则),
 * 对指定目录逐个跑扫描并执行断言检查,用于用真实课程目录回归验证组课逻辑。
 *
 * 断言项:
 * 1. 扫描不抛异常且课节数 > 0
 * 2. 视频无丢失:根目录一层视频全部收录进课节(启发式场景)
 * 3. 课节内无重复资源引用
 * 4. 课节资源路径全部真实存在
 *
 * 用法: pnpm dlx tsx scripts/test-scan.ts <课程目录或合集目录> [...更多目录]
 *      加 --collection 时把每个入参目录的一层子目录视为课程逐个测试
 *      加 --no-manifest 时忽略已有清单文件(用于回归验证启发式)
 */
import fs from "node:fs";
import path from "node:path";
import { buildHeuristicLessons, type DirNode, type HeuristicLesson } from "../apps/desktop/src/lib/heuristic";
import { resourceKindOf } from "../apps/desktop/src/types";

/** 与 scanner.ts 一致的扫描深度限制 */
const MAX_DEPTH = 4;

/** 单个目录的测试结果 */
interface ScanReport {
  dir: string;
  rule: "manifest" | "heuristic" | "default";
  lessonCount: number;
  resourceCount: number;
  errors: string[];
  notes: string[];
}

main();

/**
 * 入口:解析参数,逐目录测试并输出汇总
 */
function main() {
  const args = process.argv.slice(2);
  const collectionMode = args.includes("--collection");
  const noManifest = args.includes("--no-manifest");
  const targets = args.filter((a) => !a.startsWith("--"));
  if (targets.length === 0) {
    console.error("用法: tsx scripts/test-scan.ts <目录> [...] [--collection] [--no-manifest]");
    process.exit(1);
  }

  const dirs = collectionMode ? expandCollections(targets) : targets;
  const reports = dirs.map((d) => testOneCourse(d, noManifest));

  console.log("\n================ 汇总 ================");
  let failed = 0;
  for (const r of reports) {
    const skipped = r.notes.some((n) => n.startsWith("SKIP"));
    const status = skipped ? "SKIP" : r.errors.length === 0 ? "PASS" : "FAIL";
    if (!skipped && r.errors.length > 0) failed++;
    console.log(`[${status}] [${r.rule}] ${path.basename(r.dir)} — 课节 ${r.lessonCount},资源 ${r.resourceCount}`);
    for (const e of r.errors) console.log(`    !! ${e}`);
    for (const n of r.notes) console.log(`    -- ${n}`);
  }
  console.log(`\n${reports.length} 个目录,失败 ${failed} 个`);
  process.exit(failed > 0 ? 1 : 0);
}

/**
 * 把合集目录展开为一层子目录列表(跳过隐藏目录)
 *
 * @param targets 合集目录列表
 * @returns 课程目录列表
 */
function expandCollections(targets: string[]): string[] {
  const dirs: string[] = [];
  for (const t of targets) {
    for (const e of fs.readdirSync(t, { withFileTypes: true })) {
      if (e.isDirectory() && !e.name.startsWith(".")) dirs.push(path.join(t, e.name));
    }
  }
  return dirs;
}

/**
 * 测试单个课程目录:按调度规则组课并跑全部断言
 *
 * @param dir 课程目录绝对路径
 * @param noManifest 是否忽略清单文件强制走启发式/默认规则
 * @returns 测试结果
 */
function testOneCourse(dir: string, noManifest: boolean): ScanReport {
  const report: ScanReport = { dir, rule: "default", lessonCount: 0, resourceCount: 0, errors: [], notes: [] };
  console.log(`\n======== ${dir}`);
  try {
    const tree = readTree(dir, 0);
    // 无任何受支持资源的目录属于预期的"导入时提示无资源"场景,跳过断言
    if (countSupported(tree) === 0) {
      report.notes.push("SKIP: 目录内无受支持资源");
      return report;
    }
    let lessons: HeuristicLesson[];

    const heuristic = buildHeuristicLessons(tree);
    // 与 scanner.ts 一致的清单查找顺序：.learninghouse/manifest.json > 旧版根目录 learning-house.json
    const manifestPath = [".learninghouse/manifest.json", "learning-house.json"]
      .map((p) => path.join(dir, p))
      .find((p) => fs.existsSync(p));
    if (!noManifest && manifestPath) {
      report.rule = "manifest";
      lessons = (JSON.parse(fs.readFileSync(manifestPath, "utf8")) as { lessons: HeuristicLesson[] }).lessons;
    } else if (heuristic) {
      report.rule = "heuristic";
      lessons = heuristic;
      assertNoVideoLost(tree, lessons, report);
    } else {
      lessons = defaultRuleLessons(tree);
    }

    report.lessonCount = lessons.length;
    report.resourceCount = lessons.reduce((s, l) => s + l.resources.length, 0);
    if (lessons.length === 0) report.errors.push("组课结果为空");

    assertNoDuplicateInLesson(lessons, report);
    assertPathsExist(dir, lessons, report);
    printLessonPreview(lessons);
  } catch (e) {
    report.errors.push(`扫描抛出异常: ${e instanceof Error ? e.message : e}`);
  }
  return report;
}

/**
 * 断言:根目录一层视频全部被收录进课节,且不重复
 */
function assertNoVideoLost(tree: DirNode, lessons: HeuristicLesson[], report: ScanReport): void {
  const rootVideos = tree.files.filter((f) => resourceKindOf(f) === "video");
  const referenced = new Map<string, number>();
  for (const l of lessons) {
    for (const r of l.resources) referenced.set(r, (referenced.get(r) ?? 0) + 1);
  }
  for (const v of rootVideos) {
    const count = referenced.get(v) ?? 0;
    if (count === 0) report.errors.push(`视频未收录: ${v}`);
    if (count > 1) report.errors.push(`视频被收录 ${count} 次: ${v}`);
  }
}

/**
 * 断言:单个课节内没有重复资源引用
 */
function assertNoDuplicateInLesson(lessons: HeuristicLesson[], report: ScanReport): void {
  for (const l of lessons) {
    const seen = new Set<string>();
    for (const r of l.resources) {
      if (seen.has(r)) report.errors.push(`课节「${l.name}」重复引用: ${r}`);
      seen.add(r);
    }
  }
}

/**
 * 断言:课节引用的资源路径都真实存在
 */
function assertPathsExist(dir: string, lessons: HeuristicLesson[], report: ScanReport): void {
  for (const l of lessons) {
    for (const r of l.resources) {
      if (!fs.existsSync(path.join(dir, r))) report.errors.push(`路径不存在: ${r}`);
    }
  }
}

/**
 * 打印课节预览(首尾各 4 节)供人工核对命名与归组质量
 */
function printLessonPreview(lessons: HeuristicLesson[]): void {
  const preview = lessons.length <= 8 ? lessons : [...lessons.slice(0, 4), null, ...lessons.slice(-4)];
  for (const l of preview) {
    if (l === null) {
      console.log(`  … 共 ${lessons.length} 节 …`);
      continue;
    }
    const videos = l.resources.filter((r) => resourceKindOf(r) === "video").length;
    console.log(`  * ${l.name} [视频${videos} 其他${l.resources.length - videos}]`);
  }
}

/**
 * 统计目录树内受支持格式文件总数
 *
 * @param tree 目录树
 */
function countSupported(tree: DirNode): number {
  return (
    tree.files.filter((f) => resourceKindOf(f) !== null).length +
    tree.dirs.reduce((s, d) => s + countSupported(d), 0)
  );
}

/**
 * 与 scanner.readDirTree 等价的 Node 版目录树读取
 *
 * @param dirPath 目录绝对路径
 * @param depth 当前深度
 */
function readTree(dirPath: string, depth: number): DirNode {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true }).filter((e) => !e.name.startsWith("."));
  return {
    name: path.basename(dirPath),
    files: entries.filter((e) => e.isFile()).map((e) => e.name),
    dirs:
      depth < MAX_DEPTH
        ? entries.filter((e) => e.isDirectory()).map((e) => readTree(path.join(dirPath, e.name), depth + 1))
        : [],
  };
}

/**
 * 与 scanner.lessonsByDefaultRule 等价的默认规则(相对路径形式)
 *
 * @param tree 课程根目录树
 */
function defaultRuleLessons(tree: DirNode): HeuristicLesson[] {
  const lessons: HeuristicLesson[] = [];
  for (const dir of [...tree.dirs].sort((a, b) => a.name.localeCompare(b.name, "zh-CN", { numeric: true }))) {
    const resources = collectTree(dir, dir.name);
    if (resources.length > 0) lessons.push({ name: dir.name, resources });
  }
  const loose = tree.files.filter((f) => resourceKindOf(f) !== null);
  if (loose.length > 0) {
    lessons.push({ name: lessons.length === 0 ? tree.name : "未分组", resources: loose });
  }
  return lessons;
}

/**
 * 收集树节点全部受支持资源(相对路径,按文件名排序)
 */
function collectTree(node: DirNode, relPath: string): string[] {
  const files = node.files
    .filter((f) => resourceKindOf(f) !== null)
    .map((f) => `${relPath}/${f}`);
  for (const d of node.dirs) files.push(...collectTree(d, `${relPath}/${d.name}`));
  return files.sort((a, b) => path.basename(a).localeCompare(path.basename(b), "zh-CN", { numeric: true }));
}
