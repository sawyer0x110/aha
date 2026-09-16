# Aha 项目导览

**Aha 帮助 Agent 调研一个难题，再把解释做成别人能阅读、探索、展示或观看的作品。** 这个例子研究项目本身，分别编写 HTML、PNG、原生 PPTX 和配音视频，而不是把同一份内容自动转换四次。

| 格式 | 当前交付 | 可编辑源 |
| --- | --- | --- |
| HTML | [中英双语交互导览](index.html) | [HTML 项目](projects/html/html/index.html) |
| PNG | [1080 × 1800 一图流](overview.png) | [独立图片构图](projects/image/html/index.html) |
| PPTX | [9 页原生演示](overview.pptx) | [PptxGenJS 作者模块](projects/pptx/pptx/main.mjs) |
| Video | [111 秒、六幕英文配音 MP4](overview.mp4)、[字幕 SRT](overview.mp4.srt) | [逐帧场景](projects/video/html/index.html)、[已批准的完整旁白计划](video-plan.json) |

## 网页与视频讲什么

主线是：**Aha 是什么 → 降噪耳机实例 → Git merge 实例 → 如何调研和创作 → 四种阅读用途 → Aha 总结。** 视频保留深色首尾、浅色正文。实例中的移动红框已删除，改为位置固定的编号阅读提示：说到曲线才强调曲线，说到控件才强调控件；历史和结果同样跟随相应词句。六幕分别包含两个短配音段，避免字幕一次堆积整段讲稿。

## 画面怎样跟随旁白

不再用整段进度的三等分、四等分控制强调。现在用已有原始录音的**词句起点估计**安排 28 个提示，覆盖开场、实例、流程、格式和结尾。Windows 本地英文识别器在已知完整旁白约束下生成时间点；临时 16 kHz 输入只供识别，不改变交付录音。每个提示取该词起点之后的最近视频帧，不按字数或假定语速推算。

例如，在“四种格式”那段录音内部，约 3.00 秒开始说网页、6.19 秒说单张图片、8.42 秒说可编辑幻灯片、11.15 秒说配音视频；卡片在这些时点依次强调。下一段讨论分别创作时，不再继续轮播。波形使用同一录音逐帧测得的能量，不再按固定正弦节奏跳动。结尾的三句总结和三个用途也跟随对应词句。

[词句时间点](provenance/word-timings.json)、[提示表](provenance/cue-sheet.json)和[对齐检查](../../evals/examples/project-overview/alignment.json)保留方法及边界。所有提示均检查切换前一帧、切换帧、后一帧和回放状态；这些检查证明画面遵循估计时间点，**不把自动识别的估计误差当成零，也不等于人工听审通过**。

时间表是本例的作者侧实现，位于视频项目的 `html/narration-timing.js`；没有修改 Aha runtime，也没有新增逐词字幕接口。烧录字幕仍沿用原来的短段字幕。需要重新识别时，可在装有英文桌面识别器的 Windows 上使用 `tools/align-narration.ps1`，只读取指定 WAV 文件，不使用麦克风或联网服务；新时间点仍需重新检查并有意识地更新作品源。

实例来自仓库已经存在的 [降噪耳机 HTML](../anc/index.html) 和 [Git merge HTML](../git-merge/index.html)：前者有理想模型的相位偏差滑块；后者可比较三组预录结果。英文导览与英文视频使用从原页面英文分支离线截取的图片，图例、控件和标题均为英文；中文网页分支保留中文实例。视频展示 ANC 在 60° 偏差下的原始曲线及控件、Git 保存的冲突历史与文件节选。截图不可操作，不是新耳机实测或实时 Git 执行，也不宣称这两个题材已经有独立 PNG、PPTX 或视频成品。

网页的四个格式按钮**同步切换用途说明、右侧预览和图注**：HTML 对应网页截图，PNG 对应完整海报，PPTX 对应实际第 5 页，Video 对应当前视频的开场封面。图片保持原比例；视频预览是静态封面，不是播放器。按钮不是下载链接或格式转换器。哈希、源码更新、权限和质量检查仍在折叠补充中。

## PPT、PNG 与视频的关系

PNG 和 9 页 PPTX 偏向项目结构和实现机制；HTML/video 偏向用户用途和实际例子。它们**不逐页同步，也不是录屏关系**。

PPT 仍采用深色首尾、浅色正文。第 5 页展示上一版网页与海报截图；第 6 页嵌入 [8 秒无声 GIF](motion-preview.gif)。这份 GIF 是保留的实现机制插图，**不是新版视频的预告片**，其独立源在 [motion-preview 项目](projects/motion-preview/html/index.html)。原生文字、形状、表格可编辑；动画图像须修改对应 HTML 后重新生成。静态画布可能只显示首帧，桌面 PowerPoint 的 GIF 放映尚未验证。锁定版本的 PptxGenJS 没有原生转场/动画 API，本例不伪造接口或修改运行时。

## 研究与检查边界

研究固定在提交 `a013ea795312eab9ae2e4224998a1314eea8f718`，对应 runtime `0.3.0`、协议 `1.0.0`，不是对远端状态的持续追踪。

[统一研究](research/report.md)含 10 条主张、13 份证据，同时覆盖项目实现及 ANC/Git 既有作品的使用边界。所有四种作品及 PPT 的 GIF 插图都绑定这一份快照，不再分别维护 `research` 和 `research-v2`。

各项目按运行时契约保留同一研究的完整副本，并在 `artifact.json` 记录覆盖与省略；[身份检查器](../../evals/examples/project-overview/verify.mjs)检查五个项目副本与唯一的 `research/` 完全一致。视频有意省略身份、权限、运行机制、语言默认值和安装分发细节；PNG、PPT 和 GIF 不展开 ANC/Git 个案，因此显式省略该主张。研究报告中保留了撰写时的过程说明，当前作品绑定以元数据和收据为准。

统一时复用了原先较完整的快照，未改动其中事实和证据。HTML/video 的研究及源码身份不变；PNG、PPT 和 GIF 已在新绑定下实际重新生成，未手改收据，见 [统一记录](provenance/consolidation.json)。之后另行修正了 PPT 第 6 页的旧视频关系说明：明确 GIF 是独立插图，不是最终 ANC/Git 配音视频中的场景，见 [PPT 修正记录](provenance/pptx-correction.json)。

[运行记录](../../evals/examples/project-overview/runtime.json)、[分层审阅](../../evals/examples/project-overview/review.json)、[播放记录](../../evals/examples/project-overview/playback.json)分别记录浏览器、内容、编辑及媒体检查。HTML 覆盖中英双语、1280/390px、浅深主题和键盘/鼠标。视频检查六幕 A→B→A 状态与实际字幕覆盖层；重放要求 DOM 一致，允许浏览器缩放截图最多一个 8 位色阶的栅格化差异，并保留具体差异数。像素变化本身不证明解释有帮助。

PPT 的原生编辑检查在独立副本进行，没有修改交付件。**完整人工听审、桌面 PPT 动效播放、独立真人理解和跨机器字体检查未完成**；完整静音播放或解码不能替代这些检查。

## 配音与资源

十二段英文旁白最初经单独批准，通过 `edge-tts==7.2.8`、`en-US-JennyNeural`、`+0%` 实际合成。最终视频经用户批准当前计划后，用 `provided-audio` **离线导入原录音**。原始计划、清单及 WAV 保存在 [音频来源](audio-origin/)，当前 [音频清单](audio/manifest.json)与[视频收据](overview.mp4.json)记录导入绑定。最终成片为 3330 帧、111 秒，1280 × 720、30 fps、H.264/AAC，含烧录字幕和 SRT。导入对齐为其中四段各补了一帧静音；[音频复用记录](../../evals/examples/project-overview/audio-reuse.json)确认原有语音采样完全未变。

截图来自仓库既有案例和本例，不使用下载图库或第三方模板。[英文截图记录](provenance/example-assets.json)保存来源、状态、裁切和图像哈希。字体使用本地系统字体。制作同时使用宿主文档技能、Clawpilot 样式、原生画布等工具，不是 Aha 单独效果的对照试验。在线语音只发送明确获准的旁白及声线参数，不发送研究、源码或截图。其他再分发用途的服务条款仍需使用者自行确认。

## 本地复现

先构建项目、审阅源码并取得本地执行许可。输出到新目录，不覆盖当前成品或旧收据：

```powershell
npm run build
node .\dist\cli\aha.mjs research-validate .\examples\project-overview\research
node .\dist\cli\aha.mjs render-html .\examples\project-overview\projects\html .\artifacts\overview-rebuild\index.html
node .\dist\cli\aha.mjs render-image .\examples\project-overview\projects\image .\artifacts\overview-rebuild\overview.png --allow-code
node .\dist\cli\aha.mjs render-pptx .\examples\project-overview\projects\pptx .\artifacts\overview-rebuild\overview.pptx --allow-code
node --import tsx .\evals\examples\project-overview\check.mjs .\artifacts\overview-rebuild .\artifacts\overview-qa-new --allow-code
node --import tsx .\evals\examples\project-overview\check-alignment.mjs .\examples\project-overview\projects\video .\examples\project-overview\provenance\word-timings.json .\artifacts\overview-alignment-new --allow-code
npm run examples:verify
```

检查器使用已有 Edge，可用 `AHA_BROWSER_CHANNEL` / `AHA_BROWSER_EXECUTABLE` 指定已有浏览器，不下载浏览器。重新生成 PPT 使用的独立无声插图：

```powershell
node --import tsx .\examples\project-overview\tools\make-motion-preview.mjs .\artifacts\overview-motion-new --allow-code
```

修改 GIF 后，有意识地更新 PPT 资源并重新渲染。当前新版视频源码、计划及音频均不变时，另获本地执行许可后可离线重渲染：

```powershell
node .\dist\cli\aha.mjs render-video .\examples\project-overview\projects\video .\examples\project-overview\video-plan.json .\examples\project-overview\audio .\artifacts\overview-rebuild\overview.mp4 --approve 8e7494725ad0e9bd18a2b60ad3cff5cdfeaffef008404dc7c6e9abcc9242fcb1 --allow-code
node .\evals\examples\project-overview\check-playback.mjs .\artifacts\overview-rebuild\overview.mp4 .\artifacts\overview-playback-new.json --allow-code
```

源码或旁白改变时，用 `prepare-video` 创建新绑定并重新检查。在线合成前必须展示完整当前旁白、提供方、声线、语速、外发范围和计划标识并获得批准；`authored` 或命令行参数本身不代表许可。

## 保留内容

本目录保留最终四种作品、PPT 仍在使用的 GIF 插图、必要源码与素材、一份统一研究及运行时要求的相同副本、音频来源、`tools/` 制作工具和 `provenance/` 制作依据。验收工具及最终报告统一位于 [`../../evals/examples/project-overview/`](../../evals/examples/project-overview/)；制作依据中的素材路径仍相对于本示例根目录。`verify.mjs [新报告路径] [示例根目录] [验收目录]` 可显式选择待验证副本，默认验证仓库当前交付。

旧候选、失败计划、调试副本、临时帧和制作环境已清理。原始音频仍是录音来源和时间对齐记录的依据。迁移没有改写研究、成品、收据或历史检查记录；记录中的旧路径是当时的审计位置，当前导航以本页为准。`examples/` 与 `evals/examples/` 各自的 `.gitattributes` 禁止自动换行转换，以保留精确字节。
