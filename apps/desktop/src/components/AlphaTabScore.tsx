/**
 * Guitar Pro 谱渲染器
 *
 * 基于 alphaTab 渲染 .gp/.gp3/.gp4/.gp5/.gpx 文件，
 * 输出标准五线谱 + 六线谱（TAB），缩放通过 alphaTab 的
 * display.scale 设置实现。
 *
 * @author yuchenxi
 */
import { useEffect, useRef, useState } from "react";
import * as alphaTabLib from "@coderline/alphatab";

interface AlphaTabScoreProps {
  /** Guitar Pro 文件二进制内容 */
  data: Uint8Array;
  /** 缩放系数，1 为原始大小 */
  zoom: number;
}

/**
 * Guitar Pro 谱组件
 *
 * @param props data 谱文件字节；zoom 缩放系数
 */
export function AlphaTabScore({ data, zoom }: AlphaTabScoreProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<alphaTabLib.AlphaTabApi | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 初始化 alphaTab 实例并加载谱面（data 变化时重建）
  useEffect(() => {
    if (!hostRef.current) return;
    setError(null);
    const api = new alphaTabLib.AlphaTabApi(hostRef.current, {
      core: {
        // 看谱场景无需音频合成，关闭播放器相关加载；
        // 主线程渲染，避免 WebView 环境下 worker 加载不稳定
        engine: "svg",
        useWorkers: false,
      },
      player: {
        playerMode: alphaTabLib.PlayerMode.Disabled,
      },
      display: {
        scale: 1,
      },
    } as alphaTabLib.json.SettingsJson);
    apiRef.current = api;
    api.error.on((e) => setError(e.message ?? "乐谱解析失败"));
    try {
      api.load(data);
    } catch (e) {
      setError(String(e));
    }
    return () => {
      api.destroy();
      apiRef.current = null;
    };
  }, [data]);

  // 缩放变化时更新设置并重渲染
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    api.settings.display.scale = zoom;
    api.updateSettings();
    api.render();
  }, [zoom]);

  if (error) {
    return <div className="panel-empty">Guitar Pro 谱加载失败:{error}</div>;
  }
  return (
    <div className="score-scroll alphatab-host">
      <div ref={hostRef} />
    </div>
  );
}
