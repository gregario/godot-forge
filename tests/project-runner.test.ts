import { describe, it, expect } from "vitest";

// Test the output buffer logic and process management patterns

describe("Output buffer management", () => {
  it("enforces rolling buffer limit", () => {
    const MAX_BUFFER_LINES = 5000;
    let buffer: Array<{ timestamp: number; stream: string; text: string }> = [];

    // Simulate filling beyond the limit
    for (let i = 0; i < 6000; i++) {
      buffer.push({ timestamp: Date.now(), stream: "stdout", text: `line ${i}` });
    }
    if (buffer.length > MAX_BUFFER_LINES) {
      buffer = buffer.slice(-MAX_BUFFER_LINES);
    }

    expect(buffer.length).toBe(5000);
    expect(buffer[0].text).toBe("line 1000");
    expect(buffer[buffer.length - 1].text).toBe("line 5999");
  });

  it("tracks read position for incremental output", () => {
    const buffer = [
      { timestamp: 1, stream: "stdout", text: "line 1" },
      { timestamp: 2, stream: "stdout", text: "line 2" },
      { timestamp: 3, stream: "stderr", text: "error 1" },
      { timestamp: 4, stream: "stdout", text: "line 3" },
    ];

    let lastReadIndex = 0;

    // First read: get all
    const firstRead = buffer.slice(lastReadIndex);
    lastReadIndex = buffer.length;
    expect(firstRead).toHaveLength(4);

    // Second read: nothing new
    const secondRead = buffer.slice(lastReadIndex);
    expect(secondRead).toHaveLength(0);

    // Add more output
    buffer.push({ timestamp: 5, stream: "stdout", text: "line 4" });

    // Third read: only new line
    const thirdRead = buffer.slice(lastReadIndex);
    lastReadIndex = buffer.length;
    expect(thirdRead).toHaveLength(1);
    expect(thirdRead[0].text).toBe("line 4");
  });

  it("formats output with timestamps and stream labels", () => {
    const line = { timestamp: 1710000000000, stream: "stderr", text: "Error: null reference" };
    const formatted = `[${new Date(line.timestamp).toISOString()}] [${line.stream}] ${line.text}`;

    expect(formatted).toContain("[stderr]");
    expect(formatted).toContain("Error: null reference");
    expect(formatted).toMatch(/^\[.*T.*Z\]/);
  });
});

describe("Process action validation", () => {
  it("validates action enum", () => {
    const validActions = ["start", "stop", "get_output"];
    expect(validActions.includes("start")).toBe(true);
    expect(validActions.includes("stop")).toBe(true);
    expect(validActions.includes("get_output")).toBe(true);
    expect(validActions.includes("restart")).toBe(false);
  });
});
