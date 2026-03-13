# Contributing to Godot Forge

Thanks for your interest in contributing! Godot Forge is a young project and we'd love your help making it the best MCP server for Godot development.

## Ways to Contribute

- **Report bugs** — Found something broken? [Open an issue](https://github.com/gregario/godot-forge/issues/new).
- **Suggest features** — Got an idea? [Start a discussion](https://github.com/gregario/godot-forge/discussions).
- **Fix bugs** — Check [open issues](https://github.com/gregario/godot-forge/issues) for things to work on.
- **Add tests** — More coverage is always welcome.
- **Improve docs** — Typos, clarifications, examples — all helpful.
- **Test on your setup** — Try it with your Godot project and report what works/breaks.

## Development Setup

```bash
git clone https://github.com/gregario/godot-forge.git
cd godot-forge
npm install
npm run build
npm test
```

### Project Structure

```
src/
  index.ts              # Entry point, MCP server setup
  register-tools.ts     # Tool registration
  godot-binary.ts       # Auto-detection of Godot binary
  project.ts            # Project directory resolution
  path-sandbox.ts       # Path traversal prevention
  spawn-godot.ts        # Safe process spawning
  errors.ts             # Structured error formatting
  instructions.ts       # MCP instructions (Godot 4 conventions)
  project-config.ts     # project.godot parser
  ansi.ts               # ANSI escape code stripping
  version-check.ts      # Node.js version check
  tools/
    test-runner.ts      # GUT/GdUnit4 test execution
    docs-search.ts      # API docs + migration mapping
    script-analysis.ts  # 10 pitfall detectors
    scene-analysis.ts   # .tscn/.tres parsing
    lsp-diagnostics.ts  # Godot LSP bridge
    project-runner.ts   # Launch/stop/output capture
    screenshot.ts       # Viewport screenshot
    project-info.ts     # Project structure overview
tests/                  # vitest test files (one per module)
scripts/
  build-docs.ts         # Godot API doc extraction script
docs/                   # Documentation
```

### Running Tests

```bash
npm test              # Run all 74 tests
npm run test:watch    # Watch mode
```

Tests don't require Godot installed — they test parsing logic, regex patterns, and output format handling using sample data.

### Building

```bash
npm run build         # Compile TypeScript to dist/
npm run dev           # Watch mode
npm run lint          # Type check without emitting
```

### Testing with a Real Godot Project

```bash
# Build and point your IDE at the local version
npm run build
claude mcp add godot-forge-dev -- node /absolute/path/to/godot-forge/dist/index.js --project /path/to/your/godot/project
```

## Pull Request Guidelines

1. **Fork and branch** — Create a feature branch from `main`.
2. **Keep it focused** — One feature or fix per PR.
3. **Add tests** — If you're adding or changing functionality, add tests.
4. **Run the suite** — `npm run build && npm test` must pass.
5. **Write a clear description** — What does this change and why?

### Code Style

- TypeScript with strict mode
- No unnecessary abstractions — simple is better
- `spawn()` for process execution, never `exec()`
- Structured errors with `message` + `suggestion`
- Flat tool arguments (top-level primitives, no nested objects)

## Adding a New Tool

1. Create `src/tools/your-tool.ts` with a `registerYourTool(server, ctx)` function
2. Register it in `src/register-tools.ts`
3. Add tests in `tests/your-tool.test.ts`
4. Update the tool count in `README.md` and `tests/integration.test.ts`
5. Follow MCP best practices: outcome-oriented, actionable errors, appropriate annotations

## Adding a New Godot Binary Detection Path

If Godot installs somewhere we don't check:

1. Edit `src/godot-binary.ts`
2. Add the path to the appropriate platform function (`findGodotMacOS`, `findGodotWindows`, `findGodotLinux`)
3. Include a comment noting the install method (Steam, Homebrew, Scoop, etc.)

## Reporting Issues

When reporting a bug, please include:

- Your OS and version
- Node.js version (`node --version`)
- Godot version and how it's installed (Steam, direct download, etc.)
- Your IDE and MCP client
- Steps to reproduce
- Error output (if any)

## Licence

By contributing, you agree that your contributions will be licensed under the MIT licence.
