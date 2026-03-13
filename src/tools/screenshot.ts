import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readFileSync, existsSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve, join } from "node:path";
import type { ServerContext } from "../register-tools.js";
import { formatError, godotNotFound, projectNotFound } from "../errors.js";
import { spawnGodot } from "../spawn-godot.js";
import { parseProjectGodot } from "../project-config.js";

/**
 * Generate a GDScript that loads a scene, waits for it to render, and captures the viewport.
 * Uses SceneTree._init() to change to the target scene, then waits several frames
 * for the scene to fully initialise and render before capturing.
 */
function makeScreenshotScript(scenePath: string | null): string {
  // If no scene specified, we capture whatever the project's main scene is.
  // We do this by not calling change_scene and letting the project run normally.
  const loadScene = scenePath
    ? `\tchange_scene_to_file("${scenePath}")`
    : "\t# Using project's main scene (run/main_scene from project.godot)";

  return `extends SceneTree

func _init():
${loadScene}
	# Wait for the scene tree to settle and render
	for i in 10:
		await process_frame
	var image = get_root().get_viewport().get_texture().get_image()
	image.save_png("user://mcp_screenshot.png")
	quit()
`;
}

/**
 * Resolve Godot's user:// path for a project.
 * See: https://docs.godotengine.org/en/stable/tutorials/io/data_paths.html
 */
function getUserDataPaths(projectDir: string, projectName: string): string[] {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
  const paths: string[] = [];

  switch (process.platform) {
    case "darwin":
      // macOS: ~/Library/Application Support/Godot/app_userdata/<project_name>/
      paths.push(
        join(home, "Library", "Application Support", "Godot", "app_userdata", projectName, "mcp_screenshot.png")
      );
      break;

    case "win32":
      // Windows: %APPDATA%\Godot\app_userdata\<project_name>\
      const appData = process.env.APPDATA ?? join(home, "AppData", "Roaming");
      paths.push(
        join(appData, "Godot", "app_userdata", projectName, "mcp_screenshot.png")
      );
      break;

    case "linux":
      // Linux: ~/.local/share/godot/app_userdata/<project_name>/
      const xdgData = process.env.XDG_DATA_HOME ?? join(home, ".local", "share");
      paths.push(
        join(xdgData, "godot", "app_userdata", projectName, "mcp_screenshot.png")
      );
      break;
  }

  // Fallback: check project directory itself
  paths.push(resolve(projectDir, "mcp_screenshot.png"));
  paths.push(resolve(projectDir, ".godot", "mcp_screenshot.png"));

  return paths;
}

export function registerScreenshot(server: McpServer, ctx: ServerContext): void {
  server.tool(
    "godot_screenshot",
    "Capture a viewport screenshot from the running Godot project. Returns base64-encoded PNG image. Requires a display server (not headless mode).",
    {
      scene: z
        .string()
        .optional()
        .describe("Scene to capture (e.g., res://scenes/main.tscn). If omitted, captures the project's main scene."),
    },
    { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    async (args) => {
      if (!ctx.projectDir) {
        return { content: [{ type: "text", text: formatError(projectNotFound()) }] };
      }
      if (!ctx.godotBinary) {
        return { content: [{ type: "text", text: formatError(godotNotFound()) }] };
      }

      // Check for display availability
      if (process.platform === "linux" && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
        return {
          content: [
            {
              type: "text",
              text: formatError({
                message: "No display server available.",
                suggestion:
                  "Screenshot requires a display server. Run Godot with a display (not --headless) " +
                  "or use a virtual framebuffer (Xvfb on Linux).",
              }),
            },
          ],
        };
      }

      // Get project config for name (user:// path) and main scene
      const config = parseProjectGodot(ctx.projectDir);
      const projectName = config?.name ?? "unnamed project";

      // Determine which scene to capture
      let scenePath = args.scene ?? null;
      if (!scenePath) {
        // Read main scene from project.godot
        const projFile = resolve(ctx.projectDir, "project.godot");
        if (existsSync(projFile)) {
          const projContent = readFileSync(projFile, "utf-8");
          const mainSceneMatch = projContent.match(/run\/main_scene\s*=\s*"([^"]+)"/);
          if (mainSceneMatch) {
            scenePath = mainSceneMatch[1];
          }
        }
      }

      if (!scenePath) {
        return {
          content: [
            {
              type: "text",
              text: formatError({
                message: "No scene specified and no main scene found in project.godot.",
                suggestion: "Specify a scene path, e.g., scene: \"res://scenes/main.tscn\"",
              }),
            },
          ],
        };
      }

      try {
        // Generate and write temporary screenshot script
        const scriptPath = resolve(ctx.projectDir, ".mcp_screenshot.gd");
        writeFileSync(scriptPath, makeScreenshotScript(scenePath));

        try {
          const godotArgs = [
            "--path",
            ctx.projectDir,
            "-s",
            "res://.mcp_screenshot.gd",
          ];

          await spawnGodot(ctx.godotBinary, godotArgs, {
            cwd: ctx.projectDir,
            timeout: 15_000,
          });

          // Find the screenshot in user:// resolved paths
          const possiblePaths = getUserDataPaths(ctx.projectDir, projectName);

          let screenshotPath: string | null = null;
          for (const p of possiblePaths) {
            if (existsSync(p)) {
              screenshotPath = p;
              break;
            }
          }

          if (!screenshotPath) {
            return {
              content: [
                {
                  type: "text",
                  text: formatError({
                    message: "Screenshot captured but output file not found.",
                    suggestion:
                      `Checked user:// paths for project "${projectName}". ` +
                      "Verify the project name in project.godot matches the app_userdata directory. " +
                      `Paths checked: ${possiblePaths.join(", ")}`,
                  }),
                },
              ],
            };
          }

          const imageData = readFileSync(screenshotPath);
          const base64 = imageData.toString("base64");

          // Clean up screenshot file
          try { unlinkSync(screenshotPath); } catch { /* best effort */ }

          return {
            content: [
              {
                type: "image",
                data: base64,
                mimeType: "image/png",
              },
            ],
          };
        } finally {
          // Clean up temp script
          try { unlinkSync(scriptPath); } catch { /* best effort */ }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return {
          content: [
            {
              type: "text",
              text: formatError({
                message: `Screenshot capture failed: ${message}`,
                suggestion:
                  "Ensure Godot is installed and a display server is available. " +
                  "The project must be able to render to a viewport.",
              }),
            },
          ],
        };
      }
    }
  );
}
