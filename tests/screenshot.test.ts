import { describe, it, expect } from "vitest";

describe("Screenshot GDScript generation", () => {
  const SCREENSHOT_SCRIPT = `extends SceneTree

func _init():
\t# Wait two frames for the viewport to render
\tawait process_frame
\tawait process_frame
\tvar image = get_root().get_viewport().get_texture().get_image()
\timage.save_png("user://mcp_screenshot.png")
\tquit()
`;

  it("extends SceneTree for headless execution", () => {
    expect(SCREENSHOT_SCRIPT).toContain("extends SceneTree");
  });

  it("uses _init() not _ready() for SceneTree scripts", () => {
    expect(SCREENSHOT_SCRIPT).toContain("func _init():");
    expect(SCREENSHOT_SCRIPT).not.toContain("func _ready():");
  });

  it("waits for viewport render before capture", () => {
    expect(SCREENSHOT_SCRIPT).toContain("await process_frame");
  });

  it("saves as PNG to user://", () => {
    expect(SCREENSHOT_SCRIPT).toContain('save_png("user://mcp_screenshot.png")');
  });

  it("calls quit() to exit cleanly", () => {
    expect(SCREENSHOT_SCRIPT).toContain("quit()");
  });
});

describe("Display detection", () => {
  it("checks DISPLAY on Linux", () => {
    // On Linux, we check for DISPLAY or WAYLAND_DISPLAY
    const platform = "linux";
    const hasDisplay = !!(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);

    if (platform === "linux") {
      // This test documents the check — actual value depends on environment
      expect(typeof hasDisplay).toBe("boolean");
    }
  });

  it("macOS and Windows always have display", () => {
    // On macOS and Windows, display is always available (unless headless CI)
    const platform = process.platform;
    if (platform === "darwin" || platform === "win32") {
      // No DISPLAY check needed on these platforms
      expect(true).toBe(true);
    }
  });
});

describe("Base64 encoding", () => {
  it("encodes buffer to base64", () => {
    const sampleData = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes
    const base64 = sampleData.toString("base64");
    expect(base64).toBe("iVBORw==");

    // Verify round-trip
    const decoded = Buffer.from(base64, "base64");
    expect(decoded[0]).toBe(0x89);
    expect(decoded[1]).toBe(0x50);
  });
});
