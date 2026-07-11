/**
 * PDF 谱渲染器（虚拟化）
 *
 * 性能设计：
 * - 页面虚拟化：每页一个按宽高比占位的容器，进入视口附近
 *   （IntersectionObserver + 600px 预载余量）才渲染 canvas
 * - 即时响应 + 延迟精绘：canvas CSS 宽 100% 随容器实时拉伸
 *   （拖分隔条立即可见），容器宽度防抖稳定后按 devicePixelRatio 重画清晰版
 */
import { useEffect, useRef, useState } from "react";
import { EmptyState } from "@learning-house/ui";
// legacy 构建兼容较旧的 WebView 内核（标准构建依赖过新的 JS API）
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/** 容器宽度变化的精绘防抖（毫秒） */
const RESIZE_DEBOUNCE_MS = 200;
/** 视口预载余量（提前渲染即将滚入的页面） */
const OVERSCAN_MARGIN = "600px 0px";

interface PdfScoreProps {
  /** PDF 文件二进制内容 */
  data: Uint8Array;
}

/**
 * PDF 谱组件
 *
 * @param props data PDF 字节
 */
export function PdfScore({ data }: PdfScoreProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const taskRef = useRef<PDFDocumentLoadingTask | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageWidth, setPageWidth] = useState(0);
  /** 首页宽高比，作为未渲染页的占位估计 */
  const [fallbackAspect, setFallbackAspect] = useState(1.414);

  // 加载 PDF 文档（data 变化时重新加载），并取首页比例做占位
  useEffect(() => {
    let cancelled = false;
    setDoc(null);
    setError(null);
    // pdf.js 会转移 buffer 所有权，传入副本避免原数据失效
    const task = pdfjsLib.getDocument({ data: data.slice() });
    taskRef.current = task;
    task.promise
      .then(async (loaded) => {
        if (cancelled) return;
        const first = await loaded.getPage(1);
        const viewport = first.getViewport({ scale: 1 });
        if (cancelled) return;
        setFallbackAspect(viewport.height / viewport.width);
        setDoc(loaded);
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

  // 关键节点：容器宽度防抖更新（触发精绘）；CSS 拉伸保证拖动期间的即时视觉
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setPageWidth(Math.max(200, el.clientWidth - 24));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => setPageWidth(Math.max(200, el.clientWidth - 24)), RESIZE_DEBOUNCE_MS);
    });
    observer.observe(el);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  if (error) {
    return <EmptyState title={`PDF 加载失败：${error}`} />;
  }
  return (
    <div ref={containerRef} className="flex min-h-0 flex-1 flex-col items-center gap-3 overflow-auto p-3">
      {doc &&
        pageWidth > 0 &&
        Array.from({ length: doc.numPages }, (_, i) => (
          <PdfPage key={i} doc={doc} pageNum={i + 1} renderWidth={pageWidth} fallbackAspect={fallbackAspect} />
        ))}
    </div>
  );
}

interface PdfPageProps {
  doc: PDFDocumentProxy;
  /** 页码（1 开始） */
  pageNum: number;
  /** 精绘目标宽度（防抖后的容器宽） */
  renderWidth: number;
  /** 未知比例时的占位宽高比 */
  fallbackAspect: number;
}

/**
 * 单页：占位容器 + 进入视口后渲染 canvas
 *
 * @param props 见 PdfPageProps 字段说明
 */
function PdfPage({ doc, pageNum, renderWidth, fallbackAspect }: PdfPageProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const [visible, setVisible] = useState(false);
  const [aspect, setAspect] = useState(fallbackAspect);

  // 进入视口附近后开始渲染（渲染后保留，滚出不销毁避免回滚闪烁）
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: OVERSCAN_MARGIN },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 可见后按目标宽度精绘；宽度变化时取消旧渲染任务重画
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    void (async () => {
      const page = await doc.getPage(pageNum);
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      setAspect(base.height / base.width);
      const dpr = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: (renderWidth / base.width) * dpr });
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;
      renderTaskRef.current?.cancel();
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const task = page.render({ canvas, viewport });
      renderTaskRef.current = task;
      await task.promise.catch(() => {
        // 渲染任务被新一轮取消属正常流程
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, renderWidth, doc, pageNum]);

  return (
    <div
      ref={wrapperRef}
      className="w-full max-w-full"
      style={{ aspectRatio: `${1 / aspect}` }}
    >
      {visible ? (
        <canvas ref={canvasRef} className="block h-full w-full rounded shadow-md" />
      ) : (
        <div className="h-full w-full rounded bg-paper/50 shadow-md" />
      )}
    </div>
  );
}
