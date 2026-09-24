# Aha 示例

[English](README.md) | **简体中文**

从 [Aha 项目介绍](aha-introduction/README.md)或[本地作品入口](index.html)开始，共**五组示例、二十一份作品**。项目介绍收录重构后的英文、中文视频，原 HTML、PNG 和 PPTX 保持不变；ANC、格陵兰、CPython 字符串和 Docker 镜像层各有四种格式。五份 PPTX 均为中文。HTML 默认英文，可切换中文；其余四个主题的 PNG 与视频为英文。项目介绍 PNG 和主题说明为中文，研究报告保留原语言。

GitHub 源码预览不会执行交互页面。请下载或克隆仓库后在浏览器中打开 `examples/index.html`；通过链接用本地查看器打开或下载 PNG、PPTX、MP4 和字幕。作品是面向读者的讲解；研究、收据、哈希、批准记录和验收记录是用于核查来源及制作过程的证据，不是另一组作品，也不代表尚未完成的验收已经通过。

| 主题（说明为中文） | HTML | PNG | 原生 PPTX | 配音视频 |
| --- | --- | --- | --- | --- |
| [Aha 项目介绍 · 从这里开始](aha-introduction/README.md) | [英中双语讲解](aha-introduction/aha-introduction.html) | [中文 · 1080×1920](aha-introduction/aha-introduction.png) | [8 页中文](aha-introduction/aha-introduction.pptx) | [英文 · 154.53 秒](aha-introduction/aha-introduction.en.mp4) / [中文 · 151.07 秒](aha-introduction/aha-introduction.zh.mp4) |
| [降噪耳机](anc/README.md) | [双语交互讲解](anc/anc.html) | [1800×1600](anc/anc.png) | [7 页中文](anc/anc.pptx) | [78.53 秒](anc/anc.mp4) |
| [格陵兰与地图投影](greenland/README.md) | [双语交互讲解](greenland/greenland.html) | [1800×1600](greenland/greenland.png) | [7 页中文](greenland/greenland.pptx) | [80.80 秒](greenland/greenland.mp4) |
| [CPython 字符串](cpython-string/README.md) | [双语交互讲解](cpython-string/cpython-string.html) | [1800×1600](cpython-string/cpython-string.png) | [7 页中文](cpython-string/cpython-string.pptx) | [63.23 秒](cpython-string/cpython-string.mp4) |
| [Docker 镜像层](docker-layers/README.md) | [双语交互讲解](docker-layers/docker-layers.html) | [1800×1600](docker-layers/docker-layers.png) | [7 页中文](docker-layers/docker-layers.pptx) | [58.30 秒](docker-layers/docker-layers.mp4) |

新版视频按项目目的、研究方法与边界、Explain 的格式与语言、四个真实媒介案例、简洁安装邀请组织。两种语言共用更新后的研究；未改动的 HTML、PPTX 和 PNG 保留先前快照。HTML 和 PPTX 展开三个案例的机制，独立纵向信息图概括技能分工、媒介选择与关键区别。

四张新信息图面向至少 1200px 宽的桌面／文档阅读，不承诺手机免缩放。未改动的项目介绍纵向信息图面向约 390px 显示宽度的滚动阅读，检查仍绑定在[交付清单](delivery-manifest.json)。

## 当前目录契约

- 每组根目录保留当前作品、配套收据及视频 SRT。单版本视频使用 `video-plan.json`；项目介绍使用 `video-plans/en.json`、`video-plans/zh.json`。
- `projects/<format>/` 保留作者源、元数据、项目内资源和研究副本；QA 位于 `qa/<format>/`，不进入源项目。多语言版本在两种路径后增加 `/en/` 或 `/zh/`。
- `research/` 是共同的封存档案。项目介绍视频使用并列的 `research-video/`；未改动的格式保留原档案。研究范围描述不是当前制作清单。
- `audio/` 保留音频清单、WAV 与来源；项目介绍按 `audio/en/`、`audio/zh/` 分开。四个案例视频使用 Edge TTS Jenny，英文项目介绍使用 Aria，中文使用 Xiaoxiao。当前 `provided-audio` 计划离线导入获批录音，逐段原始合成计划区分新旁白和复用录音，导入不是再次配音。
- 唯一的[交付清单](delivery-manifest.json)使用 `schemaVersion: 2`、`layout: "topic-format-language-v1"`，在 `requestedOutputs[]` 中统一索引二十一份作品的路径、语言、身份、来源和 QA。不另设 PPTX、视频或语言版本收录清单。

各主题成品统一为 `<topic>.html/.png/.pptx/.mp4`，多语言版本使用 `<topic>.<language>.<ext>`；匹配收据为 `<成品文件名>.receipt.json`，视频字幕为 `<成品文件名>.srt`。`examples/index.html` 仅作总入口。收据与 QA 直接引用当前文件，元数据哈希同步更新；不保留迁移映射、旧收录清单或历史档案依赖。`evals/examples/` 只放可复用检查工具。维护元数据不代表重新生成或重新验收作品。工作目录规则见[统一输出布局](../skills/shared/references/output-layout.md)。

`examples` 是当前作品集，不并列保存基线／候选版本。作品应连同匹配的源码、资源、收据和适用 QA 一起替换，不将旧版对照、失败日志与旧作品副本带入当前交付。重新生成不等于重新调研。

## 内容与验收边界

ANC 展示同一位置的理想声压叠加，不是耳机实测、分贝或感知响度；语音仍有可辨线索，不意味着任何耳机都不能削弱语音。

项目介绍未改动的 HTML、PNG 和 PPTX 保留 9 月 17 日研究；新版视频补充调查当前本地技能、研究流程、语言及执行边界文档，机制证据与真实作品素材沿用已有结果，没有重新执行实验。宿主文档技能、Clawpilot 样式及外部媒体工具也参与制作，不能视为 Aha 单独效果的对照实验。

格陵兰例子以球面墨卡托解释高纬放大，使用真实概化边界的球面刚体旋转而非二维缩放。局部 60° 的四倍面积倍率不代表整片格陵兰；Equal Earth 保面积不等于保所有形状。详细来源与官方统计正文未核验的边界见该例研究报告。

CPython 示例对比特定 CPython 3.11.15 字符串对象大小与 UTF-8 载荷；U+1F600 使新结果使用四字节码点表示，不改变原字符串，也不是任何 emoji 或 Python 实现都适用。Docker 的 100 MB 为假定载荷，没有执行构建；删除后的合并视图与不可变层数据必须区分，同 RUN 对比只针对新建的临时文件。

当前 PPTX 记录把原生结构、PowerPoint 导出／副本编辑检查与有限 agent 视觉观察分开，局部标点换行问题仍如实记录。视频检查包括完整解码、精确字幕、静音播放和编码画面抽样；**实际听审及真人连续观看仍未确认**。真人理解、独立人工翻译、手机真机和读屏器验收未完成。

## 许可与第三方边界

本仓库原创源代码按 [MIT 许可证](../LICENSE)提供，具体适用范围与排除项见[许可范围](../docs/LICENSE-SCOPE.md)。这不是对整个示例目录的统一重新授权：上游文件及摘录、第三方资料、语音服务及录音的权利和字体许可不因此变成 MIT；须分别遵守其原有许可、归属要求和服务条款。收据、来源记录或能够本地查看作品，本身不授予这些第三方权利。

## 本地复现

身份检查不执行作者代码：

```powershell
npm run build
npm run examples:verify
```

统一检查器验证二十一份作品、语言版本路径、各作品实际研究副本、当前收据文件名和哈希、音频、录音来源、批准计划、原生对象编辑、浏览器观察与抽样画面。所有 QA 位于各主题 `qa/<format>/`，不依赖旧档案；回归用例拒绝陈旧身份及重新封存的错误证据。阅读预览和抽样画面不代表真人验收，辅助标签可能需要大于 640px 的播放器；实际听审与真人理解未验证。

审阅四个重新生成的页面并获得本地执行许可后，可将新浏览器结果另存到一个尚不存在的目录：

```powershell
node .\evals\examples\check-html.mjs --allow-code --output artifacts\examples-browser-new --screenshots
```

以 ANC 为例，重新输出到新目录，不覆盖当前作品或收据。PNG／PPT／视频执行前须审阅作者源码并另获本地执行许可：

```powershell
node .\dist\cli\aha.mjs render-html .\examples\anc\projects\html .\artifacts\anc\runs\rebuild-01\outputs\anc.html
node .\dist\cli\aha.mjs render-image .\examples\anc\projects\image .\artifacts\anc\runs\rebuild-01\outputs\anc.png --allow-code
node .\dist\cli\aha.mjs render-pptx .\examples\anc\projects\pptx .\artifacts\anc\runs\rebuild-01\outputs\anc.pptx --allow-code
node .\dist\cli\aha.mjs video-plan-check .\examples\anc\projects\video .\examples\anc\video-plan.json
```

源码、旁白和研究绑定不变时，按检查结果的当前 `planHash` 与当前 `audio/` 可离线重渲染视频。代码或文字变动需新计划与相应批准；命令行 `--approve` 不是授权本身。在线配音必须单独展示完整旁白、提供方、声线、语速及外发范围并取得批准。

Windows 上可将固定媒体环境放在 `%LOCALAPPDATA%\Aha\media-venv`，安装仓库锁定的 `requirements-media.txt`，将用户级 `AHA_PYTHON` 指向其 `Scripts\python.exe`。已有环境直接复用，不因更换 worktree 或清理制作中间结果而删除；新进程才自动继承更新后的用户环境变量。不把机器环境提交到仓库。

`examples/.gitattributes` 和 `evals/examples/.gitattributes` 禁止自动换行转换，避免 Windows checkout 改变研究、源码、作品和验收记录的精确字节。
