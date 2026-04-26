#!/usr/bin/env node
/**
 * Copy bundled data files (JSON) from src/data/ to dist/data/.
 *
 * tsc does not emit JSON files even with `resolveJsonModule: true` —
 * it only allows them to be imported. We need them at runtime in the
 * published package, so we copy them in the build step.
 */
import { existsSync, mkdirSync, readdirSync, copyFileSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const srcDir = resolve("src", "data");
const destDir = resolve("dist", "data");

if (!existsSync(srcDir)) {
  console.error(`[copy-data] src/data/ does not exist. Run \`npm run build:docs\` first.`);
  process.exit(1);
}

mkdirSync(destDir, { recursive: true });

let count = 0;
for (const name of readdirSync(srcDir)) {
  const srcPath = join(srcDir, name);
  if (!statSync(srcPath).isFile()) continue;
  if (!name.endsWith(".json")) continue;
  const destPath = join(destDir, name);
  copyFileSync(srcPath, destPath);
  count++;
}

console.log(`[copy-data] Copied ${count} JSON file(s) from src/data/ to dist/data/.`);
