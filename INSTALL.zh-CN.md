# 安装 Aha Skills

[English](INSTALL.md) | [简体中文](INSTALL.zh-CN.md) · [项目首页](https://github.com/sawyer0x110/aha/blob/main/README.zh-CN.md) · [使用指南](https://github.com/sawyer0x110/aha/blob/main/docs/USAGE.zh-CN.md)

请安装 **Release 中构建好的完整包**，不要直接复制源码 `skills` 目录。所有宿主统一推荐项目级 `.agents\skills`。安装器只安装 `aha-research`、`aha-explain` 两个 Skill；每份独立携带运行时、Schema、参考、已打包 JS 依赖和第三方声明。需要 **Node.js 22+**；接收方**无需 `npm install`**。

本指南可在源码 checkout 中阅读，也可随未来安装包解压后使用。**安装包命令在解压目录执行，不在源码目录执行。** 源码构建命令在后文单独标注。

Windows 已有实际使用。不宣称 macOS/Linux 已验证；POSIX 路径示例不保证平台支持。安装器宿主案例覆盖 Copilot／Codex，不等于真实宿主验收，也不是品牌白名单。其他 Agent 应检查自身发现和执行能力。文件安装、宿主发现、自然语言触发、实际任务完成是四个独立结果。

当前源码／包 runtime 为 **0.3.1**，研究／作品 Schema 为 **1.0.0**。已发布的 `v0.3.1` 是历史安装包。本次文档／打包调整待未来发布，不改变该历史 Release 的资产。

## 给 Agent 的任务入口

> 按 https://github.com/sawyer0x110/aha/blob/main/INSTALL.zh-CN.md 将 Aha 安装到当前项目。先确认宿主、项目绝对路径与安装授权，展示所选 Release 和 dry-run 结果再安装。检查两个运行时、宿主发现和最小任务。缺失依赖或权限时报告阻塞，不自动安装其他软件、不覆盖已有目录，不把未执行的检查标为通过。

## 1. 下载前确认

- 已获准下载、解压和写入目标项目。安装器是可执行代码，运行前应审阅或信任其来源。
- 确认宿主可发现项目 `.agents\skills`、读取参考文件、通过 shell 调用 Node。目标是**已存在的项目绝对路径**，不能是主目录或文件系统根目录。
- 用 `node --version` 确认 **22+**。缺失时报告阻塞，另行取得安装授权。
- 使用[官方 Releases](https://github.com/sawyer0x110/aha/releases)。优先使用用户指定版本，否则选最新稳定 Release 并记录实际 tag；不反复追随浮动版本。
- 在目标项目、源码 checkout 和现有 Skill 目录之外使用**新的空下载目录**。
- 暂停使用目标 Skill 的宿主。安装不是两个目录的原子替换；不要并发修改源或目标。需要支持硬链接的本地文件系统；不安全路径、符号链接／junction 与哈希不匹配会被拒绝。

若无正式 Release，停止并说明安装包不可用。不要猜下载地址，也不要把 GitHub 自动生成的 **Source code** ZIP 当作安装包。经授权可走后文源码构建路线。

## 2. 下载并校验发布包

已发布 `v0.3.1` 的资产为：

```text
aha-skills-0.3.1.zip
release-manifest.json
SHA256SUMS.txt
INSTALL.md
```

所选版本的基础资产为带版本的 ZIP、清单、校验文件和 `INSTALL.md`。未来包计划在 ZIP 内和 Release 附件中增加 `INSTALL.zh-CN.md`、`LICENSE`、英中双语 `LICENSE-SCOPE.md`。**不要要求历史 `v0.3.1` 必须有这些新增文件。** 不要把新文档塞入旧解压目录：旧清单只描述原始内容。

### PowerShell 下载与 SHA256 校验

在新的空下载目录中使用已有 GitHub CLI。若用户明确选定 `v0.3.1`，将查询 tag 的赋值行替换为 `$Tag = 'v0.3.1'`。任一步失败都停止：

```powershell
$ErrorActionPreference = 'Stop'
if (@(Get-ChildItem -Force).Count -ne 0) { throw 'Use a new empty download directory.' }

$Tag = gh release view --repo sawyer0x110/aha --json tagName --jq .tagName
if ($LASTEXITCODE -ne 0) { throw 'Cannot resolve a stable release.' }
if ($Tag -notmatch '^v\d+\.\d+\.\d+$') { throw 'Select a stable version tag.' }
$Version = $Tag.Substring(1)
$Archive = "aha-skills-$Version.zip"
$Required = @($Archive, 'release-manifest.json', 'INSTALL.md')
$Allowed = $Required + @('INSTALL.zh-CN.md', 'LICENSE', 'LICENSE-SCOPE.md')

# 下载该 tag 的全部附件，不覆盖已有文件。
gh release download $Tag --repo sawyer0x110/aha
if ($LASTEXITCODE -ne 0) { throw 'Download failed; do not use partial files.' }

foreach ($File in Get-ChildItem -Force) {
  if ($File.PSIsContainer -or (($Allowed + @('SHA256SUMS.txt')) -cnotcontains $File.Name)) {
    throw "Unexpected asset; review before proceeding: $($File.Name)"
  }
}
foreach ($Name in ($Required + @('SHA256SUMS.txt'))) {
  if (-not (Test-Path -LiteralPath $Name -PathType Leaf)) { throw "Missing asset: $Name" }
}

$Checksums = @{}
foreach ($Line in Get-Content -LiteralPath .\SHA256SUMS.txt) {
  if ($Line -cnotmatch '\A([0-9a-f]{64})  ([^\r\n]+)\z') { throw 'Malformed checksum line.' }
  $Hash = $Matches[1]
  $Name = $Matches[2]
  # 精确文件名白名单拒绝路径穿越、绝对路径和别名。
  if ($Allowed -cnotcontains $Name) { throw "Unsafe or unexpected checksum name: $Name" }
  if ($Checksums.ContainsKey($Name)) { throw "Duplicate checksum: $Name" }
  $Checksums[$Name] = $Hash
}
foreach ($Name in $Checksums.Keys) {
  if (-not (Test-Path -LiteralPath $Name -PathType Leaf)) { throw "Missing checksummed asset: $Name" }
}
foreach ($File in Get-ChildItem -File -Force) {
  if ($File.Name -ceq 'SHA256SUMS.txt') { continue }
  if (-not $Checksums.ContainsKey($File.Name)) { throw "Missing checksum: $($File.Name)" }
  if ((Get-FileHash -Algorithm SHA256 -LiteralPath $File.FullName).Hash -ne $Checksums[$File.Name]) {
    throw "SHA256 mismatch: $($File.Name)"
  }
}
$Manifest = Get-Content -Raw -LiteralPath .\release-manifest.json | ConvertFrom-Json
if ($Manifest.version -cne $Version) { throw 'Tag and manifest version differ.' }

if (Test-Path -LiteralPath .\extracted) { throw 'Use a new extraction directory.' }
Expand-Archive -LiteralPath $Archive -DestinationPath .\extracted
```

此流程校验三个必须有哈希的基础资产，以及**所有已下载的补充文档**。它拒绝格式错误、重复条目、缺失条目／文件和精确白名单之外的文件名。未来若资产布局改变，应审阅该版本说明，不要放宽检查直接继续。

### 手动下载／POSIX 替代路径

没有 `gh` 时，通过 Releases 页面和已有下载工具，将**同一 tag 的全部附件**保存到新的空目录；不自动安装下载工具。POSIX 可使用已有 SHA256 工具，例如已安装的 `sha256sum` 或 `shasum -a 256`。遵循上述相同检查：要求三个基础哈希条目，校验每个已下载的补充文档，**把校验文件交给工具之前**先拒绝重复／格式错误条目和白名单之外的名称，再逐个比对摘要。无法完成校验时停止。用已有解压工具把验证后的 ZIP 解压到新目录。

SHA256 检测损坏和内容不一致，**不证明发布者身份**；校验文件须来自可信来源。安装器还会检查每个解压后的载荷文件、内容身份与两个运行时清单。保持解压内容不变；下载附件放在解压目录旁边，不要放进解压目录。

## 3. 先预检，再安装

从下载目录进入**解压后的安装包目录**，替换为已授权的项目绝对路径。若已在校验过的解压目录中，省略 `Set-Location`：

```powershell
$ErrorActionPreference = 'Stop'
Set-Location .\extracted
$Project = 'C:\your-project'
node .\install-skills.mjs --project $Project
if ($LASTEXITCODE -ne 0) { throw 'Preflight failed; stop.' }
```

审阅 `project`、`destination`、`skills`、`contentHash`。确认符合用户授权后才执行：

```powershell
node .\install-skills.mjs --project $Project --apply
if ($LASTEXITCODE -ne 0) { throw 'Installation failed; inspect the error and target before retrying.' }
```

对应的 **POSIX 路径示例**（不代表平台已验证）；若已在解压目录中，省略 `cd`：

```sh
cd ./extracted || exit 1
node ./install-skills.mjs --project "/absolute/path/to/project" || exit 1
# 先停下审阅 dry-run 并取得授权，再执行下一条命令。
node ./install-skills.mjs --project "/absolute/path/to/project" --apply || exit 1
```

默认 dry-run。两个 Skill 安装到 `.agents\skills\aha-research`、`.agents\skills\aha-explain`。可选 `--host <非空标签>` 只记录元数据，不选择路径、不证明兼容性。没有 `--force`、覆盖、全局安装、自动升级或单 Skill 选择选项。失败只回滚本次调用拥有的安装工作，可能留下空的发现父目录；应检查错误，不要删除大范围目录。

### 范围冲突与升级

安装器拒绝已有目标 Skill、`.github\skills`／`.claude\skills` 中的同名 Skill，以及 `.github\skills`、`.agents\skills`、`.claude\skills` 中的旧 `aha-lab`／`aha-story`。不要绕过检查。

读取已有 `runtime-manifest.json`，报告当前和拟安装版本。取得**明确授权**后，把精确的冲突目录移到**所有宿主发现路径之外**的备份位置，再预检、安装。同时检查宿主特有的其他发现路径；安装器不会清理它们。不合并新旧文件、不手改哈希。回退同样需要授权：先移走新安装，再恢复备份。

## 4. 检查两个运行时与宿主发现

```powershell
node "C:\your-project\.agents\skills\aha-research\scripts\aha.mjs" doctor
if ($LASTEXITCODE -ne 0) { throw 'Research runtime check failed.' }
node "C:\your-project\.agents\skills\aha-explain\scripts\aha.mjs" doctor
if ($LASTEXITCODE -ne 0) { throw 'Explain runtime check failed.' }
```

POSIX 路径写作 `node "/absolute/path/to/project/.agents/skills/aha-research/scripts/aha.mjs" doctor`，再对 `aha-explain` 重复。除退出码外还应检查 JSON。

在目标项目中启动／刷新宿主，查看技能列表。支持以下命令的 Copilot CLI 可运行：

```powershell
copilot -C "C:\your-project" skill list
```

应出现两个 Skill 名称。Codex 或其他 Agent 使用当前版本文档提供的技能列表／选择界面，不假设 Copilot 命令可用。核实 `.agents\skills`、参考文件读取、Node／shell 执行与权限。需要适配时先说明并取得授权，不静默复制多份安装。无法确认或不支持发现／执行时应报告阻塞，不判定兼容通过。

## 5. 最小自然语言任务

只用已授权的非敏感材料和新输出路径。不在请求中显式指定 Skill 名，以便单独观察路由：

> 调查这两份相互冲突的材料的差异，交付有来源的报告和独立研究档案，注明限制。只用提供的材料，不联网、不制作视觉作品。

应观察到宿主加载 `aha-research`，调用已安装 CLI，构建包含实际来源和明确缺口的档案。

> 将刚才的研究档案制作成一个离线 HTML 解释页面，保留来源与限制。只生成 HTML，不执行页面脚本。

应观察到宿主加载 `aha-explain`，实际编写源，打包出非占位 HTML。HTML 默认英中双语、初始显示英语；需要其他受支持语言时请明确提出。

记录脚本绝对路径、命令结果与产物位置。缺少材料、权限或宿主能力时标为**未执行／阻塞**，不是通过。显式选择 Skill 后成功，只证明显式使用，不证明自然语言路由；HTML 打包不是浏览器 QA。

记录 Release tag／内容哈希、安装目标、两个 doctor 结果、两个发现／触发结果、最小任务产物与尚未验证的能力。

## 可选依赖与权限

| 步骤 | 额外条件 |
| --- | --- |
| 研究检查、HTML 打包 | 除 Node 外无需其他工具；不执行作品代码 |
| 原生 PPTX 构建 | Node；审阅作者脚本并明确授权 `--allow-code` |
| 浏览器检查／PNG | 已安装 Edge／Chrome；代码执行授权 |
| 动态视频编码 | 已安装浏览器、FFmpeg／ffprobe；代码执行授权 |
| 在线旁白 | Python、精确版本 `edge-tts==7.2.8`、FFmpeg／ffprobe，当前旁白计划审批及外发授权 |

| 诊断 | 探测的可选工具 |
| --- | --- |
| `doctor`、`doctor --for research`、`--for html`、`--for pptx` | 无；只检查运行时完整性 |
| `doctor --for browser`、`--for image` | 浏览器 |
| `doctor --for video` | 浏览器、FFmpeg、ffprobe；不要求语音依赖 |
| `doctor --for speech` | FFmpeg、ffprobe、Python／Edge TTS；不要求浏览器 |
| `doctor --media` | 全部媒体工具；不是所有任务的统一门槛 |

`--for` 与 `--media` 不能同时使用。检查 `mediaReadiness`；进程成功退出不等于媒体就绪。可选工具缺失只阻塞相关步骤。

通过 `AHA_BROWSER_EXECUTABLE`／`AHA_BROWSER_CHANNEL`、`AHA_FFMPEG`、`AHA_FFPROBE`、`AHA_PYTHON` 复用已有工具。Python 按显式配置、已激活环境、命令当前目录的 `.venv-media`、PATH 选择。不向上或到主目录搜索，不从损坏的显式配置静默回退；在其他目录工作时，激活已有环境或指定解释器绝对路径。

安装器和 doctor 都不安装依赖、不下载浏览器、不发送旁白。软件安装和网络处理分别取得授权。执行 `--allow-code` 前审阅源码：它**不是 OS 沙箱**，Node 作者代码拥有本地进程权限。在线旁白需要批准当前文本、提供方、声线、语速及外发范围；不要把合成旁白当作安装测试。详见[使用与执行边界](https://github.com/sawyer0x110/aha/blob/main/docs/USAGE.zh-CN.md)。

## 安全卸载

暂停宿主，确认精确项目与安装路径；按需备份用户新增内容。**只有取得明确授权后**才移除以下两个精确目录：

```text
<project>\.agents\skills\aha-research
<project>\.agents\skills\aha-explain
```

不要删除 `.agents`、`.agents\skills`、其他宿主发现目录、其他 Skill、研究档案或作品。删除前检查符号链接／junction 和意外内容；有歧义就停止。刷新宿主并验证条目消失。旧版／重复安装需另行逐路径审阅并取得授权。

## 仅限源码 checkout：授权后本地构建

Release 不可用或确需未发布变更时，取得明确授权，在独立可信 checkout 中构建。固定并记录 commit，审阅构建脚本。**以下命令不适用于解压后的安装包：**

```powershell
$ErrorActionPreference = 'Stop'
npm ci --ignore-scripts
if ($LASTEXITCODE -ne 0) { throw 'Dependency restore failed.' }
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }
node .\scripts\release.mjs
if ($LASTEXITCODE -ne 0) { throw 'Local packaging failed.' }
```

最后一条命令报告资产目录与 ZIP，通常在 `dist\releases\<version>\<contentHash>`。它是**本地产出的包**，不是正式发布。对这些资产执行相同的校验、解压、预检和验收流程，不直接复制源码 Skill。

维护者请看[参与贡献](https://github.com/sawyer0x110/aha/blob/main/CONTRIBUTING.zh-CN.md)和 [Release 工作流](https://github.com/sawyer0x110/aha/blob/main/.github/workflows/release.yml)。包版本一致、本地构建或推送 tag 都不证明发布完成；发布需单独授权，并确认实际 Release 资产。工作流不执行真实宿主验收。

## 许可与安全

对于包含相关文件的安装包，请阅读 [MIT 许可](LICENSE)和英中双语[许可范围](LICENSE-SCOPE.md)。这些是计划新增文件，不是安装历史 `v0.3.1` 的前提；文件缺失时可查看[仓库许可范围](https://github.com/sawyer0x110/aha/blob/main/LICENSE-SCOPE.md)。保留各 Skill 的第三方声明。漏洞报告遵循[安全政策](https://github.com/sawyer0x110/aha/blob/main/SECURITY.zh-CN.md)，不要公开包含秘密的信息。
