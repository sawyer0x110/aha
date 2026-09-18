# License scope / 许可范围

## English

Aha's original source code, skill instructions, documentation, evaluation fixtures, and original example authoring are covered by the [MIT License](LICENSE), unless a file or accompanying notice states otherwise. This grant covers only rights held by the Aha contributors; it does not relicense third-party material embedded in, quoted by, or used to produce an example.

| Material | Applicable notices |
| --- | --- |
| Bundled runtime dependencies | Each installed skill includes `THIRD-PARTY-NOTICES.txt`; retained dependency licenses also apply. Aha's MIT license does not replace them. |
| Upstream Git source and documentation in the repository | See [`examples/git-merge/public/COPYING`](https://github.com/sawyer0x110/aha/blob/main/examples/git-merge/public/COPYING) (GPL v2), upstream file notices, and the accompanying access ledger. These copies are not relicensed under MIT. |
| Map resources and D3 modules | Natural Earth data is identified as public domain in the example resource records. D3 modules retain their own licenses. Keep the `resources.json` and `*-LICENSE.txt` files with the [Greenland](https://github.com/sawyer0x110/aha/tree/main/examples/greenland/projects/video/assets) and [introduction](https://github.com/sawyer0x110/aha/tree/main/examples/aha-introduction/projects/video/assets) sources. |
| Speech, fonts, and separately installed tools | Approval to synthesize narration is not a blanket redistribution license. Applicable speech-service terms, font rights, and the licenses of Edge TTS, FFmpeg, browsers, and presentation tools remain separate. Aha does not distribute these tools or system fonts in its skill ZIP. |
| Quoted research and user-provided material | Citations and public availability do not grant additional reproduction rights. Check the original source and the relevant example's provenance before reuse. |

The repository examples and their audit evidence are not included in the portable skill ZIP. New builds include Aha's license and this scope note both at the package root and in each independently installable skill, alongside third-party notices. Previously published packages are immutable; adding these files in source does not update an existing download.

Licensing is not a quality certificate or a grant of rights over someone else's input. Use of Aha does not automatically assign ownership of user-generated outputs to the project.

## 简体中文

除文件或随附声明另有规定外，Aha 原创源码、技能指令、文档、评估夹具及原创示例创作内容适用 [MIT 许可证](LICENSE)。该授权只覆盖 Aha 贡献者拥有的权利；示例中嵌入、引用或制作时使用的第三方材料不因此改用 MIT。

| 材料 | 适用声明 |
| --- | --- |
| 随包运行时依赖 | 每个安装后的技能都含 `THIRD-PARTY-NOTICES.txt`，依赖自带的许可同样适用；Aha 的 MIT 不能替代它们。 |
| 仓库中保存的上游 Git 源码和文档 | 遵循 [`examples/git-merge/public/COPYING`](https://github.com/sawyer0x110/aha/blob/main/examples/git-merge/public/COPYING) 中的 GPL v2、上游文件声明及访问台账，不改授 MIT。 |
| 地图资源与 D3 模块 | 示例资源记录将 Natural Earth 数据标为公共领域，D3 模块保留各自许可证。[格陵兰](https://github.com/sawyer0x110/aha/tree/main/examples/greenland/projects/video/assets)与[项目介绍](https://github.com/sawyer0x110/aha/tree/main/examples/aha-introduction/projects/video/assets)源码中的 `resources.json`、`*-LICENSE.txt` 应随资源保留。 |
| 语音、字体和独立安装的工具 | 配音审批不是无限制再分发授权。语音服务条款、字体权利及 Edge TTS、FFmpeg、浏览器、演示工具的许可需分别遵循；技能 ZIP 不分发这些工具或系统字体。 |
| 引用研究与用户提供材料 | 有引用或可公开阅读不等于获得额外复制许可；复用前检查原始来源与对应示例记录。 |

便携技能 ZIP 不含仓库示例及验收材料。新构建会在包根目录和两个可独立安装的技能内分别携带 Aha 许可证与本说明，并保留第三方声明。已发布包保持不变；源码增加文件不会更新既有下载。

许可不代表质量认证，也不授予他人输入材料的权利。使用 Aha 不会自动将用户生成作品的所有权转让给项目。
