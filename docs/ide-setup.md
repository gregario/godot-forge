# IDE Setup Guide

Godot Forge works with any IDE that supports the [Model Context Protocol](https://modelcontextprotocol.io). Below are configuration snippets for all supported IDEs.

## Prerequisites

- **Node.js 18+** — [Download](https://nodejs.org)
- **Godot 4.x** — Optional for 6 of 8 tools. [Download](https://godotengine.org/download) or install via Steam.

## Claude Code

```bash
claude mcp add godot-forge -- npx -y godot-forge
```

## Cursor

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

## VS Code (Copilot)

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

## Windsurf

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

## Zed

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

## Claude Desktop

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

## Codex

Add to `.codex/config.toml`:
```toml
[mcp_servers.godot-forge]
command = "npx"
args = ["-y", "godot-forge"]
```

## Gemini CLI

Add to `.gemini/settings.json`:
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

## JetBrains (IntelliJ, WebStorm, Rider, etc.)

Settings → Tools → AI Assistant → MCP Servers → Add:
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

## Continue

Add to `.continue/config.yaml`:
```yaml
mcpServers:
  - name: godot-forge
    command: npx
    args: ["-y", "godot-forge"]
```

## Cline

Add to `cline_mcp_settings.json`:
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

## Roo Code

Add to `.roo/mcp.json`:
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

## Neovim (mcphub)

Add to `~/.config/mcphub/servers.json`:
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

## OpenCode

Add to `opencode.json`:
```json
{
  "mcp": {
    "godot-forge": {
      "command": "npx",
      "args": ["-y", "godot-forge"]
    }
  }
}
```

## Kiro

Add to `.kiro/settings/mcp.json`:
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

## Custom Configuration

### Explicit Godot Path

If auto-detection doesn't find your Godot binary, set it explicitly:

```json
{
  "mcpServers": {
    "godot-forge": {
      "command": "npx",
      "args": ["-y", "godot-forge"],
      "env": {
        "GODOT_PATH": "/path/to/godot"
      }
    }
  }
}
```

### Explicit Project Directory

To point at a specific Godot project:

```json
{
  "mcpServers": {
    "godot-forge": {
      "command": "npx",
      "args": ["-y", "godot-forge", "--project", "/path/to/project"]
    }
  }
}
```
