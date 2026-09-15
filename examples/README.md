# Aha examples

从[本地入口](index.html)开始。两篇均为独立、可离线阅读的 HTML，默认英文，支持 English / 中文切换。GitHub 源码预览不会执行页面。

| 主题 | 当前作品 | 可编辑源 |
| --- | --- | --- |
| 飞机轰鸣变轻了，为什么人声还在？ | [降噪耳机](anc/index.html) | [HTML 源码](anc/project/html/index.html) |
| 为什么 Git 合并会带回已撤销的修改？ | [Git merge](git-merge/index.html) | [HTML 源码](git-merge/project/html/index.html) |

本轮按新版 `aha-explain` 的解释性编辑与双语独立审读方法重新创作，不只是替换旧页面的标题。降噪页解释两路声压在耳边怎样相加，并用相位偏差滑块展示理想模型；Git 页用共同基线、当前版本和三组真实记录，解释净变化、独立修改与冲突。

## 保留什么

- 各主题的 `index.html` 和收据：当前作品及其源码、研究、输出身份。
- `project/`：作品元数据、可编辑 HTML，以及运行时要求的研究副本。
- `research/`：封存的研究报告、证据台账与清单。复用原有研究，没有声称本轮重新联网调研。
- `git-merge/inputs/`、`sources/`、`experiment-recipe.json`、`experiment-results-v2.json`：必要的原始材料、来源许可与有效实验记录。本轮没有重新执行 Git 实验。
- `evaluation/`：本轮运行结果、分别记录的文字与图形审阅、代表性截图；不代表真人验收。
- `check-html.mjs`：当前页面的离线检查脚本。

旧 HTML、PNG、PPTX、MP4、配音、旧格式项目、归档、文案 A/B 试跑和历史评估已从 `examples` 删除。本次不生成其他格式，也不清理仓库之外的会话文件或环境。

## 内容和验收边界

降噪滑块表示单一频率、相等振幅、同一位置的理想声压模型；不是耳机实测性能、分贝或主观响度。语音部分讨论剩余线索，不保证具体耳机能让谈话消失。

Git 阅读的源码和手册固定为 v2.49.0，实验记录使用 2.53.0.windows.4；页面明确区分两者。控件展示预录结果，不是 Git 模拟器。文本合并成功不证明程序行为正确。

`experiment-recipe.json` 保留原执行路径及首轮失败说明，是历史实验方法记录，不是当前目录的可执行脚本；已删除的首轮结果不再用于支持结论。`project/qa/author-review.json` 记录源码交接时的审阅范围，最终浏览器状态以本轮 `evaluation/` 为准。

当前检查和审阅见 [运行记录](evaluation/runtime.json)与[审阅记录](evaluation/review.json)。文字已分别按中文、英文审读，再核对事实；页面检查覆盖两种语言、浅深主题、1280/390px 宽度和键盘交互。真人理解效果、独立人工翻译验收、手机真机及读屏器检查仍未完成。

本轮还使用了宿主 `web-artifacts-builder` 的 Clawpilot 配色和系统字体要求，不能将视觉结果当作 Aha 单独作用的对照实验。图形为本次原创；没有下载字体或素材。Git 来源保留其上游许可。

## 本地复现

先使用仓库已有依赖构建。HTML 打包本身不执行作者脚本：

```powershell
npm run build
node .\dist\skills\aha-explain\scripts\aha.mjs render-html .\examples\anc\project .\examples\anc\rebuilt.html
node .\dist\skills\aha-explain\scripts\aha.mjs render-html .\examples\git-merge\project .\examples\git-merge\rebuilt.html
```

检查前审阅脚本、页面并取得本地执行授权。检查需要已安装的 Edge，不会联网、安装依赖或运行 Git：

```powershell
node .\examples\check-html.mjs --allow-code --screenshots
```

该命令检查两个当前 `index.html`，将本轮结果写入 `evaluation/runtime.json`；`--screenshots` 可选，会更新代表性截图。复现的新文件先另存，确认后再替换当前作品及配套收据。
