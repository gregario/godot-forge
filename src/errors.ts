export interface ToolError {
  message: string;
  suggestion: string;
  context?: Record<string, unknown>;
}

export function formatError(err: ToolError): string {
  let text = err.message;
  if (err.suggestion) {
    text += `\n\nSuggestion: ${err.suggestion}`;
  }
  return text;
}

export function godotNotFound(): ToolError {
  const platform = process.platform;
  let suggestion = "Set GODOT_PATH environment variable to your Godot 4.x binary path.";
  if (platform === "darwin") {
    suggestion += " On macOS, install from https://godotengine.org or brew install godot.";
  } else if (platform === "linux") {
    suggestion += " On Linux, install from https://godotengine.org, Flatpak, or Snap.";
  } else if (platform === "win32") {
    suggestion += " On Windows, install from https://godotengine.org, Scoop, or Chocolatey.";
  }
  return {
    message: "Godot binary not found.",
    suggestion,
    context: { platform, searchedEnv: "GODOT_PATH" },
  };
}

export function projectNotFound(): ToolError {
  return {
    message: "No Godot project found.",
    suggestion:
      "Ensure the MCP server is configured with the correct project path. " +
      "Use --project <path>, set GODOT_PROJECT_PATH, or run from within a Godot project directory.",
  };
}
