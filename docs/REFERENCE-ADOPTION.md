# 参考项目与采用边界

Aha 只发布 `aha-research` 和 `aha-explain`。外部项目是方法参考，不是其他已安装 Skill，也不作为产品入口保留。

## 本轮比较依据

2026-09-14 查询上游 HEAD，并读取以下版本的 README／SKILL、仓库目录，以及 visual-explainer 的 quick Schema 与 fact-check 工作流。未运行上游生成流程，未完成所有依赖和素材的许可审计。

| 参考 | 固定版本 | 定位 |
| --- | --- | --- |
| [nicobailon/visual-explainer](https://github.com/nicobailon/visual-explainer) | `7163c3e10660912e0b89e1af465db9f387282b88` | 富文本 HTML 与视觉解释，按需设计参考和可选 quick 模式 |
| [Vincentwei1021/anything2explainer](https://github.com/Vincentwei1021/anything2explainer) | `5b57239578284385c72ebfb2d1fce3ab61a3950a` | 来源研究、旁白、时间轴、分镜、动态镜头、小样与 QC |

## visual-explainer：默认自由创作

依据：[Skill](https://github.com/nicobailon/visual-explainer/blob/7163c3e10660912e0b89e1af465db9f387282b88/plugins/visual-explainer/SKILL.md)、[quick Schema](https://github.com/nicobailon/visual-explainer/blob/7163c3e10660912e0b89e1af465db9f387282b88/plugins/visual-explainer/quick/schema.json)、[fact-check](https://github.com/nicobailon/visual-explainer/blob/7163c3e10660912e0b89e1af465db9f387282b88/plugins/visual-explainer/commands/fact-check.md)。

采用：

- 按内容选择长文、表格、时序、架构、SVG 和交互，不让所有主题适配同款卡片。
- 每幅图表达机制或一个可解释的关系；箭头要有语义，概览和细节分层。
- 作品源是视觉设计的权威来源；结构化元数据用于身份、来源和检查，不取代自由 HTML。
- 本地 Mermaid 配缩放、拖动、展开与键盘操作；断网打开实际验证。
- 从成品关键断言回查研究与来源，必要时重读原文；语义核查不是 Schema 认证。

差异：Aha 独立研究档案与原生 PPTX 直接创作不依赖 HTML 转 PPT；本地依赖内嵌和实际浏览器检查独立实现。没有复制上游视觉模板或将 quick Schema 变成所有媒介的必经协议。

上游标注 MIT；复用实质代码或文本仍需保留许可与归属。当前采用的是高层工作法和内容驱动的美学方法，Aha 的主题配方与实现为独立编写，不要求固定 Clawpilot 外观。

## anything2explainer：制作链而非导出按钮

依据：[Skill](https://github.com/Vincentwei1021/anything2explainer/blob/5b57239578284385c72ebfb2d1fce3ab61a3950a/SKILL.md)、[README](https://github.com/Vincentwei1021/anything2explainer/blob/5b57239578284385c72ebfb2d1fce3ab61a3950a/README.md)。它提供 Remotion 模板、旁白与时间轴、镜头规范、样片和检查脚本，不能概括为普通幻灯片拼接。

采用：

- 先研究和叙事，再制作画面；旁白解释原因，视觉呈现过程和变化。
- 完整文本与配音提供方在合成前审阅，实际音频驱动时间线。
- 先做代表性小样，检查可读性、机制动作、字幕与节奏，再制作成片。
- 保留可重建源、来源和检查记录，用作品与失败对照建立质量标尺。

独立实现：Aha 使用作者编写的浏览器逐帧 HTML／SVG／canvas 与本地 FFmpeg，不声称集成 Remotion 或具备其整套动效库。Edge TTS 配音、句级字幕、音频身份与时长检查是 Aha 自己的工具链。

不照搬特定黑底紫光风格、所有镜头必须持续运动的阈值或大规模多 Agent 制作；静止可服务阅读，动效应表达机制而非装饰。

视觉参考落实在 [设计流程](../skills/aha-explain/references/visual-design.md)与[主题配方](../skills/aha-explain/references/design-themes.md)：借鉴 visual-explainer 的内容驱动布局／主题选择，以及 anything2explainer 的高对比、焦点控制、镜头内机制变化。配方给出可操作的字体、色彩角色与构图建议，但不复制上游提示词、样式文件、图形或素材，也不强制所有作品套用某一种风格。

许可边界：上游 README 标注 PolyForm Noncommercial 1.0.0，商业使用需作者授权；字体另有许可。公开可读不等于可按 MIT 商用复制。Aha 不复制其模板、镜头、提示词正文、脚本或样片素材。

## 其他历史表达参考

以前版本也参考过 ppt-master 的原生可编辑对象与实际演示检查、visual-note-card 的独立单图构图、ELI5 的受众适配。它们不是当前依赖或发布入口，本轮没有重新核验其最新源码。

相关原则保留为 `aha-explain` 内部工作法：内容丰富不等于缩小字体、卡片不等于整页截图、浅显不等于删除限定。真实读者反馈不能由 Agent 自评或静态测试代替。

## 运行依赖与方法参考分开

- Mermaid、parse5、PptxGenJS、TypeBox、Playwright 等实际 JS 依赖按锁定版本构建；发布物保留其及实际打包依赖的第三方声明。
- Mermaid 使用本地打包资源，不从 CDN 加载。其布局和颜色配置不代表上游参考模板已集成。
- 浏览器、FFmpeg／ffprobe、Python／Edge TTS 需用户环境已有或另行明确安装；不随 Skill 包分发。
- `edge-tts==7.2.8` 的 `srt_composer.py` 为 MIT，其余客户端代码为 LGPLv3；Aha 提供自己的适配器与版本要求，不分发 Python 客户端。
- 在线服务条款、声线许可、可用性和私有数据授权不由客户端软件许可代替；每个新旁白版本的外发单独审批。
- 显式允许执行作品代码不是 OS 沙箱；源材料取证不授予被研究仓库的执行权限。

采用效果以 Aha 的真实作品和检查记录判断。文件可生成、源可追溯、事实正确、视觉美观与听众理解是不同层面的结论。
