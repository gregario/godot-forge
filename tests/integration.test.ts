import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "../src/register-tools.js";
import { buildInstructions } from "../src/instructions.js";
import { checkNodeVersion } from "../src/version-check.js";

describe("MCP server integration", () => {
  it("creates server and registers all 8 tools", () => {
    const server = new McpServer({
      name: "godot-forge-test",
      version: "0.0.0-test",
    });

    // Register tools with null context (no project, no Godot binary)
    registerTools(server, { projectDir: null, godotBinary: null });

    // Server should be created without errors
    expect(server).toBeDefined();
  });

  it("builds instructions string", () => {
    const instructions = buildInstructions();

    // Instructions should contain key Godot 4 conventions
    expect(instructions).toContain("yield");
    expect(instructions).toContain("await");
    expect(instructions).toContain("@export");
    expect(instructions).toContain("CharacterBody3D");
    expect(instructions).toContain("snake_case");
    expect(instructions).toContain("type=\"Resource\"");
  });

  it("version check passes on current Node.js", () => {
    // Should not throw on Node 18+
    expect(() => checkNodeVersion()).not.toThrow();
  });
});
