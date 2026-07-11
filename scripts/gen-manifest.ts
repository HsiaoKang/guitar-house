/**
 * 课节清单生成工具（Node 环境，脱离应用使用）
 *
 * 按启发式规则扫描课程目录，把组课结果写入 .learninghouse/manifest.json，
 * 用于批量为已有课程生成/重置清单（应用内等价操作为"重新识别课节"）。
 *
 * 用法: pnpm dlx tsx scripts/gen-manifest.ts <课程目录> [...更多目录]
 *      加 --collection 时把每个入参目录的一层子目录视为课程逐个生成
 *      加 --dry-run 时只打印结果不写盘
 *
 * @author yuchenxi
 */
import fs from "node:fs";
import path from "node:path";
import { buildHeuristicLessons, type DirNode } from "../apps/desktop/src/lib/heuristic";
import { resourceKindOf } from "../apps/desktop/src/types";

/** 与 scanner.ts 一致的扫描深度限制 */
const MAX_DEPTH = 4;

main();

/**
 * 入口：解析参数，逐目录生成清单
 */
function main(): void {
  const args = process.argv.slice(2);
  const collectionMode = args.includes("--collection");
  const dryRun = args.includes("--dry-run");
  const targets = args.filter((a) => !a.startsWith("--"));
  if (targets.length === 0) {
    console.error("用法: tsx scripts/gen-manifest.ts <课程目录> [...] [--collection] [--dry-run]");
    process.exit(1);
  }

  const dirs = collectionMode ? expandCollections(targets) : targets;
  for (const dir of dirs) {
    generateOne(dir, dryRun);
  }
}

/**
 * 为单个课程目录生成清单并写盘
 *
 * @param dir 课程目录绝对路径
 * @param dryRun 只打印不写盘
 */
function generateOne(dir: string, dryRun: boolean): void {
  const tree = readDirTree(dir, 0);
  const lessons = buildHeuristicLessons(tree);
  if (!lessons || lessons.length === 0) {
    console.log(`[SKIP] ${path.basename(dir)} — 不适用启发式规则，未生成`);
    return;
  }
  const manifest = { name: path.basename(dir), lessons };
  const videoCount = lessons.reduce(
    (n, l) => n + l.resources.filter((r) => resourceKindOf(r) === "video").length,
    0,
  );
  if (!dryRun) {
    const dataDir = path.join(dir, ".learninghouse");
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  }
  console.log(
    `[${dryRun ? "DRY" : "OK"}] ${path.basename(dir)} — 课节 ${lessons.length}，视频 ${videoCount}`,
  );
}

/**
 * 把合集目录展开为一层子目录列表（跳过隐藏目录）
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
 * 读取目录树（限深，跳过隐藏项），与 scanner.readDirTree 行为一致的 Node 版
 *
 * @param dirPath 目录绝对路径
 * @param depth 当前深度（根为 0）
 * @returns 目录树节点
 */
function readDirTree(dirPath: string, depth: number): DirNode {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = entries.filter((e) => e.isFile() && !e.name.startsWith(".")).map((e) => e.name);
  const dirs: DirNode[] = [];
  if (depth < MAX_DEPTH) {
    for (const sub of entries.filter((e) => e.isDirectory() && !e.name.startsWith("."))) {
      dirs.push(readDirTree(path.join(dirPath, sub.name), depth + 1));
    }
  }
  return { name: path.basename(dirPath), files, dirs };
}
