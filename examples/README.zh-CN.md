# Aha 示例

[English](README.md) | **简体中文**

从唯一保留的 [Aha 项目介绍](aha-introduction/README.md)或[本地作品入口](index.html)开始，共**六组示例、十六份作品**。项目介绍的英中双语 HTML、中文 PNG 与 8 页中文原生 PPTX 使用当前 `aha-explain` 指导，绑定其 9 月 17 日研究快照；原有英文视频保持不变。四份当前 PPTX 均采用迭代后的指导。其他主题保留各自成品与研究快照。交互 HTML 默认英文，可切换中文；其他 PNG 与全部配音视频为英文，主题说明为中文，研究报告保留原语言。

GitHub 源码预览不会执行交互页面。请下载或克隆仓库后在浏览器中打开 `examples/index.html`；通过链接用本地查看器打开或下载 PNG、PPTX、MP4 和字幕。作品是面向读者的讲解；研究、收据、哈希、批准记录和验收记录是用于核查来源及制作过程的证据，不是另一组作品，也不代表尚未完成的验收已经通过。

| 主题（说明为中文） | HTML | PNG | 原生 PPTX | 配音视频 |
| --- | --- | --- | --- | --- |
| [Aha 项目介绍 · 从这里开始](aha-introduction/README.md) | [英中双语讲解](aha-introduction/index.html) | [中文 · 1080×1920](aha-introduction/overview.png) | [8 页中文](aha-introduction/overview.pptx) | [119.4 秒](aha-introduction/overview-v5.mp4) |
| [降噪耳机](anc/README.md) | [交互讲解](anc/index.html) | [1800×1200](anc/anc.png) | [7 页中文](anc/anc.pptx) | [127.1 秒](anc/anc.mp4) |
| [Git merge](git-merge/README.md) | [交互讲解](git-merge/index.html) | [1800×1200](git-merge/git-merge.png) | [8 页中文](git-merge/git-merge.pptx) | [126.27 秒](git-merge/git-merge.mp4) |
| [格陵兰与地图投影](greenland/README.md) | 未请求 | 未请求 | [7 页中文](greenland/greenland.pptx) | [115.73 秒](greenland/greenland.mp4) |
| [CPython 字符串](cpython-string/README.md) | 未请求 | 未请求 | 未请求 | [21.47 秒试片](cpython-string/pilot.mp4) |
| [Docker 镜像层](docker-layers/README.md) | 未请求 | 未请求 | 未请求 | [21.27 秒试片](docker-layers/pilot.mp4) |

项目介绍的四种格式共用研究快照，不强求相同布局与细节量：HTML 和 PPTX 展开三个案例的机制，独立创作的纵向信息图概括技能分工、媒介选择与关键区别。

ANC 和 Git 的横向信息图面向至少 1200px 宽的桌面／文档阅读，不承诺手机免缩放。项目介绍的纵向信息图面向约 390px 显示宽度的滚动阅读，当前检查绑定在[介绍收录记录](aha-introduction/publication.json)。

## 当前目录契约

- 每组根目录只保留各格式最近收录的作品、配套收据、视频 SRT 和 `video-plan.json`；项目介绍、ANC、Git 各有四种格式，格陵兰包含 PPTX 与视频，CPython、Docker 只有视频。
- `projects/{html,image,pptx,video}/` 保留对应作者源、元数据、项目内资源和研究副本；PPTX 的 `qa/` 保存当前 PowerPoint 观察与页面导出，不计入源码身份。
- `research/` 是该主题封存的研究报告、证据与清单。历史描述保持封存原样，当前作品目录以交付清单为准。
- `audio/` 保留当前音频清单和 WAV。ANC、Git 及项目介绍使用导入录音，`audio-origin/` 保留原配音计划、原清单或失败记录，以及原始录音到当前文件的字节身份映射；导入 WAV 与原始合成 WAV 完全相同，故只存一份。格陵兰、CPython、Docker 使用直接 Edge TTS 合成，不另造导入来源目录。Docker 当前录音来自获批的第二次合成，首次时长不足的失败记录单独封存。项目介绍在排版修正后离线导入原十三段录音，不伪装成再次联网合成。
- Git 的 `public/` 保留阅读的固定版本上游文件、许可和访问记录。
- [交付清单](delivery-manifest.json)索引十六份当前作品。[PPTX 收录记录](pptx-publication.json)绑定四份演示的源码、收据、技能来源、当前应用检查与明确的审阅限制。项目介绍的[收录记录](aha-introduction/publication.json)另行绑定其新 HTML 和 PNG 观察；较早的非 PPT 证据仍位于 `evals`，历史观察不用于证明更新后的作品已通过。

`examples` 是当前作品集，不并列保存基线／候选版本。技能迭代产物应连同匹配的源码、资源、收据和当前证据一起替换对应格式；旧版及已被替代的 Git 动画派生版由 Git 历史保留。重新生成不等于重新调研，当前路径与身份以交付清单为准。

## 内容与验收边界

ANC 展示同一位置的理想声压叠加，不是耳机实测、分贝或感知响度；语音仍有可辨线索，不意味着任何耳机都不能削弱语音。

Git 固定阅读 v2.55.0 的手册与 `merge-ort.c`，没有新运行 Git 实验。界面的简化状态不是命令执行结果；区分普通 revert、merge revert、reset、`-s ours` 和 `-Xours`。文本合并成功不证明程序行为正确。

项目介绍复用 9 月 17 日的综合研究，不冒充对当前代码重新调研或重新执行继承的实验。宿主文档技能、Clawpilot 样式及外部媒体工具也参与制作，不能视为 Aha 单独效果的对照实验。

格陵兰例子以球面墨卡托解释高纬放大，使用真实概化边界的球面刚体旋转而非二维缩放。局部 60° 的四倍面积倍率不代表整片格陵兰；Equal Earth 保面积不等于保所有形状。详细来源与官方统计正文未核验的边界见该例研究报告。

CPython 试片对比特定 CPython 3.11.15 字符串对象大小与 UTF-8 载荷；U+1F600 使新结果使用四字节码点表示，不改变原字符串，也不是任何 emoji 或 Python 实现都适用。Docker 试片的 100 MB 为假定载荷，没有执行构建；删除后的合并视图与不可变层数据必须区分，同 RUN 对比只针对新建的临时文件。

当前 PPTX 记录把原生结构、PowerPoint 打开／导出／副本编辑检查与有限视觉观察分开。最新技能不保证每份最新作品都更美观，继承的解释或间距问题仍如实记录。其他记录覆盖双语页面交互，以及视频解码、字幕和抽样画面。**CPython、Docker 独立试片及完整视频的连续听看仍未确认。** 真人理解迁移、独立人工翻译、手机真机和读屏器验收未完成。

## 许可与第三方边界

本仓库原创源代码按 [MIT 许可证](../LICENSE)提供，具体适用范围与排除项见[许可范围](../docs/LICENSE-SCOPE.md)。这不是对整个示例目录的统一重新授权：上游文件及摘录、第三方资料、语音服务及录音的权利和字体许可不因此变成 MIT；须分别遵守其原有许可、归属要求和服务条款。收据、来源记录或能够本地查看作品，本身不授予这些第三方权利。

## 本地复现

身份检查不执行作者代码：

```powershell
npm run build
npm run examples:verify
```

统一检查器验证十六份作品、研究副本、收据、当前音频及适用的原配音来源。当前 PPTX 观察和页面图片单独绑定哈希，不沿用历史幻灯片证据。代码试片与介绍视频另绑定批准计划、预览状态和编码记录；回归用例拒绝陈旧身份及重新封存的错误证据。既有[浏览器检查](../evals/examples/refresh-20260916/browser-recheck/runtime.json)覆盖未改动的 ANC 与 Git 网页，已移除主题的观察仅作历史记录；项目介绍有独立的当前收录证据。

审阅 ANC 与 Git 页面并获得本地执行许可后，可将新浏览器结果另存到一个尚不存在的目录，不覆盖封存记录：

```powershell
node .\evals\examples\check-html.mjs --allow-code --output artifacts\examples-browser-new --screenshots
```

以 ANC 为例，重新输出到新目录，不覆盖当前作品或收据。PNG／PPT／视频执行前须审阅作者源码并另获本地执行许可：

```powershell
node .\dist\cli\aha.mjs render-html .\examples\anc\projects\html .\artifacts\anc-rebuild\index.html
node .\dist\cli\aha.mjs render-image .\examples\anc\projects\image .\artifacts\anc-rebuild\anc.png --allow-code
node .\dist\cli\aha.mjs render-pptx .\examples\anc\projects\pptx .\artifacts\anc-rebuild\anc.pptx --allow-code
node .\dist\cli\aha.mjs video-plan-check .\examples\anc\projects\video .\examples\anc\video-plan.json
```

源码、旁白和研究绑定不变时，按检查结果的当前 `planHash` 与当前 `audio/` 可离线重渲染视频。代码或文字变动需新计划与相应批准；命令行 `--approve` 不是授权本身。在线配音必须单独展示完整旁白、提供方、声线、语速及外发范围并取得批准。

Windows 上可将固定媒体环境放在 `%LOCALAPPDATA%\Aha\media-venv`，安装仓库锁定的 `requirements-media.txt`，将用户级 `AHA_PYTHON` 指向其 `Scripts\python.exe`。已有环境直接复用，不因更换 worktree 或清理制作中间结果而删除；新进程才自动继承更新后的用户环境变量。不把机器环境提交到仓库。

`examples/.gitattributes` 和 `evals/examples/.gitattributes` 禁止自动换行转换，避免 Windows checkout 改变研究、源码、作品和验收记录的精确字节。
