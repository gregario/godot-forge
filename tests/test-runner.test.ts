import { describe, it, expect } from "vitest";
import { stripAnsi } from "../src/ansi.js";

// Test the GUT output parsing logic by testing the patterns directly

describe("GUT output parsing — modern format (GUT 9.x)", () => {
  const REAL_GUT_SUMMARY = `
==============================================
= Run Summary
==============================================

Totals
------
Warnings              5

Scripts              77
Tests              1229
Passing Tests      1229
Asserts            3134
Time              5.201s


---- All tests passed! ----
`;

  it("parses modern GUT summary with Tests/Passing Tests format", () => {
    const output = stripAnsi(REAL_GUT_SUMMARY);

    const testsMatch = output.match(/^Tests\s+(\d+)/m);
    const passingMatch = output.match(/Passing Tests\s+(\d+)/m);

    expect(testsMatch).not.toBeNull();
    expect(testsMatch![1]).toBe("1229");
    expect(passingMatch).not.toBeNull();
    expect(passingMatch![1]).toBe("1229");
  });

  it("parses duration from Time line", () => {
    const output = stripAnsi(REAL_GUT_SUMMARY);
    const durationMatch = output.match(/Time\s+(\d+(?:\.\d+)?)s/m);
    expect(durationMatch).not.toBeNull();
    expect(parseFloat(durationMatch![1])).toBeCloseTo(5.201);
  });

  it("parses failing test summary with Failing Tests line", () => {
    const output = `
Tests               50
Passing Tests       47
Failing Tests        3
Errors               1
Time              2.5s
`;

    const testsMatch = output.match(/^Tests\s+(\d+)/m);
    const passingMatch = output.match(/Passing Tests\s+(\d+)/m);
    const failingMatch = output.match(/Failing Tests\s+(\d+)/m);
    const errorsMatch = output.match(/Errors\s+(\d+)/m);

    expect(testsMatch![1]).toBe("50");
    expect(passingMatch![1]).toBe("47");
    expect(failingMatch![1]).toBe("3");
    expect(errorsMatch![1]).toBe("1");
  });
});

describe("GUT output parsing — legacy format", () => {
  it("parses legacy passed/failed format as fallback", () => {
    const output = `Totals:  passed: 1220 failed: 0`;
    const match = output.match(/passed:\s*(\d+)\s+failed:\s*(\d+)/i);
    expect(match).not.toBeNull();
    expect(match![1]).toBe("1220");
    expect(match![2]).toBe("0");
  });

  it("handles ANSI codes in legacy output", () => {
    const raw = "\x1b[32mpassed: 50\x1b[0m \x1b[31mfailed: 2\x1b[0m";
    const clean = stripAnsi(raw);
    expect(clean).toBe("passed: 50 failed: 2");
    const match = clean.match(/passed:\s*(\d+)\s+failed:\s*(\d+)/i);
    expect(match![1]).toBe("50");
    expect(match![2]).toBe("2");
  });
});

describe("GUT failure extraction", () => {
  it("extracts failure details with file and line", () => {
    const output = `FAILED: test_add_item - Expected 5 but got 3
  at res://tests/test_inventory.gd:42`;

    const failMatch = output.match(/FAILED:\s*(.+?)(?:\s*-\s*(.+))?$/m);
    expect(failMatch).not.toBeNull();
    expect(failMatch![1].trim()).toBe("test_add_item");
    expect(failMatch![2]?.trim()).toBe("Expected 5 but got 3");

    const scriptMatch = output.match(/(res:\/\/[^\s:]+):(\d+)/);
    expect(scriptMatch).not.toBeNull();
    expect(scriptMatch![1]).toBe("res://tests/test_inventory.gd");
    expect(scriptMatch![2]).toBe("42");
  });
});
