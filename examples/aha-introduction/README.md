# Aha：从有依据的研究，到看得懂的解释

[英文视频](aha-introduction.en.mp4) · [中文视频](aha-introduction.zh.mp4) · [英中双语 HTML](aha-introduction.html) · [中文 PPT](aha-introduction.pptx) · [中文信息图](aha-introduction.png)

**这里是项目介绍的主入口。** Aha 通过两个可移植技能分开处理研究与解释创作，由 AI 宿主协调，不是自动串联的生成流水线。

| 格式 | 当前作品 | 可编辑源 |
| --- | --- | --- |
| Video · English | [154.53 秒英文配音](aha-introduction.en.mp4)及[字幕](aha-introduction.en.mp4.srt) | [英文场景](projects/video/en/)、[批准计划](video-plans/en.json) |
| Video · 中文 | [151.07 秒中文配音](aha-introduction.zh.mp4)及[字幕](aha-introduction.zh.mp4.srt) | [中文场景](projects/video/zh/)、[批准计划](video-plans/zh.json) |
| HTML | [英中双语交互介绍](aha-introduction.html)，初始英文 | [HTML 项目](projects/html/) |
| PPTX | [8 页中文原生演示](aha-introduction.pptx) | [PptxGenJS 作者模块](projects/pptx/pptx/main.mjs) |
| PNG | [中文信息图 · 1080×1920](aha-introduction.png)，面向约 390px 宽的滚动阅读 | [独立图片构图](projects/image/) |

## 新版视频结构

1. 项目名字与目的：研究清楚，解释明白。
2. `aha-research`：明确问题与授权来源，围绕假设检查证据和反证，针对关键缺口补查；证据不足就收窄结论。只读、证据诚实、材料指令不构成授权，执行、安装和外发需要相应许可；这些是行为约束，不是操作系统沙箱。研究可以独立交付报告与 Dossier。
3. `aha-explain`：根据目标组织解释，只生成所需格式。HTML 默认英中双语、初始英文；PNG、PPTX 和视频默认英文，可明确要求中文。
4. 四种表达方式：格陵兰 HTML 的实际控件操作、CPython 信息图的总览与细节、ANC 原生幻灯片导出、Docker 原视频的静音片段。分别强调交互探索、并列对照、逐步讲述和随时间变化。
5. 总结与邀请：保留醒目的仓库 URL 和一句“把链接交给你的 Agent，让它帮你安装”，不罗列安装步骤。

视频中的 HTML 是操作录制，不能在 MP4 内交互；PPTX 展示原生页面导出，不是编辑现场。英文版使用英文格陵兰页面，ANC 原始中文幻灯片保留并标明；中文版中的 CPython、Docker 原始英文素材也保留来源说明。两种视频是分别配音的单语作品，不是在播放器中切换语言。

## 研究、源文件与录音

HTML、PPTX 和 PNG 保持原样，继续使用 [9 月 17 日研究快照](research/report.md)，包含格陵兰、CPython 和 Docker 的机制讲解；它们没有随视频重构或重新渲染。两种新版视频共用[更新后的研究快照](research-video/report.md)，补充阅读当前本地技能、研究流程、语言和执行边界文档；机制事实与真实作品素材沿用已有证据，没有重新运行实验。研究报告保留调研时的范围和原语言，其中的生产计划不是当前作品清单。

源文件位于 `projects/<format>/`，视频按 `projects/video/en/`、`projects/video/zh/` 分开。QA 位于 `qa/<format>/`，视频按 `qa/video/en/`、`qa/video/zh/` 分开；不混入作者源目录。所有作品和证据统一索引于[交付清单](../delivery-manifest.json)，不设单独的视频或语言版本收录清单。

`video-plans/en.json`、`video-plans/zh.json` 是当前批准计划。`audio/en/`、`audio/zh/` 保存匹配的 WAV、音频清单和逐段来源。英文录音使用 Edge TTS / `en-US-AriaNeural`，中文使用 `zh-CN-XiaoxiaoNeural`，均为 `+0%`。新旁白经完整审阅和联网许可后生成，四段案例录音保持原字节复用；中文结尾使用单独批准的短录音。最终均经批准离线导入，收据标记 `provided-audio`，不是再次联网合成。QA 中保留必要的原始配音计划及许可，以区分最初合成与中间导入。

## 验收边界

视频具备完整解码、准确的批准字幕与段落时间、音频身份、73 个源状态检查、13 组重放检查、完整静音播放及实际编码抽样画面的记录。**没有实际听审、发音审阅、逐词对齐验证或真人连续观看／理解测试。** 抽样代理视觉审阅不等于每帧验收，嵌入作品的小字也不保证在视频尺寸下全部可读。

其他格式保留各自的浏览器、图片、PowerPoint 导出／副本编辑和视觉观察边界。宿主文档技能、Clawpilot 样式与外部渲染工具参与制作，不是隔离测量 Aha 单独效果的实验。

地图录制所用的 [D3 许可声明](third-party-notices/)继续保留；当前视频源只包含录制图像，不再携带 D3 可执行模块。来源记录中的工具说明描述原始素材的制作过程，第三方权利仍适用[许可范围](../../docs/LICENSE-SCOPE.md)。

## 本地复现

`npm run examples:verify` 检查当前身份与证据，不执行作者场景。审阅源码并取得相应许可后，输出到不存在的新目标，不覆盖当前作品或收据：

```powershell
node .\dist\skills\aha-explain\scripts\aha.mjs video-plan-check .\examples\aha-introduction\projects\video\en .\examples\aha-introduction\video-plans\en.json
node .\dist\skills\aha-explain\scripts\aha.mjs render-video .\examples\aha-introduction\projects\video\en .\examples\aha-introduction\video-plans\en.json .\examples\aha-introduction\audio\en .\artifacts\aha-introduction\runs\rebuild-en-01\outputs\aha-introduction.en.mp4 --approve 44c538dad3508375c390bc4f2c16374cf59ff871755df5cf4f481cca24108cb3 --allow-code
```

中文使用对应 `zh` 路径和计划检查返回的 `planHash`。参数不替代权限；修改源码或旁白后须重新准备计划并取得对应批准，不能手改身份复用录音。
