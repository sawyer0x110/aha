# Aha examples

从[本地作品入口](index.html)开始。三个主题于 2026-09-16 分别重新调研，并各自创作四种格式；2026-09-17 新增仅视频的格陵兰例子，共四个主题、十三份作品。按请求选择媒介，不是同一份页面的自动转码。HTML 默认英文，可切换中文；PNG、原生 PPTX 和配音视频为英文，研究报告为中文。GitHub 源码预览不会执行交互页面。

| 主题 | HTML | PNG | 原生 PPTX | 配音视频 |
| --- | --- | --- | --- | --- |
| [降噪耳机](anc/README.md) | [交互讲解](anc/index.html) | [1800×1200](anc/anc.png) | [9 页](anc/anc.pptx) | [127.1 秒](anc/anc.mp4) |
| [Git merge](git-merge/README.md) | [交互讲解](git-merge/index.html) | [1800×1200](git-merge/git-merge.png) | [10 页](git-merge/git-merge.pptx) | [126.27 秒](git-merge/git-merge.mp4) |
| [Aha 项目导览](project-overview/README.md) | [交互导览](project-overview/index.html) | [1080×1800](project-overview/overview.png) | [10 页](project-overview/overview.pptx) | [148.43 秒](project-overview/overview.mp4) |
| [格陵兰与地图投影](greenland/README.md) | 未请求 | 未请求 | 未请求 | [115.73 秒](greenland/greenland.mp4) |

ANC 和 Git 的横向信息图面向至少 1200px 宽的桌面／文档阅读，不承诺手机免缩放。Aha 纵向信息图适合滚动导览，已按 390px 和 540px 实际显示宽度复查必要文字。增加像素不是可读性的替代。

## 当前目录契约

- 每个主题根目录只保留请求的作品、配套收据、视频 SRT 和 `video-plan.json`；格陵兰例子只有视频。
- `projects/{html,image,pptx,video}/` 保留独立作者源、元数据、资源和运行时要求的研究副本；发布迁移不修改这些字节。
- `research/` 是该主题封存的研究报告、证据与清单。项目导览记录的是研究时的源码及实例快照，不是实时页面截图。
- `audio/` 保留当前音频清单和 WAV。前三例使用导入录音，`audio-origin/` 保留原配音计划、原清单或失败记录，以及原始录音到当前文件的字节身份映射；导入 WAV 与原始合成 WAV 完全相同，故只存一份。格陵兰使用直接 Edge TTS 合成，不另造导入来源目录。
- Git 的 `public/` 保留阅读的固定版本上游文件、许可和访问记录。附加动画 PPT 使用独立后处理审计，不套用基版收据。
- [交付清单](delivery-manifest.json)索引十三份当前作品及研究、源码、输出哈希；[前三例验收记录](../evals/examples/refresh-20260916/)与[格陵兰验收记录](../evals/examples/greenland-20260917/)位于 `evals`，不混入作品正文。

`examples` 只保留当前正式作品；旧版由 Git 历史保留（此次替换前为 `c98b1927`）。候选、原始制作过程及替换前的本地备份仍在被忽略的 `artifacts`，未当作缓存删除。旧验收记录仅说明旧版，不是新版通过的证据。历史收据里的绝对路径保持原意，当前路径以交付清单为准。

## 内容与验收边界

ANC 展示同一位置的理想声压叠加，不是耳机实测、分贝或感知响度；语音仍有可辨线索，不意味着任何耳机都不能削弱语音。

Git 固定阅读 v2.55.0 的手册与 `merge-ort.c`，没有新运行 Git 实验。界面的简化状态不是命令执行结果；区分普通 revert、merge revert、reset、`-s ours` 和 `-Xours`。文本合并成功不证明程序行为正确。

Aha 研究固定本地提交 `31ff1331`，其树与当时主分支 `c98b1927` 一致。导览中的已有 ANC/Git 页面是那个快照的实例，不声称是本次新版网页。宿主文档技能、Clawpilot 样式及外部媒体工具也参与制作，不能视为 Aha 单独效果的对照实验。

格陵兰例子以球面墨卡托解释高纬放大，使用真实概化边界的球面刚体旋转而非二维缩放。局部 60° 的四倍面积倍率不代表整片格陵兰；Equal Earth 保面积不等于保所有形状。详细来源与官方统计正文未核验的边界见该例研究报告。

当前记录覆盖双语页面的桌面／手机宽度与交互、原生幻灯片渲染及内存文字编辑、针对实际排版问题的修正复查、完整视频解码、字幕文字和编码后场景画面。**四个机制试片已由用户听看确认；完整视频听看、Git 附加原生动画版的实际放映仍未确认。** 真人理解迁移、独立人工翻译、手机真机和读屏器验收未完成。技术通过不替代这些判断。

## 本地复现

身份检查不执行作者代码：

```powershell
npm run build
npm run examples:verify
```

统一检查器验证十三份作品、研究副本、收据、当前音频及适用的原配音来源；回归用例也检查身份失配会被拒绝。新版离线浏览器检查覆盖三篇网页的中英、浅深主题与 1280px／390px，当前[发布前复查](../evals/examples/refresh-20260916/browser-recheck/runtime.json)记录 24 组场景、96 项检查。

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
