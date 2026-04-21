#!/usr/bin/env node
/**
 * copy-tools.mjs
 *
 * Copies the platform-specific tools/ directory from the project root
 * into host-server/tools/ so the server can be deployed standalone.
 *
 * Usage:
 *   node scripts/copy-tools.mjs            # copies current platform only
 *   node scripts/copy-tools.mjs --all      # copies all platforms (win, darwin, linux)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVER_ROOT = path.resolve(__dirname, "..");
const PROJECT_ROOT = path.resolve(SERVER_ROOT, "..");
const SOURCE_TOOLS = path.join(PROJECT_ROOT, "tools");
const DEST_TOOLS = path.join(SERVER_ROOT, "tools");

function platformDir() {
  if (process.platform === "win32") return "win";
  if (process.platform === "darwin") return "darwin";
  return "linux";
}

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`  ⚠ Source not found, skipping: ${src}`);
    return 0;
  }

  fs.mkdirSync(dest, { recursive: true });
  let count = 0;

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      count += copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      // Preserve executable permissions on non-Windows
      if (process.platform !== "win32") {
        try {
          const stat = fs.statSync(srcPath);
          fs.chmodSync(destPath, stat.mode);
        } catch { /* ignore */ }
      }
      count++;
    }
  }

  return count;
}

// ── Main ────────────────────────────────────────────────

const copyAll = process.argv.includes("--all");
const platforms = copyAll ? ["win", "darwin", "linux"] : [platformDir()];

console.log(`\n📦 Copying tools into host-server/tools/`);
console.log(`   Source : ${SOURCE_TOOLS}`);
console.log(`   Dest   : ${DEST_TOOLS}`);
console.log(`   Targets: ${platforms.join(", ")}\n`);

if (!fs.existsSync(SOURCE_TOOLS)) {
  console.error(`❌ Source tools directory not found: ${SOURCE_TOOLS}`);
  console.error(`   Make sure you run this from inside the host-server directory`);
  console.error(`   and that the project root contains a tools/ directory.`);
  process.exit(1);
}

let totalFiles = 0;

for (const platform of platforms) {
  const src = path.join(SOURCE_TOOLS, platform);
  const dest = path.join(DEST_TOOLS, platform);

  console.log(`  → ${platform}/`);
  const copied = copyDirRecursive(src, dest);
  console.log(`    ${copied} file(s) copied`);
  totalFiles += copied;
}

console.log(`\n✅ Done — ${totalFiles} file(s) total\n`);