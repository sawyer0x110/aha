# 安装 Aha Skills（供用户与 Agent）

本文件是源码仓库的稳定安装入口。请安装 **Release 中构建好的完整包**，不要把源码 `skills` 目录直接复制到宿主；源码缺少运行时、Schema 和合并后的共享参考。

统一推荐项目级 **`.agents\skills`**，每次安装 `aha-research`、`aha-explain` 两个 Skill，**不限定 Agent 品牌**。安装流程的宿主案例覆盖 Copilot／Codex；其他 Agent 自行判断技能发现与执行能力，不能据此宣称所有宿主兼容。全局安装和自动升级暂不支持。文件安装、宿主发现、自然语言触发和实际任务执行是四个独立结果，不能互相代替。

## 给 Agent 的任务入口

可以将本文件链接交给 Agent：

> 按 https://github.com/sawyer0x110/aha/blob/main/INSTALL.md 将 Aha Skills 安装到当前项目。先确认宿主、项目绝对路径与安装授权，展示所选 Release 和 dry-run 结果，再安装。检查两个运行时、宿主发现和最小任务；遇到缺失依赖或权限时报告阻塞，不自动安装其他软件、不覆盖旧目录，不把未执行的检查标为通过。

## 1. 安装前确认

- 已获准下载、解压安装包并写入目标项目；安装脚本是可执行代码，应先审阅或信任其来源。
- 确认当前 Agent 是否发现项目 `.agents\skills`，能否读取参考文件并通过 shell 调用 Node；这不依赖品牌白名单。目标是已存在的项目绝对路径，不能是用户主目录或文件系统根目录。
- 已安装 Node.js **22+**；运行 `node --version` 确认。缺失时先报告，并另行取得安装授权。
- 下载来源为 [本仓库 Releases](https://github.com/sawyer0x110/aha/releases)。优先使用用户指定版本，否则选择最新正式 Release 并记录实际 tag，不追随浮动版本重复下载。
- 在目标项目外使用一个新的下载／解压目录。不要将安装包下载进源码或现有 Skill 目录。
- 暂停目标项目中正在使用这些 Skill 的宿主。安装不是两个目录的原子替换，不应并发修改安装源或目标。

**如果没有正式 Release，停止并说明“安装包尚未发布”。** 不要猜测下载 URL，也不要将 GitHub 自动生成的 Source code ZIP 当成可安装包。经用户同意后，可走本文末尾的源码构建路线。

## 2. 获取完整发布包并校验

每个 Release 应包含：

```text
aha-skills-<version>.zip
SHA256SUMS.txt
release-manifest.json
INSTALL.md
```

可通过 Releases 页面下载，也可使用已有的 GitHub CLI。以下 PowerShell 示例在**新的空下载目录**中执行；任一命令失败都应停止：

```powershell
# 如果用户指定了版本，直接设置该 tag，不查询 latest。
$Tag = gh release view --repo sawyer0x110/aha --json tagName --jq .tagName
if ($LASTEXITCODE -ne 0) { throw "无法获取正式 Release；停止安装。" }
if ($Tag -notmatch '^v\d+\.\d+\.\d+$') { throw "请选择有效的正式版本 tag。" }
$Version = $Tag.Substring(1)
$Archive = "aha-skills-$Version.zip"

gh release download $Tag --repo sawyer0x110/aha `
  --pattern $Archive --pattern SHA256SUMS.txt `
  --pattern release-manifest.json --pattern INSTALL.md
if ($LASTEXITCODE -ne 0) { throw "Release 下载失败；不要使用不完整的文件。" }

foreach ($Name in @($Archive, 'release-manifest.json', 'INSTALL.md')) {
  $Lines = @(Get-Content .\SHA256SUMS.txt | Where-Object {
    $_ -match ('^[0-9a-f]{64}  ' + [regex]::Escape($Name) + '$')
  })
  if ($Lines.Count -ne 1) { throw "校验条目缺失或重复：$Name" }
  $Expected = $Lines[0].Substring(0, 64)
  $Actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $Name).Hash
  if ($Actual -ne $Expected) { throw "SHA256 不匹配：$Name" }
}

if (Test-Path .\extracted) { throw "请选择新的解压目录。" }
Expand-Archive -LiteralPath $Archive -DestinationPath .\extracted -ErrorAction Stop
```

没有 `gh` 时，用宿主已有的下载工具获取**同一 tag**的上述文件，不必为此自动安装 GitHub CLI。SHA256 检测损坏与内容不一致，不证明发布者身份；校验文件必须来自可信来源。安装器还会校验解压包内每个文件及两个 Skill 的运行时清单。

## 3. 预检与安装

从解压目录执行，替换项目绝对路径，无需传入宿主名称：

```powershell
Set-Location .\extracted
$Project = 'C:\your-project'
node .\install-skills.mjs --project $Project
if ($LASTEXITCODE -ne 0) { throw "预检失败；未执行安装。" }

# 审阅 dry-run 的 project、destination、skills 和 contentHash，
# 确认其符合用户授权后，才执行：
node .\install-skills.mjs --project $Project --apply
if ($LASTEXITCODE -ne 0) { throw "安装失败；检查错误和目标目录，不强制重试。" }
```

所有宿主使用相同的推荐安装位置：`.agents\skills\aha-research` 和 `.agents\skills\aha-explain`。为兼容已有调用，保留可选 `--host <任意非空标签>`，只记录在结果中，不决定安装路径或证明宿主兼容性。

安装包自带 JS 运行时依赖，**接收方不需要 `npm install`**。安装器仅使用 Node 内置模块，需要支持硬链接的本地文件系统；没有 `--force`、全局安装或单 Skill 选择参数。POSIX 环境使用对应正斜杠路径和绝对项目路径。

### 冲突与升级

目标 Skill 已存在时安装器拒绝覆盖。在 `.github` 或 `.claude` 的 skills 目录发现同名 Skill，或在 `.github`、`.agents`、`.claude` 发现旧 `aha-lab`／`aha-story` 入口时，也会拒绝安装。不要通过跳过检查或删除目录来继续。

先读取已有 `runtime-manifest.json`，报告当前版本与拟安装版本。取得明确授权后，将旧目录移到**宿主发现路径之外**的备份目录，再重新预检安装。Agent 还应检查该宿主特有的其他发现路径是否存在同名副本，避免重复；安装器不会自动清理它们。需要回退时，同样先取得授权，移开新安装后恢复备份。不要合并新旧文件或手改哈希。

## 4. 确认运行时与宿主发现

所有宿主使用相同的安装目录：

```powershell
node "C:\your-project\.agents\skills\aha-research\scripts\aha.mjs" doctor
node "C:\your-project\.agents\skills\aha-explain\scripts\aha.mjs" doctor
```

逐个检查退出码和 JSON 输出。基础 `doctor` 不检查可选媒体工具；需要时使用 `doctor --for image`、`--for video` 或 `--for speech`，同时检查 `mediaReadiness`，不能只看进程是否成功退出。

启动／刷新目标项目的宿主，查看其技能列表。支持该命令的 Copilot CLI 可运行：

```powershell
copilot -C "C:\your-project" skill list
```

应看到 `aha-research` 和 `aha-explain`。Codex 及其他 Agent 使用各自版本提供的技能列表或选择界面；不假设存在与 Copilot 相同的 CLI 命令。其他 Agent 应自行查阅宿主文档并判断 `.agents\skills`、附带参考文件、Node／shell 执行和权限是否受支持。若需要额外路径配置或适配，先说明差异并取得相关授权，不静默复制到多个发现目录。无法确认或不支持时，报告发现／执行阻塞，不将安装成功当作兼容证明。

## 5. 最小使用验收

在安装项目中分别发出以下自然语言请求，不在请求中显式指定 Skill 名称，以便单独观察路由。使用新的输出目录，仅使用用户授权的非敏感材料：

| 目标 | 示例请求 | 应观察到的结果 |
| --- | --- | --- |
| `aha-research` | “根据我提供的两份有冲突的材料，调查差异与证据限制，交付研究报告和独立研究档案，不制作视觉作品，不联网。” | 宿主加载研究 Skill；Agent 使用安装目录中的 CLI 检查和构建研究档案，报告有实际来源与缺口 |
| `aha-explain` | “将刚才的研究档案制作成一个离线 HTML 解释页面，保留来源与限制，只生成 HTML，不执行页面脚本。” | 宿主加载创作 Skill；Agent 调用安装目录中的 CLI，实际编写源文件并成功生成非占位 HTML |

报告实际使用的脚本绝对路径、命令结果和产物位置。无材料、权限或宿主访问能力时，相关项标为“未执行／阻塞”。显式选择 Skill 后成功，只证明显式使用，不证明自然语言触发；HTML 生成成功也不等于浏览器视觉验收。

安装结束应分别记录：Release tag／内容哈希、目标目录、两个 doctor 结果、两个 Skill 的发现与触发结果、最小任务产物、尚未验收的能力。

## 可选媒体依赖与权限

| 能力 | 额外条件 |
| --- | --- |
| 研究检查、HTML 打包、PPTX 构建 | Node；PPTX 作者脚本执行仍需审阅和 `--allow-code` 授权 |
| 图片、浏览器检查 | 已安装 Edge／Chrome，作品代码执行授权 |
| 视频编码 | 已安装浏览器、FFmpeg／ffprobe，作品代码执行授权 |
| 在线旁白 | Python、`edge-tts==7.2.8`、音频工具，当前旁白计划审批及外发授权 |

安装器不安装这些软件、不下载浏览器、不调用在线语音服务。缺少可选工具只阻塞相关步骤，不阻塞基础研究或 HTML 打包；详见 [README](README.md#本地依赖与执行边界)。

## 发布尚不可用时：授权后从源码构建

在独立的可信源码 checkout 中，固定并记录 commit，审阅构建脚本后执行：

```powershell
npm ci --ignore-scripts
npm run build
node .\scripts\release.mjs
```

每一步失败即停止。最后一个命令返回发布目录与 ZIP 路径，通常为 `dist\releases\<version>\<contentHash>`；这仍只是**本地产出的包**，不代表 GitHub Release 已发布。然后从本文第 2 步校验、解压并安装，不直接复制源码。

## 维护者发布入口

确认 `package.json` 和 `package-lock.json` 中的版本一致后，发布匹配的 `v<version>` tag，例如版本 `0.3.1` 对应 `v0.3.1`。仓库的 [Release 工作流](.github/workflows/release.yml) 会检查版本，构建并检查分发包，再将 ZIP、清单、校验文件和安装指南上传到该 tag 的 GitHub Release。

当前源码版本为 `0.3.1`。以 [GitHub Releases](https://github.com/sawyer0x110/aha/releases) 中实际存在的正式 Release 和完整资产为准；源码版本提升、本地打包或 tag 推送不代表发布已完成，不猜测下载地址。需要尚未发布的修复时，按上节取得授权后从固定源码提交构建。

发布 tag 会触发对外发布，应单独确认发布权限与时机。工作流不运行 Copilot／Codex，不替代真实宿主发现与触发验收；在完成第 5 步前，不宣称宿主端到端兼容性已通过。
