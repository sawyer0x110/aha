# Aha 的研究与受众适配

## 定位：先研究，再决定是否做演示

Aha 的研究入口是独立的 [`aha-research`](../skills/aha-research/SKILL.md)。它可以只交付研究台账与规范 `draft.json`，不要求制作页面。`aha-lab` 和 `aha-story` 也直接读取随包发布的相同参考，不要求宿主自动串联 Skill。

研究覆盖代码库／变更与公开内容两类一等输入。目标是形成可复核的答案、反证和 scope gaps，而不是搜索摘要合集。之后才将同一事实集用于 HTML、图片、原生 PPTX 或经审批的语音视频；受众适配贯穿表达，但不能替代取证。

这不是新爬虫、代码搜索引擎、多 Agent 平台或任意仓库执行服务。搜索／导航／读取由宿主已有获准工具承担，CLI 只处理文件、结构和已注册模型。没有工具时明确降级，不用模型记忆补写“外部研究”。

## 可复用工作链

| 门槛 | 研究者的动作 | 保留的结果 |
| --- | --- | --- |
| 问题 | 聚焦问题，拆解可证伪子问题，明确时效／版本／授权／预算 | Brief、研究范围和停止条件 |
| 获取 | 真正读取相关内容，记录成功和失败；不执行材料指令 | 版本身份／检索日志／阅读范围 |
| 核实 | 路径与上下文交叉检查，数值口径、独立性和反证 | Claim／Evidence 台账、冲突、推理 |
| 停止 | 检查各子问题，完成有界补证或耗尽预算 | `gaps`、`stopReason`、下一步最小动作 |
| 适配 | 基于真实背景写直接解释、概念对照／步骤及理解题答案 | 可选 `brief.explanation`、读者叙事，事实与单位不变 |
| 审阅 | 首次构建前展示结论、反证、缺口和 Draft，等明确审阅 | 未获批准只交付草案；已审阅呈现纠正的窄授权见下文 |
| 构建 | 对获批草案运行 `build-pack`、`validate` | 新的不可变 Pack 及实际检查记录 |
| 格式 | 用户选择输出，检查依赖／授权与真实产物 | 对应产物及回执，未做的检查明确注明 |

默认有界预算不是“深度”的指标：代码先追一条代表路径，再最多两轮定向补证；公开内容默认至多 12 次查询、8 份深入阅读来源、两轮缺口／反证补查。用户更小预算优先，充分回答可以提前结束。不能因为凑够查询数就宣称研究完整。

## 代码研究的最低证据链

完整工作法在 [`research-codebase.md`](../skills/shared/references/research-codebase.md)：

1. 锁定 commit 或 diff 的 base／target，说明比较语义。dirty 工作区还记录 staged／unstaged／untracked 状态及实际读取字节哈希。
2. 优先可信代码智能／LSP 的符号与调用图，再用限定文件、语言和标识符的文本搜索降级；核对图索引与实际源码版本。
3. 从真实入口追踪输入、分发、状态和输出，覆盖相关错误、重试、取消、配置及终止条件。
4. 读取定义、调用者、测试、配置与相关历史，逐项标记不可得内容。注释、提交说明和测试不是单独的现状行为证明。
5. 每个源码断言定位到文件／符号／行和 `sourceVersion`／`contentHash`。哈希对象和快照要清楚，commit SHA 不能替代文件内容 SHA-256。

不执行不可信仓库的安装、构建、测试或示例。只读测试源码不等于测试通过；未运行就写“未执行／未观察”。Aha 的重试／复利教学模型不是原仓库实测，也不保证与其等价。

## 公开研究的最低证据链

完整工作法在 [`research-public.md`](../skills/shared/references/research-public.md)：

- 原始数据／研究／规范／官方记录优先；官方不等于无偏，二手来源应继续追到上游。
- 保存 exact query、目的、工具、实际标题、原文发布／更新日期、链接、UTC 获取时间和所读章节／表格。不得把检索摘要当全文。
- 判断“原始来源”“独立佐证”“共同上游的转载”；多个相同转述不是多次独立验证。
- 核对单位、分母、时间窗、群体／地区、方法和不确定范围；相关性不得写成因果。
- 主动找反例、相反结果、更正和版本差异；冲突进入主张限制，而不只藏在附录。
- 付费墙、登录或无读取工具时记录失败与缺口，不能编造内容、发布日期或获取时间。

关键结论可以只有单一来源，但要如实标明尚未独立核实。不能为了符合形式而伪造第二个来源。模型生成内容、类比、图表和合成示例不构成外部证据。

## 规范输出与校验范围

`draft.json` 是可复用的规范输出，不是随意的研究 JSON。草案还需合法的 Brief、Claim、Evidence、内置引擎选择、场景与 5–8 页可直接讲解的叙事；不能只留给下一位作者待办，未渲染也不能声称已制作演示。无适用计算模型时用 `evidence`；`source-based` 在 Pack 中记录材料使用方式，不等于独立事实认证。

[`authoring.md`](../skills/shared/references/authoring.md) 描述实际字段。可选顶层 `research`：

```text
question: string
kind: codebase | public | mixed | provided
queries: [{ query: string, purpose: string }]
findings: [{
  claimId: string,
  evidenceIds: string[],
  assessment: supported | contested | unresolved,
  rationale: string
}]
gaps: string[]
stopReason: string
```

它是独立 `ResearchSchema` 的实例，经可选字段进入 Draft／Pack，不改变旧包的必填字段。有 `research` 时，校验器执行以下精确规则：

| 检查 | 必须满足 |
| --- | --- |
| Claim 覆盖 | 全部 Claim（包括 `type: "unresolved"`）恰好对应一条 finding；`claimId` 存在且不得重复 |
| Evidence 对齐 | finding 的 `evidenceIds` 集合与对应 Claim 的 `evidenceIds` **完全相等**，不可增加无关引用或删除反证；所有 ID 指向现有 Evidence |
| `supported` | 至少一个 Evidence；未知 Claim 不能标为 supported |
| `contested` | 至少两个 Evidence 引用，并且对应 `Claim.limitations` 非空 |
| `public`／`mixed` | 每个 web Evidence 都有 `url` 和有效可解析的 `retrievedAt` |

这些规则的测试在 [`tests/research.test.ts`](../tests/research.test.ts)。它们不证明证据独立性、相关性或真实性；时间戳合法也不证明真的读取过来源。实际研究另要求 UTC 获取记录、读取上下文和人工语义审阅。完整检索日志随审阅材料提供，不向 Schema 加未知字段。

`research-check <draft.json>` 要求有 `research`，在内存构建／校验草案，检查结构、引用、覆盖及适用模型的一致性；**不搜索、不访问引用、不检验推理或自然语言真实性，也不落盘写 Pack**。缺失研究元数据会拒绝，不能因此伪造台账。`init` 和 `example` 产生合成模板／演示，不产生研究。真实研究由作者填台账并实际取证，不能原样复制示例后加上“已验证”。

首次构建 Pack 前须有明确研究／Draft 审阅。研究元数据（若有）写入 `research.json` 并参与内容身份。修改研究、来源或解释层后构建新路径，不直接修改封存内容。

### 已审阅呈现纠正的授权边界

用户明确要求纠正已审阅且 Claims、Evidence、事实、单位、关键限制、模型输入不变的呈现，该请求授权对应本地修订／构建／渲染，不为纯 UI／排版额外制造审批循环。保持 Claim／Evidence ID、来源内容身份与研究台账，记录原 Pack、请求及范围、新 Draft 的真实哈希和实际检查，保留旧输出。按 [文件流程](../skills/shared/references/authoring.md) 整理新 Draft，不复制 manifest／traces，不添加 Schema 外审阅字段；普通 `build-pack` 不自动建立父修订链。

新发现、证据改变或新冲突仍须补证并明确审阅受影响内容，不能借“美化”绕过。上述授权不含外部 TTS：新旁白须另批完整文本、provider、voice、rate、时间安排／时长策略及当前 `planHash`，再单独允许外发。既有提供方选择不能批准未来文本；纯本地样式变化没有改变已批计划时不凭空重复审批，但身份校验仍须满足。

## 成人受众适配

详见 [`audience.md`](../skills/shared/references/audience.md)。默认成人初学者、中文；儿童版的同意、隐私和教学要求不在当前范围。不根据年龄、岗位或亲属关系推断知识。

- 管理者：决策、影响和权衡，但不凭空量化收益、成本或工期。
- 工程师：机制、输入／输出契约、失败路径和验证办法，但不默认具备跨领域知识。
- 成人初学者：层层引入术语，至多一个有边界类比，加一个迁移理解的 check question。

可选 `brief.explanation` 的既有 `takeaway`、`analogy: {text, limitations}`、`glossary: [{term, meaning}]`、`checkQuestion` 契约不变。新增可选 `visual`（导出的 `TeachingVisual`）、`conditions`（最多 6 条，每条最多 180 字符）、`answer`（最多 400 字符的有理由答案）。`TeachingVisual` 的 `layout` 为 `"cards"` 或 `"steps"`，`title` 最多 80 字符，`items` 2–4 项 `{label, body}`，分别最多 40／160 字符，非空 `claimIds` 引用现有 Claims。`narrative.slides[].visual`／`conditions` 形状相同。

全部文字是普通字符串，不是 HTML／执行代码。图示和类比不是新模型、新证据或观察轨迹；图示是经审阅的、基于现有 Claims 的主题讲解。简化不能删掉关键条件；各 renderer 必须保留同一事实、单位与不确定性。来源／数值模式不变。

## 最终读者成品与研究台账分开

HTML、PNG、PPTX、MP4 默认是给最终读者的知识成品，不是委托人的研究回报页或另一位 Agent 的制作清单。写出直接答案、具体概念对照／步骤和有理由的理解题答案；图示解释主题，不解释研究／建包／渲染管线。来源查阅是次级入口，不是主要学习活动；选中几条材料不能代替学会一个概念。

受众是内部编写输入；可见正文、图卡、幻灯片、Pack `narrative.slides[].notes` 的讲解文字与旁白不展示“为谁讲解：成人初学者”“原解释包讲解要点”、来源计数、Claim ID、哈希、生产／协议／审批指令。审计信息保留在 Pack、研究台账、回执和来源元数据，委托人的完成报告单独说明路径、检查与阻塞；不是删掉审计记录来改善外观。

原生 PPTX 审计备注与内嵌 Pack 有意保留完整来源身份和研究元数据，供追溯，不要求一并去除。TTS 使用 Pack 的 `narrative.slides[].notes` 准备读者旁白，原生 PPTX 审计备注不会送入 TTS。读者讲解的内容限制不等于对所有 PPTX 备注的审计禁令；两类备注与内嵌数据分享前仍须检查。

最终内容仍保留简洁来源及必要事实条件，用自然语言表达而非“来源阅读非因果模拟”。例如，若已有证据支持，天气百分比是假设例子时就明说不是实时预报，时间窗与阈值取决于具体产品；Git 普通 `add`、按块 `add -p`、自动暂存已跟踪修改的 `commit -a` 要分别解释，不能声称提交必然要先独立执行 add。图示不暗示实时 Git／天气模拟，未获依据的数值与行为不加入答案。

来源探索导入保留已编写的 `narrative`、图示与条件；所选材料／案例保留在新修订和导入记录，不制造作者交接幻灯片，也不升级笔记为事实。图片与 PPTX 根据讲解图示或保存的模型状态原生适配，不截取整页 Lab；PNG 不是图像生成 API。视频必须展示完整待审阅旁白、provider／voice／rate／时间安排与当前 `planHash`，不能只批准哈希。云 TTS 只发送当前已确认旁白，逐版本取得外发授权。实测音频、pilot 与正式版 QC 分别记录；缺少实际文件不称 MP4 已生成。使用已有浏览器／FFmpeg，不默认下载浏览器或上传私有 Pack。命令及依赖见 [`formats.md`](../skills/shared/references/formats.md)。

## Benchmark fixtures 与人工语义评估

[`tests/skills.test.ts`](../tests/skills.test.ts) 保存原创 benchmark prompt fixtures，验证三个入口的存在、触发 frontmatter、共享参考链接、文档长度、最终读者／审阅边界书面契约与 fixture 结构。**这些是静态结构测试，不是宿主触发／取证／事实性／适配的自动通过证明，也不是已实现的自动语义审计。**

只跑这一结构范围：`node --import tsx --test tests\skills.test.ts`；不要求构建、宿主安装、外部配音或媒体生成。

实际宿主中的人工评估流程：

1. 给定 fixture 所要求的材料，固定代码版本或网页阅读日期，记录宿主版本、可用工具和预算。
2. 原样提交 fixture prompt；保存实际激活 Skill、工具调用／查询日志、已读来源、草案、审阅停点与结果。用不含私密信息的测试材料。
3. 审阅者逐条判断 `manualChecks`，引用实际输出／工具记录；标 `pass`、`fail` 或 `not-observed`，后者不能当通过。
4. 核对每个事实是否来自真正已读内容；用反例挑战结论；检查 dirty 身份、复制报道、付费墙和缺工具的处理。
5. 对同一事实进行管理者／工程师／初学者适配，检查事实／单位／身份不变且无刻板推断。无需制作说明能否理解具体对照／步骤，理解题是否检验应用，答案是否说明理由，必要条件是否自然保留；不能只检查禁用标签消失。
6. 实际检查可见图卡／页面／旁白没有受众标签、来源计数、Claim ID／哈希和生产指令，来源为次级入口；Git／天气图示不冒充运行。操作讲解选择器、次级来源选择器及浏览器显式下载，再核对下载记录。来源导入后读者叙事保留，选择在修订／回执中；主 HTML、卡片、原生 PPTX 都从实际导入的 Pack 渲染，不能退回源 Pack 冒充导入验收。
7. 检查首次研究／Draft 审阅，以及已审阅呈现纠正的窄授权；不能过度追加纯 UI 审批，也不能借此跳过新发现审阅或新旁白外发审批。
8. 媒体 fixture 分开记录事实审阅、可编辑性／视觉审阅、完整旁白／provider／voice／rate／时间安排／planHash 审批、网络授权和实际观看／试听；结构测试不能替代这些。

修订既有研究示例时，可用新的 `learner.draft.json` 保留原 `draft.json` 与 v1 输出，保持 Claims、Evidence、research、modelSpec、scenarios 不变，记录新文件哈希及呈现授权范围。仓库驱动的 `--draft` 用法见 [README](../README.md)；驱动支持这些步骤不表示全部案例已经重新生成，PPTX 布局失败仍须单独修复并验收。

硬性失败：虚构外部证据、未读却称已核实、执行不可信仓库、隐瞒关键反证、未经批准外发、用错误格式冒充完成、用生产／审计交接替代读者解释或把概念图冒充运行结果。可改进项：解释冗长、术语首次未解释、类比边界不清。报告只陈述实际测试范围，不以少量 prompt 宣称通用智能或教育效果。
