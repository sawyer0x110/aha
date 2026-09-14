---
name: aha-story
description: 先研究代码或公开材料，再把同一份已审阅依据适配为中文讲解：离线 HTML slides、图片卡片、原生可编辑 PPTX 或经旁白与提供方审批的语音视频。适用于成人受众讲解、案例传播和从 Aha Pack／exploration 转演示。可独立研究和创建草案，不要求先调用 aha-lab 或 aha-research；缺少依赖时如实停止。
---

# Aha Story：用同一份依据讲清楚

## 当前能力

- 交付用户选择的 HTML slides、图片卡片、原生可编辑 PPTX 或已批准的语音视频，以及解释包和实际回执。无需先调用其他 Skill。
- 重试与复利采用 `derived-model`；证据比较采用 `source-based`。不导入真实观察轨迹，不执行仓库。
- 前端与内容仅支持 `zh-CN`；图片／视频需要可选本地依赖，云 TTS 需用户选择并明确授权。`source-based` 不表示独立验证事实。
- 视频是保存状态的原创静态卡片与短淡入淡出，交付 720p30 MP4、逐句字幕／SRT 与回执，不是完整 Remotion 级动画。实测音频不合时长范围就拒绝，不扭曲语速凑数。
- 不要求 Canvas、MCP、宿主专有 API 或 Agent 委派；通过本地文件衔接，不假设能自动调用其他 Skill。

## 最终读者交付

- HTML、图片、PPTX、MP4 默认是给最终读者的成品，不是给委托人或下一位 Agent 的制作交接。直接解释主题，给具体概念对照／步骤、必要条件和有理由的理解题答案；不能只去掉几处标签，仍交 Brief／审计字段清单。
- 受众是内部编写输入。可见正文、图示、Pack `narrative.slides[].notes` 的讲解文字和旁白不放受众标签、来源计数、Claim ID、哈希、生产／协议／审批指令；这些保留在 Pack、研究台账、回执与来源元数据。保留简洁来源和自然语言事实条件；来源查阅是次级入口，不是主要学习活动。
- 原生 PPTX 审计备注与内嵌 Pack 有意保留完整来源身份和研究元数据，不要求删除。TTS 使用 Pack 的 `narrative.slides[].notes` 准备读者旁白，不读取原生 PPTX 审计备注；分享前仍须审查文件中的两类备注与内嵌内容。
- 用 `brief.explanation.visual`／`conditions`／`answer` 与 Slide 的 `visual`／`conditions` 创作解释，`TeachingVisual` 约束见 [编写契约](references/authoring.md)。图示解释主题而非制作管线，由已有 Claims 支持，不是新模型或观察轨迹；普通字符串不执行 HTML／代码，不暗示实时 Git／天气模拟。
- 来源事实不是脚本，同一事实集不等于同一布局。按 [解释设计](references/teaching-design.md) 先写预测／解释／迁移目标、误解、先备知识与具体内容例子；有来源的状态变化才用可选 `teaching`／`Slide.scene`，不替换适合的概念卡或数值引擎。

## 开始前

读取 [编写与工具契约](references/authoring.md)、[Story 叙事与交接](references/story-workflow.md)、[受众适配](references/audience.md) 和 [格式交付](references/formats.md)。按输入直接读取 [代码库研究](references/research-codebase.md)／[公开内容研究](references/research-public.md)，共享参考已随本 Skill 发布，不依赖自动调用另一个 Skill。

找到当前 Skill 安装目录，在宿主允许执行本地命令时运行：

```powershell
node "<技能绝对目录>\scripts\aha.mjs" doctor
```

所有 `<技能绝对目录>` 都须替换为实际绝对路径。POSIX 使用 `node "<技能绝对目录>/scripts/aha.mjs" doctor`，不能照抄 Windows 反斜杠。当前工作目录可以是用户作品目录，不必是 Skill 根目录。需要 Node.js 22 或更高版本；缺失工具或权限时报告阻塞，不自动安装。

## 先判定输出格式

- HTML、图片、PPTX：完成以下研究、审阅与叙事流程后，用格式参考中对应命令，不改扩展名冒充。
- 视频：`prepare-video` 后展示只读计划的完整提纲、逐段旁白与 provider／voice／rate／时间安排；任何计划编辑后 `video-plan-check` 重算当前 `planHash`，展示完整文本并重新审批。授权该旁白版本外发后才 `synthesize`，随后 `render-video`；没有额外封存命令。已选 Edge TTS 不等于以后版本的外发授权，不能只给哈希盲签。
- `doctor` 显示缺少浏览器、FFmpeg、Python／TTS 依赖或无授权时停止该格式；只有用户明确改选才另交 HTML。英文仍不支持。
- 用户选择自带音频时可用 `import-audio` 离线替代，必须标明 `provider: "provided-audio"`，不把替代方案称为 Edge TTS 成功。

## 三种输入入口

### A. 只有问题或材料

1. 明确核心问题、子问题、授权范围、预算与停止条件；默认成人初学者、中文，儿童版不在范围。受众背景用已知信息，不从年龄／职业推断。
2. 先实际研究，不先写幻灯片。仓库锁定版本／diff／dirty 哈希，优先代码智能／LSP 再窄文本，核对定义、调用者、代表路径的错误／重试／取消、测试／配置／历史；不执行仓库。未运行测试标未观察，测试或 commit 消息不能单独证明行为。
3. 公开内容按原始来源优先，保留精确查询、标题、日期、链接和 UTC 获取时间；实际读引用内容，检查独立性、数值口径与相反证据。未访问的链接不能称已核实，付费墙／缺工具记缺口。按共享参考形成主张台账、scope gaps 和可选 `research`，模型回答不是外部证据。
4. 选择 `retry`、`compound` 或 `evidence`。没有计算引擎时明确转为来源讲解，不制造因果或任意数值模型。
5. 用 `init <engine> <新草案.json>` 开始，编辑所有与任务有关的 Draft 字段。模板并非研究；示例不能被重新标成用户材料。
6. 以同一事实集适配受众：管理者决策／影响权衡，工程师机制／契约／失败，成人初学者一个有边界类比及有答案的理解题。可用 `brief.explanation` 保存，不改变事实／单位／不确定性。
7. 写规范 `draft.json` 与按目标手工编写的 1–12 页 `narrative`，不强制凑 5–8 页，不是作者待办，只引用真实主张、案例与步骤。`research-check` 仅查结构／覆盖，不执行搜索。首次构建前提交结论、反证、台账、缺口和 Draft 供明确审阅，通过后才 `build-pack`。

### B. 已有解释包

1. 先运行 `validate <pack.aha>`，读取 Brief、来源、主张、案例和叙事。
2. 内容适用就复用，不重新编造计算结果，也不为凑页面重取全部来源。
3. 用户明确要求纠正已审阅且事实／证据不变的呈现，授权对应本地修订：从原内容整理新 Draft，保持 Claim／Evidence ID 与内容身份、单位、关键限制、模型输入及研究台账，记录范围和新 Draft 哈希、保留旧输出，不为纯 UI／排版另造审批循环。若有新发现或事实／来源变动，则补证并明确审阅受影响部分再构建。精确边界见 [审阅范围](references/authoring.md)。
4. 上述请求不授权外部 TTS；新旁白仍须另批完整文本、provider、voice、rate、时间安排及当前 `planHash` 和外发。`build-pack` 写新路径产生新快照，不声称自动保存父修订关系；不编辑封存 Pack，不发明叙事修订命令。

### C. 已有 exploration

1. 获取导出时对应的**精确原始 Pack 修订**。不能拿相同主题但不同哈希的 Pack 替代。
2. 探索格式／导出允许 1–10 个；数值 Story 导入模板接收 1–4 个，组成 5–8 页，超过 4 个返回 `STORY_CASE_LIMIT` 且不创建 Pack，须重新选择或分批导出，不默默丢弃。来源模式保留已编写叙事，不按来源数制造交接页；选择留在新修订／回执。A/B 两案例不受影响。
3. 调用：

   ```powershell
   node "<技能绝对目录>\scripts\aha.mjs" import-exploration ".\topic-v1.aha" ".\topic.exploration-v1.json" ".\topic-v2.aha"
   ```

4. 程序核对 Pack 身份、引擎版本和引用，重算适用的内置轨迹；成功后生成保留来源和主张的新修订。来源模式保留原 `narrative` 的讲解、图示和条件；数值模式按选定案例编排。
5. 导入笔记不自动进入事实叙述。笔记中出现新断言时，需要独立证据才能成为主张。
6. 不匹配或不支持的模式必须停止，不手改 `packHash`、版本或轨迹来绕过。

## 编排、渲染与检查

- 先用具体案例让读者预测、看操作造成的变化与不变量，再归纳规则，最后解不同情境的迁移题；每个错误答案给具体反馈，不能只是复述刚看过的答案。
- 按 [格式交付](references/formats.md) 分别构图：PNG 一个视觉论证而非词汇堆砌；HTML slides／PPTX 按 hook、transition、mechanism、transfer、takeaway 的目标改变层级和构图；视频另做分镜，旁白讲原因，视觉展示关系，不逐字朗读卡片。不宣称新增完整动画能力。
- 每页一个重点；详细读者解释放 Pack 的 `narrative.slides[].notes`，不是写入原生 PPTX 审计备注。案例状态来自保存的轨迹，数字不在正文中另算。
- `eventStep: 0` 表示初态；其他步骤须在对应案例事件范围内。需要新案例时先用合法输入生成新 Pack，再写讲解。
- 模型／材料标签留在 Pack 与回执；可见内容用自然语言保留事实条件和简洁来源。逻辑等待不能称为真实耗时。图片／PPT 适配审阅过的讲解图示或保存的模型状态，不截整页 Lab。

```powershell
node "<技能绝对目录>\scripts\aha.mjs" validate ".\topic-v2.aha"
node "<技能绝对目录>\scripts\aha.mjs" render-slides ".\topic-v2.aha" ".\topic.slides-v1.html"
```

- 上例是用户选择 HTML 时的路径。其他格式使用 [格式交付](references/formats.md) 的实际命令；输出在 Pack 之外且尚不存在。
- HTML 内嵌 reveal 核心与必要资源，浏览器直接打开；备注在同页查看，不依赖弹窗或本地服务器。
- 按 [检查—修订闭环](references/quality-loop.md) 先保存代表性 pilot 截图，检查颜色编码、delta、关系、焦点、可读性与媒介适配。检查实际文件的逐页显示、导航、备注与中文；先修设计／通用实现再重新生成，不手改最终 HTML／PPTX。未执行视觉检查时明确写出。

## 失败、续跑与交付

- 同一问题两次局部修补仍失败就返回设计层，不设任意全局通过轮数；继续到阻塞项关闭或报告真实限制。独立 Agent 视觉审阅只是启发式，学习任务成绩须基于实际回答，不编造人类反馈；记录命令、身份、截图、修订及检查。
- 不覆盖旧产物；失败恢复使用新的版本化路径。来源仍适用时复用，改动主张或输入后主动重新构建并验证依赖结果。重验／导入只检查快照及关联身份；离线 HTML 不监视源文件，当前没有完整自动依赖图或增量失效机制。
- 生成物、批准输入／证据／Pack／必要回执和版本化截图／日志默认放忽略的 artifacts 或获准会话工作目录；旧版归档可回滚。用户指定交付目录后，显式 promotion 一套当前成品，不静默覆盖用户文件。
- 向委托人的完成报告列出 Pack、用户所选产物、CLI 返回的回执位置、来源／模型性质、实际检查和未完成项，与最终读者成品分开。没有真实文件不报告图片／视频已生成；未观看／试听就明确标注，不凭编码成功宣称语义／人工验收、宿主安装验收或完整 P0 完成。
- 分享前审查摘要、私有地址及演讲备注。离线 HTML 携带 Pack 数据，`private` 不提供加密；未经授权不上传。
