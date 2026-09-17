# Aha: researched visual explanations

[观看新版介绍](overview-v5.mp4) · [英文字幕](overview-v5.mp4.srt) · [研究报告](research/report.md) · [作品入口](../index.html)

这版 119.4 秒的英文配音视频采用“总—分—总”：先介绍 Aha，再用格陵兰、CPython 和 Docker 展示可以解释的机制，最后总结研究与媒介的关系。1280×720、30 fps、H.264/AAC，共 3582 帧。

## 三个例子分别说明什么

- **格陵兰：地图外观与真实面积不同。** 沿球面旋转边界，保持球面面积和墨卡托比例尺，观察投影轮廓改变；不是把平面形状直接缩小。
- **CPython：对象内存与编码载荷不同。** 固定 CPython 3.11.15，给长 ASCII 字符串加入 U+1F600，新结果使用四字节码点表示，原字符串不变；UTF-8 载荷只增加四字节。
- **Docker：路径不可见与底层字节消失不同。** 后续删除通过 whiteout 隐藏路径，不改写先前不可变层；同一个 RUN 内创建并删除新临时文件，则最终差异不包含该文件载荷。100 MB 为假定的未压缩载荷，没有执行 Docker 构建。

结尾使用已有 Git 作品的真实静态预览说明格式用途，不把预览当成实时交互、放映或编辑演示，也不暗示这三个独立例子都有四种成品。

## 版本与文件

本组独立收录新版视频，保留[较早的四格式项目导览](../project-overview/README.md)。两者研究快照不同，不混成同一版四格式作品。新请求的介绍图片另作本地候选，此次不替换旧 PNG。

- `overview-v5.mp4`、`.mp4.json`、`.mp4.srt`：修正版视频、原始收据与字幕，保持文件名和字节身份。
- `projects/video/`：可编辑场景、章节过渡、本地资源与绑定研究副本；其中 HTML 是视频源，不是独立网页成品。
- `research/`：重新整合的研究快照，明确区分既有证据复用与新查阅的本地技能文档，没有声称重新执行所有上游调查。
- `video-plan.json`、`audio/`：当前批准计划和离线导入的十三段录音。
- `audio-origin/`：原 Edge TTS 完整计划、成功音频清单和字节映射；`original-scenes.js` 与当前其余源文件可重建原配音绑定的源身份。
- [收录与验收记录](../../evals/examples/aha-introduction-20260917/publication.json)：授权、试片确认、源码预览、实际编码帧以及修正前后的证据。

录音最初使用 `en-US-AriaNeural`、`+0%`。排版修正后，经用户批准离线导入相同 WAV；当前收据如实标为 `provided-audio`，不是再次联网合成。全部波形字节与帧数保持不变。

## 验收边界

用户已完整听看并确认 24.73 秒代表性试片。根据反馈，首页只介绍项目，补足三个案例的过渡，并删除了重复句。完整版编码后发现 Docker 时间线穿过文字；修正版将连接线移到方框之间，实际编码画面已确认该问题消除。

完整解码、批准字幕、音频身份、文字边界及抽样状态重放均有记录。**完整版连续听看仍未确认**，也没有宣称完整逐帧视觉审阅或理解迁移验收；收录和提交授权不替代这些判断。

## 本地复现

`npm run examples:verify` 验证全部当前示例的身份与证据，不执行作者场景。

审阅源码并获得本地执行许可后，使用现有录音离线输出到新目录：

```powershell
node .\dist\skills\aha-explain\scripts\aha.mjs render-video .\examples\aha-introduction\projects\video .\examples\aha-introduction\video-plan.json .\examples\aha-introduction\audio .\artifacts\aha-introduction-rebuild\overview-v5.mp4 --approve b24dea69586c4d895972e2ec5a04eb4e929501d3681b64f23fa73b92107fee98 --allow-code
```

参数不替代权限；修改源码或旁白后须重新准备计划并取得对应批准，不能手改身份复用录音。
