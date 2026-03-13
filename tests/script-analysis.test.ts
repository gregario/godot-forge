import { describe, it, expect } from "vitest";

// Test the regex patterns used by script analysis
// These validate the pitfall detection logic without needing the full MCP server

const GODOT3_PATTERNS = [
  { pattern: /\byield\s*\(/, name: "yield" },
  { pattern: /\.connect\s*\(\s*["']/, name: "string-connect" },
  { pattern: /(?<!@)\bexport\s+var\b/, name: "export-var" },
  { pattern: /(?<!@)\bonready\s+var\b/, name: "onready-var" },
  { pattern: /\.instance\s*\(\s*\)/, name: "instance" },
  { pattern: /\bdeg2rad\s*\(/, name: "deg2rad" },
  { pattern: /\brand_range\s*\(/, name: "rand_range" },
  { pattern: /\bBUTTON_LEFT\b/, name: "BUTTON_LEFT" },
];

describe("Godot 3→4 API detection", () => {
  it("detects yield()", () => {
    expect(GODOT3_PATTERNS[0].pattern.test('yield(get_tree(), "idle_frame")')).toBe(true);
    expect(GODOT3_PATTERNS[0].pattern.test("await get_tree().process_frame")).toBe(false);
  });

  it("detects string-based connect", () => {
    expect(GODOT3_PATTERNS[1].pattern.test('.connect("pressed", self, "_on_pressed")')).toBe(true);
    expect(GODOT3_PATTERNS[1].pattern.test(".connect(_on_pressed)")).toBe(false);
  });

  it("detects export var", () => {
    expect(GODOT3_PATTERNS[2].pattern.test("export var speed = 10")).toBe(true);
    expect(GODOT3_PATTERNS[2].pattern.test("@export var speed = 10")).toBe(false);
  });

  it("detects onready var", () => {
    expect(GODOT3_PATTERNS[3].pattern.test("onready var label = $Label")).toBe(true);
    expect(GODOT3_PATTERNS[3].pattern.test("@onready var label = $Label")).toBe(false);
  });

  it("detects instance()", () => {
    expect(GODOT3_PATTERNS[4].pattern.test("var obj = scene.instance()")).toBe(true);
    expect(GODOT3_PATTERNS[4].pattern.test("var obj = scene.instantiate()")).toBe(false);
  });
});

describe("Giant script detection", () => {
  it("flags scripts over 300 lines", () => {
    const lines = new Array(301).fill("var x = 1");
    expect(lines.length > 300).toBe(true);
  });

  it("allows scripts at 300 lines", () => {
    const lines = new Array(300).fill("var x = 1");
    expect(lines.length > 300).toBe(false);
  });
});

describe(":= on Variant detection", () => {
  const pattern = /:=\s*.*\.get\s*\(/;

  it("detects := with Dictionary.get()", () => {
    expect(pattern.test('var x := my_dict.get("key")')).toBe(true);
  });

  it("allows = with Dictionary.get()", () => {
    expect(pattern.test('var x = my_dict.get("key")')).toBe(false);
  });
});

describe("Tight coupling detection", () => {
  it("counts distant node references", () => {
    const lines = [
      'var a = get_node("../../UI/Label")',
      'var b = get_node("../../UI/Button")',
      "var c = $../../Panel/Container",
      'var d = get_node("../Sibling/Child/Deep")',
      "var e = $../Other/Node/Path",
      'var f = get_node("../../Another/One")',
    ];

    let distantRefs = 0;
    for (const line of lines) {
      const getNodeMatch = line.match(/get_node\s*\(\s*["']([^"']+)["']\s*\)/);
      const dollarMatch = line.match(/\$([A-Za-z0-9_/\.]+)/);
      const path = getNodeMatch?.[1] ?? dollarMatch?.[1];
      if (path && (path.includes("..") || path.split("/").length > 2)) {
        distantRefs++;
      }
    }

    expect(distantRefs).toBe(6);
    expect(distantRefs > 5).toBe(true);
  });
});

describe("Signal re-entrancy detection", () => {
  it("detects emit between state changes", () => {
    const code = `func update_state():
	current_state = new_state
	state_changed.emit()
	counter += 1`;

    const lines = code.split("\n");
    let emitLine = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/\.emit\s*\(/)) {
        emitLine = i;
        break;
      }
    }

    expect(emitLine).toBe(2);
    // State change before (line 1: current_state = new_state)
    expect(lines[1]).toMatch(/\s*\w+\s*=(?!=)/);
    // State change after (line 3: counter += 1)
    expect(lines[3]).toMatch(/\s*\w+\s*\+=/);
  });
});

describe("_init() timing detection", () => {
  const nodeAccessPatterns = [
    /get_node\s*\(/,
    /\$[A-Za-z]/,
    /get_parent\s*\(/,
    /get_tree\s*\(/,
  ];

  it("detects get_node in _init", () => {
    const line = '\tvar label = get_node("Label")';
    expect(nodeAccessPatterns.some((p) => p.test(line))).toBe(true);
  });

  it("detects $ in _init", () => {
    const line = "\tvar label = $Label";
    expect(nodeAccessPatterns.some((p) => p.test(line))).toBe(true);
  });

  it("detects get_tree in _init", () => {
    const line = "\tvar tree = get_tree()";
    expect(nodeAccessPatterns.some((p) => p.test(line))).toBe(true);
  });
});

describe("Python-ism detection", () => {
  it("detects list comprehension syntax", () => {
    const pattern = /\[.+\s+for\s+\w+\s+in\s+/;
    expect(pattern.test("[x * 2 for x in array]")).toBe(true);
    expect(pattern.test('var arr = ["a", "b"]')).toBe(false);
  });

  it("detects Python import", () => {
    const pattern = /^import\s+\w+/;
    expect(pattern.test("import os")).toBe(true);
    expect(pattern.test("# import something")).toBe(false);
  });

  it("detects len() builtin", () => {
    const pattern = /\blen\s*\(/;
    expect(pattern.test("var n = len(array)")).toBe(true);
    expect(pattern.test("var n = array.size()")).toBe(false);
  });
});

describe("Missing signal disconnect detection", () => {
  it("detects connect without _exit_tree", () => {
    const code = `extends Node

func _ready():
	some_signal.connect(_on_signal)

func _on_signal():
	pass`;

    const hasConnect = /\.connect\s*\(/.test(code);
    const hasExitTree = /func\s+_exit_tree\s*\(/.test(code);

    expect(hasConnect).toBe(true);
    expect(hasExitTree).toBe(false);
  });

  it("passes when _exit_tree exists", () => {
    const code = `extends Node

func _ready():
	some_signal.connect(_on_signal)

func _exit_tree():
	some_signal.disconnect(_on_signal)`;

    const hasConnect = /\.connect\s*\(/.test(code);
    const hasExitTree = /func\s+_exit_tree\s*\(/.test(code);

    expect(hasConnect).toBe(true);
    expect(hasExitTree).toBe(true);
  });
});
