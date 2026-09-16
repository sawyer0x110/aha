# Aha 仓库独立研究：从证据到真正可读的解释

## 结论
Aha 不是把报告自动变成四种文件的模板引擎。它把工作拆成两个可移植技能：`aha-research` 产出独立报告和 Research Dossier；`aha-explain` 从足够新、覆盖问题的研究出发，创作指定视觉媒介。运行时负责结构与身份、离线打包和受许可的渲染，宿主作者负责“研究是否真的支持解释”这一关键桥梁。[e-skills, e-explain, e-project]

## 本次身份、目的与范围
研究面向第一次接触 Aha 的成年读者及评审者，解释用途、用户旅程、机制案例与能力边界。时间范围是本机 2026-09-16 读取的工作树；预算为只读源码/契约/测试研究和四种新源码创作，不运行仓库测试、不浏览外部网页、不进行渲染、语音、安装或发布。

实际分支是 `sawyer0x110-project-artifacts-example`，HEAD 为 `31ff1331b402bc80c3a731ca470000a77dcd594f`，不是 main。HEAD tree 为 `03f664db2e8af495d662685a10592ae631f409d8`；本地 origin/main 为 `c98b192797d8f682ba3db3ca610c7c6802e023ac`，tree 与 HEAD 相同；本地 main 为 `a013ea795312eab9ae2e4224998a1314eea8f718`，tree 为 `6b2ab206978aff746b2f31f14c0eda3f2fa0f628`，不同于当前树。未 fetch，不能宣称远端服务器此刻仍无变化。初始与本轮取证时 `git status --porcelain` 为空；授权产物写入忽略的 artifacts 目录不改变已跟踪源。精确 bundle SHA-256 另见 reviews/repository-identity.json。两套 portable CLI 当时字节相同，版本号 0.3.0 不等于 schema 版本 1.0.0。

问题树先问“用户为什么用 Aha”（q-purpose），再问“证据如何保存”（q-evidence）；两者确定后，才分别判断“案例界面到底计算什么”（q-cases）、“媒介为何不能同版复制”（q-design）、“运行时做到哪里”（q-runtime）、“测试/示例组织意味着什么”（q-layout）。q-observation 保留实际运行和理解效果的空白。

## 用户旅程：先答问题，再决定怎样展示
用户给出问题、材料、用途、读者背景及允许的资源。只要最终产物是报告，就停在研究；需要视觉解释时，作者可以在 aha-explain 工作流内研究，不依赖宿主自动调度另一技能。研究先形成论点与证据对应、反例与缺口，然后封存 Dossier。每个目标媒介通过 explain-init 复制同一个 Dossier，作者填写真正的源码和覆盖映射，再 explain-check。需要执行时另行许可，最后才看实际输出是否清楚可靠。[e-skills, e-explain, e-project]

## 快照保存可追溯性，不制造真实性
研究不是收集链接后给出结论。Dossier 有 report、claims、evidence、subquestions、researchLog、gaps 和 stopReason；代码证据保存惰性文本及匹配的 SHA-256，读日志说明实际范围。构建器严格检查引用、反向覆盖和完整性；report.md 必须与 research.json 的报告文字一致。新证据应进入新快照，旧作品仍绑定旧身份，不能静默改旧 manifest。[e-dossier]

反证检查：通过结构校验的论点仍可能过度推断。源码明确称这些记录是作者声明，不证明真的阅读或支持语义。于是本报告把“函数做什么”“测试断言什么”“本轮实际运行了什么”分开：下面的交互来自源代码检查，不是本轮操作网页后的观测。[e-dossier, e-artifact-test]

## 两个可看见机制的案例
### ANC：滑块改变条件，而不是只换一个结论
当前 ANC HTML 的每个语言分支独立找到 data-model。滑块取 0–180 度，相位偏差换算为弧度；循环采样 240 个点，生成传入、扬声器和相加结果三条 SVG path。归一化残余峰值取 `2 * abs(sin(delta / 2))`。0 度时理想等幅单音相消；60 度时峰值比 1；180 度时为 2。输入事件同步更新曲线、读数、可访问说明与条件反馈，Reset 回到 0。[e-anc]

这说明交互如何把“条件变化→压力叠加→结果”显示出来，不证明任何商业耳机的降噪量。这里是模型源码，不是本轮声学实验；峰值比 2 不能写成“听起来两倍响”。更丰富的旧 ANC 文章涉及频率、路径及人声，但本次不重新验证其外部来源，因此新概览聚焦已读界面机制。

### Git：按钮展示已有记录，而不是网页偷偷运行 Git
当前 Git HTML 内嵌三条 RECORDS。按钮映射到 one/apart/clash；selectCase 使用 textContent 更新 base、ours、theirs、result 四面板，同时控制提交节点、HEAD、合并边与索引 stage。撤销例中 timeout 的 base=30、ours=30、theirs=60，内嵌结果=60；分离编辑例保留 timeout=60 与 retries=4；冲突例保留 diff3 标记、HEAD 留在 ours，没有新合并节点。[e-git]

这些是本机已有记录的呈现逻辑，不是本轮重新执行的 Git 实验。页面并非通用合并模拟器，文本合并成功也不等于应用行为正确。新概览会重画精简界面并明确称为“embedded record / 内嵌记录”，不搬用旧实验的现场背书。

## 为什么四种媒介需要四次创作
同一证据可以共享，几何和节奏不能共享。HTML 让读者主动比较条件和展开说明；PNG 必须在单张画布上自给自足；PPTX 用原生文本、形状和连线逐步演示关系；视频把条件变化、局部强调和结果出现与叙述同步。把长文缩成截图既不保证 PNG 可读，也破坏 PPTX 的编辑性；仅整页淡入不等于机制动画。[e-project, e-render, e-video]

新图像指南明确先看用户尺寸，再看目标容器、阅读情境和内容结构。1080×1800 在本任务中仅作为滚动概览的初始选择，不是 Aha 默认推荐。新图的核心字号计划为 42–48px，在 540px 显示宽度约 21–24px；在 390px 手机宽度约 15–17px，因此必须按真实宽度审阅，必要时精简，而不是只提高像素数。技术上 image 高度可到 16000，但这不支持无限加长。[e-image, e-project]

## 运行时实现与宿主职责
已读实现中，explain-check 检查 scaffold、status、已知 claim、覆盖/省略、研究身份与 HTML 静态资源；它不导入 PPTX 作者模块。render-html 打包时不执行作者 JS，并写 outputHash、sourceHash、researchHash。PNG 浏览器捕获、PPTX Node 模块执行与视频捕获需要明确本地许可；Node 作者模块不是安全沙箱。浏览器网络限制是防护措施，不是万能隔离。[e-project, e-render, e-artifact-test]

视频 plan 明确 provider/voice/rate、时长范围、segment 文本及 claimIds。完整计划哈希包括视觉 sourceHash：修改视觉也会让旧音频绑定失效。当前引擎逐帧调用 renderFrame，用 FFmpeg 编成 1280×720、30fps 的 H.264/AAC；句/片段级字幕不是逐词对齐。回执记录采样视觉变化，但自身将 determinism 标为未验证。旁白批准与外部语音处理许可独立，默认建议文字也不是完成叙述。[e-plan, e-video, e-media-test]

宿主负责真正的检索、证据选择、反例、中文/英文语义、对象关系、权限沟通、资源授权和实际观看/操作。仓库把 Mermaid 与 PptxGenJS 等运行资源打入便携技能，但浏览器、FFmpeg 和 Edge TTS 等可选条件仍需宿主环境满足。[e-build, e-package] 本次没有测得延迟、性能或技能效果。

## 新目录结构的含义
examples 保存面向读者的作品，源项目归入 projects/html 等目录；evals/examples 保存 ANC/Git 及项目概览的运行审阅工具/记录；evals/skills 保存技能对照用例、材料与判据；宿主 scenarios 与固定四案例分开。尺寸场景覆盖桌面横向、手机滚动和显式尺寸，但场景定义和结构测试不能作为“技能已改善”的实测结果。[e-evals, e-example-test]

旧项目概览是旧研究快照，不作本轮新事实证据。新 example set 仍在创作/批准流程中，本报告不称其已经完成或证明效果；当前四媒介仅交付作者源与计划，HTML 可做不执行代码的打包。

## 语义复核、未决项与停止理由
反向复核结果：两技能分工、Dossier 身份、四媒介入口、ANC 计算与 Git 记录切换、授权分界均有对应源码/契约；已将“Git 实验”收窄为“内嵌既有记录”，将“确定性视频”收窄为作者接口要求而非已验结果。测试文件只说明断言意图，本轮未运行测试。未抓取公网、未核对当前语音服务条款、未听音频、未渲染 PPTX/PNG/视频、未浏览 HTML，未做读者实验。

停止理由是批准的只读研究范围已覆盖核心结构与机制，下一步需要另行批准代码执行和旁白/外部处理。真实可读性、音画同步、PowerPoint 编辑实用性、服务可用性和理解提升仍待对应观察，不以静态通过填补。[q-observation]
