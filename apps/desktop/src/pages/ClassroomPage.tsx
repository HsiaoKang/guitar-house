/**
 * 上课页
 *
 * 顶栏：课节下拉即页面标题 + "下一节"快捷按钮（简洁原则），
 * 主区左视频右文档（可调换），音频播放条，底部工具栏。
 * 全局媒体快捷键：空格播停、左右快进退、上下音量。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Checkbox, EmptyState, IconButton, Select, toast } from "@learning-house/ui";
import { SplitPane } from "../components/SplitPane";
import { VideoPlayer } from "../components/VideoPlayer";
import { AudioPlayerBar } from "../components/AudioPlayerBar";
import { DocViewer } from "../components/DocViewer";
import { ResourcePicker } from "../components/ResourcePicker";
import { ToolBar } from "../components/ToolBar";
import { detectBpmFromFile } from "../lib/bpmDetect";
import { useMetronome } from "../hooks/useMetronome";
import { useMediaShortcuts, type ShortcutTarget } from "../hooks/useMediaShortcuts";
import {
  DEFAULT_TOOL_BY_COURSE_TYPE,
  isDocKind,
  type AppSettings,
  type Course,
  type ToolKind,
} from "../types";

interface ClassroomPageProps {
  course: Course;
  /** 进入时定位到的课节名（管理页跳转指定；null/未命中时从第一节开始） */
  initialLessonName?: string | null;
  /** 返回课程库 */
  onBack: () => void;
  /** 课节完成状态变化（lessonName 为键，由外层持久化到课程文件夹） */
  onLessonCompletedChange: (lessonName: string, completed: boolean) => void;
  /** 应用设置 */
  settings: AppSettings;
  /** 更新应用设置（由外层持久化） */
  onSettingsChange: (patch: Partial<AppSettings>) => void;
  /** 查询资源续播位置（秒） */
  getSavedPosition: (resourcePath: string) => number;
  /** 持久化资源续播位置 */
  onSavePosition: (resourcePath: string, position: number) => void;
  /** "下一节"按钮使用计数（本地统计，决定功能去留） */
  onNextLessonUsed: () => void;
  /** 更新课节的资料关联（写清单固化，relPaths 为文档/音频相对路径全集） */
  onUpdateLessonResources: (lessonId: string, relPaths: string[]) => Promise<void>;
  /** 主题切换按钮（由 App 注入） */
  themeToggle: React.ReactNode;
}

/**
 * 上课页组件
 *
 * @param props 见 ClassroomPageProps 字段说明
 */
export function ClassroomPage(props: ClassroomPageProps) {
  const {
    course,
    initialLessonName,
    onBack,
    onLessonCompletedChange,
    settings,
    onSettingsChange,
    getSavedPosition,
    onSavePosition,
    onNextLessonUsed,
    onUpdateLessonResources,
    themeToggle,
  } = props;
  const [lessonIndex, setLessonIndex] = useState(0);
  const [tool, setTool] = useState<ToolKind>(DEFAULT_TOOL_BY_COURSE_TYPE[course.type]);
  /** "关联资料"选择器开关 */
  const [pickerOpen, setPickerOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const metronome = useMetronome();

  // 课程切换时定位起始课节（管理页跳转可指定课节名）并重置默认工具
  useEffect(() => {
    const target = initialLessonName ? course.lessons.findIndex((l) => l.name === initialLessonName) : -1;
    setLessonIndex(target >= 0 ? target : 0);
    setTool(DEFAULT_TOOL_BY_COURSE_TYPE[course.type]);
    // 关键节点：仅在课程切换时定位一次，之后用户自由切换课节不受影响
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course.id, course.type]);

  // 切换课节时收起资料选择器
  useEffect(() => {
    setPickerOpen(false);
  }, [lessonIndex]);

  const lesson = course.lessons[Math.min(lessonIndex, course.lessons.length - 1)] ?? null;

  // 按区域拆分当前课节资源
  const videoResources = useMemo(() => lesson?.resources.filter((r) => r.kind === "video") ?? [], [lesson]);
  const audioResources = useMemo(() => lesson?.resources.filter((r) => r.kind === "audio") ?? [], [lesson]);
  const docResources = useMemo(() => lesson?.resources.filter((r) => isDocKind(r.kind)) ?? [], [lesson]);

  // 伴奏音频的联动控制接口（选中音频联动源时驱动节拍器）
  const audioControl = useMemo(() => metronome.bindSource("audio"), [metronome.bindSource]);

  /** 快捷键作用域：跟随用户最近操作的区域（视频/伴奏/节拍器） */
  const shortcutDomainRef = useRef<"video" | "audio" | "metronome">("video");
  const hasVideo = videoResources.length > 0;

  // 课节切换时作用域回到主媒体
  useEffect(() => {
    shortcutDomainRef.current = hasVideo ? "video" : "audio";
  }, [lessonIndex, hasVideo]);

  /**
   * 解析当前快捷键目标：空格控制最近操作的域（节拍器启停 / 伴奏播停 /
   * 视频播停），方向键作用于该域的媒体（节拍器域沿用主媒体）
   */
  const resolveShortcutTarget = useCallback((): ShortcutTarget => {
    const domain = shortcutDomainRef.current;
    const primary = hasVideo ? videoRef.current : audioRef.current;
    if (domain === "metronome") {
      return { media: primary, onSpace: metronome.toggle };
    }
    const media = domain === "audio" && audioRef.current ? audioRef.current : primary;
    return {
      media,
      onSpace: () => {
        if (!media) return;
        if (media.paused) void media.play();
        else media.pause();
      },
    };
  }, [hasVideo, metronome.toggle]);
  useMediaShortcuts(resolveShortcutTarget);

  /**
   * 读取当前联动源媒体的播放位置（秒），无联动源时返回 null
   */
  const getMediaTime = useCallback(() => {
    if (metronome.sync.source === "audio") return audioRef.current?.currentTime ?? null;
    return null;
  }, [metronome.sync.source]);

  /** 当前选中的伴奏路径（BPM 识别的分析对象） */
  const currentAudioPathRef = useRef<string | null>(null);
  /** BPM 识别进行中 */
  const [detectingBpm, setDetectingBpm] = useState(false);

  /**
   * 识别当前伴奏的 BPM 与首拍偏移，写入节拍器实现自动卡点
   */
  const detectBpm = useCallback(async () => {
    const path = currentAudioPathRef.current;
    if (!path || detectingBpm) return;
    setDetectingBpm(true);
    try {
      const { bpm, offset, octaveAdjusted } = await detectBpmFromFile(path);
      metronome.updateOptions({ bpm });
      metronome.setSync({ firstBeatOffset: offset });
      toast(`已识别伴奏：${bpm} BPM${octaveAdjusted ? "（已修正倍频）" : ""} · 首拍 ${offset}s`);
    } catch {
      toast("识别失败：节奏特征不明显或文件无法解码");
    } finally {
      setDetectingBpm(false);
    }
  }, [detectingBpm, metronome.updateOptions, metronome.setSync]);

  if (!lesson) {
    return (
      <div className="flex h-full flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-3.5">
          <IconButton name="home" label="返回课程库" onClick={onBack} />
          <span className="text-[13px] text-muted-foreground">{course.name}</span>
        </header>
        <EmptyState title="该课程没有课节，请在课程库重新扫描或检查文件夹内容。" />
      </div>
    );
  }

  const videoPane = (
    // display:contents 包装不产生盒子，仅用于捕获"最近操作的域"
    <div className="contents" onPointerDownCapture={() => (shortcutDomainRef.current = "video")}>
      <VideoPlayer
        resources={videoResources}
        videoRef={videoRef}
        getSavedPosition={getSavedPosition}
        onPositionSave={onSavePosition}
      />
    </div>
  );
  const docPane = (
    <DocViewer resources={docResources} onAttach={course.rootDir ? () => setPickerOpen(true) : undefined} />
  );

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2.5 border-b border-border bg-card px-3.5">
        <IconButton name="home" label="返回课程库" onClick={onBack} />

        {/* 课节下拉即页面标题（课节名自带编号时不再重复加序号） */}
        <Select
          value={String(lessonIndex)}
          onChange={(v) => setLessonIndex(Number(v))}
          options={course.lessons.map((l, i) => ({
            value: String(i),
            label: `${/^\s*\d+[.\-、·]/.test(l.name) ? "" : `${i + 1}. `}${l.name}${l.completed ? " ✓" : ""}`,
          }))}
          className="max-w-[46vw] font-medium"
          title={course.name}
        />
        <Button
          variant="ghost"
          size="sm"
          disabled={lessonIndex >= course.lessons.length - 1}
          onClick={() => {
            onNextLessonUsed();
            setLessonIndex((i) => Math.min(course.lessons.length - 1, i + 1));
          }}
        >
          下一节
        </Button>

        <div className="flex flex-1 items-center justify-end gap-3">
          <Checkbox
            checked={lesson.completed}
            onChange={(completed) => onLessonCompletedChange(lesson.name, completed)}
            label="已完成"
            title="标记本课节的学习进度"
          />
          <IconButton
            name="swap"
            label="交换左右区域"
            onClick={() => onSettingsChange({ swapPanes: !settings.swapPanes })}
          />
          {themeToggle}
        </div>
      </header>

      <main className="min-h-0 flex-1">
        <SplitPane
          left={settings.swapPanes ? docPane : videoPane}
          right={settings.swapPanes ? videoPane : docPane}
        />
      </main>

      <div className="contents" onPointerDownCapture={() => (shortcutDomainRef.current = "audio")}>
        <AudioPlayerBar
          resources={audioResources}
          audioRef={audioRef}
          engineControl={audioControl}
          onActiveResourceChange={(path) => {
            currentAudioPathRef.current = path;
          }}
        />
      </div>

      <div className="contents" onPointerDownCapture={() => (shortcutDomainRef.current = "metronome")}>
        <ToolBar
          tool={tool}
          onToolChange={setTool}
          metronome={{
            options: metronome.options,
            updateOptions: metronome.updateOptions,
            running: metronome.running,
            toggle: metronome.toggle,
            activeBeat: metronome.activeBeat,
            sync: metronome.sync,
            setSync: metronome.setSync,
            hasAudio: audioResources.length > 0,
            getMediaTime,
            detectingBpm,
            onDetectBpm: () => void detectBpm(),
          }}
        />
      </div>

      <ResourcePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        course={course}
        lesson={lesson}
        onConfirm={(relPaths) => onUpdateLessonResources(lesson.id, relPaths)}
      />
    </div>
  );
}
