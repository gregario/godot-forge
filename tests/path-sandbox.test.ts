import { describe, it, expect } from "vitest";
import { resolveSafePath } from "../src/path-sandbox.js";

const PROJECT_DIR = "/home/user/my-godot-project";

describe("resolveSafePath", () => {
  it("resolves res:// paths", () => {
    const result = resolveSafePath(PROJECT_DIR, "res://scripts/player.gd");
    expect(result).toEqual({ path: "/home/user/my-godot-project/scripts/player.gd" });
  });

  it("resolves relative paths", () => {
    const result = resolveSafePath(PROJECT_DIR, "scripts/player.gd");
    expect(result).toEqual({ path: "/home/user/my-godot-project/scripts/player.gd" });
  });

  it("blocks path traversal with ../", () => {
    const result = resolveSafePath(PROJECT_DIR, "res://../../etc/passwd");
    expect(result).toEqual({ error: "Path traversal detected. All paths must be within the project directory." });
  });

  it("blocks absolute paths outside project", () => {
    const result = resolveSafePath(PROJECT_DIR, "/etc/passwd");
    expect(result).toEqual({ error: "Path traversal detected. All paths must be within the project directory." });
  });

  it("allows nested project paths", () => {
    const result = resolveSafePath(PROJECT_DIR, "res://scenes/ui/main_menu.tscn");
    expect(result).toEqual({ path: "/home/user/my-godot-project/scenes/ui/main_menu.tscn" });
  });
});
