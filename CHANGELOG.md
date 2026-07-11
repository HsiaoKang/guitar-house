# Changelog

## [0.3.0](https://github.com/HsiaoKang/learning-house/compare/v0.2.0...v0.3.0) (2026-07-11)


### ⚠ BREAKING CHANGES

* UI 栈迁移 shadcn 体系与体验批量升级
* 转型为通用课程管理与上课工具 Learning House

### Features

* toast 组件与重扫提示、PDF 虚拟化、分隔条实时重排 ([0fab00d](https://github.com/HsiaoKang/learning-house/commit/0fab00dba81c1f1010399e0eeb0b83ce7f94f6d7))
* UI 栈迁移 shadcn 体系与体验批量升级 ([8058183](https://github.com/HsiaoKang/learning-house/commit/805818397828251a69e2cc29c5a5b5c909f20c1c))
* UI 样式体系重构（vanilla-extract 主题 + SVG 图标） ([e77518f](https://github.com/HsiaoKang/learning-house/commit/e77518fbab3c61cca717b6980541c41e63ea42bc))
* 主题默认跟随系统外观，支持三态手动切换 ([11ff00d](https://github.com/HsiaoKang/learning-house/commit/11ff00d47e207ac28cf421a2323d167baa8a2c4c))
* 自绘视频控制层与可靠封面渲染 ([9212e19](https://github.com/HsiaoKang/learning-house/commit/9212e198494daf043dbbbbf45e01269a5cf5829c))
* 课程导入支持课节清单、网课结构启发式组课与 AI 整理提示词 ([2b1440d](https://github.com/HsiaoKang/learning-house/commit/2b1440dc2683d2fb67c5da5ee8946e144e8ac06e))
* 转型为通用课程管理与上课工具 Learning House ([c69e3f8](https://github.com/HsiaoKang/learning-house/commit/c69e3f892cb45338eb0a3509f52a9a259b79f9fa))
* 音量收纳为悬浮纵向滑条，倍速触发器去边框 ([9e3d5fd](https://github.com/HsiaoKang/learning-house/commit/9e3d5fd5b93139311d136fe8b972d0e97f5cf5ed))


### Bug Fixes

* fs scope 允许隐藏路径，修复 .learninghouse 目录访问被拒 ([d14cc9c](https://github.com/HsiaoKang/learning-house/commit/d14cc9c477c4ef3f1afb3053a53f2e63a577afe2))
* requireLiteralLeadingDot 移到 fs 插件配置的正确位置 ([7222db0](https://github.com/HsiaoKang/learning-house/commit/7222db03c2c572e94a4b0b64ecb6d8d6d6a08b01))
* WKWebView 视频封面渲染（静音瞬时播放触发首帧上屏） ([a310a79](https://github.com/HsiaoKang/learning-house/commit/a310a79e9451429a764c2758d9b7c7b607dca07d))
* 修正 ui 组件文件名大小写并加 husky pre-push 类型检查 ([1a9a9b7](https://github.com/HsiaoKang/learning-house/commit/1a9a9b786f574efc4b3655195932923c5d7dd77b))
* 全屏切换布局错位——h-screen 改百分比高度链 ([116f545](https://github.com/HsiaoKang/learning-house/commit/116f5451ee41ba8acbe8e49f21eb81b77cafa931))
* 导入流程错误可见化与扫描加载态 ([9885068](https://github.com/HsiaoKang/learning-house/commit/98850686d4ae444951dfaa7228f6535ec15aafc3))
* 控制层鼠标空闲渐隐与全屏态逻辑修正 ([d490db7](https://github.com/HsiaoKang/learning-house/commit/d490db7f8803ae94ab000b6eab7c814b1f1132f5))
* 视频封面预渲染、分割栏拖动性能、课程名清单同步、下一节改文字按钮 ([306a742](https://github.com/HsiaoKang/learning-house/commit/306a742692790d48c114a2d5f11d006c832339d3))
* 窗口级全屏、倍速下拉收纳、分割拖拽内容宽度锁定 ([927c785](https://github.com/HsiaoKang/learning-house/commit/927c7856e9f07003dada7004eafefcc486a549a2))
* 资料区始终适配容器宽度并随窗口变化自动重排 ([cb2873d](https://github.com/HsiaoKang/learning-house/commit/cb2873df19df786aff69b09f1ee036f4077487f5))
* 边界音量快捷键补发事件保证反馈，seek 唤起控制层 ([75bec13](https://github.com/HsiaoKang/learning-house/commit/75bec13925af340336da52f778ce5d0f780c826a))
* 音量浮层百分比预留三字符宽，100 时不再撑宽边缘 ([9c2e652](https://github.com/HsiaoKang/learning-house/commit/9c2e6521e5074c3e48b04a455c24c0a90ed5e3c8))

## [0.2.0](https://github.com/HsiaoKang/guitar-house/compare/v0.1.0...v0.2.0) (2026-07-08)


### Features

* 接入 release-please 语义化自动发版 ([e93e0d5](https://github.com/HsiaoKang/guitar-house/commit/e93e0d544f20144ef0bad08e01a7ebc835333915))
