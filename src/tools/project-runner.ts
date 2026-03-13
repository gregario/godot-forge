import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ChildProcess } from "node:child_process";
import type { ServerContext } from "../register-tools.js";
import { formatError, godotNotFound, projectNotFound } from "../errors.js";
import { spawnGodotManaged } from "../spawn-godot.js";

interface OutputLine {
  timestamp: number;
  stream: "stdout" | "stderr";
  text: string;
}

const MAX_BUFFER_LINES = 5000;

let runningProcess: ChildProcess | null = null;
let outputBuffer: OutputLine[] = [];
let lastReadIndex = 0;

export function registerProjectRunner(server: McpServer, ctx: ServerContext): void {
  server.tool(
    "godot_run_project",
    "Launch, stop, or get debug output from a running Godot project. Captures stdout/stderr with timestamps.",
    {
      action: z
        .enum(["start", "stop", "get_output"])
        .describe("Action to perform"),
      scene: z
        .string()
        .optional()
        .describe("Scene to launch directly (e.g., res://scenes/main.tscn)"),
    },
    { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
    async (args) => {
      if (!ctx.projectDir) {
        return { content: [{ type: "text", text: formatError(projectNotFound()) }] };
      }

      if (args.action === "start") {
        if (!ctx.godotBinary) {
          return { content: [{ type: "text", text: formatError(godotNotFound()) }] };
        }

        if (runningProcess) {
          return {
            content: [
              {
                type: "text",
                text: "A Godot project is already running. Stop it first with action: 'stop'.",
              },
            ],
          };
        }

        const godotArgs = ["--path", ctx.projectDir];
        if (args.scene) {
          godotArgs.push(args.scene);
        }

        outputBuffer = [];
        lastReadIndex = 0;

        runningProcess = spawnGodotManaged(ctx.godotBinary, godotArgs, {
          cwd: ctx.projectDir,
        });

        runningProcess.stdout?.on("data", (chunk: Buffer) => {
          const lines = chunk.toString().split("\n").filter((l) => l.length > 0);
          for (const text of lines) {
            outputBuffer.push({ timestamp: Date.now(), stream: "stdout", text });
          }
          if (outputBuffer.length > MAX_BUFFER_LINES) {
            outputBuffer = outputBuffer.slice(-MAX_BUFFER_LINES);
          }
        });

        runningProcess.stderr?.on("data", (chunk: Buffer) => {
          const lines = chunk.toString().split("\n").filter((l) => l.length > 0);
          for (const text of lines) {
            outputBuffer.push({ timestamp: Date.now(), stream: "stderr", text });
          }
          if (outputBuffer.length > MAX_BUFFER_LINES) {
            outputBuffer = outputBuffer.slice(-MAX_BUFFER_LINES);
          }
        });

        runningProcess.on("close", () => {
          runningProcess = null;
        });

        return {
          content: [
            {
              type: "text",
              text: `Godot project launched (PID: ${runningProcess.pid}). Use action: "get_output" to read debug output, or action: "stop" to terminate.`,
            },
          ],
        };
      }

      if (args.action === "stop") {
        if (!runningProcess) {
          return {
            content: [{ type: "text", text: "No Godot project is currently running." }],
          };
        }

        runningProcess.kill("SIGTERM");
        runningProcess = null;

        return {
          content: [{ type: "text", text: "Godot project stopped." }],
        };
      }

      if (args.action === "get_output") {
        const newLines = outputBuffer.slice(lastReadIndex);
        lastReadIndex = outputBuffer.length;

        if (newLines.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: runningProcess
                  ? "No new output since last read."
                  : "No output available. Project is not running.",
              },
            ],
          };
        }

        const formatted = newLines
          .map(
            (l) =>
              `[${new Date(l.timestamp).toISOString()}] [${l.stream}] ${l.text}`
          )
          .join("\n");

        return { content: [{ type: "text", text: formatted }] };
      }

      return { content: [{ type: "text", text: "Unknown action." }] };
    }
  );
}
