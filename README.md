# Learning House

通用课程管理与上课桌面工具：把本地的视频 / 音频 / 图片 / PDF / Guitar Pro 资源整合成课节，
在同一界面完成看课、看谱、练习与进度管理。

本地优先（local-first）：所有课程资源与学习数据都留在你自己的设备上。


## 核心概念

- **课程 Course**：一组课节，带类型（吉他 / 通用）与学习进度
- **课节 Lesson**：一组资源（视频 + 音频 + 文档），可标记完成
- **默认整理规则**：导入课程根文件夹时，每个子文件夹自动归纳为一个课节；根目录散落文件归为"未分组"课节；无子文件夹时整个文件夹视为单课节课程

## 功能

### 课程库
- 课程卡片：类型标签、课节数、学习进度条（已完成课节 / 总课节）
- 从文件夹导入课程（自动扫描归纳课节）、重新扫描（保留完成状态）、删除

### 上课页
- 顶栏：课节切换（上一节 / 下一节 / 下拉）、课节完成标记、左右布局调换
- **视频区**：课节内多视频 tab 切换，0.5x - 1.5x 倍速，自动记忆播放位置（续播）
- **文档区**：课节内多文档 tab 切换，支持图片 / PDF（pdf.js）/ Guitar Pro（alphaTab 渲染五线谱 + 六线谱），可缩放
- **音频条**：课节内多音频切换，进度拖动、倍速、循环、独立音量
- **底部工具栏**：可切换工具，吉他类型课程默认带出节拍器

### 节拍器（工具）
- BPM 20 - 300、拍号 2/4 - 6/4、首拍重音、音量、拍点指示灯
- **Tap Tempo 浮窗**：鼠标点击或空格键击打，实时计算 BPM，一键应用
- **媒体联动**：可跟随视频或音频——播放/暂停自动起停，跳转与倍速变化自动重对齐（慢速练习节拍同步变慢），支持首拍偏移对齐小节

## 技术栈

- [Tauri 2](https://tauri.app/)（Rust 壳 + 系统 WebView），插件：dialog / fs / store
- React 19 + TypeScript + Vite，pnpm workspace monorepo
- [alphaTab](https://alphatab.net/)（Guitar Pro 谱渲染）、[pdf.js](https://mozilla.github.io/pdf.js/)（PDF 渲染）
- `packages/metronome-core`：节拍器引擎（纯 TS，Web Audio 采样级调度，支持媒体时间轴锚定）

## 目录结构

```
learning-house/
├── mise.toml                  # 工具链版本（node / rust）
├── apps/
│   └── desktop/               # Tauri 桌面应用
│       ├── src/
│       │   ├── pages/         # 课程库页 / 上课页
│       │   ├── components/    # 播放器、文档查看器、工具栏、浮窗
│       │   ├── lib/           # 存储、文件夹扫描、平台适配
│       │   └── hooks/         # 节拍器 hook
│       └── src-tauri/         # Rust 壳
└── packages/
    └── metronome-core/        # 节拍器核心引擎（无 UI 依赖）
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

## 下载与发版（GitHub Actions 自动打包）

- 每次 push 到 `main`：CI 自动执行类型检查与前端构建
- **语义化自动发版（release-please）**：提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/)（`feat:` 新功能升 minor、`fix:` 修复升 patch），push 到 main 后机器人自动维护 Release PR（版本号、CHANGELOG）；**合并该 PR 即发版**——自动打 tag、创建 Release，并级联构建 macOS（Apple Silicon / Intel）、Windows、Linux 安装包上传
- 兜底：手动推 `v*` 标签也会直接触发打包

macOS 安装包未签名（无 Apple 开发者证书），首次打开如提示"已损坏"，在终端执行：

```bash
xattr -cr "/Applications/Learning House.app"
```

## 已知限制

- 视频/音频解码依赖系统 WebView（macOS 为 WKWebView），mkv / avi / ogg 等格式暂不支持
- Guitar Pro 谱为纯看谱渲染（不含 alphaTab 自带的音频播放）
- 区域分离为独立窗口（类 DevTools detach）规划中

## 路线图

- [ ] 区域分离为独立窗口（Tauri 多窗口 + 状态同步）
- [ ] 手动编辑课节（跨文件夹添加资源、调整顺序）
- [ ] 更多工具：AB 段落循环、调音器、录音对比

## 协议

本项目核心以 [AGPL-3.0](LICENSE) 协议开源：你可以自由使用、修改与分发，
但基于本项目的衍生作品（包括以网络服务形式提供）必须以相同协议开源。
如需商业授权或闭源集成，请通过 issue 联系作者。
