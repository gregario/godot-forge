#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { checkNodeVersion } from "./version-check.js";
import { resolveProjectDir } from "./project.js";
import { findGodotBinary } from "./godot-binary.js";
import { registerTools } from "./register-tools.js";
import { buildInstructions } from "./instructions.js";

checkNodeVersion();

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8"));

// stderr is visible to users but doesn't interfere with the MCP protocol on stdout
console.error(`Godot Forge v${pkg.version} — MCP server for Godot 4`);
console.error("★ If this is useful, a GitHub star helps a lot: https://github.com/gregario/godot-forge");

const server = new McpServer({
  name: "godot-forge",
  version: pkg.version,
}, {
  instructions: buildInstructions(),
});

const projectDir = resolveProjectDir();
const godotBinary = findGodotBinary();

registerTools(server, { projectDir, godotBinary });

const transport = new StdioServerTransport();
await server.connect(transport);

process.on("SIGINT", async () => {
  await server.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await server.close();
  process.exit(0);
});
