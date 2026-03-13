import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export interface ProjectConfig {
  name: string;
  godotVersion: string | null;
  autoloads: Array<{ name: string; path: string }>;
  inputActions: Array<{ name: string; events: string[] }>;
}

/**
 * Parse project.godot for key configuration.
 * The file is an INI-like format with [sections].
 */
export function parseProjectGodot(projectDir: string): ProjectConfig | null {
  const configPath = resolve(projectDir, "project.godot");
  if (!existsSync(configPath)) return null;

  const content = readFileSync(configPath, "utf-8");
  const lines = content.split("\n");

  const config: ProjectConfig = {
    name: "Unknown",
    godotVersion: null,
    autoloads: [],
    inputActions: [],
  };

  let currentSection = "";

  for (const line of lines) {
    const trimmed = line.trim();

    // Section header
    const sectionMatch = trimmed.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      continue;
    }

    // Key=value pairs
    const kvMatch = trimmed.match(/^([^=]+)=(.+)$/);
    if (!kvMatch) continue;

    const key = kvMatch[1].trim();
    const value = kvMatch[2].trim();

    if (currentSection === "application") {
      if (key === "config/name") {
        config.name = value.replace(/^"(.*)"$/, "$1");
      }
    }

    if (currentSection === "autoload") {
      // Format: AutoloadName="*res://path/to/script.gd"
      const pathStr = value.replace(/^"?\*?(.*?)"?$/, "$1");
      config.autoloads.push({ name: key, path: pathStr });
    }

    if (currentSection === "input") {
      // Input actions are complex, just capture the action name
      const actionMatch = key.match(/^(.+?)$/);
      if (actionMatch && !config.inputActions.find((a) => a.name === actionMatch[1])) {
        config.inputActions.push({ name: actionMatch[1], events: [] });
      }
    }
  }

  // Try to extract Godot version from config/features
  const featuresMatch = content.match(/config\/features=PackedStringArray\(([^)]+)\)/);
  if (featuresMatch) {
    const versionMatch = featuresMatch[1].match(/"(\d+\.\d+)"/);
    if (versionMatch) {
      config.godotVersion = versionMatch[1];
    }
  }

  return config;
}
