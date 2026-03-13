#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { checkNodeVersion } from "./version-check.js";
import { resolveProjectDir } from "./project.js";
import { findGodotBinary } from "./godot-binary.js";
import { registerTools } from "./register-tools.js";
import { buildInstructions } from "./instructions.js";

checkNodeVersion();

const server = new McpServer({
  name: "godot-forge",
  version: "0.1.0",
}, {
  instructions: buildInstructions(),
});

const projectDir = resolveProjectDir();
const godotBinary = findGodotBinary();

registerTools(server, { projectDir, godotBinary });

const transport = new StdioServerTransport();
await server.connect(transport);
