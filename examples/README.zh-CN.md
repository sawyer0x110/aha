# Aha 示例

[English](README.md) | **简体中文**

从[本地作品入口](index.html)或[新版 Aha 视频介绍（中文主题说明）](aha-introduction/README.md)开始。三个主题于 2026-09-16 分别重新调研并各创作四种格式；2026-09-17 新增格陵兰视频、CPython/Docker 两支机制试片，以及总分总结构的新版项目介绍，共七组示例、十六份作品。新旧项目介绍使用不同研究快照，分开保存，不把它们伪装成同一版四格式作品。作品入口和三篇交互 HTML 默认英文，可切换中文；PNG、原生 PPTX 和配音视频为英文。各主题 README 仍为中文，尚未翻译；前四例研究报告为中文，两支代码试片与新版介绍研究报告为英文。

GitHub 源码预览不会执行交互页面。请下载或克隆仓库后在浏览器中打开 `examples/index.html`；通过链接用本地查看器打开或下载 PNG、PPTX、MP4 和字幕。作品是面向读者的讲解；研究、收据、哈希、批准记录和验收记录是用于核查来源及制作过程的证据，不是另一组作品，也不代表尚未完成的验收已经通过。

| 主题（说明为中文） | HTML | PNG | 原生 PPTX | 配音视频 |
| --- | --- | --- | --- | --- |
| [降噪耳机](anc/README.md) | [交互讲解](anc/index.html) | [1800×1200](anc/anc.png) | [9 页](anc/anc.pptx) | [127.1 秒](anc/anc.mp4) |
| [Git merge](git-merge/README.md) | [交互讲解](git-merge/index.html) | [1800×1200](git-merge/git-merge.png) | [10 页](git-merge/git-merge.pptx) | [126.27 秒](git-merge/git-merge.mp4) |
| [Aha 较早研究快照导览](project-overview/README.md) | [交互导览](project-overview/index.html) | [新版能力图 · 1080×1800](project-overview/overview.png) | [10 页](project-overview/overview.pptx) | [148.43 秒旧版](project-overview/overview.mp4) |
| [格陵兰与地图投影](greenland/README.md) | 未请求 | 未请求 | 未请求 | [115.73 秒](greenland/greenland.mp4) |
| [CPython 字符串](cpython-string/README.md) | 未请求 | 未请求 | 未请求 | [21.47 秒试片](cpython-string/pilot.mp4) |
| [Docker 镜像层](docker-layers/README.md) | 未请求 | 未请求 | 未请求 | [21.27 秒试片](docker-layers/pilot.mp4) |
| [Aha 新版介绍](aha-introduction/README.md) | 未请求 | 未收录 | 未请求 | [119.4 秒](aha-introduction/overview-v5.mp4) |

用户于 2026-09-17 选用新版能力介绍图，现已替换 `project-overview/overview.png`；只介绍项目定位、两个 skills 和四种媒介，不展示案例。它复用该目录的原研究快照，不与新版视频伪装成同一快照。数量仍为十六份；旧图保留于 Git 历史。

ANC 和 Git 的横向信息图面向至少 1200px 宽的桌面／文档阅读，不承诺手机免缩放。Aha 新版纵向图已检查浏览器文字边界并生成 390px／540px 缩放图；代理实际视觉复核受图片工具限制，用户已选用。详见[新图收录记录](../evals/examples/overview-image-20260917/publication.json)。旧版视觉记录不适用于新图，增加像素也不是可读性的替代。

## 当前目录契约

- 每组根目录只保留已收录的作品、配套收据、视频 SRT 和 `video-plan.json`；格陵兰、CPython、Docker、新版介绍在这里都只有视频。
- `projects/{html,image,pptx,video}/` 保留独立作者源、元数据、资源和运行时要求的研究副本；发布迁移不修改这些字节。
- `research/` 是该主题封存的研究报告、证据与清单。项目导览记录的是研究时的源码及实例快照，不是实时页面截图。
- `audio/` 保留当前音频清单和 WAV。前三例及新版介绍使用导入录音，`audio-origin/` 保留原配音计划、原清单或失败记录，以及原始录音到当前文件的字节身份映射；导入 WAV 与原始合成 WAV 完全相同，故只存一份。格陵兰、CPython、Docker 使用直接 Edge TTS 合成，不另造导入来源目录。Docker 当前录音来自获批的第二次合成，首次时长不足的失败记录单独封存。新版介绍在排版修正后离线导入原十三段录音，不伪装成再次联网合成。
- Git 的 `public/` 保留阅读的固定版本上游文件、许可和访问记录。附加动画 PPT 使用独立后处理审计，不套用基版收据。
- [交付清单](delivery-manifest.json)索引十六份当前作品及研究、源码、输出哈希；[前三例验收记录](../evals/examples/refresh-20260916/)、[格陵兰验收记录](../evals/examples/greenland-20260917/)、[代码试片收录记录](../evals/examples/code-pilots-20260917/publication.json)和[新版介绍记录](../evals/examples/aha-introduction-20260917/publication.json)位于 `evals`，不混入作品正文。

`examples` 只保留各组正式作品与复现所需材料；旧版由 Git 历史保留（新图替换前为 `4b87e4c`）。用户明确要求清理后，本轮十个媒体制作目录中的候选、重复渲染、临时音频和本地备份已删除；必要批准及验收记录保留在 `evals`，不删除独立的技能评估材料。旧验收记录仅说明旧版，不是新版通过的证据。历史收据里的绝对路径保持原意，即使原制作目录已清理；当前路径以交付清单为准。

## 内容与验收边界

ANC 展示同一位置的理想声压叠加，不是耳机实测、分贝或感知响度；语音仍有可辨线索，不意味着任何耳机都不能削弱语音。

Git 固定阅读 v2.55.0 的手册与 `merge-ort.c`，没有新运行 Git 实验。界面的简化状态不是命令执行结果；区分普通 revert、merge revert、reset、`-s ours` 和 `-Xours`。文本合并成功不证明程序行为正确。

Aha 研究固定本地提交 `31ff1331`，其树与当时主分支 `c98b1927` 一致。导览中的已有 ANC/Git 页面是那个快照的实例，不声称是本次新版网页。宿主文档技能、Clawpilot 样式及外部媒体工具也参与制作，不能视为 Aha 单独效果的对照实验。

格陵兰例子以球面墨卡托解释高纬放大，使用真实概化边界的球面刚体旋转而非二维缩放。局部 60° 的四倍面积倍率不代表整片格陵兰；Equal Earth 保面积不等于保所有形状。详细来源与官方统计正文未核验的边界见该例研究报告。

CPython 试片对比特定 CPython 3.11.15 字符串对象大小与 UTF-8 载荷；U+1F600 使新结果使用四字节码点表示，不改变原字符串，也不是任何 emoji 或 Python 实现都适用。Docker 试片的 100 MB 为假定载荷，没有执行构建；删除后的合并视图与不可变层数据必须区分，同 RUN 对比只针对新建的临时文件。

当前记录覆盖双语页面的桌面／手机宽度与交互、原生幻灯片渲染及内存文字编辑、排版问题的修正复查、完整视频解码、字幕文字和编码后场景画面。**此前四个机制试片和新版介绍的修订试片已由用户听看确认；CPython、Docker 独立试片及完整视频的连续听看、Git 附加动画版的实际放映仍未确认。** 新版介绍保留“首页只介绍项目、补足章节过渡、去掉重复句、修正 Docker 线穿文字”的审阅过程。部分图像读取受限，不声称完整逐帧视觉验收。真人理解迁移、独立人工翻译、手机真机和读屏器验收未完成。

## 许可与第三方边界

本仓库原创源代码按 [MIT 许可证](../LICENSE)提供，具体适用范围与排除项见[许可范围](../LICENSE-SCOPE.md)。这不是对整个示例目录的统一重新授权：上游文件及摘录、第三方资料、语音服务及录音的权利和字体许可不因此变成 MIT；须分别遵守其原有许可、归属要求和服务条款。收据、来源记录或能够本地查看作品，本身不授予这些第三方权利。

## 本地复现

身份检查不执行作者代码：

```powershell
npm run build
npm run examples:verify
```

统一检查器验证十六份作品、研究副本、收据、当前音频及适用的原配音来源；代码试片和新版介绍还绑定批准计划、预览状态、编码记录及证据哈希。回归用例检查身份失配、错误证据重新封存仍被拒绝，以及原配音对应源码可重建。新版离线浏览器检查覆盖三篇网页的中英、浅深主题与 1280px／390px，当前[发布前复查](../evals/examples/refresh-20260916/browser-recheck/runtime.json)记录 24 组场景、96 项检查。

审阅页面并获得本地执行许可后，可将新浏览器结果另存到一个尚不存在的目录，不覆盖封存记录：

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
