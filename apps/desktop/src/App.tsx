/**
 * Learning House 应用根组件
 *
 * 负责视图路由（课程库 / 上课页）、课程库与设置的加载持久化、
 * 主题切换（.dark 类挂载）与页面过渡动效。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { AnimatePresence, motion } from "motion/react";
import { IconButton, Toaster, toast } from "@learning-house/ui";
import { LibraryPage } from "./pages/LibraryPage";
import { ClassroomPage } from "./pages/ClassroomPage";
import { readDirTree, readManifestName, scanCourseFolder, writeManifest } from "./lib/scanner";
import { showMessage } from "./lib/dialogs";
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
import type { AppSettings, Course, CourseType, ResolvedTheme, ThemeKind } from "./types";

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
  const [loaded, setLoaded] = useState(false);
  /** 课程 id -> 进度（完成课节 + 续播位置），持久化在课程文件夹内 */
  const progressRef = useRef<Map<string, CourseProgress>>(new Map());
  const systemTheme = useSystemTheme();

  // 实际渲染主题：偏好为 system 时跟随系统外观
  const resolvedTheme: ResolvedTheme = settings.theme === "system" ? systemTheme : settings.theme;

  // 启动时加载课程库与设置，读取各课程的进度文件，并同步清单声明的课程名
  useEffect(() => {
    void (async () => {
      const [storedCourses, storedSettings] = await Promise.all([loadCourses(), loadSettings()]);
      let renamed = false;
      for (const course of storedCourses) {
        if (!course.rootDir) continue;
        progressRef.current.set(course.id, await loadCourseProgress(course.rootDir));
        // 关键节点：清单是课程名的事实来源，历史导入的文件夹名展示随之更新
        const manifestName = await readManifestName(course.rootDir).catch(() => null);
        if (manifestName && manifestName !== course.name) {
          course.name = manifestName;
          renamed = true;
        }
      }
      setCourses(applyProgress(storedCourses, progressRef.current));
      setSettings({ ...DEFAULT_SETTINGS, ...storedSettings });
      setLoaded(true);
      if (renamed) void saveCourses(storedCourses);
    })();
  }, []);

  // 关键节点：暗色时给根元素挂 .dark 类，shadcn CSS 变量随之切换
  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  }, [resolvedTheme]);

  // 生产环境屏蔽 WebView 原生右键菜单（视频区有自定义菜单；开发保留以便审查元素）
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    window.addEventListener("contextmenu", onContextMenu);
    return () => window.removeEventListener("contextmenu", onContextMenu);
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
   * 接收用户贴回的 AI 清单 JSON：写入课程文件夹并直接按清单导入
   *
   * @param rootDir 课程根文件夹
   * @param type 课程类型
   * @param manifestJson AI 返回的清单 JSON 文本
   */
  const importByPastedManifest = useCallback(
    async (rootDir: string, type: CourseType, manifestJson: string) => {
      try {
        await writeManifest(rootDir, manifestJson);
        const course = await scanCourseFolder(rootDir, type);
        if (course.lessons.length === 0) {
          await showMessage("清单未匹配到任何有效资源，请检查 AI 输出的路径是否与文件一致。", "导入失败");
          return false;
        }
        const progress = await loadCourseProgress(rootDir);
        progressRef.current.set(course.id, progress);
        updateCourses((prev) => [...prev, ...applyProgress([course], progressRef.current)]);
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
   */
  const rescanCourse = useCallback(
    async (id: string) => {
      const target = courses.find((c) => c.id === id);
      if (!target?.rootDir) return;
      const fresh = await scanCourseFolder(target.rootDir, target.type).catch(async (e: unknown) => {
        await showMessage(String(e instanceof Error ? e.message : e), "重新扫描失败");
        return null;
      });
      if (!fresh) return;
      const progress = progressRef.current.get(id) ?? (await loadCourseProgress(target.rootDir));
      progressRef.current.set(id, progress);
      updateCourses((prev) =>
        prev.map((c) =>
          c.id === id
            ? applyProgress([{ ...fresh, id: c.id, createdAt: c.createdAt }], new Map([[c.id, progress]]))[0]
            : c,
        ),
      );
      toast(`已重新扫描「${fresh.name}」：${fresh.lessons.length} 个课节`);
    },
    [courses, updateCourses],
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

  const activeCourse = courses.find((c) => c.id === activeCourseId) ?? null;

  return (
    <>
      <Toaster />
      <AnimatePresence mode="wait">
      {activeCourse ? (
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
            onBack={() => setActiveCourseId(null)}
            onLessonCompletedChange={(lessonName, completed) =>
              setLessonCompleted(activeCourse.id, lessonName, completed)
            }
            settings={settings}
            onSettingsChange={updateSettings}
            getSavedPosition={(path) => getSavedPosition(activeCourse.id, path)}
            onSavePosition={(path, pos) => savePosition(activeCourse.id, path, pos)}
            onNextLessonUsed={() => void bumpUsageCounter("nextLessonClicks")}
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
            onOpenCourse={setActiveCourseId}
            onImportFolder={importFolder}
            onGenerateAiPrompt={generateAiPrompt}
            onImportByPastedManifest={importByPastedManifest}
            onRescanCourse={rescanCourse}
            onDeleteCourse={deleteCourse}
            themeToggle={themeToggle}
          />
        </motion.div>
      )}
      </AnimatePresence>
    </>
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

export default App;
