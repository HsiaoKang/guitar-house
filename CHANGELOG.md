# Changelog

## [0.4.0](https://github.com/HsiaoKang/learning-house/compare/v0.3.0...v0.4.0) (2026-07-11)


### Features

* AI 清单贴回导入体检 + 忽略清单重新识别出口 ([cf756d3](https://github.com/HsiaoKang/learning-house/commit/cf756d31bdd56e8f0fbe88c1a0cc50245cb11bca))
* BPM 等数字输入改用自绘步进控件 ([edc2763](https://github.com/HsiaoKang/learning-house/commit/edc2763d92b8c62b4681f69d8b8b92681214c22c))
* TAP 拍击吸附识别网格，解决 4/3 类节奏歧义 ([bd5c924](https://github.com/HsiaoKang/learning-house/commit/bd5c924ea21176bdf66c6700c402b59676e0aa02))
* 上课页就地关联资料到当前课节 ([b7fc586](https://github.com/HsiaoKang/learning-house/commit/b7fc5860d278b67b5988c0230b275e5658804bd8))
* 伴奏 BPM 自动识别与一键卡点 ([65cb185](https://github.com/HsiaoKang/learning-house/commit/65cb1859d7915a4454bf87d4f86d96a16619193c))
* 伴奏节拍参数持久化 + 课节切换重置节拍器 ([a2ba0c0](https://github.com/HsiaoKang/learning-house/commit/a2ba0c0b17e8cf500c1a1dd8f0967857e51a8e24))
* 原生标题栏跟随应用主题，窗口标题随课程切换 ([65a00dc](https://github.com/HsiaoKang/learning-house/commit/65a00dcd214aba37c2f3e4b038d03bbc52eb3a04))
* 反馈双通道（邮件免登录）+ 自绘 Tooltip 修复悬停提示延迟 ([925381b](https://github.com/HsiaoKang/learning-house/commit/925381bcf412c640bcbe21e8c5239be797aa53d1))
* 应用内反馈入口（预填环境信息的 GitHub Issue） ([917b2f3](https://github.com/HsiaoKang/learning-house/commit/917b2f38049fe7c9cd3d42a0c4e7e428bfdd5650))
* 应用内自动更新（tauri-plugin-updater + GitHub Releases） ([d6b337a](https://github.com/HsiaoKang/learning-house/commit/d6b337a4b3b727e0c3628843e312615002e1a92a))
* 开启跟随伴奏时自动就位节拍参数 ([3fc4928](https://github.com/HsiaoKang/learning-house/commit/3fc4928f287db0b8902ec15c55b1292e1fab1022))
* 拍点检测升级为频谱通量 ODF（essentia 同级特征） ([3be398e](https://github.com/HsiaoKang/learning-house/commit/3be398e9939c082079690d4da9d4e8ef9e74e9e2))
* 文件名 BPM 标注优先 + 切音频复位播放态 + 音频名前置 ([e223b4a](https://github.com/HsiaoKang/learning-house/commit/e223b4a692aa22b9c236c61c209df9e92eb867d5))
* 每拍强弱编辑器（柱高表示强弱，点击循环切换） ([334bdcb](https://github.com/HsiaoKang/learning-house/commit/334bdcbb4becebbdd4af84bbf043075443962913))
* 空格快捷键跟随最近操作的域 ([4454097](https://github.com/HsiaoKang/learning-house/commit/4454097fde75b9d1606167c1752227b9e43c0ec0))
* 管理页课节行直达上课并定位到该课节 ([4cff872](https://github.com/HsiaoKang/learning-house/commit/4cff87290b54ecd045325a49bec05c3e6f1acc14))
* 识别时读取本课节谱面 PDF 的速度标注 ([6f87513](https://github.com/HsiaoKang/learning-house/commit/6f87513d5f728c89ca52b2e69aa9aae258e120c2))
* 课节按视频文件一一对应 + 课节管理页 ([5044b65](https://github.com/HsiaoKang/learning-house/commit/5044b658fd4b10dab3634de49b5c9e7b16c2cdf7))
* 课节管理页资源支持复制到其他课节 ([e1f4084](https://github.com/HsiaoKang/learning-house/commit/e1f40849e3c732dc1e863adc9d25fa4cdd45ec02))
* 课节管理页顺路进入上课 ([6ac08bd](https://github.com/HsiaoKang/learning-house/commit/6ac08bd352ac532b96fa1b82c73211de4e15cd5b))
* 谱面候选按对应可能性排序（同目录优先） ([06ba0e8](https://github.com/HsiaoKang/learning-house/commit/06ba0e8f635d29e62028a6b9059bfb33055eadc2))


### Bug Fixes

* AI 导入可选课程类型 + 卡片右键切换类型 + 联动改开关 ([c2d03bc](https://github.com/HsiaoKang/learning-house/commit/c2d03bc7aa2efd6762d4a5e2f3af8ac4d4ac7979))
* BPM 倍频错判修正（150-&gt;75 类）与网格化首拍定位 ([4dc4322](https://github.com/HsiaoKang/learning-house/commit/4dc4322a45194207632a678da6688874e152af7a))
* Tooltip 快速切换内容不更新 + 音量反馈与图标分级 ([cf9c3cf](https://github.com/HsiaoKang/learning-house/commit/cf9c3cf30366e3428307380f691041b9be681ec0))
* 倍频修正改为结构信号提议+拍速先验裁决 ([b853992](https://github.com/HsiaoKang/learning-house/commit/b85399210835f12fbd262770a736d6093dd06d2e))
* 切换课节重置伴奏进度与播放状态 ([27403c5](https://github.com/HsiaoKang/learning-house/commit/27403c549bdb486df30fab2eb661cc636066baaa))
* 反馈入口权限改用 opener:default，打开失败时弹窗提示 ([1649c01](https://github.com/HsiaoKang/learning-house/commit/1649c01797b34a1cbcaad6d5fb781f81d66ecbe4))
* 媒体快捷键改捕获阶段拦截，修复空格误开课节下拉 ([26483a1](https://github.com/HsiaoKang/learning-house/commit/26483a18f7e0764e491b975d0a649de7b1d81803))
* 弹窗改 flex 居中修复 WKWebView 文字发糊 ([1ad522d](https://github.com/HsiaoKang/learning-house/commit/1ad522d31265eefc674449cab8f145639b8f90b6))
* 用真实伴奏数据校准倍频判别阈值，新增诊断工具 ([d1786dd](https://github.com/HsiaoKang/learning-house/commit/d1786dd6f42f54d248b22a8b5d1c7edec1d1786e))
* 课节内切换伴奏时停止节拍器 ([a3293b3](https://github.com/HsiaoKang/learning-house/commit/a3293b3a0e85c93cee81e340bd15be44e8957f24))
* 谱面标注须通过声学网格交叉验证，防错谱误导 ([f3ae4bd](https://github.com/HsiaoKang/learning-house/commit/f3ae4bdec3142f55faf2b881fcf61a46c9d76d21))
* 首拍识别回溯至能量爬升 50% 时刻，消除系统性偏晚 ([fa87913](https://github.com/HsiaoKang/learning-house/commit/fa87913aa2e140d2496e9fedbc74eb47e6b88745))


### Performance Improvements

* 课程库首屏不再被外接盘 IO 阻塞 ([fc40dab](https://github.com/HsiaoKang/learning-house/commit/fc40dab7cacb16aa352f3f91ce6d286d8b15e6fb))

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
