# 参与 Aha

[English](CONTRIBUTING.md) | [简体中文](CONTRIBUTING.zh-CN.md)

欢迎针对研究工作法、解释创作、运行时、文档和可复现评估提交聚焦的小改动。重大行为或格式变化，请先通过 [issue](https://github.com/sawyer0x110/aha/issues) 讨论目标。可能涉及敏感信息的问题按 [SECURITY.zh-CN.md](SECURITY.zh-CN.md) 处理，不公开披露细节。

## 从源码开发

在可信的源码 checkout 中使用 Node.js 22+ 和仓库锁定的 npm 依赖。普通使用者应安装 Release 包，无需构建仓库，见[安装指南](../docs/INSTALL.zh-CN.md)。

```powershell
npm ci --ignore-scripts
npm run typecheck
npm run build
npm test
```

`npm test` 会先构建，再运行单元、CLI、分发、技能和示例身份测试。小改动可只构建一次，再用 `node --import tsx --test` 执行相关文件，避免重复构建。

| 范围 | 额外检查 |
| --- | --- |
| 浏览器运行时或作品导航 | 已有 Edge／Chrome 下运行 `npm run test:browser` |
| 视频／音频运行时 | 已有浏览器、FFmpeg、ffprobe 及离线适配器测试所需 Python 下运行 `npm run test:media` |
| 当前示例源码或发布元数据 | `npm run examples:verify` |
| 发布内容或安装器 | 构建后运行 `node --import tsx --test ./tests/distribution.test.ts` |
| 文档 | `node --import tsx --test ./tests/docs.test.ts`，并人工核对两种语言和命令 |

Release 工作流当前使用 Windows 和 Node.js 22；这不表示所有操作系统上的宿主和媒体能力都已完成端到端验收。不要自动安装浏览器或媒体工具。媒体测试使用合成／离线输入，不要求真实联网配音，也不认证听感。依赖配置见[使用指南](../docs/USAGE.zh-CN.md)。

## 让改动易于审阅

在 PR 中说明问题、行为变化、兼容性影响、实际执行的检查和剩余限制。行为修改应添加聚焦的回归测试；失败或未运行的检查不能写成通过。不要混入无关依赖升级、媒体重渲染或大范围格式调整。

同一改动中同步中英文入口：根 `README`、`docs/README`、`docs/INSTALL`、`docs/USAGE`、`.github/CONTRIBUTING`、`.github/SECURITY` 和 `examples/README`。中文文件以 `.zh-CN.md` 标记。安装链接直接指向 `docs/` 中的指南，不在根目录另设安装入口。同步含义、限制、命令和链接，不只翻译标题；链接到中文高级文档时标明语言。`skills/**` 保持单一英文权威契约，不另外制作平行中文技能包。

`docs/INSTALL.md`、`docs/INSTALL.zh-CN.md`、`docs/LICENSE-SCOPE.md` 会按原字节、原文件名复制到新安装包根目录；根 `LICENSE` 单独加入。相对链接必须同时适用于 `docs/` 和解压后的 ZIP：指南／范围说明用同级链接，`LICENSE` 用绝对仓库 URL，源码专用文档也用仓库 URL。调整发布内容时，同步构建器、安装白名单、资产校验、工作流和测试。不要覆盖已发布版本或移动 tag；发布修改后的包时使用新版本号。

## 尊重证据与权属

研究、作者源、产物、收据、旁白计划和 QA 身份须保持一致。不要修改封存报告或 hash 来伪装新产物已验收。建立新候选并保留必要证据，通过清单指出当前交付。翻译冻结报告是新的衍生内容，不是可直接覆盖的措辞修订。

历史验收路径记录当时制作环境，不要求贡献者复建这些目录。这些路径有意保留；已有示例公开不代表未来私有输入也适合公开。

不要提交凭据、私有源码、无关账户标识或未经批准的旁白。分享前裁剪／脱敏截图和日志。研究材料中的代码不会因被贴进 issue 就自动获得执行许可。

## 许可与署名

提交原创贡献表示同意按项目 [MIT 许可证](../LICENSE) 提供该内容，且你须有权提交。第三方材料应明确标注并保留声明，遵循[许可范围](../docs/LICENSE-SCOPE.md)。上游 Git 副本、地图数据、依赖声明、语音服务条款和字体权利不被 Aha 的 MIT 替代。讨论应尊重参与者并聚焦工作。
