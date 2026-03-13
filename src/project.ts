import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";

export function resolveProjectDir(): string | null {
  // 1. CLI argument: --project <path>
  const projectArgIndex = process.argv.indexOf("--project");
  if (projectArgIndex !== -1 && process.argv[projectArgIndex + 1]) {
    const dir = resolve(process.argv[projectArgIndex + 1]);
    if (existsSync(resolve(dir, "project.godot"))) {
      return dir;
    }
    console.error(`No project.godot found at: ${dir}`);
    return null;
  }

  // 2. Environment variable
  const envPath = process.env.GODOT_PROJECT_PATH;
  if (envPath) {
    const dir = resolve(envPath);
    if (existsSync(resolve(dir, "project.godot"))) {
      return dir;
    }
    console.error(`No project.godot found at GODOT_PROJECT_PATH: ${dir}`);
    return null;
  }

  // 3. Walk up from cwd
  let current = process.cwd();
  while (true) {
    if (existsSync(resolve(current, "project.godot"))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return null;
}
