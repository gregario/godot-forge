<p align="center">
  <h1 align="center">Godot Forge</h1>
  <p align="center">The MCP server for Godot 4. Test runner, API docs, script analysis, and more.</p>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/godot-forge"><img src="https://img.shields.io/npm/v/godot-forge.svg" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/godot-forge"><img src="https://img.shields.io/npm/dm/godot-forge.svg" alt="npm downloads"></a>
  <a href="https://github.com/gregario/godot-forge/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg" alt="Node.js 18+"></a>
  <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/MCP-compatible-purple.svg" alt="MCP Compatible"></a>
  <a href="https://glama.ai/mcp/servers/gregario/godot-forge"><img src="https://glama.ai/mcp/servers/gregario/godot-forge/badges/score.svg" alt="godot-forge MCP server"></a>
</p>

---

AI coding assistants are structurally bad at GDScript. Models trained on data skewed towards Godot 3 hallucinate deprecated APIs (`yield` instead of `await`, `KinematicBody` instead of `CharacterBody3D`, `export var` instead of `@export var`). Godot Forge fixes this.

**8 tools. Zero config. Works with every MCP-compatible IDE.**

<a href="https://glama.ai/mcp/servers/gregario/godot-forge">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/gregario/godot-forge/badge" alt="godot-forge MCP server" />
</a>

## Install

```bash
npx -y godot-forge
```

That's it. Godot Forge auto-detects your Godot binary (Steam, Homebrew, direct download) and finds your `project.godot` automatically.

### Add to your IDE

<details open>
<summary><strong>Claude Code</strong></summary>

```bash
claude mcp add godot-forge -- npx -y godot-forge
```
</details>

<details>
<summary><strong>Cursor</strong></summary>

Add to `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "godot-forge": {
      "command": "npx",
      "args": ["-y", "godot-forge"]
    }
  }
}
```
</details>

<details>
<summary><strong>VS Code (Copilot)</strong></summary>

Add to `.vscode/mcp.json`:
```json
{
  "servers": {
    "godot-forge": {
      "command": "npx",
      "args": ["-y", "godot-forge"]
    }
  }
}
```
</details>

<details>
<summary><strong>Windsurf</strong></summary>

Add to `~/.codeium/windsurf/mcp_config.json`:
```json
{
  "mcpServers": {
    "godot-forge": {
      "command": "npx",
      "args": ["-y", "godot-forge"]
    }
  }
}
```
</details>

<details>
<summary><strong>Zed</strong></summary>

Add to `settings.json`:
```json
{
  "context_servers": {
    "godot-forge": {
      "command": {
        "path": "npx",
        "args": ["-y", "godot-forge"]
      }
    }
  }
}
```
</details>

<details>
<summary><strong>Claude Desktop</strong></summary>

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%/Claude/claude_desktop_config.json` (Windows):
```json
{
  "mcpServers": {
    "godot-forge": {
      "command": "npx",
      "args": ["-y", "godot-forge"]
    }
  }
}
```
</details>

<details>
<summary><strong>More IDEs (Codex, Gemini CLI, JetBrains, Continue, Cline, Roo Code, Neovim, OpenCode, Kiro)</strong></summary>

See [IDE Setup Guide](docs/ide-setup.md) for configuration snippets for all supported IDEs.
</details>

## Tools

| Tool | Description | Needs Godot | Needs Editor |
|------|-------------|:-----------:|:------------:|
| `godot_run_tests` | Run GUT/GdUnit4 tests, get structured pass/fail results | Yes | No |
| `godot_search_docs` | Search Godot 4 API docs with 3→4 migration mapping | No | No |
| `godot_analyze_script` | Detect 10 GDScript pitfalls (deprecated API, coupling, re-entrancy) | No | No |
| `godot_analyze_scene` | Parse .tscn/.tres, detect antipatterns and format errors | No | No |
| `godot_get_project_info` | Project structure overview with progressive disclosure | No | No |
| `godot_get_diagnostics` | LSP diagnostics from Godot's language server | No | Yes |
| `godot_run_project` | Launch/stop project, capture debug output | Yes | No |
| `godot_screenshot` | Capture viewport screenshot as base64 PNG | Yes | No |

> [!TIP]
> 6 of 8 tools work without Godot installed. Only test running, project launching, and screenshots need the binary.

## Features

### Test Runner

Auto-detects GUT and GdUnit4. Returns structured JSON with pass/fail counts, failure details with file paths and line numbers. Supports filtering by script, method, or inner class.

```
Ask your AI: "Run the water profile tests"
→ { total: 5, passed: 5, failed: 0, duration_ms: 462 }
```

### Godot 3→4 Migration Mapping

The #1 reason AI writes broken GDScript. When your AI queries a deprecated API, it gets the correct Godot 4 equivalent instantly (30+ mappings covering classes, methods, syntax, and constants).

```
Query: "KinematicBody"  →  "Renamed to CharacterBody3D in Godot 4"
Query: "yield"          →  "yield(obj, 'signal') → await obj.signal"
Query: "instance()"     →  "instance() → instantiate()"
```

### Script Analysis: 10 Pitfalls

Every pitfall detected from real game development:

| # | Pitfall | What It Catches |
|---|---------|-----------------|
| 1 | Godot 3→4 API | `yield`, `connect("signal")`, `export var`, `instance()` |
| 2 | Giant scripts | Over 300 lines. Should be split |
| 3 | `:=` on Variant | Type inference on `Dictionary.get()` causes parse errors |
| 4 | Tight coupling | Excessive `get_node("../../...")` references |
| 5 | Signal re-entrancy | Signal emitted between state changes |
| 6 | Autoload misuse | Too many autoloads, `static func` on autoloads |
| 7 | Missing disconnect | `connect()` without `_exit_tree()` cleanup |
| 8 | `_init()` timing | Node tree access before node is in tree |
| 9 | Python-isms | List comprehensions, `len()`, Python imports |
| 10 | .tres type field | Custom class name instead of `type="Resource"` |

### Scene Analysis

Parses `.tscn` and `.tres` files. Detects deep nesting (>8 levels), oversized scenes (>100 nodes), missing script references, `preload()` in `.tres`, integer resource IDs, and more.

### LSP Diagnostics

Connects to Godot's built-in language server (runs automatically when the editor is open). Returns real compiler errors and warnings (no guesswork).

> [!NOTE]
> Requires the Godot editor to be running with your project open. All other tools work without the editor.

### Screenshot Capture

Captures the game viewport as a PNG image. Loads the project's main scene (or a specified scene), waits for rendering, and returns the screenshot as base64 for the AI to see.

## Hosted deployment

A hosted deployment is available on [Fronteir AI](https://fronteir.ai/mcp/gregario-godot-forge).

## Configuration

### Godot Binary

Auto-detected in this order:

1. `GODOT_PATH` environment variable
2. `godot` / `godot4` in PATH
3. Steam installation (macOS, Windows, Linux)
4. Platform defaults (`/Applications/Godot.app`, Homebrew, Scoop, Flatpak, Snap, etc.)

Override manually:
```bash
export GODOT_PATH="/path/to/godot"
```

See [Godot Detection](docs/godot-detection.md) for the full list of searched paths.

### Project Directory

Auto-detected by walking up from the current directory to find `project.godot`. Override:
```bash
npx godot-forge --project /path/to/godot/project
```

## Requirements

- **Node.js 18+**: for `npx` execution
- **Godot 4.x**: auto-detected (optional for 6 of 8 tools)
- **Any MCP-compatible IDE**: Claude Code, Cursor, VS Code, Windsurf, Zed, and [more](docs/ide-setup.md)

## Design Principles

- **Outcomes, not operations**: Each tool delivers a complete result, not raw API wrapping
- **8 curated tools**: No 93-tool context bloat ([why this matters](https://modelcontextprotocol.io/docs/concepts/tools#best-practices))
- **Progressive disclosure**: Summaries first, details on demand
- **`spawn()` not `exec()`**: No command injection, no Windows quoting bugs
- **Actionable errors**: Every error includes a suggestion the AI can act on
- **Cross-platform**: macOS, Windows, Linux. Steam and non-Steam installs.

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

- **Bug reports**: [Open an issue](https://github.com/gregario/godot-forge/issues/new)
- **Feature requests**: [Start a discussion](https://github.com/gregario/godot-forge/discussions)
- **Pull requests**: Fork, branch, test, PR

### Development

```bash
git clone https://github.com/gregario/godot-forge.git
cd godot-forge
npm install
npm run build
npm test        # 74 tests across 12 test files
```

### Running locally

```bash
# Point your IDE at the local build
claude mcp add godot-forge-dev -- node /path/to/godot-forge/dist/index.js
```

## Roadmap

See [ROADMAP.md](ROADMAP.md) for planned features.

**Phase 2**: Input simulation, runtime scene tree inspection, performance profiling, shader validation, export/CI pipeline.

## Licence

[MIT](LICENSE)