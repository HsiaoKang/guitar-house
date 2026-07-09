/**
 * 图标体系
 *
 * 统一封装 lucide-react：集中管理应用用到的图标集合，
 * 统一默认尺寸与线宽，业务侧通过名称引用，便于整体替换与审计。
 */
import type { CSSProperties } from "react";
import {
  ArrowLeftRight,
  Check,
  ChevronDown,
  ChevronLeft,
  FolderOpen,
  Minus,
  Monitor,
  Moon,
  Music,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Square,
  Sun,
  Trash2,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";

/** 应用图标名 -> lucide 组件映射（新增图标在此登记） */
const ICONS = {
  back: ChevronLeft,
  check: Check,
  chevronDown: ChevronDown,
  close: X,
  folderOpen: FolderOpen,
  minus: Minus,
  monitor: Monitor,
  moon: Moon,
  music: Music,
  pause: Pause,
  play: Play,
  plus: Plus,
  rescan: RefreshCw,
  stop: Square,
  sun: Sun,
  swap: ArrowLeftRight,
  trash: Trash2,
  video: Video,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

/** 预设尺寸（像素） */
const SIZES = { sm: 14, md: 16, lg: 20, xl: 42 } as const;

export interface IconProps {
  /** 图标名 */
  name: IconName;
  /** 预设尺寸，默认 md(16px) */
  size?: keyof typeof SIZES;
  /** 额外样式（少数需要微调对齐的场景） */
  style?: CSSProperties;
}

/**
 * 统一图标组件
 *
 * @param props name 图标名；size 预设尺寸；style 额外样式
 */
export function Icon({ name, size = "md", style }: IconProps) {
  const Comp = ICONS[name];
  return <Comp size={SIZES[size]} strokeWidth={2} aria-hidden style={style} />;
}
