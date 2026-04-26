#!/usr/bin/env node
/**
 * Build script to extract Godot 4.x API docs into compressed JSON
 * for bundling with the npm package.
 *
 * Two source modes:
 *   1. GITHUB (default): Downloads the doc/classes/ XML tarball directly
 *      from the godotengine/godot repo at a pinned tag. No Godot binary
 *      required — works in CI, on contributor machines, on any platform.
 *   2. DOCTOOL (fallback): Runs `<godot> --doctool <out>` to extract XML
 *      from a locally-installed Godot binary. Use this when you need docs
 *      that match a specific local Godot install.
 *
 * Usage:
 *   npm run build:docs                          # GitHub mode (default tag)
 *   npm run build:docs -- --tag=4.4-stable      # GitHub mode (custom tag)
 *   npm run build:docs -- --doctool /path/godot # Local doctool mode
 *
 * Output: src/data/godot-docs.json
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";

const DEFAULT_GODOT_TAG = "4.4-stable";

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

async function fetchClassesFromGithub(tag: string, destDir: string): Promise<void> {
  // The godotengine/godot tarball is huge (>200MB) — instead we use the
  // GitHub Trees API to enumerate doc/classes/ and fetch each XML via the
  // raw.githubusercontent.com CDN. Each XML is small (a few KB), and we
  // parallelise fetches to keep wall time reasonable (<60s on broadband).
  console.log(`Fetching Godot ${tag} class XML files from GitHub...`);

  // 1. Resolve tag -> commit SHA via Trees API recursive listing of doc/classes
  const treeUrl = `https://api.github.com/repos/godotengine/godot/git/trees/${tag}?recursive=0`;
  // We instead enumerate doc/classes directly:
  const listUrl = `https://api.github.com/repos/godotengine/godot/contents/doc/classes?ref=${tag}`;

  const listRes = await fetch(listUrl, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "godot-forge-build-docs",
    },
  });
  if (!listRes.ok) {
    throw new Error(`GitHub API listing failed (${listRes.status}): ${listUrl}\nThis may be a rate limit. Set GITHUB_TOKEN env var or use --doctool mode.`);
  }
  const entries = (await listRes.json()) as Array<{
    name: string;
    type: string;
    download_url: string | null;
  }>;

  const xmlEntries = entries.filter((e) => e.type === "file" && e.name.endsWith(".xml"));
  console.log(`Found ${xmlEntries.length} XML files. Downloading...`);

  // Cap concurrency to avoid hammering raw.githubusercontent.com
  const CONCURRENCY = 16;
  let downloaded = 0;
  const queue = [...xmlEntries];

  async function worker() {
    while (queue.length > 0) {
      const entry = queue.shift();
      if (!entry || !entry.download_url) continue;
      const res = await fetch(entry.download_url);
      if (!res.ok) {
        throw new Error(`Failed to fetch ${entry.name}: ${res.status}`);
      }
      const text = await res.text();
      writeFileSync(join(destDir, entry.name), text, "utf-8");
      downloaded++;
      if (downloaded % 50 === 0) {
        console.log(`  ...${downloaded}/${xmlEntries.length}`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`Downloaded ${downloaded} XML files.`);
  // Suppress unused var lint
  void treeUrl;
}

function fetchClassesFromDoctool(godotPath: string, destDir: string): void {
  if (!existsSync(godotPath)) {
    throw new Error(`Godot binary not found at: ${godotPath}`);
  }
  console.log(`Running ${godotPath} --doctool ${destDir} ...`);
  try {
    execFileSync(godotPath, ["--doctool", destDir, "--no-docbase"], {
      timeout: 120_000,
      stdio: "inherit",
    });
  } catch {
    console.error("Retrying without --no-docbase...");
    execFileSync(godotPath, ["--doctool", destDir], {
      timeout: 120_000,
      stdio: "inherit",
    });
  }
  // --doctool writes to <destDir>/doc/classes/*.xml — flatten it
  const nestedClasses = join(destDir, "doc", "classes");
  if (existsSync(nestedClasses)) {
    for (const f of readdirSync(nestedClasses)) {
      if (f.endsWith(".xml")) {
        const src = join(nestedClasses, f);
        const dst = join(destDir, f);
        writeFileSync(dst, readFileSync(src));
      }
    }
  }
}

function parseArgs(argv: string[]): { tag: string; doctool: string | null } {
  let tag = process.env.GODOT_DOCS_TAG ?? DEFAULT_GODOT_TAG;
  let doctool: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--doctool") {
      doctool = argv[++i] ?? process.env.GODOT_PATH ?? null;
    } else if (arg.startsWith("--doctool=")) {
      doctool = arg.slice("--doctool=".length);
    } else if (arg === "--tag") {
      tag = argv[++i] ?? tag;
    } else if (arg.startsWith("--tag=")) {
      tag = arg.slice("--tag=".length);
    }
  }
  return { tag, doctool };
}

async function main() {
  const { tag, doctool } = parseArgs(process.argv.slice(2));

  // Use system tmp to avoid polluting cwd
  const tmpDir = join(tmpdir(), `godot-forge-doctool-${process.pid}`);
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });

  try {
    if (doctool) {
      console.log(`Mode: --doctool (binary=${doctool})`);
      fetchClassesFromDoctool(doctool, tmpDir);
    } else {
      console.log(`Mode: GitHub (tag=${tag})`);
      await fetchClassesFromGithub(tag, tmpDir);
    }

    const docs = parseXmlDocs(tmpDir);
    if (docs.size === 0) {
      throw new Error("Parsed 0 classes. Aborting (would produce an empty index).");
    }
    console.log(`Parsed ${docs.size} classes.`);

    // Write the bundled JSON
    const outputDir = resolve("src", "data");
    mkdirSync(outputDir, { recursive: true });
    const outputPath = resolve(outputDir, "godot-docs.json");

    const docsObject: Record<string, ClassDoc> = {};
    // Sort keys for deterministic output (so the file is diff-friendly)
    for (const key of [...docs.keys()].sort()) {
      docsObject[key] = docs.get(key)!;
    }

    writeFileSync(outputPath, JSON.stringify(docsObject));
    const stats = readFileSync(outputPath);
    console.log(`Wrote ${outputPath} (${(stats.length / 1024).toFixed(0)} KB, ${docs.size} classes)`);
    console.log("Done. Run `npm run build` to bundle the JSON into dist/.");
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

void Readable; // imported but only kept for parity with prior streaming intent
void pipeline;
void createWriteStream;

main().catch((err) => {
  console.error("build-docs failed:", err.message ?? err);
  process.exit(1);
});
