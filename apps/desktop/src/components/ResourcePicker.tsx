/**
 * 课节资料选择器
 *
 * 上课页"关联资料"的弹窗：按课节分组列出课程内全部文档/音频资源
 * （含未被任何课节引用的文件），勾选即关联到当前课节、取消勾选即移除。
 * 典型场景：讲解课需要引用上一节练习曲的曲谱与伴奏。
 */
import { useEffect, useMemo, useState } from "react";
import { Button, Checkbox, Icon, Modal, type IconName } from "@learning-house/ui";
import { listCourseFiles } from "../lib/scanner";
import {
  basename,
  isDocKind,
  relativePathOf,
  resourceKindOf,
  type Course,
  type Lesson,
  type ResourceKind,
} from "../types";

interface ResourcePickerProps {
  open: boolean;
  onClose: () => void;
  course: Course;
  /** 当前课节 */
  lesson: Lesson;
  /** 确认回调：当前课节应关联的文档/音频相对路径全集（视频不受影响） */
  onConfirm: (relPaths: string[]) => Promise<void>;
}

/** 选择器内的一个分组 */
interface PickerGroup {
  /** 分组标题（课节名 / 未引用文件） */
  title: string;
  /** 组内资源相对路径 */
  paths: string[];
}

/** 资源类别图标 */
const KIND_ICONS: Record<ResourceKind, IconName> = {
  video: "video",
  audio: "music",
  image: "image",
  pdf: "doc",
  guitarpro: "music",
};

/** 判断路径是否为可关联的资料类型（文档/音频；视频由课节主列表管理） */
function isAttachable(path: string): boolean {
  const kind = resourceKindOf(path);
  return kind !== null && (kind === "audio" || isDocKind(kind));
}

/**
 * 课节资料选择器组件
 *
 * @param props 见 ResourcePickerProps 字段说明
 */
export function ResourcePicker({ open, onClose, course, lesson, onConfirm }: ResourcePickerProps) {
  const rootDir = course.rootDir ?? "";
  /** 当前课节已关联的资料相对路径（初始勾选集） */
  const currentPaths = useMemo(
    () => lesson.resources.filter((r) => isAttachable(r.path)).map((r) => relativePathOf(rootDir, r.path)),
    [lesson, rootDir],
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allFiles, setAllFiles] = useState<string[]>([]);
  const [keyword, setKeyword] = useState("");
  const [saving, setSaving] = useState(false);

  // 打开时重置勾选状态并加载磁盘文件全集
  useEffect(() => {
    if (!open) return;
    setSelected(new Set(currentPaths));
    setKeyword("");
    if (rootDir) {
      void listCourseFiles(rootDir).then(setAllFiles).catch(() => setAllFiles([]));
    }
  }, [open, currentPaths, rootDir]);

  /** 本课节已关联组置顶 + 未引用文件组 + 其他课节分组（都只含资料类资源） */
  const groups = useMemo<PickerGroup[]>(() => {
    const referenced = new Set<string>();
    const others: PickerGroup[] = [];
    for (const l of course.lessons) {
      const paths = l.resources
        .filter((r) => isAttachable(r.path))
        .map((r) => relativePathOf(rootDir, r.path));
      for (const p of paths) referenced.add(p.normalize("NFC"));
      if (l.id !== lesson.id && paths.length > 0) {
        others.push({ title: l.name, paths });
      }
    }
    const result: PickerGroup[] = [];
    // 本课节已有的资料置顶，取消勾选即可移除（含仅属于本课节的资源）
    if (currentPaths.length > 0) {
      result.push({ title: "本课节已关联", paths: currentPaths });
    }
    const unreferenced = allFiles.filter((f) => isAttachable(f) && !referenced.has(f.normalize("NFC")));
    if (unreferenced.length > 0) {
      result.push({ title: "未引用文件", paths: unreferenced });
    }
    return [...result, ...others];
  }, [course.lessons, lesson.id, currentPaths, allFiles, rootDir]);

  /** 关键字过滤后的分组 */
  const filteredGroups = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return groups;
    return groups
      .map((g) => ({ ...g, paths: g.paths.filter((p) => p.toLowerCase().includes(kw)) }))
      .filter((g) => g.paths.length > 0);
  }, [groups, keyword]);

  /** 切换某个资源的勾选态 */
  const toggle = (path: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  /** 确认：按稳定顺序（原有优先、新增按列表序追加）组装并回调 */
  const confirm = async () => {
    const ordered: string[] = currentPaths.filter((p) => selected.has(p));
    const known = new Set(ordered);
    for (const group of groups) {
      for (const p of group.paths) {
        if (selected.has(p) && !known.has(p)) {
          ordered.push(p);
          known.add(p);
        }
      }
    }
    setSaving(true);
    try {
      await onConfirm(ordered);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const changed = useMemo(() => {
    if (selected.size !== currentPaths.length) return true;
    return currentPaths.some((p) => !selected.has(p));
  }, [selected, currentPaths]);

  return (
    <Modal open={open} onClose={onClose} title={`关联资料 · ${lesson.name}`} widthClassName="w-[520px]">
      <p className="text-xs leading-relaxed text-muted-foreground">
        勾选课程内任意曲谱 / 伴奏关联到本课节（如讲解课引用上一节的练习曲资料），取消勾选即移除，调整会写入课程清单。
      </p>
      <input
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder="搜索文件名…"
        className="h-8 w-full shrink-0 rounded-md border border-border bg-secondary px-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/50 focus-visible:outline-2 focus-visible:outline-ring"
      />
      <div className="max-h-[52vh] overflow-y-auto rounded-md border border-border">
        {filteredGroups.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">没有匹配的资料文件</div>
        ) : (
          filteredGroups.map((group) => (
            <div key={group.title}>
              <div className="sticky top-0 border-b border-border/60 bg-secondary px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
                {group.title}
              </div>
              <ul>
                {group.paths.map((path) => {
                  const kind = resourceKindOf(path) ?? "pdf";
                  return (
                    <li key={path} className="border-b border-border/40 last:border-b-0">
                      <label className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-[13px] hover:bg-secondary/50">
                        <Checkbox checked={selected.has(path)} onChange={() => toggle(path)} />
                        <span className="shrink-0 text-muted-foreground">
                          <Icon name={KIND_ICONS[kind]} size="sm" />
                        </span>
                        <span className="min-w-0 flex-1 truncate" title={path}>
                          {basename(path)}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>
      <div className="flex shrink-0 items-center justify-between">
        <span className="text-xs text-muted-foreground">已关联 {selected.size} 个资料</span>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" disabled={!changed || saving} onClick={() => void confirm()}>
            {saving ? "保存中…" : "保存"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
