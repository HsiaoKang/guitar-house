/**
 * 节拍器核心类型定义
 */

/** 节拍器运行模式 */
export type MetronomeMode = "free" | "sync";

/** 节拍事件：调度器每打一拍都会向 UI 层广播一次 */
export interface BeatEvent {
  /** 小节内拍序号（0 开始，0 为重拍） */
  beatInBar: number;
  /** 是否重音拍 */
  isAccent: boolean;
  /** 该拍对应的 AudioContext 时间（秒） */
  time: number;
}

/** 节拍器可调参数 */
export interface MetronomeOptions {
  /** 每分钟拍数，范围 20 - 300 */
  bpm: number;
  /** 拍号分子：每小节拍数（4/4 拍即 4） */
  beatsPerBar: number;
  /** 是否强调每小节第一拍 */
  accentFirstBeat: boolean;
  /** 音量 0 - 1 */
  volume: number;
}

/** 联动模式的时间轴对齐参数（把拍点锚定到视频时间轴上） */
export interface TimelineAlignment {
  /** 当前媒体时间（秒），即 video.currentTime */
  mediaTime: number;
  /** 媒体播放速率，即 video.playbackRate */
  playbackRate: number;
  /** 视频时间轴上第一拍出现的时刻（秒），用于对齐小节 */
  firstBeatOffset: number;
}
