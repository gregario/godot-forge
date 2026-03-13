import { describe, it, expect } from "vitest";

// Test scene/resource parsing patterns

describe(".tscn parsing", () => {
  it("parses node entries", () => {
    const line = '[node name="Player" type="CharacterBody2D" parent="."]';
    const match = line.match(
      /\[node\s+name="([^"]*)"\s+(?:type="([^"]*)"\s+)?(?:parent="([^"]*)")?/
    );
    expect(match).not.toBeNull();
    expect(match![1]).toBe("Player");
    expect(match![2]).toBe("CharacterBody2D");
    expect(match![3]).toBe(".");
  });

  it("parses root node without parent", () => {
    const line = '[node name="Main" type="Node2D"]';
    // Root nodes have type but no parent — regex needs trailing space to be optional
    const match = line.match(
      /\[node\s+name="([^"]*)"\s+(?:type="([^"]*)"\s*)?(?:parent="([^"]*)")?/
    );
    expect(match).not.toBeNull();
    expect(match![1]).toBe("Main");
    expect(match![2]).toBe("Node2D");
    expect(match![3]).toBeUndefined();
  });

  it("parses external resources", () => {
    const line = '[ext_resource type="Script" path="res://scripts/player.gd" id="1"]';
    const typeM = line.match(/type="([^"]*)"/);
    const pathM = line.match(/path="([^"]*)"/);
    const idM = line.match(/id="([^"]*)"/);

    expect(typeM![1]).toBe("Script");
    expect(pathM![1]).toBe("res://scripts/player.gd");
    expect(idM![1]).toBe("1");
  });
});

describe(".tres validation", () => {
  it("detects preload() usage", () => {
    const content = `[gd_resource type="Resource"]
[resource]
data = preload("res://other.tres")`;

    expect(content.includes("preload(")).toBe(true);
  });

  it("detects custom class name in type field", () => {
    const content = '[gd_resource type="BeerStyle" format=3]';
    const headerMatch = content.match(/\[gd_resource\s+type="([^"]*)"/);
    expect(headerMatch).not.toBeNull();

    const builtinTypes = new Set([
      "Resource", "Theme", "StyleBox", "StyleBoxFlat",
      "Font", "Texture2D", "Material", "Animation",
    ]);
    expect(builtinTypes.has(headerMatch![1])).toBe(false);
  });

  it("allows built-in type names", () => {
    const content = '[gd_resource type="Resource" format=3]';
    const headerMatch = content.match(/\[gd_resource\s+type="([^"]*)"/);
    const builtinTypes = new Set(["Resource"]);
    expect(builtinTypes.has(headerMatch![1])).toBe(true);
  });

  it("detects integer resource IDs", () => {
    const content = '[ext_resource type="Script" path="res://script.gd" id=1]';
    expect(content.match(/\[ext_resource\s+[^\]]*id=(\d+)/)).not.toBeNull();
  });

  it("allows uid:// resource IDs", () => {
    const content = '[ext_resource type="Script" uid="uid://abc123" path="res://script.gd" id="1_abc"]';
    expect(content.match(/\[ext_resource\s+[^]]*id=(\d+)/)).toBeNull();
  });
});

describe("Scene antipattern detection", () => {
  it("calculates nesting depth from parent path", () => {
    const parent = "MainScene/UI/Panel/Container/VBox/HBox/Label/Inner";
    const depth = parent.split("/").length;
    expect(depth).toBe(8);
    expect(depth > 8).toBe(false); // exactly 8 is OK

    const deepParent = "A/B/C/D/E/F/G/H/I";
    expect(deepParent.split("/").length).toBe(9);
    expect(deepParent.split("/").length > 8).toBe(true);
  });
});
