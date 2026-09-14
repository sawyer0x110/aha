# Aha! · 原来如此

深入研究一个开放问题或代码库问题，再自由设计它的表达。

**只有两个 Skill：**

| Skill | 职责 | 交付 |
| --- | --- | --- |
| `aha-research` | 分解复杂问题、实际取证、多轮补查、反证与综合判断 | 独立研究档案、报告、来源与缺口 |
| `aha-explain` | 内容策划、媒介设计、编写作品源、渲染与检查 | 富文本 HTML／Mermaid／交互图、一图流 PNG、原生 PPTX、Edge TTS 视频 |

runtime **0.3.0**，研究与作品协议 **1.0.0**。不再发布 `aha-lab`／`aha-story` 或旧命令别名，不要求研究先选模型、建立实验或编写 slides。旧 Pack 不会被自动转换或删除。

产品需求见 [PRD](docs/PRD.md)，架构取舍见 [重构方案](docs/SKILLS-REDESIGN.md)，研究工作法见 [研究协议](docs/RESEARCH.md)，上游方法与许可边界见 [参考记录](docs/REFERENCE-ADOPTION.md)。

## 自由创作，不是填写统一卡片

研究档案保存结论、证据、报告与身份。每个媒介有独立作品源和内容覆盖：HTML 可以是长文、表格、SVG、Mermaid 和任意本地交互；图片按目标尺寸重新构图；PPTX 使用原生对象；视频由作者编写按帧变化的 HTML／SVG／canvas 场景。

共用事实，不共用固定布局。模板只是待编写的起点，未经编写的 scaffold 不会被当成完成作品。改变结构不需要给共享 Schema 增加一个题材专属字段。

工具检查结构、引用、版本、资源和产物；宿主 Agent 负责实际研究与内容设计。CLI 不内置联网搜索，不证明来源支持每句结论，也不执行被研究仓库。

## 开发与发布

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
node .\install-skills.mjs --host copilot --project "C:\你的项目"
node .\install-skills.mjs --host copilot --project "C:\你的项目" --apply
# Codex 使用 --host codex
```

默认 dry-run；Copilot 安装到项目 `.github\skills`，Codex 到 `.agents\skills`。不覆盖现有安装；发现 `.github`／`.agents`／`.claude` 中的旧 Aha 入口会拒绝并提示先审阅移走，不自动删除用户目录。

源码 `skills` 不是完整安装包。安装后从任何作品目录调用：

```powershell
node "C:\你的项目\.github\skills\aha-explain\scripts\aha.mjs" doctor
```

POSIX 使用对应正斜杠路径。文件安装、哈希与 doctor 不等于真实宿主发现或自然语言触发，需在目标宿主单独确认。

## 1. 先完成复杂调研

下面以仓库开发入口示例；安装后把 `node .\dist\cli\aha.mjs` 替换为已安装 Skill 的绝对脚本路径。

```powershell
node .\dist\cli\aha.mjs research-init "这个代码库如何处理请求失败？" ".\artifacts\topic.draft.json" --kind codebase
```

这只创建未完成草案，不执行任何调研。按 `aha-research` 工作法实际读取材料，编辑草案的报告、子问题、主张、来源、日志、反证、缺口与停止理由。精确字段以构建生成的 `schemas\research-draft.schema.json` 和 Skill 参考为准。

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

PNG 捕获专门编写的一图流，不截图整个文章作为海报。PPTX 入口接收随运行时提供的 PptxGenJS 实例，自由添加文本、形状、图表与页面，没有旧版 12 页限制；不能把“写出了 PPTX”当作原生编辑和逐页视觉都已验收。

## 3. Edge TTS 与动态讲解视频

视频作品定义 `window.ahaVideo.renderFrame({ frame, fps, segmentIndex, segmentFrame, segmentFrames, text })`。运行时按实测音频逐帧调用，捕获动态场景并用 FFmpeg 编码，不是循环静态卡片，也不是 Remotion 集成。作者需使用确定性时间计算；工具不会自动把任意脚本变成确定性动画。

```powershell
node .\dist\cli\aha.mjs doctor --media
node .\dist\cli\aha.mjs prepare-video ".\artifacts\topic-video" ".\artifacts\video-plan.json"
node .\dist\cli\aha.mjs video-plan-check ".\artifacts\topic-video" ".\artifacts\video-plan.json"
```

准备命令输出 `status: "draft"`。编辑计划中 `segments[].text` 的完整旁白、逐段来源、声线、语速和目标时长，完成后将计划 `status` 改为 `"authored"`，重新运行 `video-plan-check`。向用户展示完整计划和当前 `planHash`；只有批准当前文本及向提供方外发后才运行：

```powershell
node .\dist\cli\aha.mjs synthesize ".\artifacts\topic-video" ".\artifacts\video-plan.json" ".\artifacts\audio-v1" --approve "<已批准的planHash>" --allow-network
node .\dist\cli\aha.mjs render-video ".\artifacts\topic-video" ".\artifacts\video-plan.json" ".\artifacts\audio-v1" ".\artifacts\topic.mp4" --approve "<已批准的planHash>" --allow-code
```

默认中文声线，在线客户端固定 `edge-tts==7.2.8`；只外发获准旁白和声音参数。用户逐句音频使用 `import-audio` 和明确的 `provided-audio` 提供方，不能冒称在线合成成功。命令见 `help`。

720p30 H.264 / AAC、句级烧录字幕、SRT 与回执。时间取自真实音频；超出批准范围明确失败，不偷偷拉伸语速。源码或计划身份不符时拒绝直接复用；新计划重新确认，不手改音频 hash。只改画面而保留旁白时，可将旧音频作为 `provided-audio`，在新计划获准后重新导入新音频目录；这不需要再次联网合成，但不再冒称新一轮 Edge 合成。

先做短小样再扩展正式片。编码成功不代表听审／视觉通过；`doctor --media` 不联网合成，在线可用性和实际配音需另行验收。

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

来源命令是材料，不执行。新输出不覆盖旧文件；发布目标位于作品目录外，研究与创作源可保留。分享前检查正文、备注与资源清单，私有标签不提供加密。

## 验证与质量

```powershell
npm run typecheck
npm test
npm run test:browser
npm run test:media
```

单元／分发／CLI、浏览器交互、媒体集成分开运行。媒体集成使用本地测试音频，不替代真实 Edge TTS 或人工听审；PPTX 包内容检查不替代实际演示程序中的视觉检查。

最终质量还需对关键断言回查来源、核对媒介内容覆盖、检查实际尺寸下的版式与交互、观看完整视频。不以静态 Skill 文本检查或一个成功退出码冒充这些验收。
