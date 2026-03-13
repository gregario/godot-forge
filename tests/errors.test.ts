import { describe, it, expect } from "vitest";
import { formatError, godotNotFound, projectNotFound } from "../src/errors.js";

describe("Structured error responses", () => {
  it("formats errors with message and suggestion", () => {
    const result = formatError({
      message: "File not found",
      suggestion: "Check the file path",
    });
    expect(result).toContain("File not found");
    expect(result).toContain("Suggestion: Check the file path");
  });

  it("godotNotFound returns platform-specific suggestion", () => {
    const err = godotNotFound();
    expect(err.message).toBe("Godot binary not found.");
    expect(err.suggestion).toContain("GODOT_PATH");
  });

  it("projectNotFound returns actionable message", () => {
    const err = projectNotFound();
    expect(err.message).toBe("No Godot project found.");
    expect(err.suggestion).toContain("--project");
    expect(err.suggestion).toContain("GODOT_PROJECT_PATH");
  });
});
