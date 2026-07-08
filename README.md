# Guitar House

吉他练习桌面工具：本地视频播放 + 看谱 + 节拍器 + 伴奏播放，同屏配合练琴。

作者：yuchenxi

## 功能

- **本地视频播放**：播放教学/翻弹视频（mp4 / mov / m4v / webm），支持 0.5x - 1.5x 倍速慢练
- **看谱**：右侧谱面区支持三类格式，可缩放
  - 图片（png / jpg / webp / gif / bmp）
  - PDF（pdf.js 连续滚动渲染）
  - Guitar Pro（.gp / .gp3 / .gp4 / .gp5 / .gpx，alphaTab 渲染五线谱 + 六线谱）
- **伴奏播放**：本地伴奏音频（mp3 / m4a / aac / wav / flac / aiff），进度拖动、倍速、循环、独立音量
- **节拍器**：Web Audio 采样级精准调度
  - BPM 20 - 300（滑块 / 输入 / TAP 测速）
  - 拍号 2/4、3/4、4/4、6/4，首拍重音可开关
  - **联动模式**：可选跟随视频或跟随伴奏——媒体播放/暂停时节拍器自动起停，跳转与倍速变化自动重对齐（慢速练习时节拍同步变慢），支持设置"首拍偏移"把节拍对齐到歌曲第一拍

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

1. 顶栏"打开视频"选择本地练习视频，"打开伴奏"选择伴奏音频，"打开乐谱"选择谱面文件（图片 / PDF / GP）
2. 底部节拍器条：
   - `▶ 节拍` 自由模式手动起停；`TAP` 按节奏连点测出 BPM
   - 联动选"跟随视频"或"跟随伴奏"后，媒体播放时节拍器自动响起；先把媒体停在歌曲第一拍处点"取当前"设置首拍偏移，节拍即可与歌曲小节对齐
3. 中间分隔条可拖拽调整视频/谱面比例

## 下载与发版（GitHub Actions 自动打包）

- 每次 push 到 `main`：CI 自动执行类型检查与前端构建
- **语义化自动发版（release-please）**：提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/)（`feat:` 新功能升 minor、`fix:` 修复升 patch、`feat!:` 破坏性变更升 major），push 到 main 后机器人自动维护一个 Release PR（累积变更、预告版本号、生成 CHANGELOG）；**合并该 PR 即发版**——自动打 tag、创建 Release，并级联构建 macOS（Apple Silicon / Intel）、Windows、Linux 安装包上传
- 兜底：手动推 `v*` 标签也会直接触发打包

```bash
# 常规发版：正常提交，等 release-please 的 PR 出现后合并它即可
git commit -m "feat: 新增 AB 循环"

# 兜底手动发版
git tag v0.2.0 && git push origin v0.2.0
```

macOS 安装包未签名（无 Apple 开发者证书），首次打开如提示"已损坏"，在终端执行：

```bash
xattr -cr "/Applications/Guitar House.app"
```

## 已知限制

- 视频解码依赖 macOS WKWebView，mkv / avi 等格式暂不支持
- Guitar Pro 谱当前为纯看谱渲染（不含 alphaTab 自带的音频播放）
