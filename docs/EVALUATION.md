# Aha 技能对照评估

[文档目录](README.zh-CN.md) · [研究协议](RESEARCH.md) · [使用指南](USAGE.zh-CN.md)

本评估把**固定材料、作者生成、隐藏评分、真实读者迁移**分开。它不是模型自动排名，也不会把 HTML 通过检查解释为“读者理解了”。

目录按用途分开：`evals/skills/` 保存本文的技能对照用例与判据；[`evals/examples/refresh-20260916/`](../evals/examples/refresh-20260916/) 保存 ANC、Git 和旧快照 Aha 四格式作品记录；[`evals/examples/greenland-20260917/`](../evals/examples/greenland-20260917/) 保存格陵兰视频记录；[`evals/examples/code-pilots-20260917/`](../evals/examples/code-pilots-20260917/) 保存 CPython/Docker 试片的批准、状态与重放、编码、有限视觉覆盖及首次失败记录；[`evals/examples/aha-introduction-20260917/`](../evals/examples/aha-introduction-20260917/) 保存新版项目介绍的修订试片确认、完整旁白批准、离线录音导入与连线修正证据。新版介绍的试片确认不代表完整版连续听看；两支独立代码试片的连续听看也未确认。旧版结果仅作历史证据，新的检查另存。成品验收不是技能对照结果，作品仍位于 `examples/`；当前身份检查入口 `npm run examples:verify` 检查十六份作品，兼容直接配音与批准导入的录音来源，并验证重新封存的错误编码记录仍被拒绝。

**当前评分协议：`rubricVersion: 2`。** 内容断言与过程证据分开，读者理解独立测量。每轮冻结题目、材料、技能和判据；修订用于新运行，不覆盖已冻结的包，也不事后改规则提高分数。

## 1. 四个固定案例

`evals\skills\evals.json` 保留 skill-creator 常用的 `id`、`name`、`prompt`、`expected_output`、`files`，并附加 `skill` 和评价文件路径。**这个总表只给主持人；不要直接发给作者**。暂存器显式选择作者字段，不展开总表。

| ID / 名称 | 技能 | 作者任务概要 | 输入规模 |
|---|---|---|---|
| 1 / public-topic | aha-research | 给社区编辑写遮阳站点试点报告及建议 | 5 份短材料：首报、报道、方法、更正、独立实验 |
| 2 / code-retry | aha-research | 只读调查 Parcel relay 取消、重试、清理和测试 | 4 个原始文件，加暂存时生成的工单与真实 Git 状态 |
| 3 / tank | aha-explain | 用离线中文 HTML 解答朋友的水箱问题 | 1 份原始测量记录 |
| 4 / library | aha-explain | 用中文 HTML 为编辑解读取书变化及后续行动 | 1 份原始记录 |

全部材料是本仓库原创的**虚构、固定测试资料**，并在源文档中逐一标明；不是现实机构、已发表研究或真实调查数据。研究案例测试 provided-material 研究判断，不测试实时搜索能力，不允许声称进行了联网研究。题目不包含评分结论、必画图种或长文结构配方。作者可自由选择表达方式。

`tests\fixtures\explanation-writing-evals.json` 用于改写回归，与这里的独立作者评估分开，不能据此推断技能主动补足推理的能力。

`evals\skills\scenarios.json` 单独保存宿主运行的广泛技能场景，包含原始提示、材料要求、参考文档和人工检查项；`tests\skills.test.ts` 校验其结构、覆盖与参考链接。它不是 `evals.json` 中四个固定案例的扩展，不属于 `fixture-lock.json`，也不由 `prepare.mjs` 暂存。固定案例的题目、材料与锁保持独立。

图片尺寸选择的宿主评估用例也在 `evals\skills\scenarios.json` 中：`landscape-image-comparison`（电脑一屏横版对比）、`mobile-scroll-image`（手机滚动竖图）和 `explicit-image-dimensions`（严格遵循指定尺寸）。运行时由主持人提供匹配的已审阅 Dossier、素材与目标容器信息，为基线和候选保持输入一致；分别评价尺寸选择、实际 PNG 尺寸和缩放后的可读性。用例定义及静态测试通过不代表已完成作者生成或视觉评估。动态生成和预览仍需独立执行授权；未运行项保持未验证。

## 2. 准备两个独立版本

要求 Node 22+；案例 2 另需本机已有 Git。暂存器无 npm/model 专用依赖，不安装软件、不运行模型。两个技能根目录都应含安装完成的 `aha-research`、`aha-explain` 子目录及各自的 `SKILL.md`、`scripts\aha.mjs`。不要指向整个代码仓库。

先保存基线与候选版本到两个独立、之后不再修改的安装目录。下面是 PowerShell 命令；把两个绝对路径替换为已有目录：

```powershell
$baseline = 'C:\AhaBundles\baseline'
$current = 'C:\AhaBundles\current'
New-Item -ItemType Directory -Force .\artifacts\skill-evals | Out-Null
node evals\skills\prepare.mjs .\artifacts\skill-evals\baseline-r1 --skill-root $baseline --label baseline-r1
node evals\skills\prepare.mjs .\artifacts\skill-evals\current-r1 --skill-root $current --label current-r1
node --import tsx --test tests\skill-evaluation.test.ts
```

单案例/子集可以重复 `--case`，名称和 ID 均可；未指定则准备全部案例：

```powershell
node evals\skills\prepare.mjs .\artifacts\skill-evals\subset-r1 --skill-root $current --case 1 --case tank --label subset-r1
```

生成资料统一放在仓库已忽略的 `artifacts\skill-evals` 下，不放在可提交的示例目录或仓库根目录。输出目录必须**不存在**，父目录必须存在。已存在目录即使为空也不覆盖；拒绝目录穿越、符号链接/junction 技能路径、未知案例、缺失 bundle 和损坏材料。失败后的部分目录没有 `evaluator\run.json` 完成标记，不应用于实验，重新指定新目录。可用 `--git 'C:\Program Files\Git\cmd\git.exe'` 指定受信任的绝对 Git 路径；默认解析 PATH 中仓库以外的现有 Git 可执行文件。

技能仅通过**绝对路径引用**，不复制技能目录或 node_modules。暂存器流式计算 bundle 全文件清单和 SHA-256；并非只记录版本号。主持人应冻结两个 bundle，开始/结束后复核清单。不必要地复制整个仓库、依赖树或历史输出会破坏隔离。

## 3. 输出布局和身份

```text
<新目录>\
  author\<case>\
    task.json
    RUN.md
    inputs\<case>\...
    outputs\
  evaluator\
    run.json
    git-environment\...              # 仅案例 2；空配置和空模板
    <case>\
      eval-metadata.json
      eval_metadata.json            # stock skill-creator viewer 的评价侧适配文件
      process-observations.json     # 独立过程观测，不计入内容断言分数
      human-responses.json
```

本地完整元数据使用 `schema_version: 1`；精简作者 `task.json` 和 stock viewer 适配文件遵循各自字段：

- `id`：案例 ID；`prompt`：原题；`skill`：所选 bundle 的绝对目录；`files`：相对输入文件路径。
- `RUN.md`：一致的授权边界、输出位置和输入范围，不含 hidden expected output、评分断言或迁移题答案。
- `evaluator\run.json`：准备状态、时间、`rubricVersion`、版本标签、Node/平台/架构/Git 身份、暂存器哈希、语料清单哈希、技能根/逐文件哈希/内容哈希、案例位置；`generation` 初始为 `pending`，模型、预算、耗时、token 等初始为 `null`，由主持人据真实运行补录。`prepared` **不等于已经生成或评分**。
- `eval-metadata.json`：原 `expected_output`、`rubricVersion`、prompt/RUN/input 哈希、隐藏 rubric/迁移题、实际 Git 快照及 `process_observations` 初始快照；四个评价维度分别初始化 `status: pending, score: null, evidence: []`。
- `eval_metadata.json`：stock viewer 使用的 `eval_id`、`eval_name`、`prompt`、`assertions`，并附 `rubricVersion`。只输出可从产物评判的内容、来源定位和静态结构断言，不含过程条件或通过结果；视觉评价单列，迁移题/答案不进入自动断言。此文件也只能给评价者，不能放回作者目录。
- `process-observations.json`：独立过程观测模板，含 `rubricVersion`、案例 ID 及各条件的 `id/text/required_evidence/status/result/reason/evidence`。准备时全部为 `status: pending, result: null, reason: null, evidence: []`。它是后续过程评价的工作记录；完整 metadata 内的同名内容是准备时初始快照，不用于覆盖已收集观测。
- `human-responses.json`：未收集的读者回答模板，初始 `status: pending`、`consent: null`、`responses: []`、`comprehension_score: null`，不是 0 分或通过。

两个 metadata 文件是有意保留的不同语义视图：连字符版本是完整审计/评价记录，含身份、来源定位和单独的迁移协议；下划线版本只是 stock viewer 所需的最小适配投影，不含迁移答案、身份快照或已评分结果，不能替代完整记录。它们在准备时由同一份数据生成，均不属于作者包。

`fixture-lock.json` 将清单、所有原始材料、Git 改动配方、rubric 和迁移答案绑定到 SHA-256，并记录评分版本及被替代 lock 的身份。语料采用 UTF-8/LF 规范化，避免 Windows checkout 的 CRLF 造成无意义差异；暂存后的输入也是 LF。bundle 和已暂存工作区记录的是实际字节哈希。变更固定语料后必须人工复核事实/定位，再用同一 UTF-8/LF 规则重新生成 lock；不能用刷新哈希掩盖未评审变更。候选与基线必须使用同一语料 lock、评分协议、题目、RUN 指令和输入哈希；`task.json` 总哈希因技能绝对路径不同而不同是正常的。过程条件文件属于 evaluator-only 语料，不进入作者包。

案例 2 在准备时使用空模板、空全局配置、禁用系统配置、hooks、fsmonitor、换行转换及签名，以固定作者/时间创建本地初始提交，再产生 staged / unstaged / untracked 状态。它不执行输入脚本，不访问远程，不 reset 或修改用户仓库。Git 状态、HEAD、差异及每个文件的 HEAD/index/worktree 哈希来自真实命令和真实内容，不是编造提交号。作者只获输入 Git 仓库；配方和快照评分副本留在 evaluator。

## 4. 作者运行由宿主完成

暂存器**不是生成器**，没有隐藏的模型调用。宿主 CLI/API 没有统一接口，因此不提供假装可运行的某模型命令。准备后，对两个根的每个 `author\<case>` 启动一个新的干净作者会话，工作目录限定在那里，只给以下启动指令：

> 读取当前目录的 RUN.md 和 task.json，按其中所选技能执行任务，将交付物保存在 outputs。只读指定输入。

不要把本页后面的评价材料、总清单、expected_output、evaluator 路径内容、先前作者结果或本次实现对话附加给作者。两个条件采用相同的模型版本、系统提示、工具白名单、上下文窗口、token/时间预算、重试规则和可用受信任 CLI 能力；若工具或运行时随技能版本改变，单独披露为混杂因素。支持固定 seed 的宿主应记录 seed；不支持时记录 `null`，不要杜撰。

**权限**：作者可读原始材料/所选技能；可调用受信任 Aha CLI 作不执行作者代码的检查、构建及打包；可作禁用 external diff/textconv/fsmonitor 的只读 Git 查询。不得运行输入仓库的模块或测试，不得执行/浏览器打开作者 HTML/JavaScript，不得联网、安装、发布、改写输入或技能。若某 CLI 操作需要执行 HTML、联网或缺失工具，标记未运行；不为了完成评分扩大权限。评估 HTML 时可静态读源文件；确需动态渲染，应另行使用经批准的、断网受限沙箱，不能让通用 Node 测试 import 作者产物。

**隔离是宿主职责**：普通目录布局不是 OS 安全边界。同机任意文件读取权限仍可看到兄弟目录。宿主应只挂载当前作者包和所选 bundle，或设置工具路径白名单；隐藏 evaluator 和源 checkout，不给目录上层搜索权限，并禁用网络。共享文件系统只能做到程序性隔离时，必须披露此限制，不能声称答案无法访问。输入只读也应由宿主权限落实；运行后比较 `input_sha256`、真实 Git 状态和技能清单，任何修改/越界应单独记录，不能作为合格运行。

## 5. 分开评价，别把检查当理解

四个维度各自报告，不混成一个“理解通过率”：

1. **正确性与来源支持**：评价者读取隐藏 rubric，用精确文档锚点或代码行/状态检查主张。每个判断附输出摘录及来源定位；不只匹配关键词。
2. **结构与操作**：`structure_operation` 的计分断言只涉及输出中的文件结构、离线依赖和来源可追溯等静态产物。CLI 检查记录和操作权限证据另行报告，过程限制由 `process-observations.json` 管理，不混入语义分母。自动测试能证明准备流程和固定代码行为，不证明模型报告正确。
3. **清晰度与视觉表达**：单独盲评可读性、视觉编码、决策帮助和不确定性呈现；不数段落、图表或因果箭头。
4. **人的理解**：只有真实读者的迁移回答可以贡献得分；模型自评、评价者猜测、读者“我懂了”不能替代。

`tests\skill-evaluation.test.ts` 自动验证材料锁、原始来源定位、作者包不含答案、不同 bundle 的可比输入、实际 dirty Git 身份、防覆盖/参数错误、待收集模板，以及**已经审查并哈希绑定的输入 fixture**的取消/超时行为。该宿主测试不会执行未知作者模块；作者任务仍禁止执行 fixture。

自动检查结果/报告正确性属于回归证据。案例含新领域不等于读者发生迁移；模板题目只能建立测试协议。必须收集人在新的数值、条件、代码或领域中的独立推理，才能讨论迁移。

### stock viewer 与诚实计数

这里的 stock viewer 指外部 [Anthropic skills 仓库的 skill-creator](https://github.com/anthropics/skills/tree/main/skills/skill-creator) 中的 `eval-viewer/generate_review.py`，不是 Aha 自带命令或依赖。使用前由主持人单独审阅并记录所选上游 commit、许可和实际命令帮助；浮动 `main` 链接只用于发现，不保证未来接口兼容，也不自动授予下载或执行许可。Aha 保留 `eval_metadata.json` 作为适配投影，不承诺所有 viewer 版本均兼容。

不安装 viewer 也能完成本协议：直接阅读冻结产物、`eval-metadata.json`、`process-observations.json` 和逐条评分文件，用现有编辑器记录结论。动态预览作者 HTML 仍需另获授权；viewer 是否可用不改变内容、过程与真人理解的评分边界。

生成完成后，主持人可在**另一个评价专用目录**按 `eval-<ID>\<盲标签>\outputs` 收集冻结、去标签的产物，并把对应 `eval_metadata.json` 放在 `eval-<ID>` 或该次运行目录中。这符合 stock `eval-viewer\generate_review.py` 查找运行目录/父目录 metadata 的规则，不必增建框架。评价后的 `grading.json` 可使用 `expectations: [{ text, passed, evidence }]`；只放已经真实评价的断言，未评的条目不要伪造 `passed`。评分、答案和 review 目录都不回传作者；任何 HTML 动态预览仍需满足前述沙箱要求。

**不要直接采用 stock aggregate 脚本的默认次数或缺失值补零。** 按实际宿主执行逐条登记开始/结束、成功/失败/未运行及每案例每条件的样本量；暂存目录的数量不是完成次数。失败保留记录，追加尝试另算并披露，不能静默挑选最佳结果。

宿主提供真实 token 或耗时时才记入测量；没有提供时，原始记录保持 `null`，汇总/benchmark **省略该指标及其均值、标准差、delta**，并写明未获得。禁止把缺失记为 0；禁止用字符数、文件大小或估计字数冒充 token。若 stock viewer/aggregate 要求这些数值，宁可只输出 artifacts/grading 和单独的诚实结果表，不造一个可喂给工具的数字。n=1 时也不把默认 `stddev: 0` 当成“稳定”；不具备重复样本的统计量应省略或明确不可估计。真实读者回答未收集时，理解维度仍为 pending/null，与上述作者运行次数完全分开。

### 独立过程证据

内容正确、产物有效以及遵守执行限制是不同判断。某个过程条件缺乏证据，不代表观察到违规，也不代表内容有语义错误；不能把无法证明记成通过或失败。

作者工作日志、最终产物、CLI 收据、输入哈希不变及 Git 状态不变，分别支持其直接覆盖的事实；它们不能独立证明整个运行中没有网络调用或发布行为。要认证“没有禁止调用”，需宿主保存覆盖完整会话的工具/进程调用追踪，落实并记录网络禁用及发布能力阻断，确认没有未追踪的执行通道。相关宿主追踪/执行约束尚未具备时，该过程条件保持未验证。不得仅凭作者自述“未联网”作认证。

禁止联网、执行输入、发布、安装、执行作者代码及修改输入/技能的条件位于 evaluator-only `process-checks.json`，由暂存器生成独立过程观测。内容断言只评价实际输出及任务需要的推理；使用单位转换或算术时必须正确，不强制题目未请求的特定推导或表现形式。

过程状态只能是 `pending`、`verified`、`failed`、`insufficient-evidence`。`pending` 和 `insufficient-evidence` 的 `result` 必须为 `null`；`verified` 对应 `true`，`failed` 对应 `false`，这两种已作结论的状态必须附真实证据定位及原因。`insufficient-evidence` 需说明缺少的证据，不转为 false 或通过；所有过程结果均独立于内容分数。导出的 `validateProcessObservations(value)` 校验状态、空值和证据字段的基本一致性，不能代替主持人核实证据覆盖范围。

每轮使用匹配的评分协议和 lock，并收集对应宿主证据；准备成功不能将模板中的 pending 自动变成认证结果。

## 6. 盲评与真实读者协议

- 先冻结生成结果，再由主持人随机映射为 X/Y 等中性标签，移除文件名、绝对路径或说明中的 baseline/current 暗示。映射表只给主持人，正确性/视觉评价者与读者不见版本标签。绝对技能路径留在生成记录，不展示给盲评者。
- 从 `evaluator\*.json` 对应案例中取 **2–3 道**迁移题。题目与 `expected_reasoning` 都不发给作者；读者只看到问题，不看到答案。研究与代码案例招募相应阅读/开发背景的人，解释案例使用目标普通读者，记录匿名经验层级。
- 先取得自愿、知情同意，允许退出；只存匿名 ID 和去标识化回答，不存姓名、邮箱、工作机密。若未同意，不收集回答或分数。组织另有保存/删除政策时优先遵循。
- **前后测**：先给等难度、不同表面数值的预备题，再读产物，再答后测；预先固定同一推理评分规则，题目版本由主持人保留，不进入作者包。或者采用**平衡顺序**：随机一半读者先 X 后 Y，另一半反向；使用等难但不同表面条件的题组，避免重复同题提示答案。说明残余练习/顺序效应。不能拿同一人第二次更熟悉当技能优势。
- 闭卷独立回答，不用模型代答。每题 0–2 分：0 表示错误或没有关键推理；1 表示部分正确但关键条件/理由不完整；2 表示判断与关键理由都正确。按隐藏 `expected_reasoning` 评分，不要求措辞一致。保留匿名原答及评分理由，必要时由第二位盲评者复核分歧。
- `human-responses.json` 收集后填 `status: collected`、`consent: true`、匿名 ID、`case_id`、`blind_artifact_label`、`design: pre-post | balanced-order`、`phase: pre | post`、`presentation_order`。`responses` 每项为 `{ question_id, answer, score: null, rationale: null }`；总分仍为 `null`。评分后才改 `status: scored`，填写每题整数 0/1/2、依据、匿名 `rater_id` 和 `comprehension_score`（各题总分，报告同时列分母）。模板一人/一阶段/一产物一份，不要覆盖别人的回答。
- 可从本脚本导出的 `validateHumanResponse(value)` 检查上述状态与分数约束。没有真实读者就保留 pending/null，明确报告“未做理解测量”，**绝不制造人类分数**。

一次/每条件一次仅是冒烟对照：不能估计模型随机性、稳定胜率或人群学习效果。资源允许时使用多个独立生成重复、多个读者，报告逐案例结果、失败、耗时/token、样本量与分布，不挑最好的一次。披露小样本、顺序效应、评审者主观性及共享文件系统限制；不可把 4 题均通过宣称为所有任务的普遍能力。
