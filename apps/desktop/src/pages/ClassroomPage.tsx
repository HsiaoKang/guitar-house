/**
 * 上课页
 *
 * 顶栏：课节下拉即页面标题 + "下一节"快捷按钮（简洁原则），
 * 主区左视频右文档（可调换），音频播放条，底部工具栏。
 * 全局媒体快捷键：空格播停、左右快进退、上下音量。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Checkbox, EmptyState, IconButton, Select, toast } from "@learning-house/ui";
import type { MetronomeOptions } from "@learning-house/metronome-core";
import { SplitPane } from "../components/SplitPane";
import { VideoPlayer } from "../components/VideoPlayer";
import { AudioPlayerBar } from "../components/AudioPlayerBar";
import { DocViewer } from "../components/DocViewer";
import { ResourcePicker } from "../components/ResourcePicker";
import { ToolBar } from "../components/ToolBar";
import { alignToScoreBpm, detectBpmFromFile, snapTapToGrid } from "../lib/bpmDetect";
import { bpmFromScorePdf, rankScoresForAudio } from "../lib/scoreBpm";
import { loadMediaMeta, saveMediaMeta, type AudioBeatMeta, type CourseMediaMeta } from "../lib/mediaMeta";
import { useMetronome, type SyncConfig } from "../hooks/useMetronome";
import { useMediaShortcuts, type ShortcutTarget } from "../hooks/useMediaShortcuts";
import {
  DEFAULT_TOOL_BY_COURSE_TYPE,
  isDocKind,
  relativePathOf,
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
  /** 课程的媒体元数据（伴奏 BPM/首拍持久化，按相对路径索引） */
  const mediaMetaRef = useRef<CourseMediaMeta>({ audio: {} });

  // 打开课程时加载媒体元数据；加载完成后对当前伴奏补一次应用（可能先于加载上报）
  useEffect(() => {
    mediaMetaRef.current = { audio: {} };
    if (!course.rootDir) return;
    let cancelled = false;
    void loadMediaMeta(course.rootDir).then((meta) => {
      if (cancelled) return;
      mediaMetaRef.current = meta;
      applyAudioMetaRef.current(currentAudioPathRef.current);
    });
    return () => {
      cancelled = true;
    };
  }, [course.id, course.rootDir]);

  /**
   * 把当前伴奏的节拍参数写入媒体元数据并落盘
   *
   * @param patch 新的 BPM / 首拍偏移（未提供的字段沿用已有记录或当前节拍器值）
   * @param manual 是否用户手动校准（识别覆盖时清除该标记）
   */
  const persistAudioMeta = useCallback(
    (patch: Partial<AudioBeatMeta>, manual: boolean) => {
      const rootDir = course.rootDir;
      const abs = currentAudioPathRef.current;
      if (!rootDir || !abs) return;
      const key = relativePathOf(rootDir, abs);
      const store = mediaMetaRef.current;
      const prev = store.audio[key];
      store.audio[key] = {
        bpm: patch.bpm ?? prev?.bpm ?? metronome.options.bpm,
        firstBeatOffset: patch.firstBeatOffset ?? prev?.firstBeatOffset ?? metronome.sync.firstBeatOffset,
        manual,
      };
      saveMediaMeta(rootDir, store);
    },
    [course.rootDir, metronome.options.bpm, metronome.sync.firstBeatOffset],
  );

  /** 应用某伴奏的已保存节拍参数（无记录时保持现状） */
  const applyAudioMeta = useCallback(
    (absPath: string | null) => {
      if (!absPath || !course.rootDir) return;
      const meta = mediaMetaRef.current.audio[relativePathOf(course.rootDir, absPath)];
      if (!meta) return;
      metronome.updateOptions({ bpm: meta.bpm });
      metronome.setSync({ firstBeatOffset: meta.firstBeatOffset });
    },
    [course.rootDir, metronome.updateOptions, metronome.setSync],
  );
  /** 供加载完成回调使用的最新引用（规避 effect 与 callback 的声明顺序依赖） */
  const applyAudioMetaRef = useRef(applyAudioMeta);
  applyAudioMetaRef.current = applyAudioMeta;

  /**
   * 工具栏参数更新入口：联动伴奏时的手动调整视为对该伴奏的校准，落盘保存
   */
  const updateMetronomeOptions = useCallback(
    (patch: Partial<MetronomeOptions>) => {
      metronome.updateOptions(patch);
      if (patch.bpm !== undefined && metronome.sync.source === "audio") {
        persistAudioMeta({ bpm: patch.bpm }, true);
      }
    },
    [metronome.updateOptions, metronome.sync.source, persistAudioMeta],
  );

  /** 自动识别的最新引用（识别函数声明在后，规避声明顺序依赖） */
  const detectBpmRef = useRef<() => Promise<void>>(async () => {});

  /**
   * 工具栏联动配置入口：手动调整首拍偏移落盘为该伴奏的校准值；
   * 开启跟随伴奏时，有预设（已识别/已手动校准）直接应用，
   * 没有预设自动识别一次——开关本身已表达"按这首伴奏打"的完整意图
   */
  const updateMetronomeSync = useCallback(
    (patch: Partial<SyncConfig>) => {
      metronome.setSync(patch);
      if (patch.firstBeatOffset !== undefined && metronome.sync.source === "audio") {
        persistAudioMeta({ firstBeatOffset: patch.firstBeatOffset }, true);
      }
      if (patch.source === "audio") {
        const path = currentAudioPathRef.current;
        const rootDir = course.rootDir;
        const preset = path && rootDir ? mediaMetaRef.current.audio[relativePathOf(rootDir, path)] : undefined;
        if (preset) {
          metronome.updateOptions({ bpm: preset.bpm });
          metronome.setSync({ firstBeatOffset: preset.firstBeatOffset });
          toast(`已应用伴奏预设：${preset.bpm} BPM · 首拍 ${preset.firstBeatOffset}s`);
        } else if (path) {
          void detectBpmRef.current();
        }
      }
    },
    [metronome.setSync, metronome.sync.source, metronome.updateOptions, persistAudioMeta, course.rootDir],
  );

  // 切换课节：停掉正在响的节拍器；无伴奏课节联动源退回不联动
  useEffect(() => {
    metronome.stop();
    if (audioResources.length === 0 && metronome.sync.source !== "none") {
      metronome.setSync({ source: "none" });
    }
    // 关键节点：仅课节切换时执行（关联资料引起的资源变化不应打断节拍器）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course.id, lessonIndex]);

  /**
   * 识别当前伴奏的 BPM 与首拍偏移，写入节拍器实现自动卡点；
   * 结果按音频落盘，下次直接读取。
   * 可信度：文件名标注 > 本课节谱面标注 > 声学估计——
   * 声学结果会被课节内 PDF 谱的「= N」速度标注覆盖
   * （伴奏律动与谱面拍速非倍频关系时，声学不可判定，谱面是权威真值）
   */
  const detectBpm = useCallback(async () => {
    const path = currentAudioPathRef.current;
    if (!path || detectingBpm) return;
    setDetectingBpm(true);
    try {
      const detected = await detectBpmFromFile(path);
      let final = { bpm: detected.bpm, offset: detected.offset };
      let source = detected.fromFilename ? "（文件名标注）" : detected.octaveAdjusted ? "（已修正倍频）" : "";
      if (!detected.fromFilename) {
        // 关键节点：按对应可能性排序（同目录谱优先）后逐份验证谱面标注——
        // 标注须精确命中声学网格的比率族才采纳（防引用来的无关谱误导）
        const pdfPaths = (lesson?.resources ?? []).filter((r) => r.kind === "pdf").map((r) => r.path);
        for (const pdfPath of rankScoresForAudio(path, pdfPaths)) {
          const scoreBpm = await bpmFromScorePdf(pdfPath).catch(() => null);
          if (scoreBpm === null) continue;
          const verified = alignToScoreBpm(path, scoreBpm);
          if (verified) {
            final = verified;
            source = "（谱面标注）";
            break;
          }
        }
      }
      metronome.updateOptions({ bpm: final.bpm });
      metronome.setSync({ firstBeatOffset: final.offset });
      persistAudioMeta({ bpm: final.bpm, firstBeatOffset: final.offset }, false);
      toast(`已识别伴奏：${final.bpm} BPM${source} · 首拍 ${final.offset}s，不准可用 TAP 拍击校正`);
    } catch {
      toast("识别失败：节奏特征不明显或文件无法解码");
    } finally {
      setDetectingBpm(false);
    }
  }, [detectingBpm, lesson, metronome.updateOptions, metronome.setSync, persistAudioMeta]);
  detectBpmRef.current = detectBpm;

  /**
   * TAP 测速结果应用：当前伴奏识别过时，把人拍的粗略节奏吸附到
   * 识别网格的比率候选（解决 4/3 类纯信号不可判定的节奏歧义），
   * 用精确拍速重新定位首拍并落盘为手动校准；无法吸附时按原值应用
   */
  const applyTapBpm = useCallback(
    (tapBpm: number) => {
      const path = currentAudioPathRef.current;
      const snapped = path ? snapTapToGrid(path, tapBpm) : null;
      if (snapped) {
        metronome.updateOptions({ bpm: snapped.bpm });
        metronome.setSync({ firstBeatOffset: snapped.offset });
        persistAudioMeta({ bpm: snapped.bpm, firstBeatOffset: snapped.offset }, true);
        toast(`已按 TAP 校正：${snapped.bpm} BPM · 首拍 ${snapped.offset}s`);
        return;
      }
      updateMetronomeOptions({ bpm: tapBpm });
    },
    [metronome.updateOptions, metronome.setSync, persistAudioMeta, updateMetronomeOptions],
  );

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
            // 关键节点：伴奏是节拍器联动的依赖，换伴奏先停节拍器
            // （旧 audio 元素直接销毁不发 pause 事件，联动不会自行停止）
            if (currentAudioPathRef.current !== path) {
              metronome.stop();
            }
            currentAudioPathRef.current = path;
            // 应用新伴奏已保存的 BPM/首拍（识别或手动校准过的值）
            applyAudioMeta(path);
          }}
        />
      </div>

      <div className="contents" onPointerDownCapture={() => (shortcutDomainRef.current = "metronome")}>
        <ToolBar
          tool={tool}
          onToolChange={setTool}
          metronome={{
            options: metronome.options,
            updateOptions: updateMetronomeOptions,
            running: metronome.running,
            toggle: metronome.toggle,
            activeBeat: metronome.activeBeat,
            sync: metronome.sync,
            setSync: updateMetronomeSync,
            hasAudio: audioResources.length > 0,
            getMediaTime,
            detectingBpm,
            onDetectBpm: () => void detectBpm(),
            onTapBpm: applyTapBpm,
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
