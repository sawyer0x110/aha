# 参考项目：核验与原创采用边界

本记录保留 2026-09-11 的历史核验范围；下文“本轮读取”均指当时的分工记录，不是本次文档修订者重新访问上游的声明。本次按任务提供的最新固定 revision 补充设计采用要点，未重新执行来源／许可证审计；历史阅读不能自动算作新版已读。历史提交时间为当时 GitHub 返回的 committer UTC 时间，不代表文章发布日期或 Aha 完成日期。

五个参考分别帮助审视 HTML 表达、语音视频流程、可编辑 PPTX、图片卡片和受众适配。**代码库研究与公开内容研究必须先于这些表达形式**；Aha 自己的可复用研究工作法见 [RESEARCH.md](RESEARCH.md)。没有添加新爬虫、代码搜索引擎或自主多 Agent 平台。

## 固定版本与许可证

| 参考 | 固定 revision | 提交时间（UTC） | 许可依据 |
| --- | --- | --- | --- |
| [nicobailon/visual-explainer](https://github.com/nicobailon/visual-explainer) | `7163c3e10660912e0b89e1af465db9f387282b88` | 2026-08-28 22:23:39 | [MIT LICENSE](https://github.com/nicobailon/visual-explainer/blob/7163c3e10660912e0b89e1af465db9f387282b88/LICENSE) |
| [Vincentwei1021/anything2explainer](https://github.com/Vincentwei1021/anything2explainer) | `5b57239578284385c72ebfb2d1fce3ab61a3950a` | 本次未重新核验 | 历史版 `5544f59` 的 [PolyForm Noncommercial 1.0.0 LICENSE](https://github.com/Vincentwei1021/anything2explainer/blob/5544f599522cc0f7bab6d0dfe823905059641172/LICENSE)；新版许可未重新核验 |
| [hugohe3/ppt-master](https://github.com/hugohe3/ppt-master) | `6e3ce9c5a3b994a0e223a14a0f7eddf42fd0b9f5` | 本次未重新核验 | 历史版 `09ad58f` 的 [MIT LICENSE](https://github.com/hugohe3/ppt-master/blob/09ad58f0d58decc9d30799ca83374ff2604ef16b/LICENSE)；新版许可未重新核验 |
| [beilunyang/visual-note-card-skills](https://github.com/beilunyang/visual-note-card-skills) | `2d46ff6d43d67d2f20a67e06b8996a9b82e4b229` | 2026-03-18 14:05:31 | [MIT LICENSE](https://github.com/beilunyang/visual-note-card-skills/blob/2d46ff6d43d67d2f20a67e06b8996a9b82e4b229/LICENSE) |
| [DreambigOu/ELI5](https://github.com/DreambigOu/ELI5) | `a766623b062331fdde53467001379b4ddf3acc2f` | 2026-03-18 03:35:19 | [MIT LICENSE](https://github.com/DreambigOu/ELI5/blob/a766623b062331fdde53467001379b4ddf3acc2f/LICENSE) |

MIT 不是免除归属、字体、素材或其他依赖许可检查的许可。若今后复制代码或实质性文本，必须保留对应许可和声明；当前记录的采用是高层方法与独立编写，不宣称安装或集成这些参考仓库。

## 本次设计采用：工作法不是功能对等或学习效果证明

以下根据任务给定的固定参考与既有核验记录整理，不宣称本次逐文件重读或运行上游：

| 固定参考定位 | 采用到 Aha 的具体设计动作 | 不应推导的结论 |
| --- | --- | --- |
| [visual-explainer SKILL.md](https://github.com/nicobailon/visual-explainer/blob/7163c3e10660912e0b89e1af465db9f387282b88/plugins/visual-explainer/SKILL.md) | 让布局表达机制而非仅摆标签；检查操作对应的可见 delta、对象关系、箭头和不变量 | “自包含 HTML”或漂亮标题不证明读者理解，Aha 不因此获得所有上游交互 |
| [anything2explainer narration-guidance.md](https://github.com/Vincentwei1021/anything2explainer/blob/5b57239578284385c72ebfb2d1fce3ab61a3950a/reference/narration-guidance.md) | 另做分镜，旁白解释因果／衔接，视觉负责具体内容和变化；先代表性 pilot，再看实际音画修订 | 不只是加审批，不把朗读卡片当教学视频；不声明新增完整动画或复制受限提示词 |
| [ppt-master plan-core.md](https://github.com/hugohe3/ppt-master/blob/6e3ce9c5a3b994a0e223a14a0f7eddf42fd0b9f5/skills/ppt-master/references/plan-core.md) | 页面先定目标、焦点、阅读路径和构图；hook、transition、mechanism、transfer、takeaway 各负其责 | 可编辑文件或所有页面同一三列框不等于演示质量；不声明上游功能已集成 |
| [visual-note-card SKILL.md](https://github.com/beilunyang/visual-note-card-skills/blob/2d46ff6d43d67d2f20a67e06b8996a9b82e4b229/SKILL.md) | 独立单张海报／卡片只承载一个视觉论证，测实际尺寸、焦点、中文可读性 | 固定海报版式不是教师有效性或人类理解证明，也不是所有媒介的统一布局 |
| [ELI5 evals.json](https://github.com/DreambigOu/ELI5/blob/a766623b062331fdde53467001379b4ddf3acc2f/eli5-workspace/evals.json) | 保存任务和判据；Aha 另记录实际读者预测／解释／迁移回答及评分理由 | LLM 评估／断言检查不是人类学习研究，不能编造人类反馈或照搬上游分数 |

落实在三个独立入口及共享 [解释设计](../skills/shared/references/teaching-design.md)、[媒介设计](../skills/shared/references/formats.md)、[检查—修订闭环](../skills/shared/references/quality-loop.md)。源事实不是脚本，同一事实不等于同一布局；先小样实际截图，观察颜色编码、变化和关系、焦点与可读性，修设计／通用实现后重新生成。独立 Agent 视觉审阅只是启发式，学习成绩须来自真实回答；同一问题两次局部修补无效就回到设计，不以任意全局轮数宣布合格。

## 1. visual-explainer：为结论选择表达

本轮 HTML 实现任务的实际读取范围：

- [固定版 README](https://github.com/nicobailon/visual-explainer/blob/7163c3e10660912e0b89e1af465db9f387282b88/README.md) 的开头、Why、Install 部分，前 5,000 字符；不是全文阅读。
- 完整 [`plugins/visual-explainer/SKILL.md`](https://github.com/nicobailon/visual-explainer/blob/7163c3e10660912e0b89e1af465db9f387282b88/plugins/visual-explainer/SKILL.md)。
- 完整 [`references/responsive-nav.md`](https://github.com/nicobailon/visual-explainer/blob/7163c3e10660912e0b89e1af465db9f387282b88/plugins/visual-explainer/references/responsive-nav.md)。
- [`references/slide-patterns.md`](https://github.com/nicobailon/visual-explainer/blob/7163c3e10660912e0b89e1af465db9f387282b88/plugins/visual-explainer/references/slide-patterns.md) 开头的规划、布局和溢出部分，前 7,000 字符；未读其余内容。
- 完整 [LICENSE](https://github.com/nicobailon/visual-explainer/blob/7163c3e10660912e0b89e1af465db9f387282b88/LICENSE)：MIT，Copyright (c) 2025 Nico Bailon。

这些已读内容将系统、变更、计划与数据组织为 HTML 解释页，强调视觉层级、图表与浏览方式。

Aha 采用的原则：

- 第一屏先呈现结论与实际保存结果，摘要先于表单／细节，再选择概览、对照、步骤或来源视图。
- 使用语义锚点导航，并照顾键盘和减少动画设置；关系与顺序应传达含义，不作纯装饰。
- 保持标题层级、中文排版、响应式和适度信息密度；内容预算实际测量，溢出不能静默裁切。
- 将解释与保存的状态／证据关联，概览和细节分层；保持 Aha 自己的 Clawpilot 配色和字体选择，不采用上游视觉模板。

边界：导航、展开和图表缩放不是参数驱动的行为验证。Aha 的离线布局与交互是自己的实现，不复制参考模板或强制引入其工具接口；“自包含”需以真实断网／资源检查为准，不凭 README 用词推定。

## 2. anything2explainer：把审阅放在制作成本上升之前

依据：[固定版 README](https://github.com/Vincentwei1021/anything2explainer/blob/5544f599522cc0f7bab6d0dfe823905059641172/README.md)、本轮分工核验的 [`reference/research-brief.md`](https://github.com/Vincentwei1021/anything2explainer/blob/5544f599522cc0f7bab6d0dfe823905059641172/reference/research-brief.md)、[`reference/narration-storyboard.md`](https://github.com/Vincentwei1021/anything2explainer/blob/5544f599522cc0f7bab6d0dfe823905059641172/reference/narration-storyboard.md)，以及上表 LICENSE。文档描述来源研究、旁白、TTS／时间线、分镜、预览和质量检查的流程，并使用 Remotion；这是对其文档的概括，不是 Aha 集成 Remotion 的声明。

Aha 独立采用的高层顺序：有来源的主张台账 → 审阅旁白／音频来源 → 测量实际音频 → 代表性 pilot → 正式画面／音频与 QC。Aha 的 `prepare-video` 会给出待审阅计划，宿主须展示完整文本；`planHash` 不能代替人的审阅或外发授权。小样与正式版分别按真实输出验收，不用估算时长代替音频测量。

实际画面是原创静态状态卡片和短淡入淡出，不宣称达到该参考的完整 Remotion 逐镜动画能力。720p30 MP4、逐句字幕与音频封装是 Aha 自身交付规格，不能据此推导视觉效果或制作质量等同。

当前 Edge TTS 路径仅在用户选择提供方、批准当前旁白版本并允许该版本外发后运行；已选 Edge TTS 不是对以后所有旁白的概括授权。只发送确认过的旁白，不发送完整私有 Pack、代码或检索日志。provider、voice 与哈希可记录，秘密不可记录。运行使用已安装浏览器和 FFmpeg，不默认下载浏览器。参考项目的默认声线、网络选择、制作耗时、并行规模不转成 Aha 默认或承诺。

**许可边界**：固定 LICENSE 明确为 PolyForm Noncommercial 1.0.0，并声明商业使用该工具包须事先取得作者授权；所带字体另有许可。公司 Hackathon 不自动等于非商业用途。Aha 不复制其代码、模板、提示词正文、脚本、视觉素材或参考影片；仅学习高层工作顺序。不把 PolyForm Noncommercial 笼统称为 MIT 式许可，不以公开视频可观看推导可复制。

## 3. ppt-master：可编辑性是内容模型要求

本轮 PPTX 实现任务实际读取的依据：

- [`docs/project-positioning.md`，L15–21、L32、L57–65](https://github.com/hugohe3/ppt-master/blob/09ad58f0d58decc9d30799ca83374ff2604ef16b/docs/project-positioning.md#L15-L65)：原生可编辑 PowerPoint 对象而非整页截图，显式路由／质量契约。
- [`docs/technical-design.md`，L15–35、L54–60、L154–168](https://github.com/hugohe3/ppt-master/blob/09ad58f0d58decc9d30799ca83374ff2604ef16b/docs/technical-design.md#L15-L168)：不支持或含糊内容阻止输出，图形使用可核对数值，导出器不新增可见事实，写文件与包回读分开检查。
- [`docs/powerpoint-svg-mapping.md`，L29–30、L43–49、L59–60、L91–104](https://github.com/hugohe3/ppt-master/blob/09ad58f0d58decc9d30799ca83374ff2604ef16b/docs/powerpoint-svg-mapping.md#L29-L104)：原生对象语义、显式坐标／结构及包级检查。

该任务只在树中定位了 README.md／README_CN.md，未阅读它们；这里不把 README 算作已读证据。LICENSE 已完整阅读，为 MIT，版权声明为 2025–2026 Hugo He；上表提交时间由独立 GitHub commit 元数据查询取得。

Aha 采用“保留可编辑文本／形状、合理层级、检查实际演示文件”的要求，以自己的 Pack 状态生成原生内容。不是将整页 Lab 截图塞入幻灯片，也不是把 HTML 改为 `.pptx`；PPTX 的数字、单位、来源与边界应和其他 renderer 一致。

不复制或导入参考实现、提示词、模板、素材、SVG 转换器或依赖，不宣称直接集成。Aha 使用自己的 Pack-to-PPTX 渲染路径，具体能力以 `render-pptx` 和实际文件检查为准。原生文本／形状／图表、可核对数值、布局预算和 OOXML 回读借鉴的是高层质量要求；ZIP 结构／内容测试不等于在 PowerPoint 中验证版式或可编辑性。

## 4. visual-note-card：卡片不是整个应用的缩略截图

本轮图片实现任务完整阅读了 [固定版 README](https://github.com/beilunyang/visual-note-card-skills/blob/2d46ff6d43d67d2f20a67e06b8996a9b82e4b229/README.md)、[根目录 SKILL.md](https://github.com/beilunyang/visual-note-card-skills/blob/2d46ff6d43d67d2f20a67e06b8996a9b82e4b229/SKILL.md) 和 [LICENSE](https://github.com/beilunyang/visual-note-card-skills/blob/2d46ff6d43d67d2f20a67e06b8996a9b82e4b229/LICENSE)；许可为 MIT，Copyright (c) 2026 yangtianyi。文档介绍中文单页视觉笔记卡片、信息组织与图片保存方式。

Aha 只采用编辑层级、按内容自然选择对照列、有限单页构图及独立截图目标等高层方法，不强行套缩写或编造论点／公式。`render-card` 生成专用 HTML，`render-image` 用已安装浏览器的元素截图生成 PNG，不截整页 Lab。历史早期卡片曾把 Claim ID、受众和完整 Pack 哈希印入画面；这不是当前交付契约：当前可见卡片应突出读者问题、具体内容／关系、必要条件与简洁来源，审计身份保留在 Pack／回执／来源元数据，不放在读者画面。

重要区别：参考 README 的 Overview 在“self-contained”表述旁明确列出 Google Fonts 和 html2canvas CDN 例外，Typography 说明字体经 Google Fonts CDN 加载；SKILL 的 Output／Download Button 部分同样引入远程资源。因此不能据此认为浏览器断网时完全独立。Aha 只用离线系统字体、自己编写的内联 SVG／CSS 和本地浏览器截图，不采用 html2canvas、CDN、自动加载远程资源或上游模板；实际中文排版与裁切仍需检查。当前没有直接集成该参考 Skill。

## 5. ELI5：按任务和已知背景适配，保持准确性

本轮直接查看了固定 revision 的仓库树，定位并阅读：

- [`skills/eli5/SKILL.md`](https://github.com/DreambigOu/ELI5/blob/a766623b062331fdde53467001379b4ddf3acc2f/skills/eli5/SKILL.md)
- [`eli5-workspace/evals.json`](https://github.com/DreambigOu/ELI5/blob/a766623b062331fdde53467001379b4ddf3acc2f/eli5-workspace/evals.json)
- 根目录 [LICENSE](https://github.com/DreambigOu/ELI5/blob/a766623b062331fdde53467001379b4ddf3acc2f/LICENSE)

可以学习的维度：受众背景、词汇、类比、展开深度和解释 framing。Aha 独立编写 [`audience.md`](../skills/shared/references/audience.md)，不复制原提示词或示例：

- 管理者：与实际决策相关的影响、风险和权衡，不假定没有技术背景。
- 工程师：机制、契约和失败路径，不假定已掌握所有领域知识。
- 成人初学者：逐层引入术语，至多一个有明确不适用处的类比，以及一个理解检查问题。

不采用儿童默认、按年龄／亲属关系推定兴趣或知识的分类，也不采用以牺牲事实准确性换取简化的原则。PRD 的成人默认和儿童版不在范围保持不变。各格式只改变表达，不改变事实、单位、关键条件或不确定性。

评估形式方面，所读 `evals.json` 具有 `skill_name` 和 `evals`；条目含 `id`、`name`、`prompt`、`audience`、`assertions`。这启发了保存具名场景与判据的做法，不是复用原 prompt、儿童刻板案例或评估实现。Aha 的 [`tests/skills.test.ts`](../tests/skills.test.ts) 保存原创成人／研究／格式 benchmark fixtures，只验证文件与 fixture 结构；宿主触发、实际取证、受众适配和事实性仍须 [人工语义评估](RESEARCH.md)。未运行上游评估器，不声称上游结果能证明 Aha 表现。

## 运行依赖与参考项目分开核验

上面的五个项目是方法参考，不是 Aha 依赖清单。随发布物提供的 JS 运行依赖和可选外部程序应另行记录许可：

- 每份完整 Skill 在本地 `node_modules` 内带有 `playwright-core`；基础使用无需另跑 `npm install`，但不能称发布物“没有 node_modules”。PNG 仍使用用户已经安装的 Edge／Chrome，不默认下载浏览器。
- PPTX 使用随发布物提供的 PptxGenJS 等 JS 库；这不是集成 ppt-master 的证据。浏览器、FFmpeg 及其具体发行版许可另行审查。
- 本轮核验的 [rany2/edge-tts 7.2.8 LICENSE](https://github.com/rany2/edge-tts/blob/7.2.8/LICENSE) 仅将 `src/edge_tts/srt_composer.py` 列为 MIT，其余客户端代码为 LGPLv3，不能把整个客户端标为 MIT。
- Aha 仅提供自己编写的 Python API 适配器及 `requirements-media.txt` 中的 `edge-tts==7.2.8` pin，不携带该 Python 客户端库；由用户明确单独安装，不自动安装或默认联网。
- 客户端代码许可不代替在线服务条款、可用性或隐私授权。Edge TTS 是 Microsoft 在线语音的社区客户端，不是离线 TTS，也不承诺提供 Azure 凭据。每个新旁白版本的外发仍须明确批准。

## 采用记录的使用方式

以上是来源可定位的高层设计依据，不是功能对等表。功能完成以 Aha 自身命令、产物、结构测试和真实人工检查分别说明。下一次升级参考时重新固定 revision、查看相关 diff 和许可，不能仅因名称相同而沿用旧结论。
