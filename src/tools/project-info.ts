import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readdirSync, statSync } from "node:fs";
import { resolve, relative, extname } from "node:path";
import type { ServerContext } from "../register-tools.js";
import { formatError, projectNotFound } from "../errors.js";
import { parseProjectGodot } from "../project-config.js";

interface FileEntry {
  path: string;
  size: number;
}

function collectFiles(
  dir: string,
  base: string,
  extensions: Set<string>,
  maxDepth: number,
  currentDepth = 0
): FileEntry[] {
  if (currentDepth > maxDepth) return [];

  const entries: FileEntry[] = [];
  try {
    const items = readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = resolve(dir, item.name);
      if (item.isDirectory()) {
        // Skip .godot, .git, addons (unless specifically requested)
        if (item.name.startsWith(".") && item.name !== ".godot") continue;
        entries.push(...collectFiles(fullPath, base, extensions, maxDepth, currentDepth + 1));
      } else if (extensions.has(extname(item.name))) {
        const stat = statSync(fullPath);
        entries.push({
          path: "res://" + relative(base, fullPath),
          size: stat.size,
        });
      }
    }
  } catch {
    // Permission error or similar
  }
  return entries;
}

function getDirectoryTree(dir: string, base: string, maxDepth: number, currentDepth = 0): string[] {
  if (currentDepth > maxDepth) return [];

  const dirs: string[] = [];
  try {
    const items = readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      if (item.isDirectory() && !item.name.startsWith(".")) {
        const relPath = relative(base, resolve(dir, item.name));
        const indent = "  ".repeat(currentDepth);
        dirs.push(`${indent}${relPath}/`);
        dirs.push(...getDirectoryTree(resolve(dir, item.name), base, maxDepth, currentDepth + 1));
      }
    }
  } catch {
    // Permission error or similar
  }
  return dirs;
}

export function registerProjectInfo(server: McpServer, ctx: ServerContext): void {
  server.tool(
    "godot_get_project_info",
    "Return project structure overview: project name, Godot version, scenes, scripts, autoloads, addons, and directory tree. Uses progressive disclosure — summary by default, full details on request.",
    {
      detail: z
        .enum(["summary", "full"])
        .optional()
        .describe("Level of detail: 'summary' (default) for counts and top-level dirs, 'full' for complete file listings"),
    },
    { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    async (args) => {
      if (!ctx.projectDir) {
        return { content: [{ type: "text", text: formatError(projectNotFound()) }] };
      }

      const config = parseProjectGodot(ctx.projectDir);
      if (!config) {
        return {
          content: [
            {
              type: "text",
              text: formatError({
                message: "No project.godot found.",
                suggestion: "Ensure the MCP server is configured with the correct project path.",
              }),
            },
          ],
        };
      }

      const scenes = collectFiles(ctx.projectDir, ctx.projectDir, new Set([".tscn"]), 10);
      const scripts = collectFiles(ctx.projectDir, ctx.projectDir, new Set([".gd"]), 10);
      const resources = collectFiles(ctx.projectDir, ctx.projectDir, new Set([".tres"]), 10);

      // Check for addons
      const addons: string[] = [];
      try {
        const addonsDir = resolve(ctx.projectDir, "addons");
        const items = readdirSync(addonsDir, { withFileTypes: true });
        for (const item of items) {
          if (item.isDirectory()) addons.push(item.name);
        }
      } catch {
        // no addons directory
      }

      const detail = args.detail ?? "summary";

      if (detail === "summary") {
        let text = `## ${config.name}\n\n`;
        if (config.godotVersion) text += `**Godot version:** ${config.godotVersion}\n`;
        text += `**Scenes:** ${scenes.length}\n`;
        text += `**Scripts:** ${scripts.length}\n`;
        text += `**Resources:** ${resources.length}\n`;
        text += `**Autoloads:** ${config.autoloads.length}\n`;
        text += `**Addons:** ${addons.length > 0 ? addons.join(", ") : "none"}\n`;

        if (config.autoloads.length > 0) {
          text += `\n### Autoloads\n`;
          for (const a of config.autoloads) {
            text += `- **${a.name}**: ${a.path}\n`;
          }
        }

        text += `\n### Directory Structure\n\`\`\`\n`;
        const tree = getDirectoryTree(ctx.projectDir, ctx.projectDir, 3);
        text += tree.join("\n");
        text += `\n\`\`\`\n`;

        return { content: [{ type: "text", text }] };
      }

      // Full detail
      let text = `## ${config.name}\n\n`;
      if (config.godotVersion) text += `**Godot version:** ${config.godotVersion}\n\n`;

      if (config.autoloads.length > 0) {
        text += `### Autoloads\n`;
        for (const a of config.autoloads) {
          text += `- **${a.name}**: ${a.path}\n`;
        }
        text += "\n";
      }

      if (config.inputActions.length > 0) {
        text += `### Input Actions\n`;
        for (const a of config.inputActions) {
          text += `- ${a.name}\n`;
        }
        text += "\n";
      }

      text += `### Scenes (${scenes.length})\n`;
      for (const s of scenes) {
        text += `- ${s.path} (${s.size} bytes)\n`;
      }

      text += `\n### Scripts (${scripts.length})\n`;
      for (const s of scripts) {
        text += `- ${s.path} (${s.size} bytes)\n`;
      }

      text += `\n### Resources (${resources.length})\n`;
      for (const r of resources) {
        text += `- ${r.path} (${r.size} bytes)\n`;
      }

      text += `\n### Addons\n`;
      text += addons.length > 0 ? addons.map((a) => `- ${a}`).join("\n") : "None";

      return { content: [{ type: "text", text }] };
    }
  );
}
