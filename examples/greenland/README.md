# Why does Greenland look so big?

[观看讲解视频](greenland.mp4) · [英文字幕](greenland.mp4.srt) · [中文研究报告](research/report.md) · [返回作品入口](../index.html)

本例仅制作用户请求的视频，不提供独立交互网页、PNG 或 PPTX。英文 Aria 配音，正常语速，1280×720、30 fps、H.264/AAC，115.733 秒（3472 帧）；字幕已烧录，另附 SRT。

## 解释主线

从格陵兰与非洲的面积反差出发，解释墨卡托投影为什么放大高纬地区，再以局部 60° 示例、球面刚体旋转和 Equal Earth 对照展示投影取舍。非洲约为格陵兰面积的 14 倍，不是轮廓装箱结论；局部四倍面积倍率也不是整片格陵兰的统一系数。

研究采用球面墨卡托模型，有限画面裁去极区。Natural Earth v5.1.2 的 1:110 million 边界是公共领域概化数据，不是精密测量数据；动画中的球面面积不变量与研究所引用的统计面积分别处理。格陵兰官方统计 PDF 正文未成功提取，面积约数的二手来源及局限已在报告中说明。

## 文件与来源

- `greenland.mp4`、`.mp4.json`、`.mp4.srt`：最终视频、原始渲染收据及字幕，逐字节保留。
- `projects/video/`：可编辑视频场景源码、绑定研究副本及本地地理库。内部 HTML 是逐帧渲染源，不是独立交互网页成品。
- `research/`：中文报告、证据台账和研究身份。
- `video-plan.json`、`audio/`：用户批准的完整旁白与原始 Edge TTS 音频。此次直接合成成功，没有导入音频，不创建虚假的 `audio-origin/`。
- `projects/video/assets/resources.json`：Natural Earth 下载地址、版本、原文件哈希及数据许可；D3 相关软件许可随源码保留。
- [验收记录](../../evals/examples/greenland-20260917/publication.json)：源码检查、编码后十四个场景的截图和审阅记录。记录中的原工作路径保留历史含义；当前文件以本目录和总交付清单为准。

研究身份：`8e9e0223136baf3cdbda0811c58bceb201e5098ec28745c2fa808d3f617a30a6`。

## 验收边界

22 秒机制试片已由用户实际听看确认。完整版已完整解码，字幕与批准原文一致，十四个编码后场景中点画面已审阅；源码阶段记录了球面面积不变量与 A→B→A 重放检查。**完整版连续听看仍未确认**；用户要求收录并提交不等于音频听审或理解迁移验收。

## 本地复现

仓库根目录运行 `npm run examples:verify` 可检查全部当前作品身份，不执行作者场景代码。

审阅源码并获得本地执行许可后，可用已有配音离线渲染到新的工作目录：

```powershell
node .\dist\skills\aha-explain\scripts\aha.mjs video-plan-check .\examples\greenland\projects\video .\examples\greenland\video-plan.json
node .\dist\skills\aha-explain\scripts\aha.mjs render-video .\examples\greenland\projects\video .\examples\greenland\video-plan.json .\examples\greenland\audio .\artifacts\greenland-rebuild\greenland.mp4 --approve 0953231d9094642e782ab70a8b8910dac20377b3cd44f8c2adda8050270585b7 --allow-code
```

`--approve` 本身不授予权限。源码或旁白变化会使当前绑定失效；须生成新计划并取得相应批准，不能手改哈希复用录音。离线重渲染不需要重新联网配音。
