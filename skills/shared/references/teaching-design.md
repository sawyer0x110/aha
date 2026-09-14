# 解释设计：从依据到读者能做的事

来源事实不是脚本；同一事实集不等于同一布局。先取证，再用下面的设计步骤把依据变成可理解的关系。此参考是三个 Skill 各自可用的工作法，不要求互相调用；纯研究交付可止于结论、台账与缺口，不强制制作课程或媒体。

## 1. 先定义理解，再排内容

在作者工作记录中写清下列内容；不要把整份记录印进读者页面，也不向严格 Schema 添加自造字段。

1. **目标**：读完后能预测哪一步的结果、解释哪个原因、把规则迁移到什么新情境？用可判对错的任务，不写“了解 Git”。
2. **误解与先备知识**：最可能的错误预测是什么？列出完成任务所需的术语／背景、已知与待引入部分，不从职业推断。不需要的高级例外移到相关任务的说明；会改变答案的条件必须随例子出现。
3. **最小实物例子**：选一份具体内容、数值或操作；把支持它的 Claims／Evidence 及适用条件绑好。只有术语定义的三张卡还不是机制解释。
4. **可见证据**：操作前是什么，操作改变了哪个对象的哪些内容，哪些保持不变？箭头表示复制、影响还是顺序，要有可核对的关系而非装饰。
5. **体验后归纳**：先让读者预测、查看例子与差异，再给一句可解释差异的规则。不用提前公布的口号代替经历。
6. **新情境迁移**：改变与规则有关的内容、顺序或条件，不能仅换名字后抄原答案；保留答案理由与每种典型错误的具体反馈。反馈指出错在哪里、该看哪处差异，而不是只说“再试一次”。

根据关系选表达：分类／定义比较沿用 `TeachingVisual` 的 `cards`，来源支持的步骤可用 `steps`；适配重试／复利规则的问题保留数值引擎。只有**有来源支持的状态变化**才选下述 `teaching`，不把天气概率、争议证据或所有知识硬塞进序列。

## 2. 可选 Teaching 编写契约

顶层 `teaching` 可选，嵌入 Draft／Pack；旧 Draft／Pack 与 `TeachingVisual` 继续有效。仅适用于 `evidence` 路由，仍是 `source-based`，不是新增 `observed` 引擎、Git 执行器或任意模拟器。计划可留在 Pack，渲染面必须 reader-first。

| 字段 | 精确形状与设计职责 |
| --- | --- |
| `title`／`objective`／`misconception` | 非空字符串，分别最多 90／240／240 字符；标题、可检验目标、待纠正误解是设计输入，不是默认展示的作者栏目 |
| `basis` | `{kind, note, evidenceIds}`；`kind` 为 `recorded-example` 或 `source-example`，`note` 非空且最多 180 字符；非空 `evidenceIds` 指向实际保留的 Evidence。前者每条所引 Evidence 须有真实 `contentHash`，说明记录对象；后者标明按来源构造，不能冒称实测 |
| `entities` | 2–3 项 `{id, label, description}`；label／description 非空且最多 40／100 字符；固定对象位置和含义 |
| `states` | 按发生顺序列出 2–7 项 `{id, label, values}`；label 非空且最多 60 字符；每个 `values` 恰含全部实体一次，每项 `{entityId, label, content}`，label 非空且最多 40 字符，content 最多 300 字符、可为空 |
| `transitions` | 1–6 项 `{id, from, to, targetEntityId, action, explanation, predictionId, claimIds}`；可选 `copyFromEntityId`／`command`；action／explanation 非空且最多 60／240 字符，command 非空且最多 120 字符 |
| `checks` | 2–8 项 `{id, kind, question, choices, correctChoiceId, claimIds}`；kind 为 `prediction` 或 `transfer`；question 非空且最多 240 字符；2–4 个 choices，每项 `{id, text, feedback}`，text／feedback 非空且最多 120／240 字符 |
| `card` | 专用 `{headline, summary, transitionIds, takeaway, claimIds}`；文本非空且最多 90／180／150 字符；`transitionIds` 选 1–4 个不同的已有操作。不是把全部词汇、计划和幻灯片压入一张 PNG |
| `outcome` | 可选 `{fromStateId, sourceEntityId, action, label, explanation, basis, claimIds}`；action／label／explanation 非空且最多 100／80／240 字符；basis 固定 `rule-application`。把已经批准的规则应用于保留状态的示意结果，不是观察到的执行 |

- states 数量等于 transitions 数量加一；每个 transition 必须连接列表中相邻前后态，**恰好改变一个 targetEntityId 的 content**，其他实体内容不变。多目标操作拆成有依据的步骤；不能编造中间状态来迎合 Schema，不能拆时改用适合的旧表达。
- `copyFromEntityId` 可省略；存在时不是目标本身，目标后态 content 必须等于来源前态 content。复制箭头须与这份内容一致；单纯编辑不画复制箭头。
- 每步绑定自己独有的 prediction check；所有 prediction 都须被操作引用。另有一个不同情境的 transfer check，不用重复预测题充数。每个 choice 都给具体反馈，正确项也解释原因。
- transition、check、card 的 `claimIds` 非空，指向已有、非 unresolved 的 Claims。basis 的引用存在不等于来源真正支持该例子；作者须核对实际证据，保留来源内容身份与研究台账。
- `outcome.fromStateId`／`sourceEntityId` 引用已有状态及其中实体内容；`teachingOutcome` 校验这些引用，不执行 action 或验证自然语言规则。outcome 的非空 claimIds 指向已有、非 unresolved 的 Claims，card.claimIds 也须覆盖它们及选定 transitions 的 Claims。使用条件语气说明“若此时执行……将得到……”，不追加虚构的已执行状态，不把 rule-application 冒充 recorded-example；原证据与主张不因画结果图而改变。
- 所有文本都是普通字符串，不是 HTML、脚本或可执行代码；`command` 也只是显示文本。状态是保留记录或按来源构造的例子，不暗示页面实际执行过操作。

### Slide.scene：页面目标，不是统一卡片皮肤

`narrative.slides` 手工编写为 **1–12 页**，不要求凑 5–8 页；数值 Story 导入模板仍接收 **1–4 个案例、组成 5–8 页**，二者不要混淆。

可选 `scene: {kind, transitionId?, checkId?, statePhase?}` 需要 teaching；不能同时选旧 `visual` 或 `scenarioId`。`hook`／`transition`／`mechanism` 必须引用 transitionId；仅 hook 必须显式带 `statePhase: "before" | "after"`，其他 scene 不允许 statePhase。`transfer`／`answer` 必须引用 transfer 类 checkId；`outcome`／`takeaway` 不带 transitionId 或 checkId，outcome 使用 teaching.outcome，缺失即失败。Slide 的 claimIds 覆盖其场景所需 Claims（outcome 用 outcome.claimIds，answer 用所引 check.claimIds）；详细约束以随附 Schema／校验为准。

hook 按作者填写的 statePhase 渲染，不硬编码为 after，也不根据正文猜测或自动补默认值；预测尚未发生的操作可选 before，讨论操作后的现象可选 after。正文与 phase 是否一致仍须实际画面 QA，字段合法不证明叙事正确。

用场景目标选择构图：hook 聚焦一个可预测的矛盾；transition 突出前后差异；mechanism 显示操作、方向和不变量；outcome 展示条件成立时的规则应用结果；transfer 先摆新问题，answer 再给答案及每个错误选项的理由；takeaway 收束成一条可复用规则。PPT 的 transfer 与 answer 使用同一 checkId，必须分成实际相邻的两页，下一页才揭示；不能用空 notes 或“答案见备注”占位。页面数量由解释需要决定，不能所有场景都只换标题、正文、三列框。

**两道画面硬门槛：** ①叙事时态与所示状态一致：“执行前／接下来”展示 before，“已执行／现在”展示 after；对照图分别标明前后，不能讲已 add 却画未 add 的暂存内容。②跨页实体位置与箭头含义稳定：对象位置／顺序不随焦点更换，复制、影响、时间顺序不能共用一个未说明的箭头；聚焦变化靠强调而非交换实体。变化高亮仅用背景、边框或独立标注，不向实际代码／content 添加 `+`、`>`、星号等字符；原内容已有的字符必须保留，不能让读者误认高亮符号为文件内容。

## 3. Git 最小例子：用内容证明不是“永远同步”

仅在已审阅 Git 来源支持这些操作时采用，下面是按来源构造的内容示例，不是本轮执行记录。先备知识：文件保存、暂存区、当前提交；本例使用一个已跟踪文件和普通 `git commit`，不包含自动暂存选项。

| 状态／刚完成的操作 | 工作区 `message.txt` | 暂存区 | 当前提交 |
| --- | --- | --- | --- |
| 初态 | `Hello` | `Hello` | `Hello` |
| 编辑并保存 | `Hello, team` | `Hello` | `Hello` |
| `git add message.txt` | `Hello, team` | `Hello, team` | `Hello` |
| 再次编辑并保存 | `Hello, team!` | `Hello, team` | `Hello` |
| 普通 `git commit` | `Hello, team!` | `Hello, team` | `Hello, team` |

每次操作前先问目标内容；揭示时高亮实际变化的一行、指出未变对象。add 时复制工作区到暂存区，普通 commit 时把暂存内容记录到当前提交；第二次编辑没有自动更新暂存区。先经历“文件最新却没全提交”的差异，再归纳：**普通提交记录的是暂存内容，不会自动跟随之后的编辑**。

迁移题改用新的两行内容：文件已暂存 `Title: One`／`Status: draft`，随后只把工作区第二行改为 `Status: ready`，未再 add 就普通 commit。让读者选提交中两行内容并说明原因。把“最新工作区”“空文件”“暂存快照”作为有理由的不同选择；正确反馈指出未再次暂存，第一行与第二行分别是什么。不能只问“暂存区是什么”或把刚出现的 Hello 答案再问一次。

`git add -p`、`git commit -a` 只在相关比较或迁移任务中展开，不在每张图重复。若提到 `commit -a`，必须保留仅自动暂存已跟踪修改／删除、不包括新未跟踪文件的条件；不能暗示所有提交都先单独 add。保持三者事实区别，不为简洁删关键条件。

下一步必须分别执行 [每种媒介设计](formats.md) 与 [检查—修订闭环](quality-loop.md)，不能把这张内容表原样铺满所有输出。
