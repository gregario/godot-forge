# Godot Binary Detection

Godot Forge automatically finds your Godot 4.x binary. Here's the full search order.

## Search Order

### 1. Environment Variable

```bash
export GODOT_PATH="/path/to/godot"
```

Always checked first. Use this if auto-detection doesn't find your installation.

### 2. PATH Lookup

Searches for `godot` and `godot4` in your system PATH.

### 3. Platform-Specific Paths

#### macOS

| Source | Path |
|--------|------|
| **Steam** | `~/Library/Application Support/Steam/steamapps/common/Godot Engine/Godot.app/Contents/MacOS/Godot` |
| **Homebrew** | `/Applications/Godot.app/Contents/MacOS/Godot` |
| **Direct download** | `/Applications/Godot.app/Contents/MacOS/Godot` |
| **Home Applications** | `~/Applications/Godot.app/Contents/MacOS/Godot` |
| **Versioned** | `/Applications/Godot_v4.app/Contents/MacOS/Godot` (and similar patterns) |

Also scans `/Applications/` and `~/Applications/` for any `Godot*.app` bundle.

#### Windows

| Source | Path |
|--------|------|
| **Steam** | `C:\Program Files (x86)\Steam\steamapps\common\Godot Engine\Godot.exe` |
| **Steam (alt)** | `D:\Steam\steamapps\common\Godot Engine\Godot.exe` |
| **Direct download** | `C:\Program Files\Godot\Godot.exe` |
| **Scoop** | `%USERPROFILE%\scoop\apps\godot\current\godot.exe` |
| **Chocolatey** | `C:\ProgramData\chocolatey\lib\godot\tools\Godot.exe` |
| **Winget** | `%LOCALAPPDATA%\Programs\GodotEngine\Godot\Godot.exe` |

Also scans common directories for versioned executables (`Godot_v4.*.exe`).

#### Linux

| Source | Path |
|--------|------|
| **Steam** | `~/.local/share/Steam/steamapps/common/Godot Engine/Godot*` |
| **Steam (alt)** | `~/.steam/steam/steamapps/common/Godot Engine/Godot*` |
| **System** | `/usr/bin/godot`, `/usr/bin/godot4` |
| **Local** | `/usr/local/bin/godot`, `~/.local/bin/godot` |
| **Flatpak** | `/var/lib/flatpak/exports/bin/org.godotengine.Godot` |
| **Flatpak (user)** | `~/.local/share/flatpak/exports/bin/org.godotengine.Godot` |
| **Snap** | `/snap/bin/godot`, `/snap/bin/godot-4` |

## Not Found?

If Godot Forge can't find your binary:

1. **Set `GODOT_PATH`** — the simplest fix:
   ```bash
   export GODOT_PATH="/your/godot/path"
   ```

2. **Add to your MCP config** — per-IDE override:
   ```json
   {
     "mcpServers": {
       "godot-forge": {
         "command": "npx",
         "args": ["-y", "@gregario/godot-forge"],
         "env": {
           "GODOT_PATH": "/your/godot/path"
         }
       }
     }
   }
   ```

3. **Open an issue** — if you're using a standard installation that should be auto-detected, please [report it](https://github.com/gregario/godot-forge/issues/new) so we can add support.
