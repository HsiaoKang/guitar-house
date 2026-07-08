# Guitar House

吉他练习桌面工具：本地视频播放 + 看谱 + 节拍器，三者同屏配合练琴。

作者：yuchenxi

## 功能

- **本地视频播放**：播放教学/翻弹视频（mp4 / mov / m4v / webm），支持 0.5x - 1.5x 倍速慢练
- **看谱**：右侧谱面区支持三类格式，可缩放
  - 图片（png / jpg / webp / gif / bmp）
  - PDF（pdf.js 连续滚动渲染）
  - Guitar Pro（.gp / .gp3 / .gp4 / .gp5 / .gpx，alphaTab 渲染五线谱 + 六线谱）
- **节拍器**：Web Audio 采样级精准调度
  - BPM 20 - 300（滑块 / 输入 / TAP 测速）
  - 拍号 2/4、3/4、4/4、6/4，首拍重音可开关
  - **跟随视频模式**：视频播放/暂停时节拍器自动起停，跳转与倍速变化自动重对齐（慢速练习时节拍同步变慢），支持设置"首拍偏移"把节拍对齐到歌曲第一拍

## 技术栈

- [Tauri 2](https://tauri.app/)（Rust 壳 + 系统 WebView）
- React 19 + TypeScript + Vite
- [alphaTab](https://alphatab.net/)（Guitar Pro 谱渲染）
- [pdf.js](https://mozilla.github.io/pdf.js/)（PDF 渲染）
- pnpm workspace monorepo

## 目录结构

```
guitar-house/
├── mise.toml                  # 工具链版本（node / rust）
├── apps/
│   └── desktop/               # Tauri 桌面应用
│       ├── src/               # React 前端
│       └── src-tauri/         # Rust 壳
└── packages/
    └── metronome-core/        # 节拍器核心引擎（纯 TS，无 UI 依赖）
```

## 开发

环境要求：[mise](https://mise.jdx.dev/)（自动管理 node 与 rust 版本）、Xcode Command Line Tools。

```bash
mise install        # 安装 node 22 与 rust 1.88
pnpm install        # 安装依赖
pnpm dev            # 启动开发模式（Vite + Tauri）
pnpm build          # 构建产物（.app / .dmg）
pnpm typecheck      # 全仓库类型检查
```

## 使用说明

1. 顶栏"打开视频"选择本地练习视频
2. 顶栏"打开乐谱"选择谱面文件（图片 / PDF / GP）
3. 底部节拍器条：
   - `▶ 节拍` 自由模式手动起停；`TAP` 按节奏连点测出 BPM
   - 勾选"跟随视频"后，视频播放时节拍器自动响起；先把视频停在歌曲第一拍处点"取当前"设置首拍偏移，节拍即可与歌曲小节对齐
4. 中间分隔条可拖拽调整视频/谱面比例

## 已知限制

- 视频解码依赖 macOS WKWebView，mkv / avi 等格式暂不支持
- Guitar Pro 谱当前为纯看谱渲染（不含 alphaTab 自带的音频播放）
