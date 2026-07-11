/**
 * Learning House 应用根组件
 *
 * 负责视图路由（课程库 / 上课页）、课程库与设置的加载持久化、
 * 主题切换（.dark 类挂载）与页面过渡动效。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { AnimatePresence, motion } from "motion/react";
import { IconButton, Toaster, TooltipProvider, toast } from "@learning-house/ui";
import { LibraryPage } from "./pages/LibraryPage";
import { ClassroomPage } from "./pages/ClassroomPage";
import { ManagePage } from "./pages/ManagePage";
import {
  auditManifest,
  parseManifestText,
  persistCourseManifest,
  readDirTree,
  readManifestName,
  scanCourseFolder,
  writeManifest,
} from "./lib/scanner";
import { showConfirm, showMessage } from "./lib/dialogs";
import { IS_TAURI } from "./lib/platform";
import { runStartupUpdateCheck } from "./lib/updater";
import { buildOrganizePrompt } from "./lib/aiPrompt";
import { loadCourseProgress, saveCourseProgress, type CourseProgress } from "./lib/progress";
import {
  DEFAULT_SETTINGS,
  bumpUsageCounter,
  loadCourses,
  loadSettings,
  saveCourses,
  saveSettings,
} from "./lib/storage";
import {
  SCAN_RULE_LABELS,
  basename,
  resourceKindOf,
  type AppSettings,
  type Course,
  type CourseType,
  type LessonResource,
  type ResolvedTheme,
  type ThemeKind,
} from "./types";
import type { CourseManifest, ManifestAudit } from "./lib/scanner";

/** 主题偏好的循环切换顺序 */
const THEME_CYCLE: Record<ThemeKind, ThemeKind> = {
  system: "light",
  light: "dark",
  dark: "system",
};

/** 主题切换按钮的图标与说明（展示当前偏好） */
const THEME_TOGGLE_META: Record<ThemeKind, { icon: "monitor" | "sun" | "moon"; label: string }> = {
  system: { icon: "monitor", label: "主题：跟随系统（点击切为亮色）" },
  light: { icon: "sun", label: "主题：亮色（点击切为暗色）" },
  dark: { icon: "moon", label: "主题：暗色（点击切为跟随系统）" },
};

/**
 * 订阅系统外观（prefers-color-scheme），返回系统当前的实际主题
 */
function useSystemTheme(): ResolvedTheme {
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  );
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? "dark" : "light");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return systemTheme;
}

function App() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  /** 正在管理课节的课程 id（管理页视图） */
  const [managingCourseId, setManagingCourseId] = useState<string | null>(null);
  /** 进入上课页时要定位到的课节名（管理页跳转指定；消费后清空） */
  const [initialLessonName, setInitialLessonName] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  /** 课程 id -> 进度（完成课节 + 续播位置），持久化在课程文件夹内 */
  const progressRef = useRef<Map<string, CourseProgress>>(new Map());
  const systemTheme = useSystemTheme();

  // 实际渲染主题：偏好为 system 时跟随系统外观
  const resolvedTheme: ResolvedTheme = settings.theme === "system" ? systemTheme : settings.theme;

  // 启动加载：课程库与设置存于本地应用数据（快），读到即渲染首屏；
  // 进度文件与清单名位于课程文件夹（可能在外接盘，寻道/唤醒慢），
  // 改为后台并行刷新，完成后校正展示——首屏不再被外接盘 IO 阻塞
  useEffect(() => {
    void (async () => {
      const [storedCourses, storedSettings] = await Promise.all([loadCourses(), loadSettings()]);
      setSettings({ ...DEFAULT_SETTINGS, ...storedSettings });
      // 关键节点：先用上次保存的课程快照（含完成状态）渲染
      setCourses(storedCourses);
      setLoaded(true);

      // 后台并行读取各课程的进度与清单名（每门课两次外接盘 IO，互不等待）
      const refreshed = await Promise.all(
        storedCourses.map(async (course) => {
          if (!course.rootDir) return null;
          const [progress, manifestName] = await Promise.all([
            loadCourseProgress(course.rootDir),
            readManifestName(course.rootDir).catch(() => null),
          ]);
          return { course, progress, manifestName };
        }),
      );

      let renamed = false;
      for (const item of refreshed) {
        if (!item) continue;
        progressRef.current.set(item.course.id, item.progress);
        // 清单是课程名的事实来源，历史导入的文件夹名展示随之更新
        if (item.manifestName && item.manifestName !== item.course.name) {
          item.course.name = item.manifestName;
          renamed = true;
        }
      }
      setCourses(applyProgress(storedCourses, progressRef.current));
      if (renamed) void saveCourses(storedCourses);
    })();
  }, []);

  // 关键节点：暗色时给根元素挂 .dark 类，shadcn CSS 变量随之切换
  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  }, [resolvedTheme]);

  // 原生标题栏跟随应用主题（system 时传 null 交还系统控制），保持窗口装饰与内容一致
  useEffect(() => {
    if (!IS_TAURI) return;
    void (async () => {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().setTheme(settings.theme === "system" ? null : settings.theme);
    })().catch(() => undefined);
  }, [settings.theme]);

  const activeCourse = courses.find((c) => c.id === activeCourseId) ?? null;
  const managingCourse = courses.find((c) => c.id === managingCourseId) ?? null;

  // 窗口标题：打开课程后显示课程名，回到课程库恢复应用名
  useEffect(() => {
    if (!IS_TAURI) return;
    const title = activeCourse?.name ?? managingCourse?.name ?? "Learning House";
    void (async () => {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().setTitle(title);
    })().catch(() => undefined);
  }, [activeCourse?.name, managingCourse?.name]);

  // 生产环境屏蔽 WebView 原生右键菜单（视频区有自定义菜单；开发保留以便审查元素）
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    window.addEventListener("contextmenu", onContextMenu);
    return () => window.removeEventListener("contextmenu", onContextMenu);
  }, []);

  // 启动后静默检查应用更新（仅 Tauri 生产构建生效，失败静默忽略）
  useEffect(() => {
    void runStartupUpdateCheck(toast);
  }, []);

  /**
   * 更新课程库并持久化
   *
   * @param updater 基于当前课程列表计算新列表
   */
  const updateCourses = useCallback((updater: (prev: Course[]) => Course[]) => {
    setCourses((prev) => {
      const next = updater(prev);
      void saveCourses(next);
      return next;
    });
  }, []);

  /**
   * 从文件夹导入课程：弹目录选择器 -> 扫描 -> 加入课程库并读取进度
   *
   * @param type 课程类型
   */
  const importFolder = useCallback(
    async (type: CourseType) => {
      const selected = await open({ directory: true, multiple: false, title: "选择课程根文件夹" });
      if (typeof selected !== "string") return;
      const course = await scanCourseFolder(selected, type).catch(async (e: unknown) => {
        await showMessage(String(e instanceof Error ? e.message : e), "导入失败");
        return null;
      });
      if (!course) return;
      if (course.lessons.length === 0) {
        await showMessage("该文件夹内没有识别到可用资源（视频/音频/图片/PDF/Guitar Pro）。");
        return;
      }
      const progress = await loadCourseProgress(selected);
      progressRef.current.set(course.id, progress);
      updateCourses((prev) => [...prev, ...applyProgress([course], progressRef.current)]);
    },
    [updateCourses],
  );

  /**
   * 选择文件夹并生成 AI 整理提示词
   *
   * @returns 提示词与目标文件夹，取消或无资源时返回 null
   */
  const generateAiPrompt = useCallback(async (): Promise<{ prompt: string; rootDir: string } | null> => {
    const selected = await open({ directory: true, multiple: false, title: "选择要整理的课程文件夹" });
    if (typeof selected !== "string") return null;
    const tree = await readDirTree(selected, 0);
    const prompt = buildOrganizePrompt(tree);
    if (!prompt) {
      await showMessage("该文件夹内没有识别到可用资源。");
      return null;
    }
    return { prompt, rootDir: selected };
  }, []);

  /**
   * 接收用户贴回的 AI 清单 JSON：先对照磁盘体检（缺失路径/遗漏视频），
   * 有问题时列出明细请用户确认，通过后写入课程文件夹并按清单导入
   *
   * @param rootDir 课程根文件夹
   * @param type 课程类型
   * @param manifestJson AI 返回的清单 JSON 文本
   */
  const importByPastedManifest = useCallback(
    async (rootDir: string, type: CourseType, manifestJson: string) => {
      try {
        const manifest = parseManifestText(manifestJson);
        // 关键节点：写盘前体检清单质量，AI 写错路径或漏视频时给用户拦截机会
        const audit = await auditManifest(rootDir, manifest);
        if (audit.missingPaths.length > 0 || audit.unreferencedVideos.length > 0) {
          const ok = await showConfirm(buildAuditText(audit), "清单体检未通过");
          if (!ok) return false;
        }
        await writeManifest(rootDir, manifest);
        const course = await scanCourseFolder(rootDir, type);
        if (course.lessons.length === 0) {
          await showMessage("清单未匹配到任何有效资源，请检查 AI 输出的路径是否与文件一致。", "导入失败");
          return false;
        }
        const progress = await loadCourseProgress(rootDir);
        progressRef.current.set(course.id, progress);
        updateCourses((prev) => [...prev, ...applyProgress([course], progressRef.current)]);
        toast(`已按清单导入「${course.name}」：${course.lessons.length} 个课节`);
        return true;
      } catch (e) {
        await showMessage(String(e instanceof Error ? e.message : e), "导入失败");
        return false;
      }
    },
    [updateCourses],
  );

  /**
   * 重新扫描课程根文件夹，进度按课节名从进度文件继承
   *
   * @param id 课程 id
   * @param ignoreManifest 为 true 时忽略清单强制自动识别，并把新结果固化覆盖原清单
   *                       （清单被 AI 整理坏时的自救出口）
   */
  const rescanCourse = useCallback(
    async (id: string, ignoreManifest = false) => {
      const target = courses.find((c) => c.id === id);
      if (!target?.rootDir) return;
      const fresh = await scanCourseFolder(target.rootDir, target.type, { ignoreManifest }).catch(
        async (e: unknown) => {
          await showMessage(String(e instanceof Error ? e.message : e), "重新扫描失败");
          return null;
        },
      );
      if (!fresh) return;
      if (fresh.lessons.length === 0) {
        await showMessage("重新识别没有找到可用资源，保持原课节不变。", "重新扫描");
        return;
      }
      // 关键节点：重新识别的结果写回清单，让下次重扫不再回到劣质清单
      if (ignoreManifest) {
        await persistCourseManifest(fresh).catch(() => undefined);
      }
      const progress = progressRef.current.get(id) ?? (await loadCourseProgress(target.rootDir));
      progressRef.current.set(id, progress);
      updateCourses((prev) =>
        prev.map((c) =>
          c.id === id
            ? applyProgress([{ ...fresh, id: c.id, createdAt: c.createdAt }], new Map([[c.id, progress]]))[0]
            : c,
        ),
      );
      const ruleLabel = fresh.scanRule ? SCAN_RULE_LABELS[fresh.scanRule] : "";
      toast(`已重新扫描「${fresh.name}」：${fresh.lessons.length} 个课节${ruleLabel ? `（${ruleLabel}）` : ""}`);
    },
    [courses, updateCourses],
  );

  /**
   * 切换课程类型（吉他/通用，决定上课页默认工具）
   *
   * @param id 课程 id
   * @param type 目标类型
   */
  const changeCourseType = useCallback(
    (id: string, type: CourseType) => {
      updateCourses((prev) => prev.map((c) => (c.id === id ? { ...c, type } : c)));
      toast(`已切换为${type === "guitar" ? "吉他" : "通用"}课程`);
    },
    [updateCourses],
  );

  /**
   * 从课程库删除课程（不动磁盘文件与进度文件）
   *
   * @param id 课程 id
   */
  const deleteCourse = useCallback(
    (id: string) => {
      updateCourses((prev) => prev.filter((c) => c.id !== id));
      progressRef.current.delete(id);
      if (activeCourseId === id) setActiveCourseId(null);
    },
    [updateCourses, activeCourseId],
  );

  /**
   * 更新课节完成状态：更新内存课程 + 写课程文件夹进度文件
   *
   * @param courseId 课程 id
   * @param lessonName 课节名（进度文件以课节名为键，重扫后仍稳定）
   * @param completed 是否完成
   */
  const setLessonCompleted = useCallback(
    (courseId: string, lessonName: string, completed: boolean) => {
      updateCourses((prev) =>
        prev.map((c) =>
          c.id === courseId
            ? { ...c, lessons: c.lessons.map((l) => (l.name === lessonName ? { ...l, completed } : l)) }
            : c,
        ),
      );
      const course = courses.find((c) => c.id === courseId);
      const progress = progressRef.current.get(courseId) ?? { completedLessons: [], playback: {} };
      const set = new Set(progress.completedLessons);
      if (completed) set.add(lessonName);
      else set.delete(lessonName);
      progress.completedLessons = [...set];
      progressRef.current.set(courseId, progress);
      if (course?.rootDir) void saveCourseProgress(course.rootDir, progress);
    },
    [courses, updateCourses],
  );

  /**
   * 保存资源续播位置到课程进度文件（调用方已节流）
   *
   * @param courseId 课程 id
   * @param resourcePath 资源绝对路径
   * @param position 位置（秒）
   */
  const savePosition = useCallback(
    (courseId: string, resourcePath: string, position: number) => {
      const course = courses.find((c) => c.id === courseId);
      if (!course?.rootDir) return;
      const progress = progressRef.current.get(courseId) ?? { completedLessons: [], playback: {} };
      progress.playback[relativeTo(course.rootDir, resourcePath)] = Math.round(position * 10) / 10;
      progressRef.current.set(courseId, progress);
      void saveCourseProgress(course.rootDir, progress);
    },
    [courses],
  );

  /**
   * 查询资源续播位置
   *
   * @param courseId 课程 id
   * @param resourcePath 资源绝对路径
   */
  const getSavedPosition = useCallback(
    (courseId: string, resourcePath: string): number => {
      const course = courses.find((c) => c.id === courseId);
      if (!course?.rootDir) return 0;
      return progressRef.current.get(courseId)?.playback[relativeTo(course.rootDir, resourcePath)] ?? 0;
    },
    [courses],
  );

  /**
   * 更新应用设置并持久化
   *
   * @param patch 设置变更
   */
  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      void saveSettings(next);
      return next;
    });
  }, []);

  /**
   * 更新某课节的资料资源集合（保留视频资源不动），并固化写入课程清单，
   * 供上课页"关联资料"使用（如讲解课引用上一节练习曲的曲谱/伴奏）
   *
   * @param courseId 课程 id
   * @param lessonId 课节 id
   * @param relPaths 该课节应关联的文档/音频相对路径全集（顺序即展示顺序）
   */
  const updateLessonResources = useCallback(
    async (courseId: string, lessonId: string, relPaths: string[]) => {
      const course = courses.find((c) => c.id === courseId);
      if (!course?.rootDir) return;
      const rootDir = course.rootDir;
      const nextCourse: Course = {
        ...course,
        lessons: course.lessons.map((l) => {
          if (l.id !== lessonId) return l;
          const videos = l.resources.filter((r) => r.kind === "video");
          const attachments = relPaths
            .map((rel): LessonResource | null => {
              const abs = rootDir.endsWith("/") ? `${rootDir}${rel}` : `${rootDir}/${rel}`;
              const kind = resourceKindOf(abs);
              return kind ? { path: abs, name: basename(abs), kind } : null;
            })
            .filter((r): r is LessonResource => r !== null);
          return { ...l, resources: [...videos, ...attachments] };
        }),
      };
      try {
        // 关键节点：手动关联写入清单固化，之后重扫不会回退
        await persistCourseManifest(nextCourse);
        updateCourses((prev) => prev.map((c) => (c.id === courseId ? nextCourse : c)));
        toast("资料关联已保存");
      } catch (e) {
        await showMessage(String(e instanceof Error ? e.message : e), "保存失败");
      }
    },
    [courses, updateCourses],
  );

  /**
   * 保存管理页的课节草稿：写清单 -> 按清单重扫 -> 更新课程库并返回
   *
   * @param courseId 课程 id
   * @param manifest 管理页组装的课节清单
   * @returns 是否保存成功
   */
  const saveManagedManifest = useCallback(
    async (courseId: string, manifest: CourseManifest): Promise<boolean> => {
      const target = courses.find((c) => c.id === courseId);
      if (!target?.rootDir) return false;
      try {
        await writeManifest(target.rootDir, manifest);
        const fresh = await scanCourseFolder(target.rootDir, target.type);
        const progress = progressRef.current.get(courseId) ?? (await loadCourseProgress(target.rootDir));
        progressRef.current.set(courseId, progress);
        updateCourses((prev) =>
          prev.map((c) =>
            c.id === courseId
              ? applyProgress([{ ...fresh, id: c.id, createdAt: c.createdAt }], new Map([[c.id, progress]]))[0]
              : c,
          ),
        );
        toast(`已保存课节调整：${fresh.lessons.length} 个课节`);
        setManagingCourseId(null);
        return true;
      } catch (e) {
        await showMessage(String(e instanceof Error ? e.message : e), "保存失败");
        return false;
      }
    },
    [courses, updateCourses],
  );

  // 关键节点：提前返回必须位于全部 hooks 之后，否则 loaded 翻转时 hooks 数量变化会触发 React 报错
  if (!loaded) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">加载中…</div>;
  }

  // 主题切换按钮：三态循环 跟随系统 -> 亮色 -> 暗色，两个页面顶栏共用
  const toggleMeta = THEME_TOGGLE_META[settings.theme];
  const themeToggle = (
    <IconButton
      name={toggleMeta.icon}
      label={toggleMeta.label}
      onClick={() => updateSettings({ theme: THEME_CYCLE[settings.theme] })}
    />
  );

  return (
    <TooltipProvider>
      <Toaster />
      <AnimatePresence mode="wait">
      {managingCourse ? (
        <motion.div
          key={`manage-${managingCourse.id}`}
          className="h-full"
          initial={{ opacity: 0, scale: 0.985 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.01 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          <ManagePage
            course={managingCourse}
            onBack={() => setManagingCourseId(null)}
            onSave={(manifest) => saveManagedManifest(managingCourse.id, manifest)}
            onStartLearning={(lessonName) => {
              setInitialLessonName(lessonName ?? null);
              setActiveCourseId(managingCourse.id);
              setManagingCourseId(null);
            }}
          />
        </motion.div>
      ) : activeCourse ? (
        <motion.div
          key={`classroom-${activeCourse.id}`}
          className="h-full"
          initial={{ opacity: 0, scale: 0.985 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.01 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          <ClassroomPage
            course={activeCourse}
            initialLessonName={initialLessonName}
            onBack={() => {
              setActiveCourseId(null);
              setInitialLessonName(null);
            }}
            onLessonCompletedChange={(lessonName, completed) =>
              setLessonCompleted(activeCourse.id, lessonName, completed)
            }
            settings={settings}
            onSettingsChange={updateSettings}
            getSavedPosition={(path) => getSavedPosition(activeCourse.id, path)}
            onSavePosition={(path, pos) => savePosition(activeCourse.id, path, pos)}
            onNextLessonUsed={() => void bumpUsageCounter("nextLessonClicks")}
            onUpdateLessonResources={(lessonId, relPaths) =>
              updateLessonResources(activeCourse.id, lessonId, relPaths)
            }
            themeToggle={themeToggle}
          />
        </motion.div>
      ) : (
        <motion.div
          key="library"
          className="h-full"
          initial={{ opacity: 0, scale: 0.985 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.01 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          <LibraryPage
            courses={courses}
            onOpenCourse={(id) => {
              setInitialLessonName(null);
              setActiveCourseId(id);
            }}
            onImportFolder={importFolder}
            onGenerateAiPrompt={generateAiPrompt}
            onImportByPastedManifest={importByPastedManifest}
            onRescanCourse={rescanCourse}
            onChangeCourseType={changeCourseType}
            onManageCourse={setManagingCourseId}
            onDeleteCourse={deleteCourse}
            themeToggle={themeToggle}
          />
        </motion.div>
      )}
      </AnimatePresence>
    </TooltipProvider>
  );
}

/**
 * 把进度（完成课节名单）套用到课程列表
 *
 * @param list 课程列表
 * @param progressMap 课程 id -> 进度
 */
function applyProgress(list: Course[], progressMap: Map<string, CourseProgress>): Course[] {
  return list.map((course) => {
    const progress = progressMap.get(course.id);
    if (!progress) return course;
    const completed = new Set(progress.completedLessons);
    return { ...course, lessons: course.lessons.map((l) => ({ ...l, completed: completed.has(l.name) })) };
  });
}

/**
 * 计算资源相对课程根目录的路径（进度文件用相对路径，课程文件夹可整体搬迁）
 *
 * @param rootDir 课程根目录
 * @param absPath 资源绝对路径
 */
function relativeTo(rootDir: string, absPath: string): string {
  const prefix = rootDir.endsWith("/") ? rootDir : `${rootDir}/`;
  return absPath.startsWith(prefix) ? absPath.slice(prefix.length) : absPath;
}

/** 体检明细里最多列出的条目数（对话框空间有限） */
const AUDIT_SAMPLE_LIMIT = 5;

/**
 * 把清单体检报告组装成确认对话框文案（列出前几条明细）
 *
 * @param audit 清单体检结果
 */
function buildAuditText(audit: ManifestAudit): string {
  const parts: string[] = [];
  if (audit.unreferencedVideos.length > 0) {
    const sample = audit.unreferencedVideos.slice(0, AUDIT_SAMPLE_LIMIT).map((p) => `  · ${p}`);
    if (audit.unreferencedVideos.length > AUDIT_SAMPLE_LIMIT) sample.push("  · …");
    parts.push(`有 ${audit.unreferencedVideos.length} 个视频没被清单引用（会看不到这些课）：\n${sample.join("\n")}`);
  }
  if (audit.missingPaths.length > 0) {
    const sample = audit.missingPaths.slice(0, AUDIT_SAMPLE_LIMIT).map((p) => `  · ${p}`);
    if (audit.missingPaths.length > AUDIT_SAMPLE_LIMIT) sample.push("  · …");
    parts.push(`有 ${audit.missingPaths.length} 个路径在文件夹里不存在（AI 可能写错了）：\n${sample.join("\n")}`);
  }
  parts.push("建议把以上问题反馈给 AI 重新生成。仍要按这份清单导入吗？");
  return parts.join("\n\n");
}

export default App;
