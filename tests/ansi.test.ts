import { describe, it, expect } from "vitest";
import { stripAnsi } from "../src/ansi.js";

describe("stripAnsi", () => {
  it("strips colour codes from GUT output", () => {
    const input = "\x1b[32mPassed\x1b[0m: test_add_item";
    expect(stripAnsi(input)).toBe("Passed: test_add_item");
  });

  it("strips multiple escape sequences", () => {
    const input = "\x1b[1m\x1b[31mFAILED\x1b[0m: test_remove - expected 5 got 3";
    expect(stripAnsi(input)).toBe("FAILED: test_remove - expected 5 got 3");
  });

  it("leaves plain text unchanged", () => {
    const input = "All 1220 tests passed";
    expect(stripAnsi(input)).toBe("All 1220 tests passed");
  });

  it("strips OSC sequences", () => {
    const input = "\x1b]0;Godot\x07Output line";
    expect(stripAnsi(input)).toBe("Output line");
  });
});
