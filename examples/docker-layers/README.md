# Why does Docker keep a deleted file's bytes?

[观看 21.27 秒机制试片](pilot.mp4) · [英文字幕](pilot.mp4.srt) · [英文研究报告](research/report.md) · [返回作品入口](../index.html)

本例仅提供英文配音视频试片：1280×720、30 fps、H.264/AAC，638 帧。先把新文件记录到不可变镜像层，再展示后续删除如何让合并视图中的路径消失、却不改写底层数据；最后对比同一个 RUN 内创建并删除新临时文件。

## 机制与边界

研究包括 Docker 官方文档、固定 OCI layer 规范 `af26a05fba5ee648512f4ea3c9fda1fcc1b6d6dc`，以及 Moby v27.5.1（`4c9b3b011ae4c30145a7b344c870bdda01b454e2`）的 RUN/提交、目录差异与 whiteout 处理代码。经典构建器与回退驱动的源码入口，不等于当前 BuildKit 或本机实际走过的执行路径。

100 MB 是**假定的未压缩文件载荷**，不是实测镜像、压缩传输、缓存或磁盘占用；没有运行 Docker 构建实验。whiteout 只在层剖面中显示，应用后的合并视图不把它作为普通文件暴露。对比针对普通未压平的镜像差异；同一步删除已有基础层文件不能回收该层字节，临时文件消失也不保证整个差异为空。

## 当前文件与来源

- `pilot.mp4`、`.mp4.json`、`.mp4.srt`：当前试片、原始收据和字幕，逐字节保留。
- `projects/video/`：可编辑 HTML/SVG 场景、资源说明及研究副本；不是独立 HTML 成品。
- `research/`、`video-plan.json`、`audio/`：封存研究、修订后批准的完整旁白和直接 Edge TTS 录音。
- [本轮收录与验收](../../evals/examples/code-pilots-20260917/publication.json)：身份、授权、预览和编码记录；[首次失败记录](../../evals/examples/code-pilots-20260917/docker-layers/original-attempt/)与当前成功结果分开。

首次录音自然时长 19.23 秒，低于批准的 20–30 秒范围，未渲染为视频。用户批准补充不可变层说明后的完整旁白，再次合成得到当前 21.27 秒试片；没有补静音或变速凑时长，没有伪造首次成功清单。首次录音原文件留在本地被忽略的制作档案中，收录记录保留其哈希与时长。

配音使用 `en-US-AriaNeural`、`+0%`；仅外发批准旁白和声音设置。SVG 为自行绘制，无外部视觉资产。

## 验收与复现

完整解码、批准字幕文字及时间、抽样状态与 A→B→A 重放、文字边界已检查。部分静帧读取失败，视觉覆盖不完整；**收录不等于连续听看或理解验收**。

`npm run examples:verify` 检查身份，不执行场景代码。审阅源码并获得本地执行许可后，可用现有录音离线输出到新目录：

```powershell
node .\dist\skills\aha-explain\scripts\aha.mjs render-video .\examples\docker-layers\projects\video .\examples\docker-layers\video-plan.json .\examples\docker-layers\audio .\artifacts\docker-rebuild\pilot.mp4 --approve e4c928b388b1f3274478a2d03d36890a8fc5850bd9ebe0303522ba2f363e4319 --allow-code
```

参数不替代权限；源码或旁白改变后需新计划与对应批准。
