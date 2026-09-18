# Install Aha Skills

[English](INSTALL.md) | [简体中文](INSTALL.zh-CN.md) · [Project](https://github.com/sawyer0x110/aha/blob/main/README.md) · [Usage](https://github.com/sawyer0x110/aha/blob/main/docs/USAGE.md)

Install the **complete built release package**, not the source `skills` directory. The recommended location for every host is project-local `.agents\skills`. The installer installs exactly `aha-research` and `aha-explain`; each carries its own runtime, schemas, references, bundled JS dependencies, and third-party notices. Recipients need **Node.js 22+**, but **not `npm install`**.

This guide is usable in a source checkout and, when included, an extracted release ZIP. **Package commands run in the extracted ZIP, not the source checkout.** Source-building commands are separately labeled below.

Windows has been exercised. macOS/Linux have not been verified; POSIX path examples do not guarantee support. Installer host cases cover Copilot/Codex, not live host acceptance or a brand allowlist. Other agents must check their own discovery and execution capabilities. File installation, host discovery, natural-language routing, and actual task completion are four separate results.

Current source/package runtime is **0.3.2**, with research/artifact schemas **1.0.0**. Version 0.3.2 packages include MIT notices and bilingual installation guides. Confirm publication and available assets on [Releases](https://github.com/sawyer0x110/aha/releases); source changes alone do not mean a release is available. Published `v0.3.1` remains unchanged.

## Ask your agent to install

> Follow https://github.com/sawyer0x110/aha/blob/main/docs/INSTALL.md to install Aha into this project. Confirm the host, absolute project path, and installation permission. Show the selected release and dry-run before applying. Check both runtimes, host discovery, and minimal tasks. Report missing dependencies or permissions; do not install other software, overwrite existing directories, or mark unperformed checks as passed.

## 1. Before downloading

- Obtain permission to download, extract, and write to the target project. The installer is executable code: review it or trust its source before running it.
- Confirm the host can discover project `.agents\skills`, read references, and invoke Node through a shell. Use an **existing absolute project path**, not a home directory or filesystem root.
- Check `node --version` for **22+**. If missing, report the blocker and obtain separate installation permission.
- Use [official Releases](https://github.com/sawyer0x110/aha/releases). Prefer the user's selected version; otherwise choose the latest stable release and record the actual tag. Do not repeatedly follow a floating version.
- Use a **new, empty download directory outside the target project**, source checkout, and existing skill directories.
- Pause hosts using the target skills. Installation is not an atomic two-directory replacement; do not concurrently modify source or target. A local filesystem supporting hard links is required. Unsafe paths, symlinks/junctions, and hash mismatches are refused.

If no stable release exists, stop and say the package is unavailable. Do not guess asset URLs or use GitHub's automatically generated **Source code** ZIP as an installation package. An authorized source-build alternative appears below.

## 2. Download and verify the release

The published `v0.3.1` assets are:

```text
aha-skills-0.3.1.zip
release-manifest.json
SHA256SUMS.txt
INSTALL.md
```

For the selected version, the baseline is its versioned ZIP, manifest, checksum file, and `INSTALL.md`. Version 0.3.2 adds `INSTALL.zh-CN.md`, `LICENSE`, and bilingual `LICENSE-SCOPE.md` inside the ZIP and as release assets. The full guides and scope note come from source `docs/` and retain these basenames at the ZIP root. **Do not require the additional files for historical `v0.3.1`.** Do not add new documents to an old extracted ZIP: its manifest describes its original contents.

### PowerShell download and SHA256 check

Use an already-installed GitHub CLI, in the new empty download directory. Replace the tag lookup with `$Tag = 'v0.3.1'` when that is the version explicitly selected by the user. Stop on every failure:

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

# Download all assets belonging to this tag, without overwriting existing files.
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
  # An exact filename allowlist rejects path traversal, absolute paths, and aliases.
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

This verifies the mandatory three hashed baseline assets and **every downloaded supplemental document**. It rejects malformed lines, duplicates, missing entries/files, and any filename outside the exact list. If a later release changes the asset layout, review its instructions rather than weakening these checks.

### Manual download / POSIX alternative

Without `gh`, use the Releases page and existing download tools to save **all attached assets for the same tag** into a new empty directory; do not automatically install a downloader. On POSIX, use an already-available SHA256 tool (for example `sha256sum` or `shasum -a 256`, if present). Apply the same checks above: require the three baseline hash entries, check every downloaded supplemental document, reject duplicate/malformed entries and non-allowlisted names **before** handing a checksum file to a tool, and compare each digest. Stop if verification cannot be completed. Extract the verified ZIP into a new directory using an existing archive tool.

SHA256 detects corruption and inconsistent content, **not publisher authenticity**; get the checksum file from a trusted source. The installer additionally checks every extracted payload file, the content identity, and both runtime manifests. Keep the extracted payload unchanged and keep downloaded assets beside—not inside—the extraction directory.

## 3. Dry-run, then install

Starting in the download directory, enter the **extracted package directory** and replace the target with your authorized absolute project path. If already inside the verified extracted package, omit `Set-Location`:

```powershell
$ErrorActionPreference = 'Stop'
Set-Location .\extracted
$Project = 'C:\your-project'
node .\install-skills.mjs --project $Project
if ($LASTEXITCODE -ne 0) { throw 'Preflight failed; stop.' }
```

Review `project`, `destination`, `skills`, and `contentHash`. Only after confirming they match the user's authorization:

```powershell
node .\install-skills.mjs --project $Project --apply
if ($LASTEXITCODE -ne 0) { throw 'Installation failed; inspect the error and target before retrying.' }
```

Equivalent **POSIX path examples** (not a claim of verified platform support); omit `cd` if already inside the extracted package:

```sh
cd ./extracted || exit 1
node ./install-skills.mjs --project "/absolute/path/to/project" || exit 1
# Stop to review the dry-run and obtain authorization before the next command.
node ./install-skills.mjs --project "/absolute/path/to/project" --apply || exit 1
```

The default is dry-run. Both skills go into `.agents\skills\aha-research` and `.agents\skills\aha-explain`. Optional `--host <nonempty-label>` records metadata only; it does not choose a path or prove compatibility. There is no `--force`, overwrite, global installation, automatic upgrade, or single-skill selection option. Failure rolls back only this invocation's owned installation work; empty discovery parents may remain. Inspect failures rather than deleting broad directories.

### Scope conflicts and upgrades

The installer refuses existing target skills, same-name skills under `.github\skills` or `.claude\skills`, and legacy `aha-lab` / `aha-story` entries under `.github\skills`, `.agents\skills`, or `.claude\skills`. Do not bypass these checks.

Read the existing `runtime-manifest.json` and report installed/proposed versions. With **explicit authorization**, move the exact conflicting directories into a backup **outside every host discovery path**, then rerun dry-run and install. Check other host-specific discovery paths as well; the installer does not clean them. Do not merge old and new files or edit hashes. Rollback likewise requires authorization: move the new installation out of discovery, then restore the backup.

## 4. Check both runtimes and host discovery

```powershell
node "C:\your-project\.agents\skills\aha-research\scripts\aha.mjs" doctor
if ($LASTEXITCODE -ne 0) { throw 'Research runtime check failed.' }
node "C:\your-project\.agents\skills\aha-explain\scripts\aha.mjs" doctor
if ($LASTEXITCODE -ne 0) { throw 'Explain runtime check failed.' }
```

For POSIX paths, use `node "/absolute/path/to/project/.agents/skills/aha-research/scripts/aha.mjs" doctor` and repeat for `aha-explain`. Inspect JSON as well as exit codes.

Start/refresh the host in the target project and inspect its skill list. Copilot CLI versions supporting this command can use:

```powershell
copilot -C "C:\your-project" skill list
```

Both names should appear. For Codex or other agents, use that version's documented skill list or selection UI; do not assume Copilot's command exists. Verify `.agents\skills`, reference-file reading, Node/shell execution, and permissions. If adaptation is needed, explain it and obtain authorization; do not silently duplicate installations. Unverified or unsupported discovery/execution is a blocker, not a compatibility pass.

## 5. Try minimal natural-language tasks

Use only authorized, non-sensitive materials and new output paths. Ask without explicitly naming a skill to observe routing separately:

> Investigate the differences between these two conflicting documents. Deliver a source-grounded report and an independent research archive with limitations. Use only the provided materials; no network or visual outputs.

Expect `aha-research` to load, use the installed CLI, and build an archive with real sources and stated gaps.

> Turn that research archive into one offline HTML explanation, retaining sources and limitations. Generate HTML only; do not execute page scripts.

Expect `aha-explain` to load, author real source, and package non-placeholder HTML. HTML defaults to English/Chinese with English initially visible; explicitly request a different supported language if needed.

Record the absolute script paths, command results, and output locations. Missing materials, permissions, or host capabilities mean **not run / blocked**, not passed. Explicit skill selection proves explicit use only, not natural-language routing; HTML packaging is not browser QA.

Record the release tag/content hash, target, both doctor results, both discovery/routing results, minimal task outputs, and unverified capabilities.

## Optional dependencies and permissions

| Step | Additional requirements |
| --- | --- |
| Research checks, HTML packaging | None beyond Node; do not execute authored code |
| Native PPTX build | Node; reviewed authored script and explicit `--allow-code` |
| Browser checks / PNG | Installed Edge/Chrome; code-execution permission |
| Dynamic video encoding | Installed browser, FFmpeg/ffprobe; code-execution permission |
| Online narration | Python, exactly `edge-tts==7.2.8`, FFmpeg/ffprobe, current narration-plan approval and permission to send it externally |

| Diagnostic | Optional tools probed |
| --- | --- |
| `doctor`, `doctor --for research`, `--for html`, `--for pptx` | None; runtime integrity only |
| `doctor --for browser`, `--for image` | Browser |
| `doctor --for video` | Browser, FFmpeg, ffprobe; not speech dependencies |
| `doctor --for speech` | FFmpeg, ffprobe, Python/Edge TTS; not browser |
| `doctor --media` | All optional media tools; not a universal task gate |

Do not combine `--for` with `--media`. Inspect `mediaReadiness`; a successful exit alone is not media readiness. Missing optional tools block only the relevant step.

Reuse installed tools through `AHA_BROWSER_EXECUTABLE` / `AHA_BROWSER_CHANNEL`, `AHA_FFMPEG`, `AHA_FFPROBE`, and `AHA_PYTHON`. Python selection is explicit configuration, activated environment, `.venv-media` in the command's current directory, then PATH. There is no ancestor/home search or silent fallback from broken explicit configuration; activate an existing environment or set its absolute interpreter path when working elsewhere.

Neither installer nor doctor installs dependencies, downloads browsers, or sends narration. Obtain separate permission for any installation or network processing. Review code before `--allow-code`: it is **not an OS sandbox**, and Node author code has local process privileges. Online narration requires approval of the current text, provider, voice, rate, and outbound scope; do not synthesize as an installation test. See [usage and execution boundaries](https://github.com/sawyer0x110/aha/blob/main/docs/USAGE.md).

## Uninstall safely

Pause the host and confirm the exact project and installed paths. Back up any user additions if needed. **Only with explicit authorization**, remove these two exact directories:

```text
<project>\.agents\skills\aha-research
<project>\.agents\skills\aha-explain
```

Do not delete `.agents`, `.agents\skills`, another host's discovery directory, other skills, research archives, or artwork. Check for symlinks/junctions and unexpected contents before removal; stop on ambiguity. Refresh the host and verify those entries are gone. Older/duplicate installations require separate path-specific review and authorization.

## Source checkout only: authorized local build

If a release is unavailable or an unreleased change is required, obtain explicit permission to build from a trusted, separate checkout. Pin and record its commit; review build scripts. **These commands do not apply to an extracted package:**

```powershell
$ErrorActionPreference = 'Stop'
npm ci --ignore-scripts
if ($LASTEXITCODE -ne 0) { throw 'Dependency restore failed.' }
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }
node .\scripts\release.mjs
if ($LASTEXITCODE -ne 0) { throw 'Local packaging failed.' }
```

The last command reports the asset directory and ZIP, usually under `dist\releases\<version>\<contentHash>`. This is a **local package**, not a published release. Apply the same checksum, extraction, dry-run, and acceptance process to those assets; do not copy source skills directly.

Maintainers: see [Contributing](https://github.com/sawyer0x110/aha/blob/main/.github/CONTRIBUTING.md) and the [release workflow](https://github.com/sawyer0x110/aha/blob/main/.github/workflows/release.yml). Matching package versions, a local build, or pushing a tag do not establish publication. Publishing requires separate authorization and verification of actual release assets; the workflow does not perform live host acceptance.

## License and security

Read the [MIT license](https://github.com/sawyer0x110/aha/blob/main/LICENSE) and bilingual [license scope](LICENSE-SCOPE.md). Version 0.3.2 packages also include the license file at the ZIP root and both notices in each skill. They are not prerequisites for installing historical `v0.3.1`; when the scope note is absent, consult the [repository copy](https://github.com/sawyer0x110/aha/blob/main/docs/LICENSE-SCOPE.md). Preserve each skill's third-party notices. Report vulnerabilities using [Security](https://github.com/sawyer0x110/aha/blob/main/.github/SECURITY.md), not a public disclosure containing secrets.
