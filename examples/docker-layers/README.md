# Why does Docker keep a deleted file's bytes?

[观看 21.27 秒机制试片](pilot.mp4) · [英文字幕](pilot.mp4.srt) · [英文研究报告](research/report.md) · [返回作品入口](../index.html)

本例仅提供英文配音视频试片：1280×720、30 fps、H.264/AAC，638 帧。先把新文件记录到不可变镜像层，再展示后续删除如何让合并视图中的路径消失、却不改写底层数据；最后对比同一个 RUN 内创建并删除新临时文件。

## 机制与边界

研究包括 Docker 官方文档、固定 OCI layer 规范 `af26a05fba5ee648512f4ea3c9fda1fcc1b6d6dc`，以及 Moby v27.5.1（`4c9b3b011ae4c30145a7b344c870bdda01b454e2`）的 RUN/提交、目录差异与 whiteout 处理代码。经典构建器与回退驱动的源码入口，不等于当前 BuildKit 或本机实际走过的执行路径。

100 MB 是**假定的未压缩文件载荷**，不是实测镜像、压缩传输、缓存或磁盘占用；没有运行 Docker 构建实验。whiteout 只在层剖面中显示，应用后的合并视图不把它作为普通文件暴露。对比针对普通未压平的镜像差异；同一步删除已有基础层文件不能回收该层字节，临时文件消失也不保证整个差异为空。

## 当前文件与来源

- `pilot.mp4`、`.mp4.json`、`.mp4.srt`：当前试片、原始收据和字幕，逐字节保留。
- `projects/video/`：第二轮分镜试测的可编辑 HTML/SVG 场景、旁白与研究副本；不是独立 HTML 成品。
- `research/`、`video-plan.json`、`audio/`：封存研究、新源码绑定的获批 `provided-audio` 计划和离线导入的原录音；三段 WAV 逐字节不变，没有再次联网合成。
- `audio-origin/`：原 Edge TTS 计划、清单、录音身份映射，以及唯一新增的画面限定 `c-base` 关联；关联不是新增的口述文字。
- [当前收录与验收](../../evals/examples/task-video-20260922/publication.json)：新作品身份、授权、实际画面和播放记录。[旧收录记录](../../evals/examples/code-pilots-20260917/publication.json)及[首次失败记录](../../evals/examples/code-pilots-20260917/docker-layers/original-attempt/)保留历史身份，不证明新场景通过。

首次录音自然时长 19.23 秒，低于批准的 20–30 秒范围，未渲染为视频。用户批准补充不可变层说明后的完整旁白，再次合成得到当前 21.27 秒试片；没有补静音或变速凑时长，没有伪造首次成功清单。首次录音原文件留在本地被忽略的制作档案中，收录记录保留其哈希与时长。

原配音使用 `en-US-AriaNeural`、`+0%`；当时仅外发批准旁白和声音设置。当前导入声线标识为 `original-aria-recording`。SVG 为自行绘制，无外部视觉资产。

## 验收与复现

完整解码、静音播放、批准字幕与录音身份、638 帧源码诊断及三次 A→B→A 重放已检查，并审阅实际编码的关键画面与状态切换。互斥标签不再交叉淡入重影；640px 播放宽度下辅助字仍偏小，密度只部分改善。**未进行实际听审、词级同步或真人理解验收**；用户同意收录不替代这些检查。旧版部分静帧读取失败的限制仍保留在旧记录中。

`npm run examples:verify` 检查身份，不执行场景代码。审阅源码并获得本地执行许可后，可用现有录音离线输出到新目录：

```powershell
node .\dist\skills\aha-explain\scripts\aha.mjs render-video .\examples\docker-layers\projects\video .\examples\docker-layers\video-plan.json .\examples\docker-layers\audio .\artifacts\docker-rebuild\pilot.mp4 --approve b7bdeb2e3f8330979ba40a349b2a6175cb0c66cf705b7507ecf6dd2acb44e807 --allow-code
```

参数不替代权限；源码或旁白改变后需新计划与对应批准。
