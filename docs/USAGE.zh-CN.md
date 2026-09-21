# Aha 使用与 CLI 工作流

[English](USAGE.md) | [简体中文](USAGE.zh-CN.md) · [文档目录](README.zh-CN.md) · [安装](INSTALL.zh-CN.md) · [参与贡献](../.github/CONTRIBUTING.zh-CN.md)

本指南覆盖研究、以源文件为中心的创作、渲染、权限与验收。先按 [INSTALL](INSTALL.zh-CN.md) 安装完整包；文件安装与真实宿主验收是两回事。

Runtime **0.3.2** 与研究／作品 Schema **1.0.0** 是独立版本线。不支持的协议或命令明确报错，不静默转换数据或删除用户作品。实际发布状态与可下载内容以 [Releases](https://github.com/sawyer0x110/aha/releases) 为准。

## 按交付分工，不按统一模板填空

报告／调查结论用 `aha-research`；视觉交付用 `aha-explain`，包括需要先研究的问题。普通文字问答不升级为研究档案或媒体制作。不假设宿主自动从一个 Skill 调用另一个。

研究档案独立保存结论、证据、报告与身份，不依赖媒体格式。每个媒介有自己的作品源与内容覆盖：

- HTML 可以是图解主导的单屏、比较、交互探索、长文或混合结构，使用表格、SVG、Mermaid 和受离线契约约束的本地交互。
- PNG 按目标尺寸重新构图，不把整篇文章截图作为海报。
- PPTX 使用原生可编辑对象，按解释需要安排页数。
- 视频由作者编写按帧变化的 HTML／SVG／canvas 场景，不循环播放静态卡片。

共用事实，不共用固定布局。Scaffold 是未完成的起点；改变题材或结构不需要给共享 Schema 加题材专属字段。

**只生成请求的格式。**“网页／HTML”对应 HTML，“一图流／海报”对应 PNG，“演示文稿／PPT”对应原生 PPTX，“讲解视频”对应视频；明确说“网页幻灯片”仍是 HTML。已请求视觉解释但未指定格式、场景无明确指向时，默认 HTML 并简短说明；只要文字或研究时不触发这个默认。只询问影响用途、成本或权限的歧义。多格式须明确请求、分别创作。CLI 始终要求一个显式格式，没有 `auto` 或 `all`。详见[格式选择](../skills/aha-explain/references/format-selection.md)。

[视觉设计流程](../skills/aha-explain/references/visual-design.md)与所选[主题配方](../skills/aha-explain/references/design-themes.md)提供编辑式研究、工程图解、证据数据、高对比机制、演示叙事及 Clawpilot 基线等方向。用户／项目品牌优先；Clawpilot 是缺省起点，不是强制审美。这些是原创设计指导，不是复制上游模板或已验收的作品集。

HTML 的 `--cp-*` 是运行时图表／控件的颜色角色，可在作者 CSS 中重新定义。同时处理浅／深色选择器，正文与 Mermaid 字体保持一致。作者可在 `html` 上设置 `data-theme="light"` 或 `"dark"`。有效 `scoutTheme=light|dark` 查询参数优先，其次作者设置，最后系统偏好。不自动添加主题切换界面。

按阶段读取参考：取证时选来源路线，创作时选媒介，构图时读所选主题章节，验收时读完整 QA；不要求启动时加载全部参考。

## 命令路径与准备

**已安装用户：** 从实际加载的 Skill 解析脚本绝对路径，不依赖当前工作目录：

```powershell
node "C:\your-project\.agents\skills\aha-research\scripts\aha.mjs" doctor --for research
node "C:\your-project\.agents\skills\aha-explain\scripts\aha.mjs" doctor --for html
```

**源码 checkout：** 下文使用从仓库根目录运行的 `node .\dist\cli\aha.mjs`，前提是已经完成源码构建。安装用户应将此前缀替换为 `node "<已安装Skill的绝对路径>\scripts\aha.mjs"`。任务输出放在自己获准使用的工作目录。两个 Skill 都带研究 CLI；使用宿主实际加载的那份安装。

PowerShell 使用 Windows 路径，POSIX shell 使用对应正斜杠路径。Windows 已有实际使用；macOS/Linux 未验证，路径示例不构成跨平台支持承诺。

## 1. 先完成复杂调研

```powershell
node .\dist\cli\aha.mjs research-init "这个代码库如何处理请求失败？" ".\artifacts\topic.draft.json" --kind codebase
```

初始化只创建未完成草案，**不执行调研**。`--kind` 接受 `public`、`codebase`、`mixed`、`provided`，应匹配实际使用的材料。按研究工作法实际阅读来源，编写报告、子问题、主张、证据、日志、反证、缺口与真实停止理由。研究语言按请求决定，独立于作品默认值。精确字段见生成的 `schemas\research-draft.schema.json` 和[研究契约](../skills/shared/references/research-contract.md)，不要自行发明字段。

创作途中可运行：

```powershell
node .\dist\cli\aha.mjs research-check ".\artifacts\topic.draft.json" --draft
```

结构正确但尚未完成时返回 `status: "draft-checked"`、`ready: false`、`pending`，不生成快照或内容哈希。未知引用、重复 ID、无效日期／日志／来源元数据及哈希不匹配仍会报错。检查不修改草稿，不能代替最终校验。

[带纠正材料的研究示例](../skills/shared/references/research-example.md)明确使用虚构材料，不是真实研究证据。实际完成并审阅内容后，严格检查并封存新快照：

```powershell
node .\dist\cli\aha.mjs research-check ".\artifacts\topic.draft.json"
node .\dist\cli\aha.mjs research-build ".\artifacts\topic.draft.json" ".\artifacts\topic.research"
node .\dist\cli\aha.mjs research-validate ".\artifacts\topic.research"
```

失败时停止，不继续依赖它的命令。`topic.research` 包含 `manifest.json`、`research.json`、`report.md`；报告必须与研究数据中的报告字符串逐字一致。Manifest 绑定 `schemaVersion`、`researchId`、`contentHash`。可编辑草案放在封存目录之外。不要手改封存报告或哈希；修订草案后构建到新目录。已有作品仍绑定旧研究身份，除非主动重建。

无需实验引擎、场景、slides 或先选模型。`research-check` 检查结构与引用，不搜索、不补证、不证明实际阅读发生，也不授予“事实已验证”认证。宿主 Agent 负责研究和语义回查；CLI 不执行被研究仓库。

## 2. 按媒介编写作品

```powershell
node .\dist\cli\aha.mjs explain-init ".\artifacts\topic.research" html ".\artifacts\topic-html"
```

格式可选 `html`、`image`、`pptx`、`video`。复用前检查研究快照的时效与范围。在新项目中编辑 `artifact.json` 指定的入口，替换占位内容，把覆盖的 Claim ID 映射到作品位置，并记录有理由的省略项。每个主张必须覆盖或明确省略，不能两者兼有。完成后才设为 `authored` 并移除 scaffold 标记。研究快照不随排版修改。

初始化写入 `artifact.json`、`research/` 下的 Dossier 副本，以及 `html/index.html`（HTML／image／video）或 `pptx/main.mjs`。作品 Schema 为 `1.0.0`；`researchHash` 绑定独立 Dossier。源码身份覆盖作者文件和元数据，排除 `research/`、`dist/`、`qa/`；研究另行检查。渲染收据绑定源码、研究与输出哈希，不证明真相或视觉质量。新证据需要新快照与新初始化项目，不替换旧项目的研究、不手改哈希。详见[以源文件为中心的创作](../skills/aha-explain/references/artifact-authoring.md)。

### 媒体语言默认值

语法：`explain-init <research-directory> <html|image|pptx|video> <new-project-directory> [--language en|zh|bilingual]`。

| 新作品 | 未指定语言时 | 显式选项 |
| --- | --- | --- |
| HTML | `bilingual`，初始英语，内置 English/中文切换 | `en`、`zh`、`bilingual` |
| image／pptx／video | `en`，即使问题或研究为中文 | `en`、`zh`；拒绝 `bilingual` |

明确要求中文输出时使用 `--language zh`，不能只因提问语言推断输出偏好。新项目总写入 `artifact.language`。Schema 为兼容旧单源项目允许该字段缺失：缺失不自动转双语，视频声线有效回退为英语。

语言只作用于作品。译文由 Agent 编写；CLI 不翻译／修改绑定的研究档案，也不调用在线翻译服务。

双语 HTML 必须有恰好两个不嵌套的顶层本地化根，各自闭合并包含完整内容：

```html
<section data-aha-lang="en" lang="en" data-aha-title="English title">
  <!-- Complete authored English content -->
</section>
<section data-aha-lang="zh" lang="zh-CN" data-aha-title="中文标题">
  <!-- 完整编写的中文内容 -->
</section>
```

标题、正文、图表、Mermaid 控件／图注、无障碍标签、限制和引用措辞须准确对应。保留证据、Claim ID、单位、否定与不确定性。中性图形／资源可共享，根之外不得遗留未翻译的读者正文；布局仍由作者自由设计。

运行时校验两个分支及标题非空，注入离线按钮，切换 `html lang` 和文档标题，以 `hidden` 加 CSS 隐藏非活动分支及其焦点目标，在 `window` 派发 `aha:languagechange`，`detail.language` 为 `en` 或 `zh`。Mermaid 标签按所在分支／根本地化。不使用 `localStorage`、网络、语言 URL 参数，不推断或保存语言偏好。主题参数独立。单语 HTML 允许且无需双语切换。详见[语言契约](../skills/aha-explain/references/language.md)。

Scaffold 仍是草稿：验收前必须实际编写两种语言。Schema 通过不等于译文认证。真实切换两分支，检查键盘、中文字体、较长英文标签，回查单位、否定、不确定性和引用的一致性。

### 检查与渲染

```powershell
node .\dist\cli\aha.mjs explain-check ".\artifacts\topic-html"
node .\dist\cli\aha.mjs render-html ".\artifacts\topic-html" ".\artifacts\topic.html"
```

HTML 打包不执行脚本，内嵌本地资源与本地 Mermaid，不靠 CDN 兜底。默认交付独立离线文件，不自动把完整研究档案塞进页面。

每种请求的格式单独建立、编写作品源。下列路径代表**已编写好的**项目，不是上面 HTML 初始化命令的产物：

```powershell
# 先审阅作品代码并明确允许执行；--allow-code 不是沙箱。
node .\dist\cli\aha.mjs browser-check ".\artifacts\topic-html" --allow-code
node .\dist\cli\aha.mjs render-image ".\artifacts\topic-image" ".\artifacts\topic.png" --allow-code
node .\dist\cli\aha.mjs render-pptx ".\artifacts\topic-pptx" ".\artifacts\topic.pptx" --allow-code
```

PNG 捕获专门编写的一图流，不截图整篇文章。PPTX 入口接收运行时提供的 PptxGenJS 实例，创建原生文本、形状、图表与页面。成功写出文件，不代表已在演示应用中验证原生可编辑性和每页视觉效果。

## 3. Edge TTS 与动态讲解视频

视频作品定义 `window.ahaVideo.renderFrame({ frame, fps, segmentIndex, segmentFrame, segmentFrames, text })`。运行时按实测音频时长逐帧调用，捕获动态场景并用 FFmpeg 编码。不是 Remotion，也不是循环静态卡片。作者需使用确定性时间计算；工具不会自动让任意作者脚本变成确定性动画。

```powershell
node .\dist\cli\aha.mjs doctor --for video
node .\dist\cli\aha.mjs prepare-video ".\artifacts\topic-video" ".\artifacts\video-plan.json"
node .\dist\cli\aha.mjs video-plan-check ".\artifacts\topic-video" ".\artifacts\video-plan.json"
```

`prepare-video` 创建 `status: "draft"` 的计划。编写 `segments[].text` 完整旁白、逐段来源、声线、语速与目标时长。完成后才将计划改为 `"authored"` 并重新运行 `video-plan-check`。向用户展示完整计划及当前 `planHash`。**只有批准这份准确文本及外发处理后**才执行：

```powershell
node .\dist\cli\aha.mjs synthesize ".\artifacts\topic-video" ".\artifacts\video-plan.json" ".\artifacts\audio-v1" --approve "<已批准的planHash>" --allow-network
node .\dist\cli\aha.mjs render-video ".\artifacts\topic-video" ".\artifacts\video-plan.json" ".\artifacts\audio-v1" ".\artifacts\topic.mp4" --approve "<已批准的planHash>" --allow-code
```

渲染命令另需审阅后的本地代码执行授权。前一步校验或合成失败时停止。

新计划对 `en` 或未声明作品语言使用 `en-US-JennyNeural`，对 `zh` 使用 `zh-CN-XiaoxiaoNeural`。计划显式保存 `voice`，不重写已有作者计划。草稿主张建议不是自动译好的旁白。在线配音固定使用 `edge-tts==7.2.8`，只外发获准旁白与声音参数。用户提供的逐段音频使用 `import-audio` 和明确的 `provided-audio` 提供方，不得冒称在线合成成功。参数见 CLI `help`。

翻译旁白会改变计划哈希：必须重新校验，完整批准当前旁白、提供方、声线、语速与外发范围。烧录字幕和 SRT 来自作者编写的 `segments[].text`，不自动翻译。

输出为 720p30 H.264／AAC，带句级烧录字幕、SRT 与收据。时间来自真实音频；超出批准范围会失败，不偷偷拉伸语速。源码／计划身份不匹配时拒绝直接复用。新计划重新批准，不手改音频哈希。

只改画面、保留旁白时，可在新计划获准后，把旧音频作为 `provided-audio` 重新导入新音频目录。这避免再次联网合成，但不能冒称新一轮 Edge 合成。

先做短小样，再扩展完整版。编码成功不代表听审或视觉通过。在线配音前运行 `doctor --for speech`；它只检查本地工具，不检查服务可用性、不合成。实际在线使用和完整听审仍是单独验收项。

## 只诊断当前步骤

| 命令 | 实际探测的可选工具 |
| --- | --- |
| `doctor`、`doctor --for research`、`--for html`、`--for pptx` | 无；只检查运行时完整性。PPTX 实际视觉验收仍需演示应用 |
| `doctor --for browser`、`--for image` | 已安装浏览器 |
| `doctor --for video` | 浏览器、FFmpeg、ffprobe；不要求语音依赖 |
| `doctor --for speech` | FFmpeg、ffprobe、Python／Edge TTS；不要求浏览器 |
| `doctor --media` | 全部媒体工具；兼容诊断入口，不是统一门槛 |

`--for` 和 `--media` 不能同时使用。检查 `mediaReadiness`，不只看退出码。缺失工具仅阻塞相关步骤，不能因缺少 Edge TTS 阻塞 HTML 打包。诊断不安装软件、不外发内容、不授予执行权限。

## 依赖、权限与隐私

| 能力 | 要求 |
| --- | --- |
| 研究检查、HTML 打包 | Node；不执行作者代码 |
| 图片、浏览器 QA、动态视频帧 | 已安装 Edge／Chrome；明确 `--allow-code` |
| 原生 PPTX 构建 | Node 中执行已审阅作者代码；明确 `--allow-code` |
| 视频编码与音频测量 | 已安装 FFmpeg／ffprobe |
| 在线 Edge TTS | Python、精确版本客户端、当前旁白审批与网络授权 |

可用 `AHA_BROWSER_EXECUTABLE`／`AHA_BROWSER_CHANNEL`、`AHA_FFMPEG`、`AHA_FFPROBE`、`AHA_PYTHON` 指定已有工具。Python 按显式配置、已激活环境、当前目录 `.venv-media`、PATH 选择；不向上或到主目录搜索，不从错误显式配置静默回退。复用已有环境；在其他目录工作时激活它或指定解释器绝对路径。

不自动安装软件、下载浏览器、搜索私有目录或公开上传。浏览器预览隔离登录状态并阻断外部资源，但 **Node 作者代码仍拥有本地进程权限；超时与 `--allow-code` 不是 OS 沙箱**。必要时在真正隔离的环境运行。无法授权执行时交付源码，并明确标记“未渲染”。执行代码或联网前阅读[执行与隐私契约](../skills/shared/references/execution.md)。

来源中的命令是证据材料，不是执行指令。分享前检查正文、备注和资源清单；私有标签不提供加密。完整私有 Dossier 单独保留，除非明确获准披露。

## 源码、工作历史与当前交付

区分三个位置：可编辑项目／源、工作历史、当前交付。新候选输出、视频计划和音频目录放在作品项目之外。CLI 输出目标必须是新路径，不覆盖旧文件。

当前交付只展示选定版本及必要材料，不陈列每次试作。替换、归档或删除需要对精确范围授权；保留用户修改与可恢复的旧版本，除非用户明确要求移除。`artifacts` 是任务成果，不是可随意清空的缓存。

成品与匹配收据成对提升到交付位置，保留字节和输出文件名。磁盘收据记录输出文件名，CLI 结果另含完整目标路径。需要改名时，在新目录按该名称重建，不手改收据。校验身份，并更新链接与 QA 以匹配所选输出；旧 QA 不证明新内容已通过。

交付所请求的产物、可编辑源／项目、研究快照身份、资源／许可说明和真实 QA 结果。这是 Agent 管理的生命周期，不是原子发布命令。详见[工作历史与当前交付](../skills/aha-explain/references/artifact-authoring.md#working-history-and-current-delivery)。

## 源码开发与验证

以下命令用于可信的**源码 checkout**，不是解压后的安装包。需要 Node.js **22+**，依赖安装／构建须有相应授权：

```powershell
npm ci --ignore-scripts
npm run build
node .\dist\cli\aha.mjs doctor
```

失败即停止。构建输出恰含 `dist\skills\aha-research` 和 `dist\skills\aha-explain`。每份包含 CLI、Schema、合并后的共享参考、本地 Mermaid、Playwright 运行库、Aha 许可／范围说明与第三方声明；不带用户研究、作品、浏览器、Python 或 FFmpeg。

`src` 是运行时源码，`skills` 是技能源码，根目录 `scripts` 放构建／发布／安装工具。`docs` 保存人类指南与许可范围，`.github` 保存贡献／安全指南、模板和工作流。`evals` 保存评估工具／用例／记录，`examples` 保存正式作品与可编辑项目／制作工具，`dist` 是可重建分发输出，`artifacts` 是不提交的任务成果。详见[架构／目录导航](ARCHITECTURE.md#仓库目录导航)（中文）。

`node .\scripts\release.mjs` 只本地打包，不上传、不全局注册。授权源码构建、Release 选择、哈希校验、dry-run／apply、冲突、升级、宿主发现和卸载见 [INSTALL](INSTALL.zh-CN.md)。本地构建、版本变化或 tag 推送都不证明发布完成。

完整英中安装指南与双语许可范围从 `docs/` 按原字节、原文件名复制到安装包根目录，并携带根 `LICENSE`。CLI 与新视频收据从 `package.json` 获取运行时版本，不改写封存示例或历史收据。

源码验证命令：

```powershell
npm run typecheck
npm test
npm run test:browser
npm run test:media
```

单元／分发／CLI、浏览器交互、媒体集成分别检查。媒体集成用本地测试音频，不代替真实 Edge TTS 验收或人工听审。PPTX 包内容检查不代替演示应用中的视觉检视。

`npm run eval:prepare -- <参数>` 准备评估输入，不运行模型。`npm run examples:verify` 检查示例身份，不执行作品代码，也不代替浏览器／媒体／人工验收。

最终质量需要把重要断言回查到来源，核对各媒介覆盖，按实际观看尺寸检查版式与交互，并完整播放视频。静态 Skill 文本检查或成功退出码不能证明这些结果。

[评估协议](EVALUATION.md)（中文）固定原始材料和具体代码夹具，分离作者输入与评分答案，在相同条件下比较候选和基线。内容与过程证据分别评分；改写回归不证明主动推理或稳定技能增益。真实读者应解释未展示的新案例并说明理由；缺少真人数据时保持未验证。评估产出单独存放，不污染 `examples` 当前作品集。

## 延伸阅读

- [产品需求](PRD.md)、[架构](ARCHITECTURE.md)、[研究协议](RESEARCH.md)、[评估协议](EVALUATION.md)：现有进阶人类文档，**中文**。
- [示例总览](../examples/README.zh-CN.md)提供英中双语入口。[Aha 项目介绍](../examples/aha-introduction/README.md)为主入口，包含**英中双语 HTML**、**中文 PPTX 与 PNG**，并保留原有**英文视频**。主题说明为中文，各作品分别注明语言与验收限制。
- [参与贡献](../.github/CONTRIBUTING.zh-CN.md)／[English](../.github/CONTRIBUTING.md)、[安全政策](../.github/SECURITY.zh-CN.md)／[English](../.github/SECURITY.md)、[MIT 许可](../LICENSE)及英中双语[许可范围](LICENSE-SCOPE.md)。

历史报告、收据和 Skill 参考按原样保留，不冒称它们已重新翻译或重新验收。
