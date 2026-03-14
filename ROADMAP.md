# Roadmap

## Shipped (v0.1)

8 tools, all working:

- [x] Test runner (GUT/GdUnit4)
- [x] API docs search with Godot 3→4 migration mapping
- [x] Script analysis (10 pitfall detectors)
- [x] Scene/resource analysis with antipattern detection
- [x] LSP diagnostics bridge
- [x] Project runner with debug output capture
- [x] Viewport screenshot capture
- [x] Project info with progressive disclosure

## Next Up (v0.2)

These are the gaps between us and what other Godot MCP servers provide. We're working through them now — items get ticked off as they ship.

### Scene & Node Operations

Every major competitor has scene manipulation. We've focused on analysis so far; now it's time to build.

- [ ] Create scenes with typed root nodes
- [ ] Add, remove, and edit nodes (properties, transforms, scripts)
- [ ] Save scenes (.tscn)
- [ ] Query scene tree structure from the editor

### Project Management

- [ ] Read/write project settings (project.godot)
- [ ] Manage autoloads (list/add/remove)
- [ ] Input map configuration

### Signal & Script Operations

- [ ] List, connect, and disconnect signals on nodes
- [ ] Attach and detach scripts to nodes

## Vision

These are areas we could grow into. Nothing here is promised — they're directions that make sense based on what the community needs and what competitors are doing. Each links to a discussion thread where you can weigh in or flag interest.

### Runtime & Debugging

Control and inspect a running game from your AI assistant.

- Input simulation — inject keyboard, mouse, and gamepad events
- Runtime scene tree inspection — live node properties, groups, signals
- DAP debugger integration — breakpoints, stepping, stack traces
- Performance profiling — frame timing, draw calls, physics step duration

[Discuss →](https://github.com/gregario/godot-forge/discussions)

### Content Authoring

Tools for building game content without switching to the editor.

- Animation tools — create and edit AnimationPlayer tracks
- TileMap operations — create and edit tilemaps and tilesets
- Shader validation — catch mistakes in Godot's shader dialect before running
- Physics, audio, and navigation configuration

[Discuss →](https://github.com/gregario/godot-forge/discussions)

### Assets & Resources

Bring assets into your project without leaving the conversation.

- CC0 asset library integration (Poly Haven, Kenney, AmbientCG)
- SVG-to-sprite conversion
- Resource creation and management

[Discuss →](https://github.com/gregario/godot-forge/discussions)

### Developer Experience

Quality-of-life improvements for day-to-day Godot development.

- Bundled API docs — full Godot 4.x class reference shipped with the package
- Companion prompts — GDScript idioms, scene architecture patterns, testing patterns
- Export/CI pipeline — headless builds and GitHub Actions integration
- Project visualisation — dependency and scene graphs

[Discuss →](https://github.com/gregario/godot-forge/discussions)

### Localisation & Accessibility

Make the tools work for more people.

- Multi-language tool descriptions
- Token-optimised composite tools for AI clients with smaller context windows

[Discuss →](https://github.com/gregario/godot-forge/discussions)

### Automated Playtest Runner

Run your game headlessly with scripted inputs and collect structured results. The MCP handles orchestration — launch, inject scenarios, capture output. The simulation logic lives in your game code. Useful for regression testing, progression curve validation, and economy balancing.

[Discuss →](https://github.com/gregario/godot-forge/discussions)

## Non-Goals

Some things we've decided not to build:

- **C# support** — GDScript focus. C# has strong native IDE support via VS Code and Rider.
- **Undo/rollback** — MCP servers shouldn't manage editor state. Use git.
- **Editor plugins** — We're a standalone MCP server, not a Godot addon. Some features may need a lightweight bridge script, but we're not building an editor plugin.

## Want to Help?

Contributions are welcome — bug reports, PRs, testing on your setup, or just telling us what's broken. If you're interested in co-maintaining a functional area (scene/node tools, runtime integration, or something else), just get in touch.

- [Contributing guide](CONTRIBUTING.md)
- [Start a discussion](https://github.com/gregario/godot-forge/discussions)
- [Open an issue](https://github.com/gregario/godot-forge/issues)
