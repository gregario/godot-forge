import { spawn, type ChildProcess } from "node:child_process";

export interface SpawnResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

/**
 * Spawn a Godot process with argument arrays (never exec with string concat).
 * Returns captured stdout/stderr after process exits.
 */
export function spawnGodot(
  godotPath: string,
  args: string[],
  options: {
    cwd?: string;
    timeout?: number;
  } = {}
): Promise<SpawnResult> {
  const timeout = options.timeout ?? 60_000;

  return new Promise((resolve, reject) => {
    const proc = spawn(godotPath, args, {
      cwd: options.cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let killed = false;

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const timer = setTimeout(() => {
      killed = true;
      proc.kill("SIGTERM");
    }, timeout);

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (killed) {
        reject(new Error(`Godot process timed out after ${timeout}ms`));
      } else {
        resolve({ stdout, stderr, exitCode: code });
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Spawn a long-running Godot process (e.g., running a project).
 * Returns the ChildProcess handle for management.
 */
export function spawnGodotManaged(
  godotPath: string,
  args: string[],
  options: { cwd?: string } = {}
): ChildProcess {
  return spawn(godotPath, args, {
    cwd: options.cwd,
    stdio: ["ignore", "pipe", "pipe"],
  });
}
