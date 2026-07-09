---
name: no-listing-tool-workaround
description: This agent's tool set sometimes has no Bash/Glob/Grep — how to still do a full codebase sweep by reading files directly
metadata:
  type: feedback
---

In at least one full-audit session (2026-07-09) the available tools were only Read, TaskStop, WebFetch, WebSearch, Write, Edit — no shell/Grep/Glob. `Read` on a directory path returns `EISDIR` and cannot list contents.

**Why:** The audit still had to cover the "entire codebase" per the user's request without a directory listing capability.

**How to apply:** When no listing tool is available, reconstruct the file tree by reading `CLAUDE.md` and `context/project-overview.md` (documented `Project Structure` section) plus `context/current-feature.md`'s History log (each shipped feature entry names real file paths it touched/added), then `Read` each candidate path directly — treat "File does not exist" errors as informative (confirms a feature/route genuinely isn't built yet, per [[devstash-implementation-status]]) rather than a tool failure to work around. Cross-check `package.json` dependencies to confirm whether a subsystem (auth, R2, OpenAI) has even been wired up before guessing at its file paths.
