import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Regression test for the bundled API docs.
 *
 * In v0.1.3 and earlier, src/data/godot-docs.json did not exist and was
 * never copied into the published tarball, so godot_search_docs returned
 * "No results found" for every Godot 4 class. This test guards against
 * the data ever going missing again.
 */
describe("bundled Godot 4 API docs (src/data/godot-docs.json)", () => {
  const jsonPath = resolve(__dirname, "..", "src", "data", "godot-docs.json");

  it("exists in src/data/", () => {
    expect(existsSync(jsonPath)).toBe(true);
  });

  it("contains a non-trivial number of classes", () => {
    const raw = readFileSync(jsonPath, "utf-8");
    const docs = JSON.parse(raw) as Record<string, unknown>;
    // Godot 4 has ~800-900 documented classes; if we're under 500, something is wrong.
    expect(Object.keys(docs).length).toBeGreaterThan(500);
  });

  it("contains the Godot-4-native classes that AI tools most commonly query", () => {
    const docs = JSON.parse(readFileSync(jsonPath, "utf-8")) as Record<
      string,
      { name: string; methods: Array<{ name: string }>; properties: Array<{ name: string }> }
    >;

    // CharacterBody3D is the Godot 4 replacement for KinematicBody —
    // it's the canonical example of "you should NOT see the migration message for this".
    const cb3d = docs.CharacterBody3D;
    expect(cb3d).toBeDefined();
    expect(cb3d.name).toBe("CharacterBody3D");
    expect(cb3d.methods.some((m) => m.name === "move_and_slide")).toBe(true);
    expect(cb3d.properties.some((p) => p.name === "velocity")).toBe(true);

    // Other commonly-searched 4.x classes
    expect(docs.Node3D).toBeDefined();
    expect(docs.Node2D).toBeDefined();
    expect(docs.CharacterBody2D).toBeDefined();
    expect(docs.RigidBody3D).toBeDefined();
  });
});
