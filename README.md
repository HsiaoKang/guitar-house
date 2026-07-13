<div align="center">

# Learning House

**把网盘下载的课程，变成真正能上课的地方。**

[![Release](https://img.shields.io/github/v/release/HsiaoKang/learning-house)](https://github.com/HsiaoKang/learning-house/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/HsiaoKang/learning-house/total)](https://github.com/HsiaoKang/learning-house/releases)
[![License](https://img.shields.io/badge/license-AGPL--3.0-blue)](LICENSE)

[English](README.en.md)

</div>

买来的视频课程解压后是一堆乱糟糟的文件？Learning House 把整个文件夹一键变成结构化的课程：
视频、曲谱、伴奏自动对号入座，同一屏幕看课、看谱、跟着节拍器练习，学到哪一课一目了然。

macOS / Windows / Linux 桌面应用。**你的课程和学习数据永远只在你自己的设备上，不上传任何内容。**

<!-- 截图占位：课程库页（多门课程卡片带进度） -->
<!-- 截图占位：上课页（左视频右曲谱 + 底部节拍器） -->

## 能做什么

### 文件夹进，课程出
- 选中课程文件夹自动整理：81 个视频加几十份资料，自动变成 81 节课，每节课的谱子和伴奏都挂在对应位置
- 常见的网课打包结构都能自动认出来，课节数和视频数严格一致，不多不少
- 结构特殊？内置 **AI 整理**：一键生成整理指令发给任意 AI（ChatGPT / 豆包 / Kimi…），把回复贴回来就完成组课，不上传任何文件
- **课节管理页**：最后一步人工把关——改名、排序、增删课节，资料在课节之间移动或复制（几节课共用同一份谱子伴奏也没问题）
- 上课时发现缺谱子？直接把课程里任何资料**就地关联**到当前课节（讲解课引用上一节的曲谱伴奏）

### 同屏上课
- 左边视频右边曲谱（可对调、可拖动分界线），视频多集切换、倍速、看到哪记到哪
- 曲谱支持图片、PDF 和 Guitar Pro 吉他谱（五线谱、六线谱都能看）
- 伴奏栏：切换、循环、倍速、独立音量
- 空格播放暂停、方向键快进和调音量——快捷键跟着你正在操作的区域走（视频 / 伴奏 / 节拍器）

### 会认谱的节拍器
- **速度自动识别**：打开"跟随伴奏"自动就位——文件名里标了速度就直接用，谱面上印着 ♩=N 也认识，都没有才自己听
- **拍几下就校准**：识别不准时跟着伴奏用 TAP 拍几下，自动修正到精确数值（你定节奏，它定精度）
- 校准结果**跟着音频记住**，一次校准永久生效
- 跟随伴奏自动起停对齐，慢速练习时节拍同步变慢
- 每一拍的强弱都能调（强 / 次强 / 弱 / 静音，柱子越高声音越响）

### 数据跟着课程走
- 学习进度和整理成果都存在课程文件夹里——换电脑、重装应用、拷给朋友，一切都在
- 应用内自动更新，装一次以后不用再手动下载

## 下载安装

前往 [Releases](https://github.com/HsiaoKang/learning-house/releases/latest) 下载对应平台安装包：

| 平台 | 文件 | 说明 |
|---|---|---|
| macOS（Apple 芯片） | `*_aarch64.dmg` | 见下方首次打开说明 |
| macOS（Intel） | `*_x64.dmg` | 同上 |
| Windows | `*_x64-setup.exe` | 提示"Windows 已保护你的电脑"时，点"更多信息 → 仍要运行" |
| Linux | `*.AppImage` / `*.deb` | |

**macOS 首次打开**：安装包暂未做苹果公证（个人项目省下每年 $99），首次打开若提示"已损坏"，
在终端里粘贴执行这一行就好：

```bash
xattr -cr "/Applications/Learning House.app"
```

## 课程文件夹怎么组织？

多数情况下**不需要组织**——直接导入，自动识别就够了。如果你想精确控制，
应用会把课节结构存成课程文件夹里的一份清单文件（`.learninghouse/manifest.json`），
AI 整理和管理页的成果也固化在这里，随文件夹一起迁移：

```json
{
  "name": "课程名",
  "lessons": [
    { "name": "01 第一课", "resources": ["1-第一课.mp4", "资料/谱子.pdf", "资料/伴奏.mp3"] }
  ]
}
```

## 反馈

- 应用内点击顶栏**反馈按钮**（自动带上版本与系统信息，也可以选择发邮件，无需注册账号）
- [提交 Issue](https://github.com/HsiaoKang/learning-house/issues/new/choose)（问题反馈 / 功能建议模板）
- [Discussions](https://github.com/HsiaoKang/learning-house/discussions) 聊想法、投票你想要的功能

## 路线图

- [ ] AB 段落循环（练习刚需）
- [ ] 直接连接网盘导入课程
- [ ] 更多练习工具：调音器、录音对比
- [ ] 区域分离为独立窗口

想要某个功能？来 [Discussions](https://github.com/HsiaoKang/learning-house/discussions) 投票或提出来。

## 已知限制

- 视频/音频解码依赖系统内核，mkv / avi 等格式暂不支持（mp4 / mov / webm / mp3 / wav / flac 等常见格式可用）
- Guitar Pro 谱为看谱渲染，不带合成音播放

## 开发与贡献

**贡献政策**：项目处于快速迭代期，欢迎通过 [Issue](https://github.com/HsiaoKang/learning-house/issues) 和
[Discussions](https://github.com/HsiaoKang/learning-house/discussions) 反馈问题与想法；
**暂不接受代码 PR**（为保持迭代速度与授权的灵活性）。想深度参与请先开 Discussion 聊。

自行构建（工具链版本与任务统一由 [mise](https://mise.jdx.dev/) 管理）：

```bash
mise install         # 安装工具链
pnpm install         # 安装依赖
mise run dev         # 开发模式（Vite + Tauri）
mise run build       # 构建安装包
mise run typecheck   # 全仓类型检查
mise tasks           # 查看全部任务（含离线回归工具）
```

发版：提交遵循 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/)，
release-please 自动维护 Release PR，合并即打 tag 并四平台打包上传。
离线回归：`scripts/test-scan.ts`（整理引擎）、`scripts/test-bpm.ts`（节拍识别）、
`scripts/diag-bpm.ts`（真实伴奏诊断）。

## 协议

[AGPL-3.0](LICENSE)：自由使用、修改与分发；基于本项目的衍生作品（包括以网络服务形式提供）必须以相同协议开源。商业授权请通过 Issue 联系作者。
