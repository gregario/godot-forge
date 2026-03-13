import { resolve, relative, isAbsolute } from "node:path";

/**
 * Resolve a Godot res:// path or relative path to an absolute path
 * within the project directory. Rejects path traversal attempts.
 */
export function resolveSafePath(
  projectDir: string,
  inputPath: string
): { path: string } | { error: string } {
  let resolved: string;

  if (inputPath.startsWith("res://")) {
    // Strip res:// prefix and resolve relative to project dir
    const relative_path = inputPath.slice(6);
    resolved = resolve(projectDir, relative_path);
  } else if (isAbsolute(inputPath)) {
    resolved = inputPath;
  } else {
    resolved = resolve(projectDir, inputPath);
  }

  // Normalise and check containment
  const normalised = resolve(resolved);
  const rel = relative(projectDir, normalised);

  if (rel.startsWith("..") || isAbsolute(rel)) {
    return {
      error:
        "Path traversal detected. All paths must be within the project directory.",
    };
  }

  return { path: normalised };
}
