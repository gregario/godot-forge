# Roadmap

## Current (v0.1)

8 tools shipping:

- [x] Test runner (GUT/GdUnit4)
- [x] API docs search with Godot 3→4 migration mapping
- [x] Script analysis (10 pitfall detectors)
- [x] Scene/resource analysis with antipattern detection
- [x] LSP diagnostics bridge
- [x] Project runner with debug output capture
- [x] Viewport screenshot capture
- [x] Project info with progressive disclosure

## Phase 2 (Planned)

These are features we're considering. Feedback and contributions welcome — [start a discussion](https://github.com/gregario/godot-forge/discussions) if any of these would be valuable for your workflow.

### Input Simulation
Inject keyboard, mouse, and gamepad input into a running Godot project. Useful for automated UI testing and gameplay verification.

### Runtime Scene Tree Inspection
Query the live scene tree of a running game — node properties, signals, groups. Requires either an editor plugin or a lightweight GDScript addon.

### Performance Profiling
Capture frame timing, draw calls, and physics step duration. Integrate with Godot's built-in profiler output.

### Shader Validation
Validate Godot's shader dialect (not standard GLSL). Catch common mistakes before running the project.

### Export / CI Pipeline
Headless export templates, build validation, and GitHub Actions integration for automated builds.

### Economy / Balance Simulation
Run the game headlessly with scripted inputs to test game balance — prices, progression curves, difficulty scaling.

### Bundled API Docs
Full Godot 4.x class reference bundled with the npm package (extracted via `--doctool`). Currently the docs tool uses migration mapping and search; bundled docs would add complete class/method documentation.

### Companion Skills Package
GDScript idiom guide, scene architecture patterns, testing patterns — as MCP resources or prompts rather than tools.

## Non-Goals

Some things we've explicitly decided not to build:

- **C# support** — GDScript focus. C# has strong native IDE support via VS Code and Rider.
- **Undo/rollback** — MCP servers shouldn't manage editor state. Use git.
- **DAP debugger integration** — Breakpoint debugging is editor-dependent.
- **Scene CRUD operations** — We focus on analysis and diagnostics, not manipulation. Use the editor or GDScript for scene changes.

## Contributing

Want to work on something from Phase 2? Check [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines, or open an issue to discuss the approach before starting.
