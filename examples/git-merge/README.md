# Git merge：撤销的修改为什么会回来？

[中文方案审查](git-merge.html)、[1800×1200 信息图](git-merge.png)、[8 页中文原生 PPTX](git-merge.pptx)和 [126.27 秒英文配音视频](git-merge.mp4)分别呈现同一主题；另附[字幕](git-merge.mp4.srt)与[研究报告](research/report.md)。HTML 审查假设中的 revert 与 `-Xours` 发布方案，以证据连接风险和修订建议；窄屏纵向排列，为纯中文页面。

历史用来确定共同基线；内容选择比较基线与两个当前版本。普通文件在 ours 等于基线时可取 theirs；保持两个当前值不变而改变基线，结果可反转。进一步解释逐路径独立修改、内容冲突、撤销与祖先关系，以及 `-s ours` 和 `-Xours` 的区别。

研究固定 **Git v2.55.0**，提交 `e9019fcafe0040228b8631c30f97ae1adb61bcdc`。阅读的手册与 `merge-ort.c`、[上游许可](public/COPYING)及访问记录保存在 [public](public/)。本次没有新运行 Git 实验；简化图不是 Git 模拟器或实测命令记录。普通文件规则不直接推广到重命名、自定义驱动或任意策略，干净的文本合并也不保证程序正确。

PNG 面向至少 1200px 宽的桌面／文档阅读，有阅读尺寸预览，不据此宣称独立视觉验收通过。PPT 保留原生形状与可编辑文字，机制按页展开，不声明页内动画。

视频为 1280×720、30fps、3788 帧。[当前计划](video-plan.json)复用已批准的 Aria `+0%` 录音，见[音频清单](audio/manifest.json)和[录音来源](audio/provenance.json)。三行字幕与来源行分开留白，没有再次联网配音。

[四种作者源](projects/)随附。各格式统一由[交付清单](../delivery-manifest.json)和[当前 QA](qa/)索引，包括 HTML 的 1280／390／320px 页面检查及 PPTX 应用观察。HTML 制作中另使用了宿主主题技能，不能视为 Aha 单独效果。完整视频听看仍未确认。复现与完整边界见[统一说明](../README.md)。
