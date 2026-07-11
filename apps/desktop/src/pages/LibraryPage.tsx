/**
 * 课程库页
 *
 * 应用首页：课程卡片列表（含学习进度），支持从文件夹导入课程、
 * AI 整理（提示词生成 + 结果贴回直接导入）、重新扫描、删除课程。
 */
import { useState } from "react";
import { motion } from "motion/react";
import {
  BrandLogo,
  Button,
  ContextMenu,
  EmptyState,
  Icon,
  IconButton,
  Modal,
  ProgressBar,
  Select,
  cn,
} from "@learning-house/ui";
import { COURSE_TYPE_LABELS, type Course, type CourseType } from "../types";
import { showConfirm, showMessage } from "../lib/dialogs";
import { FEEDBACK_EMAIL, openFeedbackEmail, openFeedbackPage } from "../lib/feedback";

interface LibraryPageProps {
  courses: Course[];
  /** 进入某课程的上课页 */
  onOpenCourse: (id: string) => void;
  /** 选择文件夹导入课程（type 为课程类型），完成/取消后 resolve */
  onImportFolder: (type: CourseType) => Promise<void>;
  /** 选择文件夹并生成 AI 整理提示词（取消选择时返回 null） */
  onGenerateAiPrompt: () => Promise<{ prompt: string; rootDir: string } | null>;
  /** 用户贴回 AI 清单后写入并导入，返回是否成功 */
  onImportByPastedManifest: (rootDir: string, type: CourseType, manifestJson: string) => Promise<boolean>;
  /** 重新扫描课程根文件夹（保留完成状态）；ignoreManifest 时忽略清单强制自动识别 */
  onRescanCourse: (id: string, ignoreManifest?: boolean) => void | Promise<void>;
  /** 切换课程类型（吉他/通用，决定上课页默认工具） */
  onChangeCourseType: (id: string, type: CourseType) => void;
  /** 打开课节管理页（人工调整课节与资源归属） */
  onManageCourse: (id: string) => void;
  /** 删除课程（仅移出课程库，不动磁盘文件） */
  onDeleteCourse: (id: string) => void;
  /** 主题切换按钮（由 App 注入） */
  themeToggle: React.ReactNode;
}

/**
 * 计算课程学习进度
 *
 * @param course 课程
 * @returns 已完成课节数与总课节数
 */
function progressOf(course: Course): { done: number; total: number } {
  const total = course.lessons.length;
  const done = course.lessons.filter((l) => l.completed).length;
  return { done, total };
}

/**
 * 课程库页组件
 *
 * @param props 见 LibraryPageProps 字段说明
 */
export function LibraryPage(props: LibraryPageProps) {
  const {
    courses,
    onOpenCourse,
    onImportFolder,
    onGenerateAiPrompt,
    onImportByPastedManifest,
    onRescanCourse,
    onChangeCourseType,
    onManageCourse,
    onDeleteCourse,
    themeToggle,
  } = props;
  const [importOpen, setImportOpen] = useState(false);
  /** 反馈渠道选择弹窗 */
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  /** AI 整理会话（提示词 + 目标文件夹 + 用户贴回的结果） */
  const [aiSession, setAiSession] = useState<{ prompt: string; rootDir: string } | null>(null);
  /** AI 导入的课程类型（决定上课页默认工具） */
  const [aiCourseType, setAiCourseType] = useState<CourseType>("guitar");
  const [pasted, setPasted] = useState("");
  const [copied, setCopied] = useState(false);
  const [importing, setImporting] = useState(false);
  /** 正在扫描导入的课程类型（按钮显示扫描中） */
  const [scanningType, setScanningType] = useState<CourseType | null>(null);
  /** 正在重新扫描的课程 id（刷新图标旋转） */
  const [rescanningId, setRescanningId] = useState<string | null>(null);

  /** 选文件夹生成 AI 提示词并打开弹窗 */
  const openAiPrompt = async () => {
    setImportOpen(false);
    const session = await onGenerateAiPrompt();
    if (session) {
      setCopied(false);
      setPasted("");
      setAiSession(session);
    }
  };

  /** 贴回的清单提交导入 */
  const submitPasted = async () => {
    if (!aiSession || !pasted.trim()) return;
    setImporting(true);
    const ok = await onImportByPastedManifest(aiSession.rootDir, aiCourseType, pasted);
    setImporting(false);
    if (ok) setAiSession(null);
  };

  /** 触发重扫并维持旋转态 */
  const rescan = async (id: string, ignoreManifest = false) => {
    setRescanningId(id);
    try {
      await onRescanCourse(id, ignoreManifest);
    } finally {
      setRescanningId(null);
    }
  };

  /** 确认后删除课程（仅移出课程库） */
  const confirmDelete = (course: Course) => {
    void showConfirm(`确认从课程库删除「${course.name}」？磁盘文件不会被删除。`).then(
      (ok) => ok && onDeleteCourse(course.id),
    );
  };

  /** 忽略清单重新识别（清单被 AI 整理坏时的自救出口），先确认再执行 */
  const reorganize = (course: Course) => {
    void showConfirm(
      `将忽略现有课节清单，按文件夹结构重新自动识别「${course.name}」的课节，并用新结果覆盖清单。学习进度会按课节名保留。继续吗？`,
      "重新识别课节",
    ).then((ok) => {
      if (ok) void rescan(course.id, true);
    });
  };

  /**
   * 课程卡片右键菜单选择分发
   *
   * @param course 目标课程
   * @param key 菜单项标识
   */
  const onCardMenuSelect = (course: Course, key: string) => {
    if (key === "open") onOpenCourse(course.id);
    else if (key === "manage") onManageCourse(course.id);
    else if (key === "rescan") void rescan(course.id);
    else if (key === "reorganize") reorganize(course);
    else if (key === "toggle-type") onChangeCourseType(course.id, course.type === "guitar" ? "general" : "guitar");
    else if (key === "delete") confirmDelete(course);
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card px-3.5">
        <div className="flex items-center gap-2 text-primary">
          <BrandLogo />
          <span className="text-[15px] font-bold tracking-wide">Learning House</span>
        </div>
        <div className="flex items-center gap-2">
          <IconButton name="feedback" label="反馈问题或建议" onClick={() => setFeedbackOpen(true)} />
          {themeToggle}
          <Button variant="primary" icon="plus" onClick={() => setImportOpen(true)}>
            导入课程文件夹
          </Button>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto p-5">
        {courses.length === 0 ? (
          <EmptyState
            icon="folderOpen"
            title="还没有课程"
            hint="选择一个文件夹，其中的每个子文件夹会自动归纳为一节课"
          >
            <Button variant="primary" onClick={() => setImportOpen(true)}>
              导入课程文件夹
            </Button>
          </EmptyState>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
            {courses.map((course, i) => {
              const { done, total } = progressOf(course);
              const percent = total > 0 ? Math.round((done / total) * 100) : 0;
              return (
                <ContextMenu
                  key={course.id}
                  items={[
                    { key: "open", label: "进入课程", icon: "folderOpen" },
                    { key: "manage", label: "管理课节", icon: "manage", disabled: !course.rootDir },
                    { key: "rescan", label: "重新扫描", icon: "rescan", disabled: !course.rootDir },
                    {
                      key: "reorganize",
                      label: "重新识别课节（忽略清单）",
                      icon: "sparkles",
                      disabled: !course.rootDir,
                    },
                    {
                      key: "toggle-type",
                      label: `切换为${COURSE_TYPE_LABELS[course.type === "guitar" ? "general" : "guitar"]}课程`,
                      icon: "music",
                    },
                    { key: "sep", label: "", separator: true },
                    { key: "delete", label: "从课程库删除", icon: "trash" },
                  ]}
                  onSelect={(key) => onCardMenuSelect(course, key)}
                >
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.04, ease: "easeOut" }}
                  whileHover={{ y: -3 }}
                  onClick={() => onOpenCourse(course.id)}
                  className="flex cursor-pointer flex-col gap-2.5 rounded-lg border border-border bg-card p-4 transition-[border-color,box-shadow] hover:border-primary/60 hover:shadow-lg"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[15px] font-semibold" title={course.name}>
                      {course.name}
                    </span>
                    <span className="shrink-0 rounded border border-primary px-1.5 py-px text-[11px] text-primary">
                      {COURSE_TYPE_LABELS[course.type]}
                    </span>
                  </div>
                  {course.rootDir && (
                    <div className="truncate text-[11px] text-muted-foreground/70" title={course.rootDir}>
                      {course.rootDir}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {total} 课节 · 已完成 {done} 节
                  </div>
                  <ProgressBar percent={percent} />
                  <div className="text-right text-[11px] text-muted-foreground">{percent}%</div>
                  <div
                    className="flex justify-end gap-1.5 border-t border-border pt-2.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {course.rootDir && (
                      <IconButton
                        name="manage"
                        label="管理课节（调整资源归属）"
                        onClick={() => onManageCourse(course.id)}
                      />
                    )}
                    {course.rootDir && (
                      <IconButton
                        name="rescan"
                        label="按文件夹重新扫描课节"
                        disabled={rescanningId === course.id}
                        className={cn(rescanningId === course.id && "[&_svg]:animate-spin")}
                        onClick={() => void rescan(course.id)}
                      />
                    )}
                    <IconButton name="trash" label="删除课程" onClick={() => confirmDelete(course)} />
                  </div>
                </motion.div>
                </ContextMenu>
              );
            })}
          </div>
        )}
      </main>

      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="导入课程" widthClassName="w-[380px]">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          选择课程类型后挑选课程根文件夹。子文件夹自动归纳为课节；平铺编号视频会按编号与配套资料自动组课；
          文件夹内已有课节清单时优先按清单组课。
        </p>
        <div className="flex gap-2.5">
          {(Object.keys(COURSE_TYPE_LABELS) as CourseType[]).map((type) => (
            <Button
              key={type}
              variant="primary"
              className="flex-1"
              disabled={scanningType !== null}
              onClick={() => {
                // 扫描完成前保持弹窗与加载态，避免"选完文件夹没反应"的观感
                setScanningType(type);
                void onImportFolder(type).finally(() => {
                  setScanningType(null);
                  setImportOpen(false);
                });
              }}
            >
              {scanningType === type ? "扫描中…" : `${COURSE_TYPE_LABELS[type]}课程`}
            </Button>
          ))}
        </div>
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <p className="text-[13px] text-muted-foreground">目录太乱、自动整理不理想？可以让任意 AI 帮你生成课节清单。</p>
          <Button variant="ghost" onClick={() => void openAiPrompt()}>
            <Icon name="sparkles" size="sm" />
            AI 整理
          </Button>
        </div>
      </Modal>

      <Modal open={aiSession !== null} onClose={() => setAiSession(null)} title="AI 整理" widthClassName="w-[600px]">
        <div className="flex flex-col gap-2">
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            第一步：复制提示词发给任意 AI（ChatGPT / 豆包 / Kimi…）
          </p>
          <textarea
            readOnly
            value={aiSession?.prompt ?? ""}
            onFocus={(e) => e.currentTarget.select()}
            className="h-28 w-full resize-none rounded-md border border-border bg-secondary p-2 font-mono text-xs text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          />
          <div>
            <Button
              variant="solid"
              size="sm"
              onClick={() => {
                void navigator.clipboard
                  .writeText(aiSession?.prompt ?? "")
                  .then(() => setCopied(true))
                  .catch(() => void showMessage("复制失败，请点击文本框全选后手动复制。"));
              }}
            >
              {copied ? "已复制 ✓" : "复制提示词"}
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            第二步：把 AI 回复的 JSON 直接粘贴到这里（无需手动建文件）
          </p>
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder='{"name": "...", "lessons": [...]}'
            className="h-36 w-full resize-none rounded-md border border-border bg-secondary p-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 focus-visible:outline-2 focus-visible:outline-ring"
          />
          <div className="flex items-center justify-end gap-2">
            <Select
              value={aiCourseType}
              onChange={(v) => setAiCourseType(v as CourseType)}
              options={(Object.keys(COURSE_TYPE_LABELS) as CourseType[]).map((t) => ({
                value: t,
                label: `${COURSE_TYPE_LABELS[t]}课程`,
              }))}
              title="课程类型决定上课页默认工具（吉他课自带节拍器）"
            />
            <Button variant="primary" disabled={!pasted.trim() || importing} onClick={() => void submitPasted()}>
              {importing ? "导入中…" : "校验并导入"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} title="反馈问题或建议" widthClassName="w-[360px]">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          两种方式都会自动带上应用版本与系统信息，直接描述问题即可。
        </p>
        <div className="flex flex-col gap-2">
          <Button
            variant="solid"
            onClick={() => {
              setFeedbackOpen(false);
              void openFeedbackPage();
            }}
          >
            <Icon name="feedback" size="sm" />
            GitHub Issue（推荐，可跟进讨论）
          </Button>
          <Button
            variant="solid"
            onClick={() => {
              setFeedbackOpen(false);
              void openFeedbackEmail();
            }}
          >
            <Icon name="mail" size="sm" />
            发送邮件（无需注册账号）
          </Button>
          <p className="text-center text-xs text-muted-foreground/70">邮箱：{FEEDBACK_EMAIL}</p>
        </div>
      </Modal>
    </div>
  );
}
