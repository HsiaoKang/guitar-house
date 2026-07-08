/**
 * Guitar House 主界面
 *
 * 布局：顶栏（打开文件）+ 左视频右乐谱（可拖拽分割）
 * + 伴奏播放条（可选）+ 底部节拍器条。
 *
 * @author yuchenxi
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { VideoPlayer } from "./components/VideoPlayer";
import { ScoreViewer } from "./components/ScoreViewer";
import { MetronomeBar } from "./components/MetronomeBar";
import { AudioPlayerBar } from "./components/AudioPlayerBar";
import { SplitPane } from "./components/SplitPane";
import { useMetronome } from "./hooks/useMetronome";
import {
  AUDIO_EXTENSIONS,
  GP_EXTENSIONS,
  IMAGE_EXTENSIONS,
  VIDEO_EXTENSIONS,
  basename,
  scoreKindOf,
  type ScoreFile,
} from "./types";
import "./App.css";

function App() {
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [audioPath, setAudioPath] = useState<string | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [score, setScore] = useState<ScoreFile | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const metronome = useMetronome();

  // 为视频与伴奏分别生成联动控制接口（只有选中的联动源会驱动节拍器）
  const videoControl = useMemo(() => metronome.bindSource("video"), [metronome.bindSource]);
  const audioControl = useMemo(() => metronome.bindSource("audio"), [metronome.bindSource]);

  /**
   * 弹出原生对话框选择本地视频文件
   */
  const openVideo = useCallback(async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "视频", extensions: VIDEO_EXTENSIONS }],
    });
    if (typeof selected === "string") {
      setVideoPath(selected);
      setPlaybackRate(1);
    }
  }, []);

  /**
   * 弹出原生对话框选择本地伴奏音频文件
   */
  const openAudio = useCallback(async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "伴奏音频", extensions: AUDIO_EXTENSIONS }],
    });
    if (typeof selected === "string") {
      setAudioPath(selected);
    }
  }, []);

  /**
   * 关闭伴奏：若节拍器正跟随伴奏则先停止联动
   */
  const closeAudio = useCallback(() => {
    if (metronome.sync.source === "audio") {
      metronome.setSync({ source: "none" });
    }
    setAudioPath(null);
  }, [metronome]);

  /**
   * 弹出原生对话框选择乐谱文件（图片 / PDF / Guitar Pro）
   */
  const openScore = useCallback(async () => {
    const selected = await open({
      multiple: false,
      filters: [
        { name: "乐谱", extensions: [...IMAGE_EXTENSIONS, "pdf", ...GP_EXTENSIONS] },
        { name: "图片", extensions: IMAGE_EXTENSIONS },
        { name: "PDF", extensions: ["pdf"] },
        { name: "Guitar Pro", extensions: GP_EXTENSIONS },
      ],
    });
    if (typeof selected === "string") {
      const kind = scoreKindOf(selected);
      if (kind) setScore({ path: selected, name: basename(selected), kind });
    }
  }, []);

  /**
   * 修改视频倍速：同步到 video 元素，节拍器经 ratechange 事件自动对齐
   *
   * @param rate 目标倍速
   */
  const changeRate = useCallback((rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) videoRef.current.playbackRate = rate;
  }, []);

  /**
   * 读取当前联动源媒体的播放位置（秒），无联动源或未打开时返回 null
   */
  const getMediaTime = useCallback(() => {
    if (metronome.sync.source === "video") return videoRef.current?.currentTime ?? null;
    if (metronome.sync.source === "audio") return audioRef.current?.currentTime ?? null;
    return null;
  }, [metronome.sync.source]);

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="brand">
          <span className="brand-mark">🎸</span>
          <span className="brand-name">Guitar House</span>
        </div>
        <div className="top-actions">
          <button className="btn btn-ghost" onClick={openVideo}>
            打开视频
          </button>
          <button className="btn btn-ghost" onClick={openAudio}>
            打开伴奏
          </button>
          <button className="btn btn-ghost" onClick={openScore}>
            打开乐谱
          </button>
        </div>
      </header>

      <main className="main-area">
        <SplitPane
          left={
            <VideoPlayer
              src={videoPath ? convertFileSrc(videoPath) : null}
              fileName={videoPath ? basename(videoPath) : null}
              playbackRate={playbackRate}
              onRateChange={changeRate}
              onOpenFile={openVideo}
              videoRef={videoRef}
              engineControl={videoControl}
            />
          }
          right={<ScoreViewer score={score} onOpenFile={openScore} />}
        />
      </main>

      {audioPath && (
        <AudioPlayerBar
          src={convertFileSrc(audioPath)}
          fileName={basename(audioPath)}
          onOpenFile={openAudio}
          onClose={closeAudio}
          audioRef={audioRef}
          engineControl={audioControl}
        />
      )}

      <MetronomeBar
        options={metronome.options}
        updateOptions={metronome.updateOptions}
        running={metronome.running}
        toggle={metronome.toggle}
        activeBeat={metronome.activeBeat}
        sync={metronome.sync}
        setSync={metronome.setSync}
        tapTempo={metronome.tapTempo}
        hasVideo={videoPath !== null}
        hasAudio={audioPath !== null}
        getMediaTime={getMediaTime}
      />
    </div>
  );
}

export default App;
