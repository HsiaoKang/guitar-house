/**
 * 底部工具栏
 *
 * 上课页底部的工具容器：左端提供工具切换器，右侧渲染当前工具面板。
 * 目前内置工具：节拍器；默认工具由课程类型决定（吉他 -> 节拍器）。
 */
import { Select } from "@learning-house/ui";
import type { MetronomeOptions } from "@learning-house/metronome-core";
import type { SyncConfig } from "../hooks/useMetronome";
import type { ToolKind } from "../types";
import { MetronomeBar } from "./MetronomeBar";
import { toolBar, toolEmptyHint, toolLabel, toolPanel, toolSwitcher } from "./toolbar.css";

/** 工具显示名 */
const TOOL_LABELS: Record<ToolKind, string> = {
  metronome: "节拍器",
  none: "无工具",
};

interface ToolBarProps {
  /** 当前激活的工具 */
  tool: ToolKind;
  /** 切换工具 */
  onToolChange: (tool: ToolKind) => void;
  /** 节拍器所需的全部状态与控制（透传给 MetronomeBar） */
  metronome: {
    options: MetronomeOptions;
    updateOptions: (patch: Partial<MetronomeOptions>) => void;
    running: boolean;
    toggle: () => void;
    activeBeat: number;
    sync: SyncConfig;
    setSync: (patch: Partial<SyncConfig>) => void;
    hasVideo: boolean;
    hasAudio: boolean;
    getMediaTime: () => number | null;
  };
}

/**
 * 工具栏组件
 *
 * @param props 见 ToolBarProps 字段说明
 */
export function ToolBar({ tool, onToolChange, metronome }: ToolBarProps) {
  return (
    <div className={toolBar}>
      <div className={toolSwitcher}>
        <span className={toolLabel}>工具</span>
        <Select value={tool} onChange={(e) => onToolChange(e.target.value as ToolKind)}>
          {(Object.keys(TOOL_LABELS) as ToolKind[]).map((kind) => (
            <option key={kind} value={kind}>
              {TOOL_LABELS[kind]}
            </option>
          ))}
        </Select>
      </div>
      <div className={toolPanel}>
        {tool === "metronome" ? (
          <MetronomeBar
            options={metronome.options}
            updateOptions={metronome.updateOptions}
            running={metronome.running}
            toggle={metronome.toggle}
            activeBeat={metronome.activeBeat}
            sync={metronome.sync}
            setSync={metronome.setSync}
            hasVideo={metronome.hasVideo}
            hasAudio={metronome.hasAudio}
            getMediaTime={metronome.getMediaTime}
          />
        ) : (
          <span className={toolEmptyHint}>未启用工具</span>
        )}
      </div>
    </div>
  );
}
