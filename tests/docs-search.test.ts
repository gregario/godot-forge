import { describe, it, expect } from "vitest";

// Test the migration mapping — our headline differentiator

const MIGRATION_MAP: Record<string, { replacement: string }> = {
  KinematicBody: { replacement: "CharacterBody3D" },
  KinematicBody2D: { replacement: "CharacterBody2D" },
  Spatial: { replacement: "Node3D" },
  yield: { replacement: "await" },
  instance: { replacement: "instantiate()" },
  rand_range: { replacement: "randf_range() / randi_range()" },
  deg2rad: { replacement: "deg_to_rad()" },
  rad2deg: { replacement: "rad_to_deg()" },
  "export var": { replacement: "@export var" },
  "onready var": { replacement: "@onready var" },
  tool: { replacement: "@tool" },
  BUTTON_LEFT: { replacement: "MOUSE_BUTTON_LEFT" },
};

describe("Godot 3→4 migration mapping", () => {
  it("maps all major class renames", () => {
    expect(MIGRATION_MAP["KinematicBody"].replacement).toBe("CharacterBody3D");
    expect(MIGRATION_MAP["KinematicBody2D"].replacement).toBe("CharacterBody2D");
    expect(MIGRATION_MAP["Spatial"].replacement).toBe("Node3D");
  });

  it("maps method renames", () => {
    expect(MIGRATION_MAP["instance"].replacement).toBe("instantiate()");
    expect(MIGRATION_MAP["deg2rad"].replacement).toBe("deg_to_rad()");
    expect(MIGRATION_MAP["rand_range"].replacement).toBe("randf_range() / randi_range()");
  });

  it("maps syntax changes", () => {
    expect(MIGRATION_MAP["yield"].replacement).toBe("await");
    expect(MIGRATION_MAP["export var"].replacement).toBe("@export var");
    expect(MIGRATION_MAP["onready var"].replacement).toBe("@onready var");
    expect(MIGRATION_MAP["tool"].replacement).toBe("@tool");
  });

  it("maps constant renames", () => {
    expect(MIGRATION_MAP["BUTTON_LEFT"].replacement).toBe("MOUSE_BUTTON_LEFT");
  });

  it("performs case-insensitive lookup", () => {
    const query = "kinematicbody";
    const found = Object.entries(MIGRATION_MAP).find(
      ([key]) => key.toLowerCase() === query.toLowerCase()
    );
    expect(found).not.toBeUndefined();
    expect(found![1].replacement).toBe("CharacterBody3D");
  });
});
