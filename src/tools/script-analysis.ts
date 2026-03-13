import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readFileSync, existsSync } from "node:fs";
import type { ServerContext } from "../register-tools.js";
import { formatError, projectNotFound } from "../errors.js";
import { resolveSafePath } from "../path-sandbox.js";
import { parseProjectGodot } from "../project-config.js";

interface ScriptWarning {
  pitfall: string;
  severity: "error" | "warning";
  line: number | null;
  message: string;
  suggestion: string;
}

/**
 * Godot 3 → 4 API patterns to detect in GDScript files.
 */
const GODOT3_PATTERNS: Array<{
  pattern: RegExp;
  message: string;
  suggestion: string;
}> = [
  {
    pattern: /\byield\s*\(/,
    message: "Godot 3 API: yield() was replaced by await in Godot 4.",
    suggestion: "Use: await object.signal_name",
  },
  {
    pattern: /\.connect\s*\(\s*["']/,
    message: 'Godot 3 API: String-based connect("signal", target, "method") is deprecated.',
    suggestion: "Use: signal_name.connect(callable)",
  },
  {
    pattern: /(?<!@)\bexport\s+var\b/,
    message: "Godot 3 syntax: export var is deprecated.",
    suggestion: "Use: @export var",
  },
  {
    pattern: /(?<!@)\bonready\s+var\b/,
    message: "Godot 3 syntax: onready var is deprecated.",
    suggestion: "Use: @onready var",
  },
  {
    pattern: /^tool\s*$/m,
    message: "Godot 3 syntax: tool keyword is deprecated.",
    suggestion: "Use: @tool",
  },
  {
    pattern: /\.instance\s*\(\s*\)/,
    message: "Godot 3 API: instance() was renamed in Godot 4.",
    suggestion: "Use: instantiate()",
  },
  {
    pattern: /\bdeg2rad\s*\(/,
    message: "Godot 3 API: deg2rad() was renamed in Godot 4.",
    suggestion: "Use: deg_to_rad()",
  },
  {
    pattern: /\brad2deg\s*\(/,
    message: "Godot 3 API: rad2deg() was renamed in Godot 4.",
    suggestion: "Use: rad_to_deg()",
  },
  {
    pattern: /\brand_range\s*\(/,
    message: "Godot 3 API: rand_range() was split in Godot 4.",
    suggestion: "Use: randf_range() for float, randi_range() for int",
  },
  {
    pattern: /\bBUTTON_LEFT\b/,
    message: "Godot 3 constant: BUTTON_LEFT was renamed in Godot 4.",
    suggestion: "Use: MOUSE_BUTTON_LEFT",
  },
  {
    pattern: /\bBUTTON_RIGHT\b/,
    message: "Godot 3 constant: BUTTON_RIGHT was renamed in Godot 4.",
    suggestion: "Use: MOUSE_BUTTON_RIGHT",
  },
];

function analyseScript(
  content: string,
  filePath: string,
  projectDir: string
): ScriptWarning[] {
  const warnings: ScriptWarning[] = [];
  const lines = content.split("\n");

  // Pitfall 1: Godot 3→4 API detection
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip comments
    if (line.trim().startsWith("#")) continue;

    for (const pattern of GODOT3_PATTERNS) {
      if (pattern.pattern.test(line)) {
        warnings.push({
          pitfall: "godot3-api",
          severity: "warning",
          line: i + 1,
          message: pattern.message,
          suggestion: pattern.suggestion,
        });
      }
    }
  }

  // Pitfall 2: Giant script (>300 lines)
  if (lines.length > 300) {
    warnings.push({
      pitfall: "giant-script",
      severity: "warning",
      line: null,
      message: `Large script (${lines.length} lines).`,
      suggestion:
        "Consider splitting into smaller focused scripts or using composition. Target under 300 lines per script.",
    });
  }

  // Pitfall 3: := on Variant return type
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith("#")) continue;

    // Detect := with Dictionary.get(), Array methods returning Variant, ternary
    if (line.match(/:=\s*.*\.get\s*\(/) || line.match(/:=\s*.*if\s+.*\s+else\s+/)) {
      warnings.push({
        pitfall: "variant-type-inference",
        severity: "warning",
        line: i + 1,
        message: ":= type inference on Variant return.",
        suggestion:
          "Use explicit type annotation or = instead of := to avoid parse errors. " +
          "Example: var value: Variant = dict.get(\"key\", null)",
      });
    }
  }

  // Pitfall 4: Tight coupling (excessive get_node/$ references)
  let distantNodeRefs = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith("#")) continue;

    // Count get_node or $ with paths that go up (..) or are deeply nested
    const getNodeMatch = line.match(/get_node\s*\(\s*["']([^"']+)["']\s*\)/);
    const dollarMatch = line.match(/\$([A-Za-z0-9_/]+)/);

    const path = getNodeMatch?.[1] ?? dollarMatch?.[1];
    if (path && (path.includes("..") || path.split("/").length > 2)) {
      distantNodeRefs++;
    }
  }
  if (distantNodeRefs > 5) {
    warnings.push({
      pitfall: "tight-coupling",
      severity: "warning",
      line: null,
      message: `Tight coupling: ${distantNodeRefs} references to distant nodes.`,
      suggestion:
        "Consider using signals, groups, or dependency injection instead of direct node path references.",
    });
  }

  // Pitfall 5: Signal re-entrancy
  // Detect: property assignment, then emit_signal/emit on same indentation level
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith("#")) continue;

    // Look for emit between state changes
    if (line.match(/\.\s*emit\s*\(/) || line.match(/emit_signal\s*\(/)) {
      // Check if there are state-modifying lines before AND after at same indent
      const indent = line.match(/^(\s*)/)?.[1]?.length ?? 0;
      let stateChangeBefore = false;
      let stateChangeAfter = false;

      // Look backwards for state change
      for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
        const prev = lines[j];
        const prevIndent = prev.match(/^(\s*)/)?.[1]?.length ?? 0;
        if (prevIndent < indent && prev.trim().match(/^func\s/)) break;
        if (prevIndent === indent && prev.match(/\s*\w+\s*=(?!=)/)) {
          stateChangeBefore = true;
          break;
        }
      }

      // Look forwards for state change
      for (let j = i + 1; j < Math.min(lines.length, i + 10); j++) {
        const next = lines[j];
        const nextIndent = next.match(/^(\s*)/)?.[1]?.length ?? 0;
        if (nextIndent < indent && next.trim() !== "") break;
        if (nextIndent === indent && next.match(/\s*\w+\s*=(?!=)/)) {
          stateChangeAfter = true;
          break;
        }
      }

      if (stateChangeBefore && stateChangeAfter) {
        warnings.push({
          pitfall: "signal-re-entrancy",
          severity: "warning",
          line: i + 1,
          message: "Signal re-entrancy risk: signal emitted between state changes.",
          suggestion:
            "Connected handlers will execute synchronously before subsequent lines run. " +
            "Consider emitting signals at the end of state changes, or use call_deferred() for the emission.",
        });
      }
    }
  }

  // Pitfall 6: Autoload misuse - static func on autoloads
  // Check if this script is registered as an autoload
  const config = parseProjectGodot(projectDir);
  if (config) {
    const isAutoload = config.autoloads.some(
      (a) => filePath.endsWith(a.path.replace("res://", ""))
    );
    if (isAutoload) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].match(/^static\s+func\s/)) {
          warnings.push({
            pitfall: "static-func-autoload",
            severity: "warning",
            line: i + 1,
            message: "static func on autoload script.",
            suggestion:
              "Godot 4 warns STATIC_CALLED_ON_INSTANCE when calling static methods on autoload instances. " +
              "Use regular func instead, or move static utilities to a non-autoload class.",
          });
        }
      }
    }

    // Check total autoload count
    if (config.autoloads.length > 5) {
      warnings.push({
        pitfall: "too-many-autoloads",
        severity: "warning",
        line: null,
        message: `${config.autoloads.length} autoloads detected.`,
        suggestion:
          "Autoloads are global singletons — only use for genuinely global systems (GameState, AudioManager, SaveSystem). " +
          "Consider using regular classes for utilities.",
      });
    }
  }

  // Pitfall 7: Missing signal disconnect
  const connectCalls: Array<{ line: number; signal: string }> = [];
  let hasExitTree = false;
  const disconnectSignals = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith("#")) continue;

    // Detect .connect() calls
    const connectMatch = line.match(/(\w+)\.connect\s*\(/);
    if (connectMatch) {
      connectCalls.push({ line: i + 1, signal: connectMatch[1] });
    }

    // Detect _exit_tree function
    if (line.match(/^func\s+_exit_tree\s*\(/)) {
      hasExitTree = true;
    }

    // Detect .disconnect() calls
    const disconnectMatch = line.match(/(\w+)\.disconnect\s*\(/);
    if (disconnectMatch) {
      disconnectSignals.add(disconnectMatch[1]);
    }
  }

  if (connectCalls.length > 0 && !hasExitTree) {
    warnings.push({
      pitfall: "missing-signal-disconnect",
      severity: "warning",
      line: connectCalls[0].line,
      message: "Signal connected without disconnect in _exit_tree().",
      suggestion:
        "This can cause errors when the listening node is freed but the signal source persists. " +
        "Add _exit_tree() and disconnect signals there.",
    });
  }

  // Pitfall 8: _init() timing - node tree access in _init
  let inInit = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.match(/^func\s+_init\s*\(/)) {
      inInit = true;
      continue;
    }
    if (inInit && line.match(/^func\s+/) && !line.match(/^func\s+_init/)) {
      inInit = false;
      continue;
    }

    if (inInit) {
      if (
        line.match(/get_node\s*\(/) ||
        line.match(/\$[A-Za-z]/) ||
        line.match(/get_parent\s*\(/) ||
        line.match(/get_tree\s*\(/)
      ) {
        warnings.push({
          pitfall: "init-timing",
          severity: "warning",
          line: i + 1,
          message: "Node tree access in _init().",
          suggestion:
            "The node is not in the scene tree during _init(). " +
            "Use _ready() for node access, or _enter_tree() if you need the tree before children are ready.",
        });
      }
    }
  }

  // Pitfall 9: Python-isms
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith("#")) continue;

    // List comprehension syntax
    if (line.match(/\[.+\s+for\s+\w+\s+in\s+/)) {
      warnings.push({
        pitfall: "python-ism",
        severity: "warning",
        line: i + 1,
        message: "Python-style list comprehension detected.",
        suggestion: "GDScript doesn't support list comprehensions. Use Array.map() or a for loop.",
      });
    }

    // Python imports
    if (line.match(/^import\s+\w+/) || line.match(/^from\s+\w+\s+import/)) {
      warnings.push({
        pitfall: "python-ism",
        severity: "warning",
        line: i + 1,
        message: "Python-style import detected.",
        suggestion: "GDScript uses preload() or load() for imports, not Python's import syntax.",
      });
    }

    // Python builtins
    if (line.match(/\blen\s*\(/) && !line.match(/\.\s*len\s*\(/)) {
      warnings.push({
        pitfall: "python-ism",
        severity: "warning",
        line: i + 1,
        message: "Python-style len() detected.",
        suggestion: "GDScript uses .size() for arrays/strings, not len().",
      });
    }
  }

  return warnings;
}

export function registerScriptAnalysis(server: McpServer, ctx: ServerContext): void {
  server.tool(
    "godot_analyze_script",
    "Analyse GDScript files for all 10 battle-tested pitfalls: Godot 3→4 API misuse, giant scripts, := on Variant, tight coupling, signal re-entrancy, autoload misuse, missing signal disconnect, _init() timing, Python-isms, and static func on autoloads.",
    {
      path: z
        .string()
        .describe("Path to .gd file (e.g., res://scripts/player.gd)"),
    },
    { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    async (args) => {
      if (!ctx.projectDir) {
        return { content: [{ type: "text", text: formatError(projectNotFound()) }] };
      }

      const safeResult = resolveSafePath(ctx.projectDir, args.path);
      if ("error" in safeResult) {
        return { content: [{ type: "text", text: safeResult.error }] };
      }

      if (!existsSync(safeResult.path)) {
        return {
          content: [
            {
              type: "text",
              text: formatError({
                message: `Script not found: ${args.path}`,
                suggestion: "Check the path and try again.",
              }),
            },
          ],
        };
      }

      const content = readFileSync(safeResult.path, "utf-8");
      const warnings = analyseScript(content, safeResult.path, ctx.projectDir);

      if (warnings.length === 0) {
        return {
          content: [
            { type: "text", text: `No pitfalls detected in ${args.path}. Script looks clean.` },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { file: args.path, warningCount: warnings.length, warnings },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
