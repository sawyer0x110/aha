# Aha! · 原来如此

深入研究一个开放问题或代码库问题，再自由设计它的表达。

**只有两个 Skill：**

| Skill | 职责 | 交付 |
| --- | --- | --- |
| `aha-research` | 分解复杂问题、实际取证、多轮补查、反证与综合判断 | 独立研究档案、报告、来源与缺口 |
| `aha-explain` | 内容策划、媒介设计、编写作品源、渲染与检查 | 富文本 HTML／Mermaid／交互图、一图流 PNG、原生 PPTX、Edge TTS 视频 |

runtime **0.3.0**，研究与作品协议 **1.0.0**。研究独立于媒体格式，不要求先选模型、建立实验或编写 slides。不支持的协议或命令明确报错，不自动转换或删除用户数据。

产品需求见 [PRD](docs/PRD.md)，实现与许可边界见 [架构说明](docs/ARCHITECTURE.md)，研究工作法见 [研究协议](docs/RESEARCH.md)，技能效果验证见 [评估协议](docs/EVALUATION.md)。

实际案例见 [examples](examples/README.md)：降噪耳机、Git merge 和 [Aha 项目导览](examples/project-overview/README.md)分别提供双语交互 HTML、PNG、原生 PPTX 和英文配音视频；[格陵兰与地图投影](examples/greenland/README.md)专注 1 分 56 秒的动态视频，共四个主题、十三份作品。每例只生成请求的格式，保留匹配的研究、可编辑源、收据与音频来源；完整视频听看与附加 PPT 动画放映的未确认边界单独记录。

## 安装到你的 Agent

**从 [Releases](https://github.com/sawyer0x110/aha/releases) 获取完整安装包，按 [INSTALL.md](INSTALL.md) 安装。** 统一推荐项目级 `.agents\skills`，不限定 Agent 品牌，需要 Node.js 22+；接收方无需 `npm install`。源码 `skills` 目录不是可直接安装的包。

也可以将 [安装指南链接](https://github.com/sawyer0x110/aha/blob/main/INSTALL.md) 交给 Agent，要求它确认宿主与安装授权，下载校验、预检安装，再检查宿主发现与最小任务。若尚无正式 Release，指南提供经授权的源码构建路线；不将未发布的包或未执行的宿主验收标为可用／通过。

## 自由创作，不是填写统一卡片

研究档案保存结论、证据、报告与身份。每个媒介有独立作品源和内容覆盖：HTML 可以是图解主导的单屏、比较、交互探索、长文或混合结构，使用表格、SVG、Mermaid 和受离线契约约束的本地交互；不默认要求写成长文章。图片按目标尺寸重新构图；PPTX 使用原生对象；视频由作者编写按帧变化的 HTML／SVG／canvas 场景。

共用事实，不共用固定布局。模板只是待编写的起点，未经编写的 scaffold 不会被当成完成作品。改变结构不需要给共享 Schema 增加一个题材专属字段。

**格式按请求选择，不默认全生成。**“网页／HTML”对应 HTML，“一图流／海报”对应 PNG，“PPT／演示文稿”对应原生 PPTX，“讲解视频”对应视频；明确说“网页幻灯片”则仍是 HTML。已请求视觉解释但没指定格式、场景也没有明确指向时，默认 HTML 并简短说明；只要文字回答或调研时不启动这个默认。只有影响用途、成本或权限的歧义才询问。多格式须明确请求，每种分别创作；CLI 仍需显式传入单个格式，没有 `auto`／`all` 参数。详见 [格式选择](skills/aha-explain/references/format-selection.md)。

**主题可借鉴，不强制固定。**[视觉设计流程](skills/aha-explain/references/visual-design.md)与[主题配方](skills/aha-explain/references/design-themes.md)提供编辑式研究、工程图解、证据数据、高对比动态机制、演示叙事及 Clawpilot 基线等方向，包含配色、字体、构图、适用场景与跨媒介调整。优先遵循用户／项目品牌；Clawpilot 只是缺省起点，不要求所有主题长得一样。这些是原创设计指导，不是复制上游模板或已验收的作品集。

HTML 的 `--cp-*` 是运行时图表与控件的颜色角色，可在作者 CSS 中重新定义；同时处理浅／深色选择器，正文和 Mermaid 字体保持一致。作者可在 `html` 上设置 `data-theme="light"` 或 `"dark"` 固定初始模式；有效 `scoutTheme=light|dark` 查询参数优先，其次作者设置，最后系统偏好。不自动添加主题切换界面。

工具检查结构、引用、版本、资源和产物；宿主 Agent 负责实际研究与内容设计。CLI 不内置联网搜索，不证明来源支持每句结论，也不执行被研究仓库。

两个入口按最终交付分工：报告／调查结论用 `aha-research`；视觉作品用 `aha-explain`，它按需完成前置研究。普通文字问答不升级为研究档案或媒体制作。参考按阶段读取：取证时选来源路线，创作时选媒介，构图时选主题章节，验收时读取 QA；不要求一开始加载所有参考。

## 开发与发布

目录按用途组织：`src` 是运行时源码，`skills` 是技能源码；根目录 `scripts` 只放构建、发布和安装工具。`evals` 就近保存评估工具、用例和验收记录，`examples` 保存正式作品、可编辑项目与专用制作工具。`dist` 是可重建的分发输出，`artifacts` 是不提交的任务工作结果，不可当作缓存随意清空。完整职责见[仓库目录导航](docs/ARCHITECTURE.md#仓库目录导航)。

技能评估准备入口为 `npm run eval:prepare -- <参数>`；当前示例的身份检查入口为 `npm run examples:verify`。前者不运行模型，后者不执行作品代码，也不代替浏览器、媒体或人工验收。

需要 Node.js **22+**：

```powershell
npm ci --ignore-scripts
npm run build
node .\dist\cli\aha.mjs doctor
```

构建输出恰含 `dist\skills\aha-research` 与 `dist\skills\aha-explain`。每份独立携带 CLI、Schema、共享参考、本地 Mermaid 资源、Playwright 运行库与第三方许可；不携带用户研究、作品、浏览器、Python 或 FFmpeg。

```powershell
node .\scripts\release.mjs
```

发布器生成版本化 ZIP、清单、SHA256 和安装指南，不上传或全局注册。接收方解压到新目录，检查哈希后运行：

```powershell
node .\install-skills.mjs --project "C:\你的项目"
node .\install-skills.mjs --project "C:\你的项目" --apply
```

默认 dry-run，统一安装到项目 `.agents\skills`；无需指定宿主，可选 `--host` 仅记录任意非空宿主标签，不改变路径。安装流程的宿主案例覆盖 Copilot／Codex，不代表已完成真实宿主验收；其他 Agent 自行判断发现路径与执行能力。不覆盖现有安装；发现其他发现目录中的同名 Skill 或 `.github`／`.agents`／`.claude` 中的旧 Aha 入口会拒绝并提示先审阅移走，不自动删除用户目录。

源码 `skills` 不是完整安装包。安装后从任何作品目录调用：

```powershell
node "C:\你的项目\.agents\skills\aha-explain\scripts\aha.mjs" doctor
```

POSIX 使用对应正斜杠路径。文件安装、哈希与 doctor 不等于真实宿主发现或自然语言触发，需在目标宿主单独确认。

## 1. 先完成复杂调研

下面以仓库开发入口示例；安装后把 `node .\dist\cli\aha.mjs` 替换为已安装 Skill 的绝对脚本路径。

```powershell
node .\dist\cli\aha.mjs research-init "这个代码库如何处理请求失败？" ".\artifacts\topic.draft.json" --kind codebase
```

这只创建未完成草案，不执行任何调研。按 `aha-research` 工作法实际读取材料，编辑草案的报告、子问题、主张、来源、日志、反证、缺口与停止理由。精确字段以构建生成的 `schemas\research-draft.schema.json` 和 Skill 参考为准。

研究中可运行以下检查；结构正确但尚未完成时返回 `draft-checked`、`ready: false` 和 `pending`，不生成快照或哈希。未知引用、重复 ID、错误日期／日志／来源元数据和不匹配的哈希仍会报错。它不会修改草稿，也不能代替最终检查。

```powershell
node .\dist\cli\aha.mjs research-check ".\artifacts\topic.draft.json" --draft
```

完整操作示例见[带纠正材料的研究案例](skills/shared/references/research-example.md)，明确使用虚构材料，不冒充真实调研。完成内容后执行严格检查与封存：

```powershell
node .\dist\cli\aha.mjs research-check ".\artifacts\topic.draft.json"
node .\dist\cli\aha.mjs research-build ".\artifacts\topic.draft.json" ".\artifacts\topic.research"
node .\dist\cli\aha.mjs research-validate ".\artifacts\topic.research"
```

`topic.research` 是独立研究目录，包含可读报告与版本绑定的数据。无需实验引擎、场景或 slides。`research-check` 不搜索、不补证，也不授予“事实已验证”认证。

## 2. 按媒介编写作品

```powershell
node .\dist\cli\aha.mjs explain-init ".\artifacts\topic.research" html ".\artifacts\topic-html"
```

格式可选 `html`、`image`、`pptx`、`video`。在新作品目录编辑 `artifact.json` 指定的入口源；替换占位内容，填写所覆盖 Claim 的位置映射和有理由的省略项，再设为 `authored`。研究快照不随排版被修改。

语言参数语法为 `explain-init <research-directory> <html|image|pptx|video> <new-project-directory> [--language en|zh|bilingual]`：

| 新作品 | 未指定语言时 | 显式语言 |
| --- | --- | --- |
| HTML | `bilingual`，初始英语，内置 English/中文切换按钮 | `en`、`zh`、`bilingual` |
| image／pptx／video | `en`，即使问题或研究为中文 | `en`、`zh`；拒绝 `bilingual` |

明确要求中文输出时使用 `--language zh`，不能仅因提问语言推断输出偏好。新项目总写入 `artifact.language`；协议允许该字段缺失，此时保留单源行为，不自动转为双语，视频声线有效回退为英语。语言只作用于作品：由 Agent 编写译文，不翻译／修改绑定的研究档案，也不调用在线自动翻译。

双语 HTML 必须编写恰好两个不嵌套的顶层本地化根：`<section data-aha-lang="en" lang="en" data-aha-title="English title">` 和 `<section data-aha-lang="zh" lang="zh-CN" data-aha-title="中文标题">`，各自闭合并包含完整内容。标题、正文、图表、Mermaid 控件／图注、无障碍标签、限制和引用措辞须准确对应，保留证据、Claim ID、单位、否定与不确定性。可共享中性图形／资源，根之外不得遗留未翻译的读者正文；布局和样式仍由作者自由设计。

运行时校验两个分支非空及其标题，注入离线按钮，切换 `html lang` 和文档标题，以 `hidden` 加 CSS 隐藏非活动分支及其焦点目标，并在 `window` 派发 `aha:languagechange`（`detail.language` 为 `en` 或 `zh`）供作者交互选用。Mermaid 运行时标签按所在分支／根本地化。不使用 `localStorage`、网络或语言 URL 参数，不推断／保存语言偏好；主题参数与语言无关。单语 HTML 允许且无需双语切换。详见 [语言契约](skills/aha-explain/references/language.md)。

新 scaffold 仍是草稿，双语作品必须实际编写两种语言内容后再验收；Schema 通过不等于译文认证。双语作品需真实切换并检查两分支、键盘、中文字体和较长英文标签，并回查单位、否定、不确定性及引用是否一致。

```powershell
node .\dist\cli\aha.mjs explain-check ".\artifacts\topic-html"
node .\dist\cli\aha.mjs render-html ".\artifacts\topic-html" ".\artifacts\topic.html"
```

HTML 打包不执行脚本；支持本地资源内嵌和本地 Mermaid，不靠 CDN 兜底。默认交付独立离线文件，不将完整研究档案自动塞进页面。

每种格式单独建立并编写作品源；下面的目录分别代表已经编写好的对应项目：

```powershell
# 先审阅作品代码并明确允许执行；--allow-code 不是沙箱：
node .\dist\cli\aha.mjs browser-check ".\artifacts\topic-html" --allow-code
node .\dist\cli\aha.mjs render-image ".\artifacts\topic-image" ".\artifacts\topic.png" --allow-code
node .\dist\cli\aha.mjs render-pptx ".\artifacts\topic-pptx" ".\artifacts\topic.pptx" --allow-code
```

PNG 捕获专门编写的一图流，不截图整个文章作为海报。PPTX 入口接收随运行时提供的 PptxGenJS 实例，自由添加文本、形状、图表与页面，按内容需要安排页数；不能把“写出了 PPTX”当作原生编辑和逐页视觉都已验收。

## 3. Edge TTS 与动态讲解视频

视频作品定义 `window.ahaVideo.renderFrame({ frame, fps, segmentIndex, segmentFrame, segmentFrames, text })`。运行时按实测音频逐帧调用，捕获动态场景并用 FFmpeg 编码，不是循环静态卡片，也不是 Remotion 集成。作者需使用确定性时间计算；工具不会自动把任意脚本变成确定性动画。

```powershell
node .\dist\cli\aha.mjs doctor --for video
node .\dist\cli\aha.mjs prepare-video ".\artifacts\topic-video" ".\artifacts\video-plan.json"
node .\dist\cli\aha.mjs video-plan-check ".\artifacts\topic-video" ".\artifacts\video-plan.json"
```

准备命令输出 `status: "draft"`。编辑计划中 `segments[].text` 的完整旁白、逐段来源、声线、语速和目标时长，完成后将计划 `status` 改为 `"authored"`，重新运行 `video-plan-check`。向用户展示完整计划和当前 `planHash`；只有批准当前文本及向提供方外发后才运行：

```powershell
node .\dist\cli\aha.mjs synthesize ".\artifacts\topic-video" ".\artifacts\video-plan.json" ".\artifacts\audio-v1" --approve "<已批准的planHash>" --allow-network
node .\dist\cli\aha.mjs render-video ".\artifacts\topic-video" ".\artifacts\video-plan.json" ".\artifacts\audio-v1" ".\artifacts\topic.mp4" --approve "<已批准的planHash>" --allow-code
```

`prepare-video` 新计划按作品语言选择声线：`en`（以及未声明语言）为 `en-US-JennyNeural`，`zh` 为 `zh-CN-XiaoxiaoNeural`。计划仍显式保存 `voice`，不会重写已有作者计划；草稿主张建议也不是自动译好的旁白。在线客户端固定 `edge-tts==7.2.8`，只外发获准旁白和声音参数。用户逐句音频使用 `import-audio` 和明确的 `provided-audio` 提供方，不能冒称在线合成成功。命令见 `help`。

翻译旁白会改变计划哈希，必须重新校验并让用户完整批准当前旁白、提供方、声线、语速和外发范围。烧录字幕与 SRT 来自作者编写的 `segments[].text`，不自动翻译。

720p30 H.264 / AAC、句级烧录字幕、SRT 与回执。时间取自真实音频；超出批准范围明确失败，不偷偷拉伸语速。源码或计划身份不符时拒绝直接复用；新计划重新确认，不手改音频 hash。只改画面而保留旁白时，可将旧音频作为 `provided-audio`，在新计划获准后重新导入新音频目录；这不需要再次联网合成，但不再冒称新一轮 Edge 合成。

先做短小样再扩展正式片。编码成功不代表听审／视觉通过；在线配音前运行 `doctor --for speech`，此命令只检查本地工具，不联网合成，在线可用性和实际配音需另行验收。

### 按当前步骤检查依赖

| 命令 | 实际探测的可选工具 |
| --- | --- |
| `doctor`／`doctor --for research`／`doctor --for html`／`doctor --for pptx` | 无；检查基础运行时完整性。PPTX 的实际视觉验收仍需演示应用 |
| `doctor --for browser`／`doctor --for image` | 已安装浏览器 |
| `doctor --for video` | 浏览器、FFmpeg、ffprobe，不要求语音依赖 |
| `doctor --for speech` | FFmpeg、ffprobe、Python／Edge TTS，不要求浏览器 |
| `doctor --media` | 全部媒体工具的兼容诊断入口，不作为所有任务的统一门槛 |

`--for` 与 `--media` 不能同时使用。缺失工具只阻塞相关步骤，不能因为未安装 Edge TTS 就阻塞 HTML 打包；诊断不自动安装、不外发内容，也不替代作品代码执行授权。

## 本地依赖与执行边界

| 能力 | 要求 |
| --- | --- |
| 研究检查、HTML 打包 | Node；不执行作品代码 |
| 图片、浏览器检查、动态视频帧 | 已安装 Edge／Chrome；明确 `--allow-code` |
| 原生 PPTX 构建 | Node 中执行已审阅作品脚本；明确 `--allow-code` |
| 视频编码与音频测量 | 已安装 FFmpeg／ffprobe |
| 在线 Edge TTS | Python、精确版本客户端、当前旁白审批与网络授权 |

可用 `AHA_BROWSER_EXECUTABLE`／`AHA_BROWSER_CHANNEL`、`AHA_FFMPEG`、`AHA_FFPROBE`、`AHA_PYTHON` 指定已有工具。Python 按显式配置、已激活环境、当前目录 `.venv-media`、PATH 选择；不向上搜索或从错误显式配置静默回退。

不自动安装软件、下载浏览器、搜索私有目录或公开上传。浏览器预览隔离登录状态并阻断外部资源；**Node 作者代码仍具有本地进程权限，超时与 `--allow-code` 不是 OS 沙箱**。有疑虑时在真正隔离的环境构建，不能授权时只交待执行源并说明未渲染。

来源命令是材料，不执行。新候选输出位于作品目录外，不覆盖旧文件；工作历史与当前交付目录分开，后者只展示选定版本和必要材料。只有用户授权明确范围后才替换、归档或删除；成品与收据成对保留、校验身份并更新链接及 QA。磁盘收据记录输出文件名，CLI 结果另含完整目标路径；复制时保留原文件名，需要改名则在新目录按目标名字重建，不手改收据。完整生命周期见[创作契约](skills/aha-explain/references/artifact-authoring.md#working-history-and-current-delivery)。分享前检查正文、备注与资源清单，私有标签不提供加密。

## 验证与质量

```powershell
npm run typecheck
npm test
npm run test:browser
npm run test:media
```

单元／分发／CLI、浏览器交互、媒体集成分开运行。媒体集成使用本地测试音频，不替代真实 Edge TTS 或人工听审；PPTX 包内容检查不替代实际演示程序中的视觉检查。

最终质量还需对关键断言回查来源、核对媒介内容覆盖、检查实际尺寸下的版式与交互、观看完整视频。不以静态 Skill 文本检查或一个成功退出码冒充这些验收。

技能效果评估见[评估协议](docs/EVALUATION.md)：固定原始材料和具体代码夹具，用准备工具分离作者输入与评分答案，比较相同条件下的候选与基线。内容断言与过程证据分别评分；改写回归不证明技能能主动补足推理或产生稳定增益。真实读者需解释未展示的新案例并给出理由；没有真人数据时保持待验证。评估产出放独立工作目录，不污染 `examples` 当前作品集。
