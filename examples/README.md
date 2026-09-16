# Aha examples

从[本地入口](index.html)开始。三篇 HTML 均可独立、离线阅读，默认英文，支持 English / 中文切换。项目导览另有 PNG、原生 PPTX 和配音 MP4。GitHub 源码预览不会执行页面。

| 主题 | 当前作品 | 可编辑源 |
| --- | --- | --- |
| 飞机轰鸣变轻了，为什么人声还在？ | [降噪耳机](anc/index.html) | [HTML 源码](anc/projects/html/html/index.html) |
| 为什么 Git 合并会带回已撤销的修改？ | [Git merge](git-merge/index.html) | [HTML 源码](git-merge/projects/html/html/index.html) |
| Aha 如何把研究转化为不同媒介的讲解？ | [项目导览及多格式交付](project-overview/README.md) | [四种作品项目](project-overview/projects/) |

降噪页解释两路声压在耳边怎样相加，并用相位偏差滑块展示理想模型；Git 页用共同基线、当前版本和三组真实记录，解释净变化、独立修改与冲突。

项目导览回答“Aha 是什么、能帮读者做什么”：新版 HTML 和六幕英文视频展示降噪耳机与 Git merge 的实际网页细节，再介绍调研、创作和四种阅读用途，首尾明确总结。实现细节放入网页折叠补充。另保留一图流、9 页原生 PPTX 和用于幻灯片的独立 GIF 示例。视频旁白经单独批准外发配音，附字幕及原始收据。检查与复现入口见 [project-overview](project-overview/README.md)，不属于下面旧两例的 `check-html.mjs` 范围。

## 目录内容

- 各主题的 `index.html` 和收据：当前作品及其源码、研究、输出身份。
- `projects/<format>/`：各格式作品的元数据、可编辑源，以及运行时要求的研究副本；单格式示例也使用相同结构。
- `research/`：封存的研究报告、证据台账与清单。作品复用这些档案，不代表额外完成了联网调研。
- `git-merge/inputs/`、`sources/`、`experiment-recipe.json`、`experiment-results-v2.json`：原始材料、来源许可与有效实验记录。页面复用已记录的结果，不实时执行 Git。
- [`../evals/examples/anc-git/`](../evals/examples/anc-git/)：这两个页面的运行结果、分别记录的文字与图形审阅、代表性截图；项目导览的验收记录单独放在 `../evals/examples/project-overview/`。
- [`../evals/examples/check-html.mjs`](../evals/examples/check-html.mjs)：这两个页面的离线检查脚本；其他示例验收工具就近放在对应的评估目录。
- `<topic>/tools/` 与 `<topic>/provenance/`：示例专用制作工具和制作依据（如词句时间点、素材来源与修订记录），按实际需要保留，不与最终验收报告混放。

`examples` 是当前作品集，不是每次试跑的历史目录。之后的候选产物和技能对照实验放在独立工作目录；经检查并获相应替换／清理授权后，才更新这里的成品、匹配收据、链接与 QA。技能评估材料和读者迁移理解流程见[评估协议](../docs/EVALUATION.md)，其试跑结果不替代这里的成品验收。

本目录的 `.gitattributes` 对所有示例关闭 Git 自动换行转换，保留研究、源码和成品的精确字节；Windows 的 `core.autocrlf=true` 不应改变已封存内容或使收据失效。

## 内容和验收边界

降噪滑块表示单一频率、相等振幅、同一位置的理想声压模型；不是耳机实测性能、分贝或主观响度。语音部分讨论剩余线索，不保证具体耳机能让谈话消失。

Git 阅读的源码和手册固定为 v2.49.0，实验记录使用 2.53.0.windows.4；页面明确区分两者。控件展示预录结果，不是 Git 模拟器。文本合并成功不证明程序行为正确。

`experiment-recipe.json` 保留执行路径及失败说明，是实验方法记录，不是当前目录的可执行脚本；结论以 `experiment-results-v2.json` 为依据。`projects/html/qa/author-review.json` 记录源码交接时的审阅范围，最终浏览器状态以 `../evals/examples/anc-git/` 为准。历史记录中的路径保留当时含义，不因目录整理重写封存证据。

当前检查和审阅见 [运行记录](../evals/examples/anc-git/runtime.json)与[审阅记录](../evals/examples/anc-git/review.json)。文字已分别按中文、英文审读，再核对事实；页面检查覆盖两种语言、浅深主题、1280/390px 宽度和键盘交互。真人理解效果、独立人工翻译验收、手机真机及读屏器检查仍未完成。

制作时同时遵循宿主 `web-artifacts-builder` 的 Clawpilot 配色和系统字体要求，不能将视觉结果当作 Aha 单独作用的对照实验。图形为原创；没有下载字体或素材。Git 来源保留其上游许可。

## 本地复现

先使用仓库已有依赖构建。HTML 打包本身不执行作者脚本：

```powershell
npm run build
node .\dist\skills\aha-explain\scripts\aha.mjs render-html .\examples\anc\projects\html .\artifacts\anc-rebuild\index.html
node .\dist\skills\aha-explain\scripts\aha.mjs render-html .\examples\git-merge\projects\html .\artifacts\git-merge-rebuild\index.html
```

检查前审阅脚本、页面并取得本地执行授权。检查需要已安装的 Edge，不会联网、安装依赖或运行 Git：

```powershell
node .\evals\examples\check-html.mjs --allow-code --screenshots
```

该命令检查两个当前 `index.html`，将运行结果写入仓库根目录下的 `evals/examples/anc-git/runtime.json`；`--screenshots` 可选，会更新该目录的代表性截图。复现的新文件先另存，确认后再替换当前作品及配套收据。
