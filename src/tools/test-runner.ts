import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ServerContext } from "../register-tools.js";
import { formatError, godotNotFound, projectNotFound } from "../errors.js";
import { spawnGodot } from "../spawn-godot.js";
import { stripAnsi } from "../ansi.js";

interface TestFailure {
  test: string;
  script: string;
  line: number | null;
  message: string;
}

interface TestResult {
  framework: string;
  total: number;
  passed: number;
  failed: number;
  errors: number;
  failures: TestFailure[];
  duration_ms: number | null;
  summary: string;
}

interface GutConfig {
  dirs?: string[];
  prefix?: string;
  suffix?: string;
}

function readGutConfig(projectDir: string): GutConfig | null {
  const configPath = resolve(projectDir, ".gutconfig.json");
  if (!existsSync(configPath)) return null;
  try {
    return JSON.parse(readFileSync(configPath, "utf-8")) as GutConfig;
  } catch {
    return null;
  }
}

function parseGutOutput(raw: string): TestResult {
  const output = stripAnsi(raw);

  const result: TestResult = {
    framework: "gut",
    total: 0,
    passed: 0,
    failed: 0,
    errors: 0,
    failures: [],
    duration_ms: null,
    summary: "",
  };

  // GUT summary format (actual output from GUT 9.x):
  //   Tests              1229
  //   Passing Tests      1229
  //   Failing Tests         3    (only present when >0)
  //   Pending              2     (only present when >0)
  // Also support older GUT format: "passed: 1220 failed: 0"
  const testsMatch = output.match(/^Tests\s+(\d+)/m);
  const passingMatch = output.match(/Passing Tests\s+(\d+)/m);
  const failingMatch = output.match(/Failing Tests\s+(\d+)/m);
  const pendingMatch = output.match(/Pending\s+(\d+)/m);

  if (testsMatch) {
    result.total = parseInt(testsMatch[1], 10);
    result.passed = passingMatch ? parseInt(passingMatch[1], 10) : 0;
    result.failed = failingMatch ? parseInt(failingMatch[1], 10) : 0;
  } else {
    // Fallback: older GUT format "passed: N failed: N"
    const legacyMatch = output.match(/passed:\s*(\d+)\s+failed:\s*(\d+)/i);
    if (legacyMatch) {
      result.passed = parseInt(legacyMatch[1], 10);
      result.failed = parseInt(legacyMatch[2], 10);
      result.total = result.passed + result.failed;
    }
  }

  // Parse errors count
  const errorsMatch = output.match(/Errors\s+(\d+)/m) ?? output.match(/errors:\s*(\d+)/i);
  if (errorsMatch) {
    result.errors = parseInt(errorsMatch[1], 10);
  }

  // Parse individual failures
  // GUT failure format: "FAILED: test_name - expected X got Y" followed by "at line N"
  const failureBlocks = output.split(/\n/).reduce<TestFailure[]>((acc, line) => {
    const failMatch = line.match(/FAILED:\s*(.+?)(?:\s*-\s*(.+))?$/);
    if (failMatch) {
      acc.push({
        test: failMatch[1].trim(),
        script: "",
        line: null,
        message: failMatch[2]?.trim() ?? "",
      });
    }

    // Try to match script file references
    const scriptMatch = line.match(/(res:\/\/[^\s:]+):(\d+)/);
    if (scriptMatch && acc.length > 0) {
      const last = acc[acc.length - 1];
      if (!last.script) {
        last.script = scriptMatch[1];
        last.line = parseInt(scriptMatch[2], 10);
      }
    }

    return acc;
  }, []);

  result.failures = failureBlocks;

  // Duration: "Time              5.201s" or "X.Xs" / "X seconds"
  const durationMatch = output.match(/Time\s+(\d+(?:\.\d+)?)s/m)
    ?? output.match(/(\d+(?:\.\d+)?)\s*seconds/i);
  if (durationMatch) {
    result.duration_ms = Math.round(parseFloat(durationMatch[1]) * 1000);
  }

  result.summary =
    result.failed === 0 && result.errors === 0
      ? `All ${result.total} tests passed`
      : `${result.failed} failures, ${result.errors} errors in ${result.total} tests`;

  return result;
}

function parseGdUnit4Output(raw: string): TestResult {
  const output = stripAnsi(raw);

  const result: TestResult = {
    framework: "gdunit4",
    total: 0,
    passed: 0,
    failed: 0,
    errors: 0,
    failures: [],
    duration_ms: null,
    summary: "",
  };

  // GdUnit4 summary format varies; parse common patterns
  const totalMatch = output.match(/total:\s*(\d+)/i);
  const successMatch = output.match(/success(?:es)?:\s*(\d+)/i);
  const failedMatch = output.match(/fail(?:ures|ed)?:\s*(\d+)/i);
  const errorMatch = output.match(/error(?:s)?:\s*(\d+)/i);

  if (totalMatch) result.total = parseInt(totalMatch[1], 10);
  if (successMatch) result.passed = parseInt(successMatch[1], 10);
  if (failedMatch) result.failed = parseInt(failedMatch[1], 10);
  if (errorMatch) result.errors = parseInt(errorMatch[1], 10);

  if (!totalMatch && successMatch && failedMatch) {
    result.total = result.passed + result.failed + result.errors;
  }

  result.summary =
    result.failed === 0 && result.errors === 0
      ? `All ${result.total} tests passed`
      : `${result.failed} failures, ${result.errors} errors in ${result.total} tests`;

  return result;
}

export function registerTestRunner(server: McpServer, ctx: ServerContext): void {
  server.tool(
    "godot_run_tests",
    "Run GUT or GdUnit4 tests headlessly and return structured pass/fail results. Auto-detects the test framework. Returns total/passed/failed counts with failure details including file paths and line numbers.",
    {
      script_path: z
        .string()
        .optional()
        .describe("Filter to specific test script (e.g., res://tests/test_inventory.gd)"),
      method: z
        .string()
        .optional()
        .describe("Filter to specific test method name"),
      inner_class: z
        .string()
        .optional()
        .describe("Filter to specific inner test class"),
      framework: z
        .enum(["gut", "gdunit4"])
        .optional()
        .describe("Force specific framework (auto-detected if omitted)"),
      timeout: z
        .number()
        .optional()
        .describe("Timeout in seconds (default: 60)"),
    },
    { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
    async (args) => {
      if (!ctx.projectDir) {
        return { content: [{ type: "text", text: formatError(projectNotFound()) }] };
      }
      if (!ctx.godotBinary) {
        return { content: [{ type: "text", text: formatError(godotNotFound()) }] };
      }

      const hasGut = existsSync(resolve(ctx.projectDir, "addons", "gut"));
      const hasGdUnit4 = existsSync(resolve(ctx.projectDir, "addons", "gdUnit4"));

      if (!hasGut && !hasGdUnit4) {
        return {
          content: [
            {
              type: "text",
              text: formatError({
                message: "No test framework found.",
                suggestion:
                  "Install GUT via AssetLib or add it to addons/gut/. " +
                  "Alternatively, install GdUnit4 for an alternative test framework.",
              }),
            },
          ],
        };
      }

      const useGdUnit4 =
        args.framework === "gdunit4" || (!hasGut && hasGdUnit4);

      const timeoutMs = (args.timeout ?? 60) * 1000;

      try {
        let result: TestResult;

        if (useGdUnit4) {
          // GdUnit4 CLI invocation
          const gdunitArgs = [
            "--headless",
            "--path",
            ctx.projectDir,
            "-s",
            "res://addons/gdUnit4/bin/GdUnitCmdTool.gd",
          ];

          if (args.script_path) {
            gdunitArgs.push("--add", args.script_path);
          }

          const proc = await spawnGodot(ctx.godotBinary, gdunitArgs, {
            cwd: ctx.projectDir,
            timeout: timeoutMs,
          });

          result = parseGdUnit4Output(proc.stdout + proc.stderr);
        } else {
          // GUT CLI invocation
          const gutArgs = [
            "--headless",
            "--path",
            ctx.projectDir,
            "-s",
            "res://addons/gut/gut_cmdln.gd",
          ];

          // Read .gutconfig.json for configuration
          const gutConfig = readGutConfig(ctx.projectDir);
          const configPath = resolve(ctx.projectDir, ".gutconfig.json");
          if (existsSync(configPath)) {
            gutArgs.push(`-gconfig=res://.gutconfig.json`);
          }

          gutArgs.push("-gexit");

          if (args.script_path) {
            // Use -gselect for filtering (works with -gconfig).
            // -gtest is overridden by .gutconfig.json, but -gselect always works.
            // Extract the script name without path/extension for -gselect.
            const selectName = args.script_path
              .replace(/^res:\/\//, "")
              .replace(/^.*\//, "")
              .replace(/\.gd$/, "");
            gutArgs.push(`-gselect=${selectName}`);
          }
          if (args.inner_class) {
            gutArgs.push(`-ginner_class=${args.inner_class}`);
          }
          if (args.method) {
            gutArgs.push(`-gunit_test_name=${args.method}`);
          }

          const proc = await spawnGodot(ctx.godotBinary, gutArgs, {
            cwd: ctx.projectDir,
            timeout: timeoutMs,
          });

          result = parseGutOutput(proc.stdout + proc.stderr);
        }

        let text = JSON.stringify(result, null, 2);

        // Note about both frameworks if applicable
        if (hasGut && hasGdUnit4 && !args.framework) {
          text +=
            "\n\nNote: Both GUT and GdUnit4 are installed. Using GUT by default. " +
            'Specify framework: "gdunit4" to use GdUnit4 instead.';
        }

        return { content: [{ type: "text", text }] };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown error running tests";

        if (message.includes("timed out")) {
          return {
            content: [
              {
                type: "text",
                text: formatError({
                  message: `Test execution timed out after ${args.timeout ?? 60} seconds.`,
                  suggestion:
                    "Use script_path or method filters to run a smaller test subset, " +
                    "or increase the timeout parameter.",
                }),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: formatError({
                message: `Test execution failed: ${message}`,
                suggestion:
                  "Check for syntax errors or missing dependencies in your test files.",
              }),
            },
          ],
        };
      }
    }
  );
}
