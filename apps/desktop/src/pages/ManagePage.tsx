/**
 * 课节管理页
 *
 * 人工确认与调整课程的课节结构：课节改名、排序、增删，
 * 资源在课节间移动、未引用文件补挂；保存后写入课节清单
 * （.learninghouse/manifest.json）并按清单重新组课。
 */
import { useEffect, useMemo, useState } from "react";
import { Button, EmptyState, Icon, IconButton, Select, cn, type IconName } from "@learning-house/ui";
import { listCourseFiles, type CourseManifest } from "../lib/scanner";
import { showConfirm, showMessage } from "../lib/dialogs";
import { resourceKindOf, type Course, type ResourceKind } from "../types";

/** 管理页的课节草稿（资源为相对课程根目录的路径） */
interface DraftLesson {
  /** 页面内稳定 key（新建节自增） */
  key: string;
  name: string;
  resources: string[];
}

interface ManagePageProps {
  course: Course;
  /** 返回课程库（不保存） */
  onBack: () => void;
  /** 保存草稿：写清单并按清单重扫，成功后由 App 返回课程库 */
  onSave: (manifest: CourseManifest) => Promise<boolean>;
}

/** 资源类别对应的列表图标 */
const KIND_ICONS: Record<ResourceKind, IconName> = {
  video: "video",
  audio: "music",
  image: "image",
  pdf: "doc",
  guitarpro: "music",
};

/** "移出课节"下拉项的哨兵值（不匹配任何课节 key，效果为仅从原课节移除） */
const OUT_TARGET = "__out__";

/**
 * 课节管理页组件
 *
 * @param props 见 ManagePageProps 字段说明
 */
export function ManagePage({ course, onBack, onSave }: ManagePageProps) {
  const [lessons, setLessons] = useState<DraftLesson[]>(() =>
    course.lessons.map((l, i) => ({
      key: `l${i}`,
      name: l.name,
      resources: l.resources.map((r) => relativeTo(course.rootDir ?? "", r.path)),
    })),
  );
  /** 磁盘上全部受支持文件（相对路径），用于对照未引用 */
  const [allFiles, setAllFiles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!course.rootDir) return;
    void listCourseFiles(course.rootDir).then(setAllFiles).catch(() => setAllFiles([]));
  }, [course.rootDir]);

  /** 未被任何课节引用的文件（NFC 归一化对照，规避 macOS 文件名差异） */
  const unreferenced = useMemo(() => {
    const referenced = new Set(lessons.flatMap((l) => l.resources.map((r) => r.normalize("NFC"))));
    return allFiles.filter((f) => !referenced.has(f.normalize("NFC")));
  }, [lessons, allFiles]);

  /** 视频引用统计（顶栏透明化：用户可直接核对文件数量） */
  const videoStats = useMemo(() => {
    const total = allFiles.filter((f) => resourceKindOf(f) === "video").length;
    const referenced = new Set(
      lessons.flatMap((l) => l.resources.filter((r) => resourceKindOf(r) === "video").map((r) => r.normalize("NFC"))),
    );
    return { referenced: referenced.size, total };
  }, [lessons, allFiles]);

  /** 更新草稿并标脏 */
  const update = (updater: (prev: DraftLesson[]) => DraftLesson[]) => {
    setLessons(updater);
    setDirty(true);
  };

  /** 课节重命名 */
  const rename = (key: string, name: string) => {
    update((prev) => prev.map((l) => (l.key === key ? { ...l, name } : l)));
  };

  /** 课节上移/下移一位 */
  const move = (key: string, dir: -1 | 1) => {
    update((prev) => {
      const idx = prev.findIndex((l) => l.key === key);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  /** 删除课节（其资源自动回到"未引用文件"区） */
  const removeLesson = (key: string) => {
    update((prev) => prev.filter((l) => l.key !== key));
  };

  /** 在末尾新建空课节 */
  const addLesson = () => {
    update((prev) => [...prev, { key: `n${Date.now()}`, name: `新课节 ${prev.length + 1}`, resources: [] }]);
  };

  /** 把资源从某课节移动到另一课节；目标为 OUT_TARGET 时仅移出（回到未引用区） */
  const moveResource = (fromKey: string, path: string, targetKey: string) => {
    if (fromKey === targetKey) return;
    update((prev) =>
      prev.map((l) => {
        if (l.key === fromKey) return { ...l, resources: l.resources.filter((r) => r !== path) };
        if (l.key === targetKey) return { ...l, resources: [...l.resources, path] };
        return l;
      }),
    );
  };

  /** 把未引用文件挂到指定课节 */
  const attachResource = (path: string, targetKey: string) => {
    update((prev) => prev.map((l) => (l.key === targetKey ? { ...l, resources: [...l.resources, path] } : l)));
  };

  /** 校验草稿并保存 */
  const save = async () => {
    if (lessons.some((l) => !l.name.trim())) {
      await showMessage("存在未命名的课节，请先补全名称。", "无法保存");
      return;
    }
    const nonEmpty = lessons.filter((l) => l.resources.length > 0);
    if (nonEmpty.length === 0) {
      await showMessage("至少需要一个包含资源的课节。", "无法保存");
      return;
    }
    if (nonEmpty.length < lessons.length) {
      const ok = await showConfirm(`有 ${lessons.length - nonEmpty.length} 个空课节将被丢弃，继续保存吗？`);
      if (!ok) return;
    }
    setSaving(true);
    const ok = await onSave({
      name: course.name,
      lessons: nonEmpty.map((l) => ({ name: l.name.trim(), resources: l.resources })),
    });
    setSaving(false);
    if (ok) setDirty(false);
  };

  /** 返回前的脏数据拦截 */
  const back = async () => {
    if (dirty) {
      const ok = await showConfirm("有未保存的修改，确认放弃并返回？");
      if (!ok) return;
    }
    onBack();
  };

  /** 资源"移动到"下拉的目标课节选项（含移出项） */
  const moveTargets = (excludeKey: string) => [
    { value: OUT_TARGET, label: "移出课节" },
    ...lessons.filter((l) => l.key !== excludeKey).map((l) => ({ value: l.key, label: l.name })),
  ];

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-3.5">
        <div className="flex min-w-0 items-center gap-2">
          <IconButton name="back" label="返回课程库" onClick={() => void back()} />
          <span className="truncate text-[15px] font-semibold">管理课节 · {course.name}</span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span
            className={cn(
              "text-xs",
              videoStats.referenced < videoStats.total ? "text-amber-500" : "text-muted-foreground",
            )}
          >
            {lessons.length} 个课节 · 已引用视频 {videoStats.referenced}/{videoStats.total}
          </span>
          <Button variant="ghost" icon="plus" onClick={addLesson}>
            新增课节
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={saving || !dirty}>
            {saving ? "保存中…" : "保存"}
          </Button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 gap-4 p-4">
        {/* 左：课节列表 */}
        <section className="flex min-h-0 min-w-0 flex-[2] flex-col gap-2 overflow-y-auto pr-1">
          {lessons.map((lesson, i) => (
            <div key={lesson.key} className="rounded-lg border border-border bg-card">
              <div className="flex items-center gap-1.5 border-b border-border/60 px-3 py-2">
                <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{i + 1}.</span>
                <input
                  value={lesson.name}
                  onChange={(e) => rename(lesson.key, e.target.value)}
                  className="h-7 min-w-0 flex-1 rounded border border-transparent bg-transparent px-1.5 text-[13px] font-medium text-foreground transition-colors hover:border-border focus:border-ring focus:bg-secondary focus:outline-none"
                />
                <IconButton name="arrowUp" label="上移" disabled={i === 0} onClick={() => move(lesson.key, -1)} />
                <IconButton
                  name="arrowDown"
                  label="下移"
                  disabled={i === lessons.length - 1}
                  onClick={() => move(lesson.key, 1)}
                />
                <IconButton name="trash" label="删除课节（资源回到未引用区）" onClick={() => removeLesson(lesson.key)} />
              </div>
              {lesson.resources.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground/60">空课节（保存时将被丢弃）</div>
              ) : (
                <ul className="flex flex-col">
                  {lesson.resources.map((path) => (
                    <li
                      key={path}
                      className="group flex items-center gap-2 px-3 py-1.5 text-[13px] hover:bg-secondary/50"
                    >
                      <span className="shrink-0 text-muted-foreground">
                        <Icon name={KIND_ICONS[resourceKindOf(path) ?? "pdf"]} size="sm" />
                      </span>
                      <span className="min-w-0 flex-1 truncate" title={path}>
                        {path}
                      </span>
                      <Select
                        value=""
                        placeholder="移动到"
                        onChange={(target) => moveResource(lesson.key, path, target)}
                        options={moveTargets(lesson.key)}
                        className="h-6 shrink-0 border-transparent bg-transparent px-1.5 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
                        title="移动到其他课节"
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>

        {/* 右：未引用文件 */}
        <aside className="flex min-h-0 w-80 shrink-0 flex-col rounded-lg border border-border bg-card">
          <div className="border-b border-border/60 px-3 py-2 text-[13px] font-medium">
            未引用文件
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">{unreferenced.length}</span>
          </div>
          {unreferenced.length === 0 ? (
            <EmptyState icon="check" title="全部文件都已引用" />
          ) : (
            <ul className="min-h-0 flex-1 overflow-y-auto">
              {unreferenced.map((path) => (
                <li key={path} className="group flex items-center gap-2 px-3 py-1.5 text-[13px] hover:bg-secondary/50">
                  <span className="shrink-0 text-muted-foreground">
                    <Icon name={KIND_ICONS[resourceKindOf(path) ?? "pdf"]} size="sm" />
                  </span>
                  <span className="min-w-0 flex-1 truncate" title={path}>
                    {path}
                  </span>
                  <Select
                    value=""
                    placeholder="添加到"
                    onChange={(target) => attachResource(path, target)}
                    options={lessons.map((l) => ({ value: l.key, label: l.name }))}
                    className="h-6 shrink-0 border-transparent bg-transparent px-1.5 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
                    title="添加到课节"
                  />
                </li>
              ))}
            </ul>
          )}
        </aside>
      </main>
    </div>
  );
}

/**
 * 计算资源相对课程根目录的路径（清单内统一存相对路径）
 *
 * @param rootDir 课程根目录
 * @param absPath 资源绝对路径
 */
function relativeTo(rootDir: string, absPath: string): string {
  const prefix = rootDir.endsWith("/") ? rootDir : `${rootDir}/`;
  return absPath.startsWith(prefix) ? absPath.slice(prefix.length) : absPath;
}
