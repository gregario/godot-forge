import { existsSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

/**
 * Scan a directory for executables matching a pattern.
 * Returns the first match, preferring higher version numbers.
 */
function findGodotInDir(dir: string, pattern: RegExp): string | null {
  try {
    const entries = readdirSync(dir);
    // Sort descending so higher versions come first (Godot_v4.6 before Godot_v4.5)
    const matches = entries
      .filter((name) => pattern.test(name))
      .sort()
      .reverse();
    for (const name of matches) {
      const fullPath = join(dir, name);
      if (existsSync(fullPath)) return fullPath;
    }
  } catch {
    // directory not readable
  }
  return null;
}

/**
 * Find the Godot 4.x binary across all common installation methods.
 *
 * Search order:
 *   1. GODOT_PATH environment variable (explicit override)
 *   2. PATH lookup (godot, godot4)
 *   3. Steam installations (most common for game devs)
 *   4. Platform-specific default paths (brew, direct download, package managers)
 */
export function findGodotBinary(): string | null {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "";

  // 1. GODOT_PATH environment variable — explicit override always wins
  const envPath = process.env.GODOT_PATH;
  if (envPath && existsSync(envPath)) {
    return envPath;
  }

  // 2. PATH lookup
  const pathCommand = process.platform === "win32" ? "where" : "which";
  for (const name of ["godot", "godot4"]) {
    try {
      const result = execFileSync(pathCommand, [name], {
        encoding: "utf-8",
        timeout: 5000,
      }).trim();
      // 'where' on Windows returns multiple lines; take the first
      const firstLine = result.split("\n")[0].trim();
      if (firstLine && existsSync(firstLine)) {
        return firstLine;
      }
    } catch {
      // not found in PATH
    }
  }

  // 3. Platform-specific paths (including Steam)
  const platform = process.platform;

  if (platform === "darwin") {
    return findGodotMacOS(home);
  }

  if (platform === "win32") {
    return findGodotWindows(home);
  }

  if (platform === "linux") {
    return findGodotLinux(home);
  }

  return null;
}

function findGodotMacOS(home: string): string | null {
  // Steam installation
  const steamPath = join(
    home,
    "Library/Application Support/Steam/steamapps/common/Godot Engine/Godot.app/Contents/MacOS/Godot"
  );
  if (existsSync(steamPath)) return steamPath;

  // Check both /Applications and ~/Applications for .app bundles
  for (const appsDir of ["/Applications", join(home, "Applications")]) {
    // Fixed known names first
    for (const appName of ["Godot.app", "Godot_v4.app", "Godot Engine.app"]) {
      const p = join(appsDir, appName, "Contents/MacOS/Godot");
      if (existsSync(p)) return p;
    }

    // Scan for any Godot*.app (handles versioned names like "Godot_v4.3.app")
    try {
      const apps = readdirSync(appsDir).filter(
        (name) => name.startsWith("Godot") && name.endsWith(".app")
      );
      for (const app of apps) {
        const p = join(appsDir, app, "Contents/MacOS/Godot");
        if (existsSync(p)) return p;
      }
    } catch {
      // directory not readable
    }
  }

  return null;
}

function findGodotWindows(home: string): string | null {
  const programFiles = process.env.PROGRAMFILES ?? "C:\\Program Files";
  const programFilesX86 = process.env["PROGRAMFILES(X86)"] ?? "C:\\Program Files (x86)";
  const localAppData = process.env.LOCALAPPDATA ?? join(home, "AppData", "Local");
  const appData = process.env.APPDATA ?? join(home, "AppData", "Roaming");

  // Steam installation (most common for game devs)
  const steamDirs = [
    join(programFilesX86, "Steam", "steamapps", "common", "Godot Engine"),
    join(programFiles, "Steam", "steamapps", "common", "Godot Engine"),
    // Common custom Steam library locations
    join("D:", "Steam", "steamapps", "common", "Godot Engine"),
    join("D:", "SteamLibrary", "steamapps", "common", "Godot Engine"),
  ];

  for (const dir of steamDirs) {
    // Steam may have Godot.exe or versioned names
    const found = findGodotInDir(dir, /^Godot.*\.exe$/i);
    if (found) return found;
  }

  // Fixed paths — direct installs, package managers
  const fixedPaths = [
    join(programFiles, "Godot", "Godot.exe"),
    join(programFiles, "Godot", "Godot_v4.exe"),
    join(programFiles, "Godot Engine", "Godot.exe"),
    join(localAppData, "Godot", "Godot.exe"),
    join(localAppData, "Programs", "GodotEngine", "Godot", "Godot.exe"),
    // Scoop
    join(home, "scoop", "apps", "godot", "current", "godot.exe"),
    // Chocolatey
    join("C:", "ProgramData", "chocolatey", "lib", "godot", "tools", "Godot.exe"),
  ];

  for (const p of fixedPaths) {
    if (existsSync(p)) return p;
  }

  // Scan common directories for versioned executables (Godot_v4.6.1-stable_win64.exe)
  const scanDirs = [
    join(programFiles, "Godot"),
    join(localAppData, "Godot"),
    join(home, "Downloads"),
  ];

  for (const dir of scanDirs) {
    const found = findGodotInDir(dir, /^Godot_v4[^.]*\.exe$/i);
    if (found) return found;
  }

  return null;
}

function findGodotLinux(home: string): string | null {
  const xdgData = process.env.XDG_DATA_HOME ?? join(home, ".local", "share");

  // Steam installation
  const steamDirs = [
    join(home, ".local/share/Steam/steamapps/common/Godot Engine"),
    join(home, ".steam/steam/steamapps/common/Godot Engine"),
  ];

  for (const dir of steamDirs) {
    // Linux Steam binaries may be versioned (Godot_v4.6.1-stable_linux.x86_64)
    const found = findGodotInDir(dir, /^Godot/i);
    if (found) return found;
  }

  // Standard paths
  const fixedPaths = [
    "/usr/bin/godot",
    "/usr/bin/godot4",
    "/usr/local/bin/godot",
    "/usr/local/bin/godot4",
    join(home, ".local/bin/godot"),
    join(home, ".local/bin/godot4"),
    // Flatpak (system and user)
    "/var/lib/flatpak/exports/bin/org.godotengine.Godot",
    join(home, ".local/share/flatpak/exports/bin/org.godotengine.Godot"),
    // Snap
    "/snap/bin/godot",
    "/snap/bin/godot-4",
  ];

  for (const p of fixedPaths) {
    if (existsSync(p)) return p;
  }

  return null;
}
