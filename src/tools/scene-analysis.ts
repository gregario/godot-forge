import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readFileSync, existsSync } from "node:fs";
import type { ServerContext } from "../register-tools.js";
import { formatError, projectNotFound } from "../errors.js";
import { resolveSafePath } from "../path-sandbox.js";

interface SceneNode {
  name: string;
  type: string;
  parent: string;
  script: string | null;
  depth: number;
}

interface ExternalResource {
  id: string;
  type: string;
  path: string;
}

interface Warning {
  severity: "error" | "warning";
  message: string;
}

interface SceneAnalysis {
  format: "tscn" | "tres";
  nodes: SceneNode[];
  externalResources: ExternalResource[];
  warnings: Warning[];
  nodeCount: number;
  maxDepth: number;
}

function parseTscn(content: string, projectDir: string): SceneAnalysis {
  const result: SceneAnalysis = {
    format: "tscn",
    nodes: [],
    externalResources: [],
    warnings: [],
    nodeCount: 0,
    maxDepth: 0,
  };

  const lines = content.split("\n");

  for (const line of lines) {
    // External resources: [ext_resource type="..." path="..." id="..."]
    const extMatch = line.match(
      /\[ext_resource\s+(?:type="([^"]*)")?\s*(?:path="([^"]*)")?\s*(?:uid="([^"]*)")?\s*(?:id="([^"]*)")?\s*\]/
    );
    if (extMatch) {
      result.externalResources.push({
        type: extMatch[1] ?? "",
        path: extMatch[2] ?? "",
        id: extMatch[4] ?? extMatch[3] ?? "",
      });
    }

    // Also match reordered attributes
    const extMatch2 = line.match(/\[ext_resource\s+/);
    if (extMatch2 && !extMatch) {
      const typeM = line.match(/type="([^"]*)"/);
      const pathM = line.match(/path="([^"]*)"/);
      const idM = line.match(/id="([^"]*)"/);
      const uidM = line.match(/uid="([^"]*)"/);
      if (typeM || pathM) {
        result.externalResources.push({
          type: typeM?.[1] ?? "",
          path: pathM?.[1] ?? "",
          id: idM?.[1] ?? uidM?.[1] ?? "",
        });
      }
    }

    // Nodes: [node name="..." type="..." parent="..."]
    const nodeMatch = line.match(/\[node\s+name="([^"]*)"\s+(?:type="([^"]*)"\s*)?(?:parent="([^"]*)")?/);
    if (nodeMatch) {
      const parent = nodeMatch[3] ?? "";
      const depth = parent === "" ? 0 : parent.split("/").length;
      result.nodes.push({
        name: nodeMatch[1],
        type: nodeMatch[2] ?? "Node",
        parent,
        script: null,
        depth,
      });
      if (depth > result.maxDepth) result.maxDepth = depth;
    }

    // Script on node
    if (line.match(/^script\s*=/) && result.nodes.length > 0) {
      const scriptMatch = line.match(/ExtResource\(\s*"?([^)"]*)"?\s*\)/);
      if (scriptMatch) {
        const lastNode = result.nodes[result.nodes.length - 1];
        const ext = result.externalResources.find((e) => e.id === scriptMatch[1]);
        lastNode.script = ext?.path ?? scriptMatch[1];
      }
    }
  }

  result.nodeCount = result.nodes.length;

  // Antipattern detection
  if (result.maxDepth > 8) {
    result.warnings.push({
      severity: "warning",
      message: `Deep nesting detected (${result.maxDepth} levels). Consider extracting subtrees into separate scenes.`,
    });
  }

  if (result.nodeCount > 100) {
    result.warnings.push({
      severity: "warning",
      message: `Large scene (${result.nodeCount} nodes). Consider breaking into smaller reusable scenes.`,
    });
  }

  // Missing script references
  for (const node of result.nodes) {
    if (node.script && node.script.startsWith("res://")) {
      const safeResult = resolveSafePath(projectDir, node.script);
      if ("path" in safeResult && !existsSync(safeResult.path)) {
        result.warnings.push({
          severity: "error",
          message: `Script not found: ${node.script}. The referenced script may have been moved or deleted.`,
        });
      }
    }
  }

  // Check for integer resource IDs instead of uid://
  if (content.match(/\[ext_resource\s+[^\]]*id=(\d+)/)) {
    result.warnings.push({
      severity: "warning",
      message:
        "Integer resource ID found. Godot 4 uses uid:// strings for resource identification. Regenerate UIDs by opening the scene in the editor.",
    });
  }

  return result;
}

function parseTres(content: string): SceneAnalysis {
  const result: SceneAnalysis = {
    format: "tres",
    nodes: [],
    externalResources: [],
    warnings: [],
    nodeCount: 0,
    maxDepth: 0,
  };

  // Check for preload() usage
  if (content.includes("preload(")) {
    result.warnings.push({
      severity: "warning",
      message:
        "preload() found in .tres file. Use ExtResource() for resource references in .tres files.",
    });
  }

  // Check for custom class name in type field
  const headerMatch = content.match(/\[gd_resource\s+type="([^"]*)"/);
  if (headerMatch) {
    const type = headerMatch[1];
    // Built-in Godot types are PascalCase and well-known
    const builtinTypes = new Set([
      "Resource", "Theme", "StyleBox", "StyleBoxFlat", "StyleBoxTexture",
      "Font", "FontFile", "Texture2D", "ImageTexture", "AtlasTexture",
      "Material", "ShaderMaterial", "StandardMaterial3D",
      "Animation", "AnimationLibrary", "AudioStream", "AudioStreamMP3",
      "AudioStreamWAV", "AudioStreamOggVorbis", "Curve", "Curve2D", "Curve3D",
      "Gradient", "GradientTexture1D", "GradientTexture2D",
      "Environment", "Sky", "WorldEnvironment",
      "PhysicsMaterial", "NavigationMesh", "TileSet",
      "PackedScene", "Script", "GDScript", "CSharpScript",
    ]);

    if (!builtinTypes.has(type) && !type.startsWith("Packed") && type !== "Resource") {
      result.warnings.push({
        severity: "warning",
        message: `Custom class name "${type}" in .tres type field. Use type="Resource" (the base Godot type), not the custom class name. Custom class names in the type field cause parse errors.`,
      });
    }
  }

  // Check for integer resource IDs
  if (content.match(/\[ext_resource\s+[^\]]*id=(\d+)/)) {
    result.warnings.push({
      severity: "warning",
      message:
        "Integer resource ID found. Godot 4 uses uid:// strings for resource identification.",
    });
  }

  // Parse external resources (same format as .tscn)
  const lines = content.split("\n");
  for (const line of lines) {
    const extMatch = line.match(/\[ext_resource/);
    if (extMatch) {
      const typeM = line.match(/type="([^"]*)"/);
      const pathM = line.match(/path="([^"]*)"/);
      const idM = line.match(/id="([^"]*)"/);
      result.externalResources.push({
        type: typeM?.[1] ?? "",
        path: pathM?.[1] ?? "",
        id: idM?.[1] ?? "",
      });
    }
  }

  return result;
}

export function registerSceneAnalysis(server: McpServer, ctx: ServerContext): void {
  server.tool(
    "godot_analyze_scene",
    "Parse .tscn scene files or .tres resource files and return structured analysis. Detects antipatterns (deep nesting, oversized scenes, missing scripts) and format errors (preload in .tres, custom class names in type field, integer resource IDs).",
    {
      path: z
        .string()
        .describe("Path to .tscn or .tres file (e.g., res://scenes/main.tscn)"),
    },
    { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    async (args) => {
      if (!ctx.projectDir) {
        return { isError: true, content: [{ type: "text", text: formatError(projectNotFound()) }] };
      }

      const safeResult = resolveSafePath(ctx.projectDir, args.path);
      if ("error" in safeResult) {
        return { content: [{ type: "text", text: safeResult.error }] };
      }

      if (!existsSync(safeResult.path)) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: formatError({
                message: `File not found: ${args.path}`,
                suggestion:
                  "Check the path and try again. Use godot_get_project_info to list available scenes.",
              }),
            },
          ],
        };
      }

      const content = readFileSync(safeResult.path, "utf-8");
      const isTres = args.path.endsWith(".tres");

      const analysis = isTres
        ? parseTres(content)
        : parseTscn(content, ctx.projectDir);

      return { content: [{ type: "text", text: JSON.stringify(analysis, null, 2) }] };
    }
  );
}
