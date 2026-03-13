import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTestRunner } from "./tools/test-runner.js";
import { registerDocsSearch } from "./tools/docs-search.js";
import { registerLspDiagnostics } from "./tools/lsp-diagnostics.js";
import { registerSceneAnalysis } from "./tools/scene-analysis.js";
import { registerScriptAnalysis } from "./tools/script-analysis.js";
import { registerProjectRunner } from "./tools/project-runner.js";
import { registerScreenshot } from "./tools/screenshot.js";
import { registerProjectInfo } from "./tools/project-info.js";

export interface ServerContext {
  projectDir: string | null;
  godotBinary: string | null;
}

export function registerTools(server: McpServer, ctx: ServerContext): void {
  registerTestRunner(server, ctx);
  registerDocsSearch(server, ctx);
  registerLspDiagnostics(server, ctx);
  registerSceneAnalysis(server, ctx);
  registerScriptAnalysis(server, ctx);
  registerProjectRunner(server, ctx);
  registerScreenshot(server, ctx);
  registerProjectInfo(server, ctx);
}
