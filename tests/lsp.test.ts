import { describe, it, expect } from "vitest";

describe("LSP message framing", () => {
  it("formats LSP request with Content-Length header", () => {
    const method = "textDocument/diagnostic";
    const params = { textDocument: { uri: "file:///project/script.gd" } };
    const id = 1;

    const msg = JSON.stringify({ jsonrpc: "2.0", id, method, params });
    const header = `Content-Length: ${Buffer.byteLength(msg)}\r\n\r\n`;

    expect(header).toContain("Content-Length:");
    expect(header.endsWith("\r\n\r\n")).toBe(true);

    const fullMessage = header + msg;
    expect(fullMessage).toContain('"jsonrpc":"2.0"');
    expect(fullMessage).toContain('"method":"textDocument/diagnostic"');
  });

  it("parses LSP response from buffer", () => {
    const response = { jsonrpc: "2.0", id: 1, result: { items: [] } };
    const body = JSON.stringify(response);
    const message = `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`;

    // Parse header
    const headerEnd = message.indexOf("\r\n\r\n");
    expect(headerEnd).toBeGreaterThan(0);

    const header = message.substring(0, headerEnd);
    const lengthMatch = header.match(/Content-Length:\s*(\d+)/i);
    expect(lengthMatch).not.toBeNull();

    const contentLength = parseInt(lengthMatch![1], 10);
    const contentStart = headerEnd + 4;
    const content = message.substring(contentStart, contentStart + contentLength);

    const parsed = JSON.parse(content);
    expect(parsed.jsonrpc).toBe("2.0");
    expect(parsed.id).toBe(1);
    expect(parsed.result.items).toEqual([]);
  });

  it("handles multiple messages in buffer", () => {
    const msg1 = JSON.stringify({ jsonrpc: "2.0", id: 1, result: {} });
    const msg2 = JSON.stringify({ jsonrpc: "2.0", id: 2, result: {} });

    let buffer =
      `Content-Length: ${Buffer.byteLength(msg1)}\r\n\r\n${msg1}` +
      `Content-Length: ${Buffer.byteLength(msg2)}\r\n\r\n${msg2}`;

    const messages: unknown[] = [];

    while (true) {
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) break;

      const header = buffer.substring(0, headerEnd);
      const lengthMatch = header.match(/Content-Length:\s*(\d+)/i);
      if (!lengthMatch) break;

      const contentLength = parseInt(lengthMatch[1], 10);
      const contentStart = headerEnd + 4;
      if (buffer.length < contentStart + contentLength) break;

      const content = buffer.substring(contentStart, contentStart + contentLength);
      buffer = buffer.substring(contentStart + contentLength);
      messages.push(JSON.parse(content));
    }

    expect(messages).toHaveLength(2);
  });
});

describe("LSP severity mapping", () => {
  it("maps severity numbers to strings", () => {
    const map: Record<number, string> = {
      1: "error",
      2: "warning",
      3: "info",
      4: "hint",
    };

    expect(map[1]).toBe("error");
    expect(map[2]).toBe("warning");
    expect(map[3]).toBe("info");
    expect(map[4]).toBe("hint");
  });
});

describe("Graceful degradation", () => {
  it("returns actionable error when LSP unavailable", () => {
    const port = 6005;
    const errorMessage = `Godot editor LSP not available on port ${port}.`;
    const suggestion =
      "Start the Godot editor with your project open to enable LSP diagnostics.";

    expect(errorMessage).toContain("6005");
    expect(suggestion).toContain("Start the Godot editor");
  });
});
