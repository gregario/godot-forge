---
type: product
status: evaluating
---

# Godot Forge

The definitive AI development companion for Godot 4. An MCP server with test running, API docs, script analysis, and more — built from battle-tested patterns shipping a real game (1220+ tests).

## Why This Exists

AI coding assistants are structurally bad at GDScript. Models trained on data skewed towards Godot 3 consistently hallucinate deprecated APIs (`yield` instead of `await`, `KinematicBody` instead of `CharacterBody3D`). 20+ Godot MCP servers exist but none integrate test running, prevent API version confusion, or follow MCP best practices.

Godot Forge fixes this with outcome-oriented tools, a comprehensive Godot 3→4 migration mapping, and all 10 battle-tested GDScript pitfall detectors.

## Quick Start

### Claude Code
```bash
claude mcp add godot-forge -- npx -y @gregario/godot-forge
```

### Cursor
Add to `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "godot-forge": {
      "command": "npx",
      "args": ["-y", "@gregario/godot-forge"]
    }
  }
}
```

### VS Code (Copilot)
Add to `.vscode/mcp.json`:
```json
{
  "servers": {
    "godot-forge": {
      "command": "npx",
      "args": ["-y", "@gregario/godot-forge"]
    }
  }
}
```

### Windsurf
Add to `~/.codeium/windsurf/mcp_config.json`:
```json
{
  "mcpServers": {
    "godot-forge": {
      "command": "npx",
      "args": ["-y", "@gregario/godot-forge"]
    }
  }
}
```

### Zed
Add to `settings.json`:
```json
{
  "context_servers": {
    "godot-forge": {
      "command": {
        "path": "npx",
        "args": ["-y", "@gregario/godot-forge"]
      }
    }
  }
}
```

<details>
<summary><strong>More IDEs (Claude Desktop, Codex, Gemini CLI, JetBrains, Continue, Cline, Roo Code, Neovim, OpenCode, Kiro)</strong></summary>

### Claude Desktop
Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%/Claude/claude_desktop_config.json` (Windows):
```json
{
  "mcpServers": {
    "godot-forge": {
      "command": "npx",
      "args": ["-y", "@gregario/godot-forge"]
    }
  }
}
```

### Codex
Add to `.codex/config.toml`:
```toml
[mcp_servers.godot-forge]
command = "npx"
args = ["-y", "@gregario/godot-forge"]
```

### Gemini CLI
Add to `.gemini/settings.json`:
```json
{
  "mcpServers": {
    "godot-forge": {
      "command": "npx",
      "args": ["-y", "@gregario/godot-forge"]
    }
  }
}
```

### JetBrains (IntelliJ, WebStorm, etc.)
Settings > Tools > AI Assistant > MCP Servers > Add:
```json
{
  "mcpServers": {
    "godot-forge": {
      "command": "npx",
      "args": ["-y", "@gregario/godot-forge"]
    }
  }
}
```

### Continue
Add to `.continue/config.yaml`:
```yaml
mcpServers:
  - name: godot-forge
    command: npx
    args: ["-y", "@gregario/godot-forge"]
```

### Cline
Add to `cline_mcp_settings.json`:
```json
{
  "mcpServers": {
    "godot-forge": {
      "command": "npx",
      "args": ["-y", "@gregario/godot-forge"]
    }
  }
}
```

### Roo Code
Add to `.roo/mcp.json`:
```json
{
  "mcpServers": {
    "godot-forge": {
      "command": "npx",
      "args": ["-y", "@gregario/godot-forge"]
    }
  }
}
```

### Neovim (mcphub)
Add to `~/.config/mcphub/servers.json`:
```json
{
  "mcpServers": {
    "godot-forge": {
      "command": "npx",
      "args": ["-y", "@gregario/godot-forge"]
    }
  }
}
```

### OpenCode
Add to `opencode.json`:
```json
{
  "mcp": {
    "godot-forge": {
      "command": "npx",
      "args": ["-y", "@gregario/godot-forge"]
    }
  }
}
```

### Kiro
Add to `.kiro/settings/mcp.json`:
```json
{
  "mcpServers": {
    "godot-forge": {
      "command": "npx",
      "args": ["-y", "@gregario/godot-forge"]
    }
  }
}
```

</details>

## Configuration

### Godot Binary
Auto-detected from `PATH`, platform defaults, or set explicitly:
```bash
export GODOT_PATH=/path/to/godot
```

### Project Directory
Auto-detected by walking up from the current directory to find `project.godot`, or set explicitly:
```bash
npx @gregario/godot-forge --project /path/to/godot/project
```

## Tools

| Tool | What It Does | Annotations |
|------|-------------|-------------|
| `godot_run_tests` | Run GUT/GdUnit4 tests headlessly, return structured JSON results | read/write |
| `godot_search_docs` | Search Godot 4.x API docs with Godot 3->4 migration mapping | read-only |
| `godot_get_diagnostics` | Get LSP diagnostics from Godot's built-in language server | read-only |
| `godot_analyze_scene` | Parse .tscn/.tres files, detect antipatterns and format errors | read-only |
| `godot_analyze_script` | Detect all 10 GDScript pitfalls (3->4 API, re-entrancy, coupling, etc.) | read-only |
| `godot_run_project` | Launch/stop Godot project, capture debug output | read/write |
| `godot_screenshot` | Capture viewport screenshot as base64 PNG | read-only |
| `godot_get_project_info` | Return project structure with progressive disclosure | read-only |

### Script Analysis: The 10 Pitfalls

Godot Forge detects all 10 battle-tested GDScript pitfalls from shipping a real game:

1. **Godot 3->4 API misuse** — `yield`, `connect("signal")`, `export var`, `instance()`, etc.
2. **Giant scripts** — Over 300 lines (should be split)
3. **`:=` on Variant** — Type inference on `Dictionary.get()` causes parse errors
4. **Tight coupling** — Excessive `get_node("../../...")` references
5. **Signal re-entrancy** — Signal emitted between state changes (synchronous execution trap)
6. **Autoload misuse** — Too many autoloads, `static func` on autoloads
7. **Missing signal disconnect** — No `_exit_tree()` cleanup for persistent connections
8. **`_init()` timing** — Node tree access before the node is in the tree
9. **Python-isms** — List comprehensions, `len()`, Python imports in GDScript
10. **Custom class in .tres type** — Must use `type="Resource"`, not custom class names

### Docs Search: Godot 3->4 Migration

The headline differentiator. When your AI queries a deprecated Godot 3 API, it gets the correct Godot 4 equivalent immediately:

```
Query: "KinematicBody"
-> Godot 3 API: KinematicBody was renamed to CharacterBody3D in Godot 4

Query: "yield"
-> Godot 3 API: yield(obj, 'signal') -> await obj.signal
```

Covers classes, methods, functions, syntax patterns, and constants.

## Comparison vs Existing Servers

| Feature | Godot Forge | Coding-Solo (2.3k stars) | satelliteoflove (53 stars) |
|---------|------------|---------------------|----------------------|
| Test runner (GUT/GdUnit4) | Yes | No (PR stuck 6mo) | No |
| Godot 3->4 migration mapping | Yes | No | No |
| Script pitfall analysis (10 checks) | Yes | No | No |
| Scene antipattern detection | Yes | No | No |
| .tres format validation | Yes | No | No |
| API docs search | Yes | No | No |
| Screenshot capture | Yes | No (4 competing PRs) | Yes |
| LSP diagnostics | Yes | No | No |
| npm zero-install | Yes | No (issue #61) | Yes |
| spawn() (no command injection) | Yes | No (exec) | Yes |
| Cross-IDE setup guides (15 tools) | Yes | Partial | Partial |
| MCP tool annotations | Yes | No | No |

## Design Principles

From Anthropic's MCP best practices:

- **Outcomes, not operations** — Each tool delivers a complete result
- **8 tools** — No 93-tool context bloat
- **Progressive disclosure** — Summaries first, details on demand
- **spawn() not exec()** — No command injection, no Windows quoting bugs
- **Flat arguments** — Top-level primitives, no nested dicts
- **Actionable errors** — Every error includes a suggestion the AI can act on

## Explicit Non-Goals

- **C# support** — Our expertise is GDScript. C# has better native IDE support (VS Code, Rider).
- **Undo/rollback** — MCP servers shouldn't manage editor state. Use git.
- **DAP debugger** — Breakpoint debugging is editor-dependent. Phase 2 consideration.
- **Editor plugin** — Phase 2. All MVP tools work via CLI/LSP without any Godot addon.

## Requirements

- Node.js 18+
- Godot 4.x (auto-detected or set via `GODOT_PATH`)

## Licence

MIT
