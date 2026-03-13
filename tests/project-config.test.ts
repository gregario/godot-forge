import { describe, it, expect } from "vitest";

// Test project.godot parsing patterns

describe("project.godot parsing", () => {
  const sampleConfig = `; Engine configuration file.
; It's best edited using the editor UI and not directly.

[application]

config/name="BeerBrew Tycoon"
config/features=PackedStringArray("4.3", "Forward Plus")
run/main_scene="res://scenes/main.tscn"

[autoload]

GameState="*res://autoloads/game_state.gd"
AudioManager="*res://autoloads/audio_manager.gd"
SaveSystem="*res://autoloads/save_system.gd"

[input]

move_left={
"deadzone": 0.5,
"events": [Object(InputEventKey,"resource_local_to_scene":false)]
}
move_right={
"deadzone": 0.5,
"events": [Object(InputEventKey,"resource_local_to_scene":false)]
}`;

  it("extracts project name", () => {
    const match = sampleConfig.match(/config\/name="([^"]*)"/);
    expect(match).not.toBeNull();
    expect(match![1]).toBe("BeerBrew Tycoon");
  });

  it("extracts Godot version from features", () => {
    const featuresMatch = sampleConfig.match(
      /config\/features=PackedStringArray\(([^)]+)\)/
    );
    expect(featuresMatch).not.toBeNull();
    const versionMatch = featuresMatch![1].match(/"(\d+\.\d+)"/);
    expect(versionMatch![1]).toBe("4.3");
  });

  it("extracts autoloads", () => {
    const autoloads: Array<{ name: string; path: string }> = [];
    const lines = sampleConfig.split("\n");
    let inAutoload = false;

    for (const line of lines) {
      if (line.trim() === "[autoload]") {
        inAutoload = true;
        continue;
      }
      if (line.trim().startsWith("[") && inAutoload) {
        inAutoload = false;
        continue;
      }
      if (inAutoload) {
        const kvMatch = line.match(/^([^=]+)=(.+)$/);
        if (kvMatch) {
          const name = kvMatch[1].trim();
          const path = kvMatch[2].trim().replace(/^"?\*?(.*?)"?$/, "$1");
          autoloads.push({ name, path });
        }
      }
    }

    expect(autoloads).toHaveLength(3);
    expect(autoloads[0]).toEqual({ name: "GameState", path: "res://autoloads/game_state.gd" });
    expect(autoloads[1]).toEqual({ name: "AudioManager", path: "res://autoloads/audio_manager.gd" });
    expect(autoloads[2]).toEqual({ name: "SaveSystem", path: "res://autoloads/save_system.gd" });
  });
});
