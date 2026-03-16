/**
 * Tool path resolution for the host-server (web mode).
 *
 * Resolution order:
 *   1. TOOLS_DIR environment variable (explicit override)
 *   2. <project-root>/tools/<platform>/  (dev — running from source)
 *   3. <host-server>/tools/<platform>/   (production — bundled with server)
 *   4. <cwd>/tools/<platform>/           (fallback)
 */

import fsSync from "fs";
import path from "path";
import { fileURLToPath } from "url";

export type ToolName =
  | "gitleaks"
  | "trivy"
  | "KeyGenerator"
  | "SoftwareSigner"
  | "SoftwareVerifier";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Three levels up from host-server/src/services/ → project root */
const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..");

/** One level up from src/ or dist/ → host-server root */
const SERVER_ROOT = path.resolve(__dirname, "..", "..");

function log(msg: string) {
  console.log(`[host-server] ${msg}`);
}

function platformDir(): string {
  if (process.platform === "win32") return "win";
  if (process.platform === "darwin") return "darwin";
  return "linux";
}

/** Resolve the base directory containing platform-specific tool folders. */
function resolveToolsDir(): string {
  const os = platformDir();

  const candidates = [
    process.env.TOOLS_DIR ? path.resolve(process.env.TOOLS_DIR) : null,
    path.join(PROJECT_ROOT, "tools", os),
    path.join(SERVER_ROOT, "tools", os),
    path.join(process.cwd(), "tools", os),
  ].filter(Boolean) as string[];

  for (const dir of candidates) {
    if (fsSync.existsSync(dir)) {
      log(`Tools directory: ${dir}`);
      return dir;
    }
  }

  const fallback = candidates[1];
  log(`Tools directory not found, defaulting to: ${fallback}`);
  return fallback;
}

let _toolsDir: string | null = null;

function getToolsDir(): string {
  if (!_toolsDir) _toolsDir = resolveToolsDir();
  return _toolsDir;
}

/** Absolute path to a tool binary. */
export function toolPath(tool: ToolName): string {
  const ext = process.platform === "win32" ? ".exe" : "";
  return path.join(getToolsDir(), tool, tool + ext);
}

/** Validate existence and permissions. Returns path or null. */
export function validateTool(tool: ToolName): string | null {
  const p = toolPath(tool);

  if (!fsSync.existsSync(p)) {
    log(`Tool not found: ${p}`);
    return null;
  }

  if (process.platform !== "win32") {
    try {
      fsSync.accessSync(p, fsSync.constants.X_OK);
    } catch {
      try { fsSync.chmodSync(p, 0o755); } catch { return null; }
    }
  }

  return p;
}

/** Print resolved paths for all tools (call at server startup). */
export function logToolResolution(): void {
  const tools: ToolName[] = ["gitleaks", "trivy", "KeyGenerator", "SoftwareSigner", "SoftwareVerifier"];
  log(`Platform: ${process.platform} | Tools dir: ${getToolsDir()}`);
  for (const t of tools) {
    const p = toolPath(t);
    log(`  ${fsSync.existsSync(p) ? "✓" : "✗"} ${t.padEnd(20)} ${p}`);
  }
}