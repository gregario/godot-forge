#!/usr/bin/env node
/**
 * Build script to extract Godot 4.x API docs from --doctool XML output
 * into compressed JSON for bundling with the npm package.
 *
 * Usage:
 *   npx ts-node scripts/build-docs.ts [godot-binary-path]
 *
 * If no path is provided, it tries to find Godot via the same
 * auto-detection used by the server.
 *
 * Output: src/data/godot-docs.json
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";

interface ClassDoc {
  name: string;
  description: string;
  inherits: string;
  properties: Array<{ name: string; type: string; description: string }>;
  methods: Array<{ name: string; signature: string; description: string; returnType: string }>;
  signals: Array<{ name: string; description: string }>;
}

function parseXmlDocs(xmlDir: string): Map<string, ClassDoc> {
  const docs = new Map<string, ClassDoc>();

  const files = readdirSync(xmlDir).filter((f) => f.endsWith(".xml"));
  console.log(`Parsing ${files.length} class XML files...`);

  for (const file of files) {
    const content = readFileSync(join(xmlDir, file), "utf-8");

    const nameMatch = content.match(/<class\s+name="([^"]+)"/);
    if (!nameMatch) continue;

    const className = nameMatch[1];

    // Skip internal/undocumented classes
    if (className.startsWith("_")) continue;

    const inheritsMatch = content.match(/inherits="([^"]+)"/);
    const descMatch = content.match(/<brief_description>\s*([\s\S]*?)\s*<\/brief_description>/);

    const doc: ClassDoc = {
      name: className,
      description: (descMatch?.[1] ?? "").trim().replace(/\[[\w/]+\]/g, ""),
      inherits: inheritsMatch?.[1] ?? "",
      properties: [],
      methods: [],
      signals: [],
    };

    // Parse members (properties)
    const memberRegex = /<member\s+name="([^"]+)"\s+type="([^"]+)"[^>]*>([^<]*)<\/member>/g;
    let memberMatch;
    while ((memberMatch = memberRegex.exec(content)) !== null) {
      doc.properties.push({
        name: memberMatch[1],
        type: memberMatch[2],
        description: memberMatch[3].trim(),
      });
    }

    // Parse methods
    const methodRegex = /<method\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/method>/g;
    let methodMatch;
    while ((methodMatch = methodRegex.exec(content)) !== null) {
      const methodName = methodMatch[1];
      const methodBody = methodMatch[2];

      const returnMatch = methodBody.match(/<return\s+type="([^"]+)"/);
      const descriptionMatch = methodBody.match(/<description>\s*([\s\S]*?)\s*<\/description>/);

      // Build signature from params
      const paramRegex = /<param\s+index="\d+"\s+name="([^"]+)"\s+type="([^"]+)"/g;
      const params: string[] = [];
      let paramMatch;
      while ((paramMatch = paramRegex.exec(methodBody)) !== null) {
        params.push(`${paramMatch[1]}: ${paramMatch[2]}`);
      }

      const returnType = returnMatch?.[1] ?? "void";
      const signature = `${methodName}(${params.join(", ")}) -> ${returnType}`;

      doc.methods.push({
        name: methodName,
        signature,
        description: (descriptionMatch?.[1] ?? "").trim().replace(/\[[\w/]+\]/g, ""),
        returnType,
      });
    }

    // Parse signals
    const signalRegex = /<signal\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/signal>/g;
    let signalMatch;
    while ((signalMatch = signalRegex.exec(content)) !== null) {
      const signalBody = signalMatch[2];
      const descriptionMatch = signalBody.match(/<description>\s*([\s\S]*?)\s*<\/description>/);
      doc.signals.push({
        name: signalMatch[1],
        description: (descriptionMatch?.[1] ?? "").trim(),
      });
    }

    docs.set(className, doc);
  }

  return docs;
}

async function main() {
  const godotPath = process.argv[2] || process.env.GODOT_PATH;

  if (!godotPath) {
    console.error("Usage: npx ts-node scripts/build-docs.ts <godot-binary-path>");
    console.error("Or set GODOT_PATH environment variable");
    process.exit(1);
  }

  if (!existsSync(godotPath)) {
    console.error(`Godot binary not found at: ${godotPath}`);
    process.exit(1);
  }

  // Create temp directory for XML output
  const tmpDir = resolve("tmp-doctool");
  mkdirSync(tmpDir, { recursive: true });

  console.log(`Running Godot --doctool to extract XML docs...`);
  try {
    execFileSync(godotPath, ["--doctool", tmpDir, "--no-docbase"], {
      timeout: 60_000,
      stdio: "inherit",
    });
  } catch (err) {
    console.error("Failed to run --doctool. Trying without --no-docbase...");
    try {
      execFileSync(godotPath, ["--doctool", tmpDir], {
        timeout: 60_000,
        stdio: "inherit",
      });
    } catch {
      console.error("Failed to extract docs from Godot. Is the binary valid?");
      process.exit(1);
    }
  }

  const docs = parseXmlDocs(tmpDir);
  console.log(`Parsed ${docs.size} classes`);

  // Write compressed JSON
  const outputDir = resolve("src", "data");
  mkdirSync(outputDir, { recursive: true });
  const outputPath = resolve(outputDir, "godot-docs.json");

  const docsObject: Record<string, ClassDoc> = {};
  for (const [key, value] of docs) {
    docsObject[key] = value;
  }

  writeFileSync(outputPath, JSON.stringify(docsObject));
  const stats = readFileSync(outputPath);
  console.log(`Written ${outputPath} (${(stats.length / 1024).toFixed(0)} KB)`);

  // Cleanup
  const { rmSync } = await import("node:fs");
  rmSync(tmpDir, { recursive: true, force: true });

  console.log("Done! Rebuild the server to include the docs.");
}

main();
