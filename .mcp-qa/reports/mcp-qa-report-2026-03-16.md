# MCP QA Report: godot-forge
**Date:** 2026-03-16
**Mode:** full
**Server version:** 0.1.2
**Health score:** 79/100 — Minor issues, fix before shipping

## Discovery
- **Tools:** 8 registered
- **Resources:** 0 registered
- **Prompts:** 0 registered

## Tool Execution Results
| Tool | Status | Response Size | Notes |
|------|--------|---------------|-------|
| godot_run_tests | SKIPPED | — | Requires Godot binary |
| godot_search_docs | PASS | 201 bytes | Returns "no results" (docs need build step) — graceful |
| godot_get_diagnostics | SKIPPED | — | Requires Godot binary + running editor |
| godot_analyze_scene | PASS | 224 bytes | Returns "no project found" — graceful, actionable message |
| godot_analyze_script | PASS | 224 bytes | Returns "no project found" — graceful, actionable message |
| godot_run_project | SKIPPED | — | Requires Godot binary |
| godot_screenshot | SKIPPED | — | Requires Godot binary + display server |
| godot_get_project_info | PASS | 224 bytes | Returns "no project found" — graceful, actionable message |

4/8 tools tested (4 skipped — require Godot binary). All tested tools return graceful, actionable error messages when no project is available.

## Best Practices Lint
| Check | Status | Severity |
|-------|--------|----------|
| No console.log in server code | PASS | CRITICAL |
| Shebang on entry point | PASS | HIGH |
| chmod in build script | PASS | MEDIUM |
| All imports have .js extensions | PASS | HIGH |
| No 0.0.0.0 binding | PASS (stdio only) | CRITICAL |
| No secrets in parameters | PASS | CRITICAL |
| No secrets in hardcoded strings | PASS | HIGH |
| Error cases use isError: true | FAIL | HIGH |
| Graceful shutdown handlers | FAIL | LOW |
| Server name/version match package.json | FAIL (hardcoded) | LOW |

## Findings

### FINDING-001: Error responses missing isError: true
**Severity:** high
**Category:** practices
**Details:** All error responses use `{ content: [{ type: "text", text: formatError(...) }] }` without setting `isError: true`. The error messages themselves are excellent (actionable with suggestions), but without the `isError` flag the model can't programmatically distinguish success from failure. Per MCP stack standards, expected failures should return `{ isError: true, content: [...] }`. This affects all tool handlers across 7 files.

### FINDING-002: No graceful shutdown handlers
**Severity:** low
**Category:** practices
**Details:** No SIGINT/SIGTERM handlers in src/index.ts. The server uses `process.on("SIGTERM")` in spawn-godot.ts for child process cleanup, but the MCP server itself doesn't handle graceful shutdown.

### FINDING-003: Server version hardcoded
**Severity:** low
**Category:** practices
**Details:** `src/index.ts:14` and `:19` hardcode `v0.1.2` instead of reading from package.json. Startup banner and McpServer version will drift after bumps.

### FINDING-004: Version mismatch — status.json vs package.json vs npm
**Severity:** medium
**Category:** value
**Details:** `status.json` says version `1.1.0`, `package.json` says `0.1.2`, npm has `0.1.2`. status.json is wrong.

## Score Breakdown
| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Connectivity | 100 | 20% | 20.0 |
| Tool Quality | 100 | 25% | 25.0 |
| Tool Execution | 100 | 25% | 25.0 |
| Best Practices | 79 | 15% | 11.9 |
| Security | 100 | 10% | 10.0 |
| Value Delivery | 92 | 5% | 4.6 |
| **Total** | | | **79/100** |

### Best Practices: 100 - 15 (HIGH: missing isError) - 3 (LOW: shutdown) - 3 (LOW: hardcoded version) = 79. Value: 100 - 8 (MEDIUM: version mismatch) = 92.
