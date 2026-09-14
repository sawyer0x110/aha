# Aha! · 原来如此

把一个聚焦问题与依据，做成最终读者可以独立理解、探索和复习的离线知识成品。

- **aha-lab**：直接解释、概念对照与理解练习；支持内置模型的参数／单步探索，其他主题提供有来源的概念讲解。
- **aha-story**：复用同一个解释包，生成 HTML、可编辑 PPTX、知识卡 PNG，以及经旁白确认的 Edge TTS / MP4。
- **aha-research**：先研究再解释，分别处理代码仓库和公开资料，保留主张、证据、争议、缺口与停止理由。

这是 **v0.2 多模态与研究里程碑，不是完整 P0**。内置确定性重试、复利两个模型和证据浏览路由；视频采用独立场景卡片与短转场，不等同于完整动画制作系统。产品提案见 [PRD](docs/PRD.md)，五个参考项目的采用方式与许可边界见 [参考记录](docs/REFERENCE-ADOPTION.md)。

## 目录职责与实现边界

| 目录 | 保留理由 |
| --- | --- |
| `src`、`tests` | 运行实现、模型与兼容性回归；`src/studio` 是暂停中的作品模式开发，尚未接入 CLI |
| `skills` | 三个独立 Skill 的入口与按需读取的共享协议 |
| `scripts` | 构建、项目级安装与发布 |
| `docs` | 原始 PRD、研究协议、参考项目采用与许可边界 |
| `dist`、`artifacts` | 可再生成的本地构建与工作输出，不提交到仓库 |

只发布 `aha-research`、`aha-lab`、`aha-story` 三个 Skill。共享参考、同一核心构建的 CLI、运行资源和许可随每个 Skill 独立分发；不能分别手改三份构建产物。安装仅面向项目，默认 dry-run，不替换已有目标；文件安装和 doctor 成功不等于宿主发现或自然语言触发验收。

当前运行时为 0.2.0，Pack 协议为 0.1.0。完整动态图形、通用仓库执行、直接富文档输入解析和英文输出尚未交付；场景卡片视频不能替代这些能力的验收。Edge TTS 须逐版本批准完整旁白与外发；浏览器、FFmpeg、Python 环境不随 Skills 包分发。

## 开发与构建

开发需要 Node.js **22 或更高版本**，在仓库根目录执行：

```powershell
npm ci --ignore-scripts
npm run build
```

构建生成 `dist\skills\aha-research`、`aha-lab` 与 `aha-story`。每个目录包含 Skill、研究协议、`scripts\aha.mjs`、Schema、示例及运行依赖和许可；Playwright 的资源文件随目录一起分发。HTML / PPTX 生成只需 Node，不依赖本仓库、不需另行 npm 安装；PNG 需要已安装的 Edge/Chrome，视频额外需要 FFmpeg，在线配音需要 Python / Edge TTS。观看 HTML 只需浏览器。

仓库中的 `skills` 是规范定义源码，**不是直接安装目标**。构建不会自动注册到任何宿主。

开发时，构建后也可在仓库根目录使用 `npm run aha -- doctor` 或 `npm run aha -- <命令及参数>`，对应 `node dist\cli\aha.mjs`。安装后的 Skill 仍使用下文的绝对脚本路径，不依赖此 npm 入口。

## 本地发布与安装到 Codex / GitHub Copilot

先构建，再生成可复现 ZIP；不自动发布、上传或注册到宿主：

```powershell
npm run build
node .\scripts\release.mjs
```

命令输出实际 `directory`、`archive` 与完整 `contentHash`。交付位置为
`dist\releases\<package版本>\<内容SHA256>\`，内含 `aha-skills-<版本>.zip`、
`release-manifest.json`、`SHA256SUMS.txt` 和 `INSTALL.md`。内容哈希覆盖版本、三个 Skill 及安装器／指南的文件哈希；ZIP 的排序、时间戳和权限固定。同内容重跑核对后复用，内容变化生成新目录；已有同路径资产不同则拒绝覆盖，保留所有旧输出。最终代码修订后必须重新构建／发布，不把中间 ZIP 当成最终交付。

接收方先用 `Get-FileHash -Algorithm SHA256 "<ZIP绝对路径>"` 与旁边 `SHA256SUMS.txt` 核对，再将 ZIP 解压到**新的空目录**；哈希只验证完整性，不替代可信来源。解压后无需本仓库或 npm 依赖。下面命令在解压目录运行，项目路径必须是已存在目录的绝对路径：

```powershell
# 默认 dry-run，校验所有文件哈希、白名单和三个目的目录，不写入项目：
node .\install-skills.mjs --host copilot --project "C:\你的项目"
# 审阅上一步输出后显式应用：
node .\install-skills.mjs --host copilot --project "C:\你的项目" --apply
# Codex 改用 --host codex；不要在多个发现目录重复安装同名 Skill。
```

- Copilot 目标：`C:\你的项目\.github\skills\aha-{research,lab,story}`。
- Codex 目标：`C:\你的项目\.agents\skills\aha-{research,lab,story}`，**不是历史 `.codex\skills`**。
- 官方目录核对于 2026-09-14：[Copilot](https://docs.github.com/en/copilot/concepts/agents/about-agent-skills)、[Codex](https://developers.openai.com/codex/skills/)（现重定向到 [Build skills](https://learn.chatgpt.com/docs/build-skills)）。
- 仅支持项目级安装，无全局／用户级或 `--force` 选项；拒绝主目录／文件系统根目录、已有 Skill、symlink／junction、路径逃逸与哈希不符。升级需用户先审阅并移走旧目录，不混合新旧文件。
- 安装器只用 Node 内置模块；只复制三个完整 Skill，保留各自 `node_modules\playwright-core` 与许可。不会复制工作区 secrets、`.venv`、主 `node_modules`、日志、tokens 或原始演示输出；`assets\examples` 是构建生成的三个合成 Draft。
- 发布／安装采用独占目录预留与文件硬链接，保证不替换已有目标，失败只回滚本次拥有的目录（空发现父目录可能保留）。文件逐个可见，**不是三目录同时切换**；安装期间不要启动宿主或并发修改源／目的树。需要支持硬链接的本地文件系统；路径检查不是对抗恶意并发目录替换的 OS 沙箱。

仓库开发入口也可运行 `node .\scripts\install-skills.mjs --source "C:\解压后的发布目录" --host copilot --project "C:\你的项目"`，确认后加 `--apply`。POSIX shell 使用正斜杠和绝对项目路径。

安装后从与 Skill 无关的作品目录分别运行三个绝对路径的 `doctor`，例如：

```powershell
node "C:\你的项目\.github\skills\aha-lab\scripts\aha.mjs" doctor
```

Codex 路径用 `.agents`。再在目标项目启动／刷新宿主，检查技能列表，显式选择同名 Skill（Codex 可用 `$aha-lab`），另行测试自然语言请求。**文件安装、SHA256、独立 CLI doctor 不等于真实宿主发现或语义触发通过**；安装器与发布器不执行宿主，也不声称完成真实 Copilot／Codex 验收。宿主可执行文件不存在时应明确记录未验证，而不是用文件检查冒充会话成功。

支持 `skill list` 的 Copilot CLI（例如 1.0.84-5）可用 `copilot -C "C:\你的项目" skill list` 检查发现结果。Copilot 也支持 `.agents\skills`、`.claude\skills` 项目目录，本安装器固定使用 `.github\skills`，不要重复复制。技能列表可见与自然语言实际选中是两个独立检查；没有安装 Codex 的环境不能完成其真实宿主验收。

## 三个演示包

在作品目录运行。**每个 `<技能绝对目录>` 都替换为已安装 aha-lab 或 aha-story 的实际绝对路径**，不能直接照抄占位符；不要假定命令工作目录在 Skill 根目录。

```powershell
node "<技能绝对目录>\scripts\aha.mjs" doctor
node "<技能绝对目录>\scripts\aha.mjs" example retry ".\retry-v1.aha"
node "<技能绝对目录>\scripts\aha.mjs" example compound ".\compound-v1.aha"
node "<技能绝对目录>\scripts\aha.mjs" example evidence ".\evidence-v1.aha"
```

POSIX 调用脚本使用 `"<技能绝对目录>/scripts/aha.mjs"`，作品路径例如 `"./retry-v1.aha"`。

这些是**原创合成／规范推导示例**，不是自动读取用户资料后的研究成果。重试和复利标签为 `derived-model`；证据示例为 `source-based`，但其材料仍明确是合成的。

## 先研究，再制作

对真实主题先研究，而不是改完模板标题就渲染。三个 Skill 都能独立使用随附研究参考；`aha-research` 可只交付研究，不要求先后调用其他入口。代码研究固定仓库版本和工作区状态，追踪入口、调用、数据访问、测试、配置及失败路径；公开研究分解问题，实际读取一手来源，核对时间、单位与适用范围，并记录冲突和无法访问的来源。协议见 [研究流程](docs/RESEARCH.md)。

宿主负责实际取证；CLI 不内置搜索服务。`research-check` 只检查 Draft、引用与每条 Claim 的研究覆盖，**不证明网页已经读过或自然语言事实正确**。新研究应提供 `research`；旧 v0.1 Pack 仍可读。

## 交付给读者，不交付制作说明

HTML、PNG、PPTX、MP4 默认是知识成品，不是给委托人或另一位 Agent 的工作指令。作者要直接回答问题，写具体概念对照／步骤、必要条件和有理由的理解题答案，不是仅删除几个标签后仍输出 Brief／审计字段清单。来源查阅是次级入口，不是主要学习活动。

受众是内部编写输入；可见正文、图卡、幻灯片、Pack `narrative.slides[].notes` 的讲解文字和旁白不打印“为谁讲解：成人初学者”“原解释包讲解要点”、来源计数、Claim ID、哈希或生产／协议／审批指令。审计信息保留在 Pack、研究台账、回执与来源元数据；成品保留简洁来源和自然语言事实条件。比如天气百分比若是假设例子就明说，不冒充实时预报，时间窗／降水阈值依产品定义；Git 普通 `add`、`add -p` 和 `commit -a` 的条件不能混同。清理版面不等于消除不确定性。

原生 PPTX 审计备注与内嵌 Pack 有意保留完整来源身份和研究元数据，供追溯，不属于教学画面。它们不同于 Pack 的 `narrative.slides[].notes`：TTS 使用后者准备读者旁白，原生 PPTX 审计备注不会送入 TTS。因此不要求所有 PPTX 备注都去掉审计信息；分享前仍须审查备注和内嵌数据，不朗读不等于保密。

可选 `brief.explanation` 的既有 `takeaway`、带边界类比、`glossary`、`checkQuestion` 契约不变；可再写：

- `visual`：导出的 `TeachingVisual`，`layout: "cards" | "steps"`，`title` 最多 80 字符，`items` 2–4 项 `{label, body}`（分别最多 40／160 字符），非空 `claimIds` 引用现有 Claims。
- `conditions`：最多 6 条读者条件，每条最多 180 字符。
- `answer`：最多 400 字符的理解题答案。

`narrative.slides[]` 也可有同形状 `visual`／`conditions`。全部文字是普通字符串，不是 HTML／可执行代码。图示是已有主张支持的、经审阅的主题讲解，不是制作管线、新模型或观察轨迹；不会因此获得实时 Git／天气模拟或图像生成 API。精确契约见 [编写契约](skills/shared/references/authoring.md)。

**首次构建前须明确审阅研究与 Draft。** 用户明确要求纠正已审阅且事实／证据不变的呈现，授权对应范围的本地修改、构建与渲染：保留 Claim／Evidence ID 和内容身份、事实、单位、关键限制、模型输入及旧输出，记录原 Pack、修订范围与新 Draft 哈希；不为纯 UI／排版另造审批循环。新发现或事实／证据变化仍须补证审阅，新旁白的外部合成仍须另批完整文本、provider、voice、rate、时间安排／时长策略及当前 `planHash` 与外发。此边界不是首次审阅或 TTS 授权的普遍豁免。

### 先设计理解，再适配媒介，最后检查修订

来源事实不是脚本，同一事实集不等于同一布局。[解释设计](skills/shared/references/teaching-design.md) 要求先写预测／解释／迁移目标、误解与先备知识，用具体内容展示“操作 → 可见变化＋未变部分”，经历例子后归纳规则，再解不同情境的迁移题。Git 例子应展示文件实际内容如何经过编辑、add、再次编辑、普通 commit，而非三个术语框。

可选顶层 `teaching` 保存 title／objective／misconception、实际 Evidence 支持的 recorded-example／source-example basis、2–3 个实体、2–7 个有序状态、1–6 个操作（每步恰改变一个目标，可选复制来源）、预测与独立迁移 checks，以及 card 专用标题／摘要／选定操作／结论。Slide 可选 `scene` 为 hook／transition／mechanism／transfer／takeaway。字段都是普通文本，不执行 HTML／代码；Pack 可保留设计计划和来源身份，读者画面不展示作者／审计栏目。它是 evidence 路由的记录／来源例子，不是 observed 引擎或实时 Git；旧 Draft／Pack、概念 cards／steps 和适配的数值引擎继续有效，不强迫所有主题套状态序列。

[每种媒介设计](skills/shared/references/formats.md)：PNG 一个视觉论证，不堆词汇；Lab 预测、揭示、具体反馈与记录状态回放；HTML slides／PPTX 按场景改变视觉层级和构图；视频另做分镜、旁白与视觉分工，不逐字读卡片，仍不等于完整动画系统。

[检查—修订闭环](skills/shared/references/quality-loop.md)：先生成代表性 pilot 截图，查颜色编码、delta、关系、焦点、可读性和媒介适配；独立 Agent 视觉审阅只是启发式，不是人类理解测试。学习任务成绩只根据实际回答记录，未测不得编造反馈。发现问题先修 Draft／Skill／设计／授权范围内通用实现，再经 Skill CLI 重新生成，不手改最终 HTML／PPTX。同一问题两次局部修补无效就返回设计，不设任意全局通过轮数；阻塞项关闭或如实报告真实限制后分别交代已检与未检项。

## 从示例到自己的作品

```powershell
node "<技能绝对目录>\scripts\aha.mjs" init retry ".\my-topic.draft.json"
```

编辑草案中的问题、依据、主张、案例、假设和按任务需要手工编写的 1–12 页读者叙事，不强制凑 5–8 页；不要只改标题，也不要手写轨迹或 Pack 哈希。数值 Story 导入模板仍为 1–4 个案例、5–8 页。先按上文完成相应研究／Draft 审阅；字段和模型边界见 [编写契约](skills/shared/references/authoring.md)。

```powershell
# 仅在研究与 Draft 已审阅，或属于上述已授权呈现纠正范围后：
node "<技能绝对目录>\scripts\aha.mjs" build-pack ".\my-topic.draft.json" ".\my-topic-v1.aha"
node "<技能绝对目录>\scripts\aha.mjs" validate ".\my-topic-v1.aha"
node "<技能绝对目录>\scripts\aha.mjs" render-lab ".\my-topic-v1.aha" ".\my-topic.lab-v1.html"
node "<技能绝对目录>\scripts\aha.mjs" render-slides ".\my-topic-v1.aha" ".\my-topic.slides-v1.html"
node "<技能绝对目录>\scripts\aha.mjs" render-card ".\my-topic-v1.aha" ".\my-topic.card-v1.html"
node "<技能绝对目录>\scripts\aha.mjs" render-image ".\my-topic-v1.aha" ".\my-topic.card-v1.png"
node "<技能绝对目录>\scripts\aha.mjs" render-pptx ".\my-topic-v1.aha" ".\my-topic-v1.pptx"
```

`.aha` 是解释包**目录**。HTML 可直接在浏览器打开，内嵌数据和运行资源，不需要服务器。讲解页的备注在同页查看，不依赖弹窗。主动点击来源链接仍可能联网。

所有创建操作拒绝覆盖已有目标。重渲染请使用工作／归档目录中的 `v2` 等新文件名，保留回滚而非在成品目录累积旧版；HTML、探索导出和新修订都应放在原 Pack 之外。渲染回执位于 Pack 的 `receipts`，CLI 返回具体位置；其中 `visualReview: "not-performed-by-this-command"` 明确表示命令未执行视觉审查。

## Edge TTS 与 MP4

先检查现有可选依赖：已安装的 Edge/Chrome、PATH 上的 `ffmpeg` / `ffprobe`、Python 和精确版本 `edge-tts==7.2.8`。可用 `AHA_BROWSER_EXECUTABLE` / `AHA_BROWSER_CHANNEL`、`AHA_FFMPEG`、`AHA_FFPROBE`、`AHA_PYTHON` 指定已安装工具。不会自动下载浏览器或安装软件；仅在确认缺失、获得安装授权后，才用所选 Python 执行 `-m pip install -r "<技能绝对目录>\assets\media\requirements-media.txt"`，不默认改动系统 Python。

Python 选择顺序（`doctor --media` 与媒体调用一致）：

1. 显式 `AHA_PYTHON`：指定可执行文件，报告 `source: "override"`。
2. 已激活环境 `VIRTUAL_ENV`：Windows 取其 `Scripts\python.exe`，其他平台取 `bin/python`，报告 `active-venv`。
3. **当前命令工作目录**中已有的 `.venv-media\Scripts\python.exe`（Windows）或 `.venv-media/bin/python`（其他平台），报告 `project-venv`。
4. PATH 上的 `python`，报告 `path`。

不向上搜索祖先目录或用户主目录，也不以 Skill 安装目录代替当前工作目录。现有项目 `.venv-media` 会被复用，不因此重装依赖；在别的作品目录运行时，可激活原环境或将 `AHA_PYTHON` 设为其绝对可执行文件路径。显式配置错误不会悄悄回退（空 `AHA_PYTHON` 直接报配置错误）；所选环境不可用时先报告并修正配置。

`doctor --media` 仅执行本地探测，不访问 Edge TTS 服务、不合成语音、不安装依赖。JSON 的 `pythonRuntime.executable`／`source` 表明实际选用的解释器；`mediaReadiness` 分别报告浏览器、FFmpeg／ffprobe 和 Edge TTS，检查 `edge-tts` 必须恰为 **7.2.8**。任一前提不可用时状态为 `degraded`；不能只看进程成功退出就声称媒体全部就绪。普通 `doctor` 不探测媒体环境；即使本地探测全通过，也不代表在线合成或人工听审通过。

```powershell
node "<技能绝对目录>\scripts\aha.mjs" doctor --media
node "<技能绝对目录>\scripts\aha.mjs" prepare-video ".\my-topic-v1.aha" ".\video-plan-v1.json"
node "<技能绝对目录>\scripts\aha.mjs" video-plan-check ".\my-topic-v1.aha" ".\video-plan-v1.json"
```

先展示并核对命令返回的**全部旁白、provider、voice、rate、时间安排／时长策略和 planHash**，询问用户是否同意将这份具体文本发送给 Microsoft 在线语音服务。选择 Edge TTS 或请求本地呈现纠正不是对新旁白的外发授权；哈希也不是程序能够证明的人工同意。用户确认后才运行：

```powershell
node "<技能绝对目录>\scripts\aha.mjs" synthesize ".\my-topic-v1.aha" ".\video-plan-v1.json" ".\audio-v1" --approve "<已确认planHash>" --allow-network
node "<技能绝对目录>\scripts\aha.mjs" render-video ".\my-topic-v1.aha" ".\video-plan-v1.json" ".\audio-v1" ".\my-topic-v1.mp4" --approve "<已确认planHash>"
```

Edge TTS 是社区客户端，不是离线引擎或 Azure 付费 API；服务可用性与使用条款须单独确认。只外发获准的旁白文本和声音参数，不上传整个 Pack。修改旁白、声音或时长策略后必须重新核对 hash 和授权。默认 60–90 秒；每句不超过 84 字符、最多 40 段。时长来自实际音频，超出范围明确失败，不通过加速或静默截断蒙混过关。失败目录保留片段并记录失败，不冒充完整音轨。

交付为 1280×720 / 30 fps H.264 + AAC、烧录的句级字幕、同名 `.mp4.srt` 与 `.mp4.json` 回执。镜头来自同一 Pack 的独立状态卡片，不录制 Lab 控件；目前是短转场，不是连续物理／机制动画，也不宣称逐字对齐。可用 `import-audio` 导入用户已有的逐句音频，明确标记为 `provided-audio`，绝不冒充 Edge TTS。完整命令见 `help` 和 Story 的媒体协议。

## Lab → Story

用户可在 Lab 选择模型案例，或选择要阅读的材料，添加笔记并显式下载探索记录。证据模式只保存材料选择，不产生计算或虚构轨迹。也可用 CLI 导出：

```powershell
node "<技能绝对目录>\scripts\aha.mjs" export-exploration ".\my-topic-v1.aha" ".\chosen-v1.json" baseline comparison
node "<技能绝对目录>\scripts\aha.mjs" import-exploration ".\my-topic-v1.aha" ".\chosen-v1.json" ".\my-topic-v2.aha"
node "<技能绝对目录>\scripts\aha.mjs" render-slides ".\my-topic-v2.aha" ".\my-topic.slides-v2.html"
```

`baseline`、`comparison` 是模板案例 ID；修改草案后用实际 ID。探索格式和导出允许 1–10 个案例，省略 ID 默认全部；数值 Story 导入模板仅接收 1–4 个，组成 5–8 页。超过 4 个返回 `STORY_CASE_LIMIT` 且不创建 Pack，不静默省略；请重新选择，A/B 两案例不受影响。来源模式保留已编写的 `narrative`、图示与条件，选择留在新修订／导入回执，不制造“原解释包讲解要点”等交接页。必须保留导出时的精确原始 Pack，导入核对身份、引擎版本及适用轨迹，生成新修订。用户笔记不自动变成事实证据。

完成导入后，主 HTML、卡片／PNG、原生 PPTX 都从**实际导入的 Pack** 渲染，并核对产物／回执绑定该修订；不能为了保持好看的旧叙事，转回源 Pack 渲染再声称验证了导入。来源模式本就应保留已审阅的讲解。实际浏览器验收应操作讲解选择器、次级来源选择器和显式下载，检查下载记录再导入；CLI 导出不能冒充浏览器下载验收。

## 真实边界

仓库不内置真实案例成品及其来源档案。生成物、批准输入、证据、Pack、必要回执、迭代截图与日志默认进入忽略的 `artifacts` 或获准会话目录。用户指定交付目录后，检查阻塞项关闭才显式 promotion 一套当前成品，核对产物／Pack 身份，保留可回滚归档与恢复办法；不修改封存 Pack，不静默覆盖用户文件。

- 当前前端与内容仅中文 `zh-CN`；没有英文输出、直接富文档解析或任意新主题引擎。PPTX 是本地原生可编辑对象，而非整页截图；内容超出模板预算会要求缩短，不静默裁切。
- `source-based` 表示基于材料组织主张，不会独立核实材料中的事实。
- 重新校验或导入 Pack 时检查所载快照及关联身份；独立离线 HTML 不能监视源文件变化，也不会自动发现外部来源已更新。当前没有完整自动依赖图或增量失效机制，来源更新后须显式重新取证、构建和验证。
- `run` 不执行仓库；不支持真实观察轨迹导入。内置模型结果不证明外部系统行为。
- 复利输入是十进制字符串，精确中间计算、不逐期舍入；无现金流时，仅排列同一组收益率不会改变最终金额。
- PNG / 视频需要本地浏览器；MP4 需要本地 FFmpeg。缺失依赖明确失败，绝不把 HTML 改扩展名交付。外部配音只有明确授权的 Edge TTS 路径。
- CLI 命令输出 JSON，失败返回非零；校验只覆盖结构、引用、身份和内置规则，不证明材料真实性、图示教学质量或每句讲解正确，没有自动语义审计。按上述闭环修订，真实工具／证据／授权／预算阻塞要说明；不靠硬性轮数宣布通过。未生成的 MP4 不称已交付，完成报告与读者成品分开。
- 不默认联网、安装、遥测或发布；`private` 只是标签，不是加密。HTML 包含 Pack 内容，分享前审查来源摘要、私有定位和备注。

## 验证入口

```powershell
npm run typecheck
npm test
npm run test:browser
npm run test:media
```

`npm test` 和 `npm run test:browser` 都会先自动构建；媒体集成使用已构建 CLI、本地浏览器、FFmpeg 及 Python，用测试音频验证离线编码、用离线 API 替身检查配音适配器，不调用 Edge 服务。以上是验证入口，不是测试已通过声明。真实宿主触发、人工内容审查、真实配音听审和 PPTX 视觉审查应单独记录。

`node --import tsx --test tests\skills.test.ts tests\teaching-contracts.test.ts` 检查 Skill 书面契约、链接和 Schema 边界对应关系；不是语义证明，不运行真实读者任务，不证明 Git 示例已重生成或视觉质量合格。
