# Aha：从有依据的研究，到看得懂的解释

[打开英中双语介绍](aha-introduction.html) · [中文 PPT](aha-introduction.pptx) · [中文信息图](aha-introduction.png) · [英文视频](aha-introduction.mp4) · [研究报告](research/report.md)

**这里是项目介绍的主入口。** Aha 通过两个可移植技能分开处理研究与解释创作，由宿主协调，不是自动串联的生成流水线。先说明项目与分工，再用格陵兰、CPython 和 Docker 展示怎样把有依据的主张解释清楚。

| 格式 | 当前作品 | 可编辑源 |
| --- | --- | --- |
| HTML | [英中双语交互介绍](aha-introduction.html)，初始英文 | [HTML 项目](projects/html/) |
| PPTX | [8 页中文原生演示](aha-introduction.pptx) | [PptxGenJS 作者模块](projects/pptx/pptx/main.mjs) |
| PNG | [中文信息图 · 1080×1920](aha-introduction.png)，面向约 390px 宽的滚动阅读 | [独立图片构图](projects/image/) |
| Video | [119.4 秒英文配音](aha-introduction.mp4)及[字幕](aha-introduction.mp4.srt) | [逐帧场景](projects/video/)、[旁白计划](video-plan.json) |

HTML、PPTX 与 PNG 根据当前 `aha-explain` 指导分别创作，不是将网页截图复用成所有格式。PPT 使用原生文字、形状、表格与图表；PNG 是精简的项目介绍，不展开完整数值推导。四种媒介共用本目录 2026-09-17 的研究快照，不代表对当前代码重新调研或重新执行案例实验。宿主文档技能、Clawpilot 样式与外部渲染工具也参与制作，不是 Aha 单独效果的实验。

## 三个例子分别说明什么

- **格陵兰：地图外观与真实面积不同。** 沿球面旋转边界，保持球面面积和墨卡托比例尺，观察投影轮廓改变；不是把平面形状直接缩小。
- **CPython：对象内存与编码载荷不同。** 固定 CPython 3.11.15，给长 ASCII 字符串加入 U+1F600，新结果使用四字节码点表示，原字符串不变；UTF-8 载荷只增加四字节。
- **Docker：路径不可见与底层字节消失不同。** 后续删除通过 whiteout 隐藏路径，不改写先前不可变层；同一个 RUN 内创建并删除新临时文件，则最终差异不包含该文件载荷。100 MB 为假定的未压缩载荷，没有执行 Docker 构建。

原有视频结尾使用已有 Git 作品的真实静态预览说明格式用途，不把预览当成实时交互、放映或编辑演示。新格式也不暗示这三个独立案例都已有四种成品；研究中的作品库存是当时的历史状态，当前文件以[交付清单](../delivery-manifest.json)为准。

## 当前文件

当前格式与身份以本目录和交付清单为准。研究快照提供事实依据，不充当实时作品清单。

- `aha-introduction.html`、`aha-introduction.pptx`、`aha-introduction.png` 及各自 `.receipt.json`：新媒介成品与真实渲染收据。
- `projects/html/`、`projects/pptx/`、`projects/image/`：各自源文件、研究副本与制作意图。当前 QA 集中到 `qa/<format>/`，其中观察另行绑定成品哈希。
- `aha-introduction.mp4`、`.mp4.receipt.json`、`.mp4.srt`：视频、匹配收据与字幕。
- `projects/video/`：可编辑场景、章节过渡、本地资源与绑定研究副本；其中 HTML 是视频源，不是独立网页成品。
- `research/`：重新整合的研究快照，明确区分既有证据复用与新查阅的本地技能文档，没有声称重新执行所有上游调查。
- `video-plan.json`、`audio/`：当前批准计划和离线导入的十三段录音。
- `audio/provenance.json`：Edge TTS 录音的提供方、声音参数、旁白文字与 WAV 身份。
- [统一交付清单](../delivery-manifest.json)与[当前 QA](qa/)：全部格式的来源、身份、实际观察与未完成项。

录音最初使用 `en-US-AriaNeural`、`+0%`。排版修正后，经用户批准离线导入相同 WAV；当前收据如实标为 `provided-audio`，不是再次联网合成。全部波形字节与帧数保持不变。

## 验收边界

新格式将事实和语言审读、浏览器行为、图片视觉检查、PowerPoint 打开／导出／副本编辑分别记录。渲染成功与原生对象数量不证明视觉质量，代理视觉审阅不等于真人理解、人工翻译或手工编辑易用性验收。具体观察以对应成品身份的收录记录为准。

首页先介绍项目，三个案例各有明确过渡。Docker 时间线连接线位于方框之间；实际编码画面的观察见当前 QA。

完整解码、批准字幕、音频身份、文字边界及抽样状态重放均有记录。**完整版连续听看仍未确认**，也没有宣称完整逐帧视觉审阅或理解迁移验收；收录和提交授权不替代这些判断。

## 本地复现

`npm run examples:verify` 验证全部当前示例的身份与证据，不执行作者场景。

先审阅源码并获得相应执行许可，再输出到不存在的新目标；不覆盖当前成品与收据：

```powershell
node .\dist\skills\aha-explain\scripts\aha.mjs render-html .\examples\aha-introduction\projects\html .\artifacts\aha-introduction\runs\rebuild-01\outputs\aha-introduction.html
node .\dist\skills\aha-explain\scripts\aha.mjs render-pptx .\examples\aha-introduction\projects\pptx .\artifacts\aha-introduction\runs\rebuild-01\outputs\aha-introduction.pptx --allow-code
node .\dist\skills\aha-explain\scripts\aha.mjs render-image .\examples\aha-introduction\projects\image .\artifacts\aha-introduction\runs\rebuild-01\outputs\aha-introduction.png --allow-code
```

审阅源码并获得本地执行许可后，使用现有录音离线输出到新目录：

```powershell
node .\dist\skills\aha-explain\scripts\aha.mjs render-video .\examples\aha-introduction\projects\video .\examples\aha-introduction\video-plan.json .\examples\aha-introduction\audio .\artifacts\aha-introduction\runs\rebuild-01\outputs\aha-introduction.mp4 --approve b24dea69586c4d895972e2ec5a04eb4e929501d3681b64f23fa73b92107fee98 --allow-code
```

参数不替代权限；修改源码或旁白后须重新准备计划并取得对应批准，不能手改身份复用录音。
