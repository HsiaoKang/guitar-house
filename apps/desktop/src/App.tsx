/**
 * Learning House 应用根组件
 *
 * 负责视图路由（课程库 / 上课页）、课程库与设置的加载持久化、
 * 主题 class 挂载与切换。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { darkThemeClass, IconButton, lightThemeClass } from "@learning-house/ui";
import { LibraryPage } from "./pages/LibraryPage";
import { ClassroomPage } from "./pages/ClassroomPage";
import { scanCourseFolder } from "./lib/scanner";
import {
  DEFAULT_SETTINGS,
  loadCourses,
  loadPlaybackPositions,
  loadSettings,
  saveCourses,
  savePlaybackPosition,
  saveSettings,
  type PlaybackPositions,
} from "./lib/storage";
import type { AppSettings, Course, CourseType, ResolvedTheme, ThemeKind } from "./types";
import { appLoading } from "./styles/layout.css";

/** 实际主题到 vanilla-extract 主题 class 的映射 */
const THEME_CLASSES: Record<ResolvedTheme, string> = {
  dark: darkThemeClass,
  light: lightThemeClass,
};

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
  const positionsRef = useRef<PlaybackPositions>({});
  const systemTheme = useSystemTheme();

  // 实际渲染主题：偏好为 system 时跟随系统外观
  const resolvedTheme: ResolvedTheme = settings.theme === "system" ? systemTheme : settings.theme;

  // 启动时加载课程库、设置与续播位置
  useEffect(() => {
    void Promise.all([loadCourses(), loadSettings(), loadPlaybackPositions()]).then(
      ([storedCourses, storedSettings, positions]) => {
        setCourses(storedCourses);
        // 旧版本设置缺省字段用默认值补齐
        setSettings({ ...DEFAULT_SETTINGS, ...storedSettings });
        positionsRef.current = positions;
        setLoaded(true);
      },
    );
  }, []);

  // 关键节点：把实际主题 class 挂到根元素，token 变量随之切换
  useEffect(() => {
    const el = document.documentElement;
    el.classList.remove(...Object.values(THEME_CLASSES));
    el.classList.add(THEME_CLASSES[resolvedTheme]);
  }, [resolvedTheme]);

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
   * 从文件夹导入课程：弹目录选择器 -> 扫描 -> 加入课程库
   *
   * @param type 课程类型
   */
  const importFolder = useCallback(
    async (type: CourseType) => {
      const selected = await open({ directory: true, multiple: false, title: "选择课程根文件夹" });
      if (typeof selected !== "string") return;
      const course = await scanCourseFolder(selected, type);
      if (course.lessons.length === 0) {
        alert("该文件夹内没有识别到可用资源（视频/音频/图片/PDF/Guitar Pro）。");
        return;
      }
      updateCourses((prev) => [...prev, course]);
    },
    [updateCourses],
  );

  /**
   * 重新扫描课程根文件夹，保留同名课节的完成状态
   *
   * @param id 课程 id
   */
  const rescanCourse = useCallback(
    async (id: string) => {
      const target = courses.find((c) => c.id === id);
      if (!target?.rootDir) return;
      const fresh = await scanCourseFolder(target.rootDir, target.type);
      updateCourses((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          // 关键节点：按课节名继承旧的完成状态
          const completedNames = new Set(c.lessons.filter((l) => l.completed).map((l) => l.name));
          return {
            ...c,
            lessons: fresh.lessons.map((l) => ({ ...l, completed: completedNames.has(l.name) })),
          };
        }),
      );
    },
    [courses, updateCourses],
  );

  /**
   * 从课程库删除课程（不动磁盘文件）
   *
   * @param id 课程 id
   */
  const deleteCourse = useCallback(
    (id: string) => {
      updateCourses((prev) => prev.filter((c) => c.id !== id));
      if (activeCourseId === id) setActiveCourseId(null);
    },
    [updateCourses, activeCourseId],
  );

  /**
   * 更新课节完成状态
   *
   * @param courseId 课程 id
   * @param lessonId 课节 id
   * @param completed 是否完成
   */
  const setLessonCompleted = useCallback(
    (courseId: string, lessonId: string, completed: boolean) => {
      updateCourses((prev) =>
        prev.map((c) =>
          c.id === courseId
            ? { ...c, lessons: c.lessons.map((l) => (l.id === lessonId ? { ...l, completed } : l)) }
            : c,
        ),
      );
    },
    [updateCourses],
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
   * 保存资源续播位置
   *
   * @param path 资源路径
   * @param position 位置（秒）
   */
  const savePosition = useCallback((path: string, position: number) => {
    positionsRef.current[path] = position;
    void savePlaybackPosition(path, position);
  }, []);

  if (!loaded) {
    return <div className={appLoading}>加载中…</div>;
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

  if (activeCourse) {
    return (
      <ClassroomPage
        course={activeCourse}
        onBack={() => setActiveCourseId(null)}
        onLessonCompletedChange={(lessonId, completed) => setLessonCompleted(activeCourse.id, lessonId, completed)}
        settings={settings}
        onSettingsChange={updateSettings}
        playbackPositions={positionsRef.current}
        onSavePosition={savePosition}
        themeToggle={themeToggle}
      />
    );
  }

  return (
    <LibraryPage
      courses={courses}
      onOpenCourse={setActiveCourseId}
      onImportFolder={(type) => void importFolder(type)}
      onRescanCourse={(id) => void rescanCourse(id)}
      onDeleteCourse={deleteCourse}
      themeToggle={themeToggle}
    />
  );
}

export default App;
