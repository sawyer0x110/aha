# Reporting security concerns

[English](SECURITY.md) | [简体中文](SECURITY.zh-CN.md)

**Do not put credentials, private research, exploit details, or sensitive files in a public issue, discussion, or PR.**

If GitHub shows **Security → Advisories → Report a vulnerability** for [this repository](https://github.com/sawyer0x110/aha/security), use that private channel. Availability depends on repository settings and your access; this document does not assert that private reporting is enabled.

If no private reporting option is available, open a minimal issue asking the maintainer to arrange a private reporting channel, without describing the vulnerability or attaching sensitive evidence. Wait for a confirmed private channel before sending details. No private email address or response-time guarantee is currently published.

Include the affected release tag or source commit, environment, impact, and a minimal sanitized reproduction through that private channel. Distinguish observations from hypotheses. Keep unredacted evidence locally until the maintainer agrees on handling it. Never share active tokens.

## Scope and expectations

Reports may concern the research/HTML input boundary, offline rendering, installer paths and integrity, or narration/data handling. Authored Node modules intentionally run with local process permissions after approval: `--allow-code`, timeouts, and browser isolation are not an OS sandbox. Use an isolated environment for untrusted authored code.

Report the exact version; there is no promised long-term support window or security SLA. Existing licenses and automated checks are not claims that a full security audit has been completed. For ordinary installation or documentation issues without sensitive content, use the normal [issue tracker](https://github.com/sawyer0x110/aha/issues).
