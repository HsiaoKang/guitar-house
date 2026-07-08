/**
 * 谱面查看器
 *
 * 统一承载三类谱面（图片 / PDF / Guitar Pro），
 * 提供缩放工具条，按文件类型分发到对应渲染器。
 *
 * @author yuchenxi
 */
import { useEffect, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { readFile } from "@tauri-apps/plugin-fs";
import type { ScoreFile } from "../types";
import { ImageScore } from "./ImageScore";
import { PdfScore } from "./PdfScore";
import { AlphaTabScore } from "./AlphaTabScore";

/** 单次缩放步长 */
const ZOOM_STEP = 0.15;
/** 缩放范围 */
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 3;

interface ScoreViewerProps {
  /** 当前打开的谱面，null 表示未打开 */
  score: ScoreFile | null;
  /** 触发文件选择 */
  onOpenFile: () => void;
}

/**
 * 谱面查看区组件
 *
 * @param props score 当前谱面；onOpenFile 打开文件回调
 */
export function ScoreViewer({ score, onOpenFile }: ScoreViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [binary, setBinary] = useState<Uint8Array | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // PDF 与 Guitar Pro 需要读取文件字节；图片直接走 asset URL
  useEffect(() => {
    setZoom(1);
    setBinary(null);
    setLoadError(null);
    if (!score || score.kind === "image") return;
    let cancelled = false;
    readFile(score.path)
      .then((bytes) => {
        if (!cancelled) setBinary(bytes);
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [score]);

  if (!score) {
    return (
      <div className="panel-empty">
        <div className="panel-empty-icon">♪</div>
        <p>还没有打开乐谱</p>
        <button className="btn btn-primary" onClick={onOpenFile}>
          打开乐谱
        </button>
        <p className="panel-empty-hint">支持图片 / PDF / Guitar Pro（gp3-gpx）</p>
      </div>
    );
  }

  return (
    <div className="score-viewer">
      <div className="panel-toolbar">
        <span className="panel-title" title={score.name}>
          {score.name}
        </span>
        <div className="zoom-group">
          <button className="btn btn-ghost" onClick={() => setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)))}>
            −
          </button>
          <span className="zoom-label">{Math.round(zoom * 100)}%</span>
          <button className="btn btn-ghost" onClick={() => setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)))}>
            +
          </button>
          <button className="btn btn-ghost" onClick={() => setZoom(1)}>
            适宽
          </button>
        </div>
        <button className="btn btn-ghost" onClick={onOpenFile}>
          换乐谱
        </button>
      </div>
      {renderBody(score, zoom, binary, loadError)}
    </div>
  );
}

/**
 * 根据谱面类型分发到对应渲染器
 *
 * @param score 谱面文件描述
 * @param zoom 缩放系数
 * @param binary 已读取的文件字节（图片类型为 null）
 * @param loadError 文件读取错误信息
 */
function renderBody(score: ScoreFile, zoom: number, binary: Uint8Array | null, loadError: string | null) {
  if (loadError) {
    return <div className="panel-empty">文件读取失败：{loadError}</div>;
  }
  if (score.kind === "image") {
    return <ImageScore src={convertFileSrc(score.path)} zoom={zoom} />;
  }
  if (!binary) {
    return <div className="panel-empty">加载中…</div>;
  }
  if (score.kind === "pdf") {
    return <PdfScore data={binary} zoom={zoom} />;
  }
  return <AlphaTabScore data={binary} zoom={zoom} />;
}
