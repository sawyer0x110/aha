# Why does Greenland look so big?

[7 页中文原生 PPTX](greenland.pptx) · [观看讲解视频](greenland.mp4) · [英文字幕](greenland.mp4.srt) · [中文研究报告](research/report.md) · [返回作品入口](../index.html)

本例提供迭代后技能创作的中文原生 PPTX 与原有视频，不提供独立交互网页或 PNG。PPTX 保留可编辑图表、表格与解释图形；视频为英文 Aria 配音，正常语速，1280×720、30 fps、H.264/AAC，115.733 秒（3472 帧），字幕已烧录，另附 SRT。

## 解释主线

从格陵兰与非洲的面积反差出发，解释墨卡托投影为什么放大高纬地区，再以局部 60° 示例、球面刚体旋转和 Equal Earth 对照展示投影取舍。非洲约为格陵兰面积的 14 倍，不是轮廓装箱结论；局部四倍面积倍率也不是整片格陵兰的统一系数。

研究采用球面墨卡托模型，有限画面裁去极区。Natural Earth v5.1.2 的 1:110 million 边界是公共领域概化数据，不是精密测量数据；动画中的球面面积不变量与研究所引用的统计面积分别处理。格陵兰官方统计 PDF 正文未成功提取，面积约数的二手来源及局限已在报告中说明。

## 文件与来源

- `greenland.mp4`、`.mp4.receipt.json`、`.mp4.srt`：当前视频、匹配收据及字幕。
- `greenland.pptx`、`.pptx.receipt.json`、`projects/pptx/`：当前幻灯片、收据和可编辑作者项目；与视频共用封存研究。当前检查统一位于 `qa/<format>/`，由[交付清单](../delivery-manifest.json)索引。
- `projects/video/`：可编辑视频场景源码、绑定研究副本及本地地理库。内部 HTML 是逐帧渲染源，不是独立交互网页成品。
- `research/`：中文报告、证据台账和研究身份。
- `video-plan.json`、`audio/`：用户批准的完整旁白与直接合成的 Edge TTS 音频，没有虚构的音频导入来源。
- `projects/video/assets/resources.json`：Natural Earth 下载地址、版本、原文件哈希及数据许可；D3 相关软件许可随源码保留。
- [当前 QA](qa/)：源码检查、编码后十四个场景的截图与审阅记录，由统一交付清单绑定当前文件。

研究身份：`8e9e0223136baf3cdbda0811c58bceb201e5098ec28745c2fa808d3f617a30a6`。

## 验收边界

PPTX 的技能来源、当前生成身份、PowerPoint 导出与副本编辑检查见 [PPTX 收录记录](../delivery-manifest.json)。应用检查不代表人工可用性或真人理解；继承的视觉限制仍明确记录。

视频已完整解码，字幕与批准原文一致，十四个编码后场景中点画面已审阅；源码阶段记录了球面面积不变量与 A→B→A 重放检查。**连续听看仍未确认**；收录不等于音频听审或理解迁移验收。

## 本地复现

仓库根目录运行 `npm run examples:verify` 可检查全部当前作品身份，不执行作者场景代码。

审阅源码并获得本地执行许可后，可用已有配音离线渲染到新的工作目录：

```powershell
node .\dist\skills\aha-explain\scripts\aha.mjs video-plan-check .\examples\greenland\projects\video .\examples\greenland\video-plan.json
node .\dist\skills\aha-explain\scripts\aha.mjs render-video .\examples\greenland\projects\video .\examples\greenland\video-plan.json .\examples\greenland\audio .\artifacts\greenland\runs\rebuild-01\outputs\greenland.mp4 --approve 0953231d9094642e782ab70a8b8910dac20377b3cd44f8c2adda8050270585b7 --allow-code
```

`--approve` 本身不授予权限。源码或旁白变化会使当前绑定失效；须生成新计划并取得相应批准，不能手改哈希复用录音。离线重渲染不需要重新联网配音。
