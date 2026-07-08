/**
 * PDF 谱渲染器
 *
 * 基于 pdf.js 将 PDF 所有页渲染为 canvas 连续滚动展示，
 * 按 devicePixelRatio 提升清晰度，缩放时整体重渲染。
 *
 * @author yuchenxi
 */
import { useEffect, useRef, useState } from "react";
// legacy 构建兼容较旧的 WebView 内核（标准构建依赖过新的 JS API）
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PdfScoreProps {
  /** PDF 文件二进制内容 */
  data: Uint8Array;
  /** 缩放系数，1 表示适配容器宽度 */
  zoom: number;
}

/**
 * PDF 谱组件
 *
 * @param props data PDF 字节；zoom 缩放系数
 */
export function PdfScore({ data, zoom }: PdfScoreProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const taskRef = useRef<PDFDocumentLoadingTask | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 加载 PDF 文档（data 变化时重新加载）
  useEffect(() => {
    let cancelled = false;
    setDoc(null);
    setError(null);
    // pdf.js 会转移 buffer 所有权，传入副本避免原数据失效
    const task = pdfjsLib.getDocument({ data: data.slice() });
    taskRef.current = task;
    task.promise
      .then((loaded) => {
        if (!cancelled) setDoc(loaded);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
      void taskRef.current?.destroy();
      taskRef.current = null;
    };
  }, [data]);

  // 渲染全部页面（文档就绪或缩放变化时）
  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    void renderAllPages(doc, containerRef.current!, zoom, () => cancelled);
    return () => {
      cancelled = true;
    };
  }, [doc, zoom]);

  if (error) {
    return <div className="panel-empty">PDF 加载失败：{error}</div>;
  }
  return <div className="score-scroll pdf-pages" ref={containerRef} />;
}

/**
 * 把 PDF 的每一页渲染成 canvas 追加到容器中
 *
 * @param doc pdf.js 文档对象
 * @param container 目标容器（渲染前会清空）
 * @param zoom 用户缩放系数（1 = 适配容器宽度）
 * @param isCancelled 查询当前渲染任务是否已被取消
 */
async function renderAllPages(
  doc: PDFDocumentProxy,
  container: HTMLDivElement,
  zoom: number,
  isCancelled: () => boolean,
): Promise<void> {
  const containerWidth = Math.max(200, container.clientWidth - 24);
  const dpr = window.devicePixelRatio || 1;
  container.innerHTML = "";
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    if (isCancelled()) return;
    const page = await doc.getPage(pageNum);
    // 先按原始尺寸算出适配宽度的基础缩放，再叠加用户缩放与像素密度
    const baseViewport = page.getViewport({ scale: 1 });
    const cssScale = (containerWidth / baseViewport.width) * zoom;
    const viewport = page.getViewport({ scale: cssScale * dpr });

    const canvas = document.createElement("canvas");
    canvas.className = "pdf-page-canvas";
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
    canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
    container.appendChild(canvas);
    await page.render({ canvas, viewport }).promise;
  }
}
