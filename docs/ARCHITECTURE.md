# Aha 架构与实现边界

当前源码 runtime 为 `0.3.1`，研究及作品协议为 `1.0.0`。产品行为见 [PRD](PRD.md)，命令见[使用指南](USAGE.zh-CN.md)，安装见[安装指南](../INSTALL.zh-CN.md)，发布状态见 [README](../README.md)。

## 仓库目录导航

| 目录 | 职责与编辑边界 |
| --- | --- |
| `src/` | 运行时源码；保留 CLI、研究、作品、浏览器与媒体的现有分层 |
| `skills/` | 两个技能入口及共享参考的源文件；共享参考在构建时合并，源码目录不是完整安装包 |
| `scripts/` | 仓库级构建、发布、安装工具，不汇集领域专用脚本 |
| `tests/` | 自动化测试、测试辅助代码和专用 fixtures；不嵌入宿主作者评估场景数据 |
| `evals/skills/` | 技能评估准备工具、固定案例、宿主场景和评分判据；四个锁定案例与宿主场景分别管理 |
| `evals/examples/` | 示例验收工具和保留的结果；`refresh-20260916/` 是前三例记录，`greenland-20260917/` 是格陵兰记录，`code-pilots-20260917/` 保存代码试片证据，`aha-introduction-20260917/` 保存新版介绍的授权、试片确认与修正后的编码证据，`overview-image-20260917/` 保存已选用能力图的身份、授权与检查边界；旧版结果保留为历史 |
| `examples/` | 三个四格式例子，加上格陵兰、CPython、Docker、新版 Aha 介绍四组视频例子；保存作品、收据、`projects/<format>/` 可编辑项目、研究与音频来源；`delivery-manifest.json` 索引十六份作品。新视频介绍与旧四格式导览分开，避免混淆研究快照 |
| `docs/` | 产品、架构、研究及评估说明；精确创作与权限契约链接到技能参考，不另建冲突副本 |
| `dist/` | 构建生成的 CLI 与独立技能分发包，Git 忽略；从源码和锁定依赖重建，不手动维护 |
| `artifacts/` | 本地研究、候选作品和评估运行结果，Git 忽略；可能有不可重建材料，清理需明确范围 |

按职责就近放工具：技能评估用 `evals/skills/prepare.mjs`，示例验收用 `evals/examples/` 下的检查器。独立制作工具（若有）放 `examples/<topic>/tools/`；参与作品源码身份的作者模块及辅助脚本保留在 `projects/<format>/`。根目录的 `npm run eval:prepare -- <参数>` 与 `npm run examples:verify` 提供快捷入口。

正式作品不是全部任务工作目录的镜像。只有选定的交付及必要材料进入 `examples/`，最终验收记录进入 `evals/examples/`；未清理的试跑历史放在 `artifacts/`，经用户明确授权后可按范围删除。作品项目内的研究副本、原始音频和当前导入音频各有身份用途，不按文件相似度去重。封存材料及历史记录中的旧路径保留其审计含义，当前路径由示例文档说明。

## 1. 职责划分

`宿主 Agent 调研 → 独立 Research Dossier → 媒介专属作品源 → 本地打包／渲染 → 分层 QA`

| 层 | 职责 | 不负责 |
| --- | --- | --- |
| `aha-research` | 问题分解、实际取证、反证、综合和独立研究交付 | 强制选择呈现格式或预写讲稿 |
| `aha-explain` | 必要的前置研究、内容与视觉设计、作品源和用户所选输出 | 统一页面 DSL、自动生成所有格式 |
| runtime | 协议校验、身份、资源打包、渲染、音频计划与收据 | 联网搜索、自动判断证据真假、认证美观或理解 |
| 宿主与评审 | 工具授权、隔离、实际内容／视觉检查、读者评估 | 用结构通过代替上述观察 |

只发布两个独立 Skill。共享研究参考不是第三个入口；`aha-explain` 直接使用共享研究流程，不依赖宿主自动调用另一个 Skill。

参考按职责和时机加载：研究时选来源路线，创作时选媒介，构图时选主题章节，验收时读 QA。

## 2. 研究档案

```text
topic.research/
  manifest.json
  research.json
  report.md
```

- `manifest.json` 保存协议版本、研究 ID 和内容哈希。
- `research.json` 保存问题、类型、语言、报告、子问题、主张、证据、读取记录、缺口与停止理由。
- `report.md` 与数据中的报告字符串一致；报告独立于任何媒介。

子问题在协议中是扁平列表；问题树、受众、范围和预算写入报告，不添加未经声明的字段。代码证据保留必要的 UTF-8 内容、实际 SHA-256 和 commit／dirty／diff 身份。当前档案没有任意附件目录。

`research-init` 创建待填草稿。`research-check --draft` 区分结构错误与待补内容，始终不授予交付身份。严格检查、build 和 validate 要求完整内容及一致引用；build 写入新目录，不覆盖已有档案。补证建立新快照，不修改已有作品绑定的事实底座。

每份研究文档上限 4 MiB，整个 Dossier 上限 10 MiB。准确字段见[研究契约](../skills/shared/references/research-contract.md)及构建生成的 Schema；哈希和引用校验不证明来源支持主张。

## 3. 作品项目

```text
topic-project/
  artifact.json
  research/
    manifest.json
    research.json
    report.md
  html/index.html       # HTML / image / video
  pptx/main.mjs         # PPTX
  qa/                  # 检查记录
```

每个项目只有一种格式，初始化只创建对应入口。可添加许可明确的本地资源；元数据不是统一布局或场景图。

`artifact.json` 记录格式、研究身份、入口、尺寸、语言、标题、草稿／已编写状态、`coverage` 与 `omissions`。每个研究主张都需覆盖或明确省略；映射只检查引用，不证明正文存在、正确或可读。

新项目包含 `language`。未声明该字段的项目保留单源行为，不自动翻译；完整选择规则见[语言契约](../skills/aha-explain/references/language.md)。

源身份包含元数据及源文件，排除顶层 `research/`、`dist/`、`qa/`；研究单独验证。每个源文件上限 16 MiB，源总量上限 64 MiB。资源不得逃出项目或利用链接绕过限制，渲染产物及音频／计划目录放在项目外。

共同契约各有权威位置：

| 参考 | 管理内容 |
| --- | --- |
| [artifact-authoring](../skills/aha-explain/references/artifact-authoring.md) | 项目、源身份、覆盖、省略和交付生命周期 |
| [execution](../skills/shared/references/execution.md) | 执行权限、诊断、依赖与隐私 |
| [language](../skills/aha-explain/references/language.md) | 语言默认值、本地化根、切换与翻译 |
| [artifact-qa](../skills/aha-explain/references/artifact-qa.md) | 内容、视觉、运行、编辑和理解的分层验收 |

## 4. 媒介管线

### HTML 与 PNG

作者自由编写 HTML/CSS/JS、SVG 和 Mermaid；可选图解、比较、探索、长文或混合结构。

`render-html` 内嵌受支持的本地资源并注入离线 CSP，不执行作者脚本。内置 Mermaid 使用随包本地库在浏览器中渲染，提供图形操作控件；检查或捕获前等待 `window.ahaMermaidReady`。不使用 CDN 或竞争的初始化器。

运行时先提供缺省样式，作者 CSS 随后生效。`--cp-*` 是颜色角色接口，不是固定色值；自定义样式需处理浅深色选择器与控件。主题优先级为有效 `scoutTheme` 参数、作者根 `data-theme`、系统偏好；不自动添加主题切换 UI。

双语 HTML 有英语和中文两个本地化根。运行时注入语言按钮，初始显示英语，切换标题、`html lang` 与非活动分支的隐藏状态，并派发 `aha:languagechange`。无在线翻译、语言 URL 参数或偏好存储。

本地 classic JS、受支持的图片和字体可内嵌；模块脚本、动态导入、CDN、嵌入媒体等不属于打包契约。准确资源边界见 [HTML 指南](../skills/aha-explain/references/html.md)。

PNG 使用独立 HTML/SVG 构图，经批准后由浏览器捕获元数据指定的完整视口。图像尺寸为宽 320–4096、高 240–16000；超限或溢出明确报错，不静默裁切。

### 原生 PPTX

`pptx/main.mjs` 导出接收 `{ pptx, research }` 的作者函数；运行时提供 PptxGenJS 实例并负责写文件。作者创建原生文字、形状、表格、图表和备注，不自行替换运行时或调用 `writeFile`。

作者模块在 Node 中执行，有 60 秒超时但无 OS 沙箱。结构／OOXML 检查与实际演示应用渲染、代表对象编辑检查分别执行。没有演示应用时，视觉和编辑 QA 保持未完成。

### 讲解视频

画面由作者提供的 `window.ahaVideo.renderFrame(...)` 按帧设置，时间来自实际音频。每帧应由输入独立确定，不依赖随机数、墙钟或累积状态；捕获禁用自主 CSS 动画与过渡。

`prepare-video` 创建待编写计划，旁白位于 `segments[].text`。当前完整计划经用户批准后，才允许 Edge TTS 外发或明确的 `provided-audio` 导入；本地渲染授权另行处理。

当前固定 1280 × 720、30 fps、H.264/AAC，交付句／段级烧录字幕、SRT 和收据；上限 600 秒、200 段。没有逐字对齐或自定义字幕样式 API，画面需为固定字幕区域留空间。

计划绑定整个作品源身份。即使只改颜色，也可能使音频绑定失效；不得手改哈希。旁白不变时，可在新计划获准后通过 `provided-audio` 重新导入已有授权音频，如实保留原合成来源并核对新时长。

准确计划和音频字段见[视频契约](../skills/aha-explain/references/video-contract.md)，制作与播放检查见[视频指南](../skills/aha-explain/references/video.md)。

## 5. 执行、分发与许可

研究材料是数据，不授予执行权限。浏览器预览使用独立环境、阻断未批准网络；Node 作者代码仍具有本地权限。`--allow-code`、超时及静态扫描不构成沙箱，无法获得合适授权／隔离时只交源并说明阻塞。

依赖按步骤诊断，缺失只影响相关操作：研究和 HTML 打包不需要浏览器，PNG 需要浏览器，视频渲染需要浏览器及 FFmpeg／ffprobe，在线配音另需 Python／Edge TTS。诊断不安装软件或证明在线服务可用。

构建输出为 `dist/skills/aha-research` 和 `dist/skills/aha-explain`，各自携带 CLI、Schema、合并参考、本地 Mermaid、Playwright 库、Aha 的 `LICENSE`／`LICENSE-SCOPE.md` 和第三方声明；源码 `skills/` 不是独立安装包。发布器将根目录中英文安装指南原字节复制到 ZIP 和发布资产，不维护脚本内的另一套安装文案。ZIP 另含 Aha 许可与范围说明、清单和安装工具，外部 SHA-256 覆盖发布资产；安装白名单只接受明确列出的文件。旧格式包不因缺少后来新增的文档而被新安装器自动拒绝。打包不自动上传，安装默认 dry-run、拒绝冲突及覆盖。

实际依赖包括 Mermaid、parse5、PptxGenJS、TypeBox 和 Playwright，按锁定版本分发并保留 `THIRD-PARTY-NOTICES.txt`。浏览器、FFmpeg、Python 和 Edge TTS 客户端不随包分发；客户端许可不替代在线服务条款及数据授权。字体、图片、音频等素材需单独核实来源与再分发权限，不能把公开可读或非商业许可当作任意商用许可。

Aha 原创部分采用 [MIT](../LICENSE)，第三方材料的独立许可见[许可范围](../LICENSE-SCOPE.md)。旧版 Release 不被源码变更覆盖；发布含新增许可和文档的安装包时须使用新版本。`package.json` 的 `private: true` 防止误发 npm，与 GitHub 仓库是否公开无关。

## 6. 修订与交付身份

新候选渲染到项目外的新位置，检查后才提升为当前交付。工作记录与公开目录分开；替换、归档、删除和公开发布限于用户授权范围。

输出与收据成对保留原字节和文件名。磁盘收据记录输出文件名，CLI 返回完整目标路径；需新名字时在新目录按该名字重建，不改写收据。更新目录链接及 QA 身份，不将已失效的检查用于新产物。

源码、研究和输出身份必须一致；不支持的协议版本、引用错误、链接路径和覆盖冲突明确失败。用户直接编辑成品时需说明是否同步回源，不能下次重建静默抹去。

## 7. 代码与验证入口

| 位置 | 职责 |
| --- | --- |
| `skills/` | 两个入口及渐进式指导 |
| `src/research/` | 研究 Schema、台账、三文件档案与检查 |
| `src/artifacts/` | 作品、源身份、资源打包、HTML／PNG／PPTX 和收据 |
| `src/browser/` | 本地 Mermaid 与图形操作 |
| `src/media/` | 旁白计划、音频、浏览器帧、编码与字幕 |
| `src/cli/`、`src/core/` | 命令、检查、错误与通用身份 |
| `scripts/` | 仓库级构建、发布和安装工具；技能评估准备入口在 `evals/skills/prepare.mjs` |
| `tests/`、`evals/skills/` | 程序回归、固定材料及独立评分协议 |

程序测试验证其直接覆盖的行为，不认证实际作品美观或研究结论。作品须做对应媒介的实际 QA，技能效果另按[评估协议](EVALUATION.md)比较；未收集的读者理解、未播放的音频和未执行的交互不写成通过。
