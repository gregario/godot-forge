import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Socket } from "node:net";
import { readFileSync } from "node:fs";
import type { ServerContext } from "../register-tools.js";
import { formatError, projectNotFound } from "../errors.js";
import { resolveSafePath } from "../path-sandbox.js";

interface Diagnostic {
  severity: "error" | "warning" | "info" | "hint";
  message: string;
  file: string;
  line: number;
  column: number;
}

function severityToString(severity: number): Diagnostic["severity"] {
  switch (severity) {
    case 1: return "error";
    case 2: return "warning";
    case 3: return "info";
    case 4: return "hint";
    default: return "info";
  }
}

interface LspMessage {
  jsonrpc: string;
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string };
}

/**
 * Manages an LSP connection to Godot's built-in language server.
 *
 * Godot's LSP uses the standard push model: diagnostics arrive via
 * `textDocument/publishDiagnostics` notifications after opening a document.
 * We initialise the connection once, then open files and collect diagnostics.
 */
class GodotLspClient {
  private socket: Socket | null = null;
  private connected = false;
  private initialized = false;
  private messageBuffer = "";
  private nextId = 1;
  private responseHandlers = new Map<number, { resolve: (msg: LspMessage) => void; reject: (err: Error) => void }>();
  private notificationHandlers: Array<(msg: LspMessage) => void> = [];

  async connect(port: number): Promise<boolean> {
    if (this.connected && this.socket) return true;

    return new Promise((resolve) => {
      const socket = new Socket();
      const timeout = setTimeout(() => {
        socket.destroy();
        resolve(false);
      }, 3000);

      socket.connect(port, "127.0.0.1", () => {
        clearTimeout(timeout);
        this.socket = socket;
        this.connected = true;

        socket.on("data", (data) => {
          this.messageBuffer += data.toString();
          this.processBuffer();
        });

        socket.on("close", () => {
          this.connected = false;
          this.socket = null;
          this.initialized = false;
        });

        socket.on("error", () => {
          this.connected = false;
          this.socket = null;
          this.initialized = false;
        });

        resolve(true);
      });

      socket.on("error", () => {
        clearTimeout(timeout);
        resolve(false);
      });
    });
  }

  private processBuffer(): void {
    while (true) {
      const headerEnd = this.messageBuffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) break;
      const header = this.messageBuffer.substring(0, headerEnd);
      const lengthMatch = header.match(/Content-Length:\s*(\d+)/i);
      if (!lengthMatch) break;
      const contentLength = parseInt(lengthMatch[1], 10);
      const contentStart = headerEnd + 4;
      if (this.messageBuffer.length < contentStart + contentLength) break;
      const content = this.messageBuffer.substring(contentStart, contentStart + contentLength);
      this.messageBuffer = this.messageBuffer.substring(contentStart + contentLength);
      try {
        const msg = JSON.parse(content) as LspMessage;
        this.handleMessage(msg);
      } catch {
        // skip malformed
      }
    }
  }

  private handleMessage(msg: LspMessage): void {
    if (msg.id !== undefined && this.responseHandlers.has(msg.id)) {
      const handler = this.responseHandlers.get(msg.id)!;
      this.responseHandlers.delete(msg.id);
      handler.resolve(msg);
    } else {
      // Notification (no id, or unsolicited)
      for (const handler of this.notificationHandlers) {
        handler(msg);
      }
    }
  }

  private send(method: string, params: unknown, id?: number): void {
    if (!this.socket || !this.connected) return;
    const msg: Record<string, unknown> = { jsonrpc: "2.0", method, params };
    if (id !== undefined) msg.id = id;
    const body = JSON.stringify(msg);
    const header = `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n`;
    this.socket.write(header + body);
  }

  private sendRequest(method: string, params: unknown): Promise<LspMessage> {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.responseHandlers.set(id, { resolve, reject });
      this.send(method, params, id);
      setTimeout(() => {
        if (this.responseHandlers.has(id)) {
          this.responseHandlers.delete(id);
          reject(new Error(`LSP request '${method}' timed out`));
        }
      }, 5000);
    });
  }

  private sendNotification(method: string, params: unknown): void {
    this.send(method, params);
  }

  async initialize(projectDir: string): Promise<boolean> {
    if (this.initialized) return true;

    try {
      await this.sendRequest("initialize", {
        processId: process.pid,
        rootUri: `file://${projectDir}`,
        capabilities: {
          textDocument: {
            publishDiagnostics: { relatedInformation: true },
          },
        },
      });

      this.sendNotification("initialized", {});
      this.initialized = true;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Open a file and collect diagnostics pushed by the server.
   * Godot sends textDocument/publishDiagnostics notifications after didOpen.
   */
  async getDiagnosticsForFile(filePath: string, uri: string): Promise<Diagnostic[]> {
    const diagnostics: Diagnostic[] = [];

    // Read file content for didOpen
    let text: string;
    try {
      text = readFileSync(filePath, "utf-8");
    } catch {
      return [];
    }

    return new Promise((resolve) => {
      const collected: Diagnostic[] = [];
      let resolved = false;

      const handler = (msg: LspMessage) => {
        if (msg.method === "textDocument/publishDiagnostics") {
          const params = msg.params as {
            uri: string;
            diagnostics: Array<{
              severity: number;
              message: string;
              range: { start: { line: number; character: number } };
            }>;
          };

          if (params.uri === uri) {
            for (const d of params.diagnostics) {
              collected.push({
                severity: severityToString(d.severity),
                message: d.message,
                file: uri.replace("file://", ""),
                line: d.range.start.line + 1,
                column: d.range.start.character + 1,
              });
            }

            // Resolve after receiving diagnostics
            if (!resolved) {
              resolved = true;
              cleanup();
              resolve(collected);
            }
          }
        }
      };

      const cleanup = () => {
        const idx = this.notificationHandlers.indexOf(handler);
        if (idx !== -1) this.notificationHandlers.splice(idx, 1);
      };

      this.notificationHandlers.push(handler);

      // Send didOpen
      this.sendNotification("textDocument/didOpen", {
        textDocument: {
          uri,
          languageId: "gdscript",
          version: 1,
          text,
        },
      });

      // If no diagnostics arrive within 3 seconds, return empty (file is clean)
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(collected);
        }
      }, 3000);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
      this.connected = false;
      this.initialized = false;
    }
  }
}

// Shared client instance across tool calls
let lspClient: GodotLspClient | null = null;

export function registerLspDiagnostics(server: McpServer, ctx: ServerContext): void {
  server.tool(
    "godot_get_diagnostics",
    "Get LSP diagnostics (errors, warnings) from Godot's built-in language server. Requires Godot editor to be running with the project open.",
    {
      path: z
        .string()
        .optional()
        .describe("File path to get diagnostics for (e.g., scripts/player.gd). Omit for project-wide."),
      port: z
        .number()
        .optional()
        .describe("LSP port (default: 6005)"),
    },
    { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    async (args) => {
      if (!ctx.projectDir) {
        return { isError: true, content: [{ type: "text", text: formatError(projectNotFound()) }] };
      }

      const port = args.port ?? 6005;

      if (!lspClient) {
        lspClient = new GodotLspClient();
      }

      const connected = await lspClient.connect(port);
      if (!connected) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: formatError({
                message: `Godot editor LSP not available on port ${port}.`,
                suggestion:
                  "Start the Godot editor with your project open to enable LSP diagnostics. " +
                  "The LSP runs automatically when the editor is open. " +
                  "All non-LSP tools (test runner, docs search, script analysis, etc.) continue to work without the editor.",
              }),
            },
          ],
        };
      }

      const initOk = await lspClient.initialize(ctx.projectDir);
      if (!initOk) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: formatError({
                message: "Failed to initialise LSP handshake with Godot editor.",
                suggestion: "Try restarting the Godot editor and ensure the project is open.",
              }),
            },
          ],
        };
      }

      try {
        if (args.path) {
          const safeResult = resolveSafePath(ctx.projectDir, args.path);
          if ("error" in safeResult) {
            return { content: [{ type: "text", text: safeResult.error }] };
          }

          const uri = `file://${safeResult.path}`;
          const diagnostics = await lspClient.getDiagnosticsForFile(safeResult.path, uri);

          return {
            content: [{ type: "text", text: JSON.stringify(diagnostics, null, 2) }],
          };
        }

        // Project-wide: no efficient way to get all diagnostics without opening every file.
        // Return a helpful message suggesting per-file usage.
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: formatError({
                message: "Project-wide diagnostics require specifying a file path.",
                suggestion:
                  "Godot's LSP pushes diagnostics per-file. Use the `path` argument to check specific files, " +
                  "e.g., path: \"scripts/player.gd\". For broad analysis, use `godot_analyze_script` instead — " +
                  "it works without the editor running.",
              }),
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        // Reset client on error so next call reconnects
        lspClient.disconnect();
        lspClient = null;

        return {
          isError: true,
          content: [
            {
              type: "text",
              text: formatError({
                message: `LSP request failed: ${message}`,
                suggestion: "Ensure the Godot editor is running and the project is open.",
              }),
            },
          ],
        };
      }
    }
  );
}
