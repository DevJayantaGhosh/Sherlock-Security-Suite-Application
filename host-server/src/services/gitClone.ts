/**
 * Git clone operations for the host-server.
 * Supports branch-based and tag-based clones with in-memory caching.
 */

import { spawn, spawnSync } from "child_process";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import os from "os";

import { emitLog, sseEvents } from "./sseManager.js";
import * as proc from "./processManager.js";

/* ── Constants ─────────────────────────────────────────── */

const SOFTWARE_SECURITY_SCAN = "software-security-scans";

/* ── Repo Cache ────────────────────────────────────────── */

const repoCache = new Map<string, string>();

/* ── Helpers ───────────────────────────────────────────── */

function getGitHubToken(): string | null {
  return process.env.GITHUB_PAT || null;
}

function runGitLfsInstall(scanId: string): void {
  try {
    emitLog(scanId, "\n📦 Running git lfs install...\n", 3);
    const result = spawnSync("git", ["lfs", "install"], {
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 150_000,
    });
    if (result.error) {
      emitLog(scanId, "⚠️ git lfs not found — skipping LFS\n", 4);
      return;
    }
    if (result.stdout?.toString()) emitLog(scanId, result.stdout.toString(), 4);
    if (result.stderr?.toString()) emitLog(scanId, result.stderr.toString(), 4);
    emitLog(
      scanId,
      result.status === 0
        ? "git lfs install done\n"
        : `⚠️ git lfs install exited ${result.status}\n`,
      4
    );
  } catch (err: any) {
    emitLog(scanId, `⚠️ git lfs install failed (${err.message})\n`, 4);
  }
}

function buildAuthUrl(repoUrl: string, token: string | null): string {
  if (token && !repoUrl.includes("x-access-token")) {
    return repoUrl.replace("https://", `https://x-access-token:${token}@`);
  }
  return repoUrl;
}

/* ── Clone by Branch ───────────────────────────────────── */

async function cloneRepository(
  repoUrl: string,
  branch: string,
  isQuickScan: boolean,
  githubToken: string,
  scanId: string
): Promise<string | null> {
  const cacheKey = `${repoUrl}:${branch}`;
  if (repoCache.has(cacheKey)) {
    const cached = repoCache.get(cacheKey)!;
    try {
      await fs.access(path.join(cached, ".git"));
      emitLog(scanId, "✅ Using cached repository\n", 50);
      return cached;
    } catch {
      repoCache.delete(cacheKey);
    }
  }

  emitLog(scanId, `\n${"═".repeat(60)}\n📦 CLONING REPOSITORY\n${"═".repeat(60)}\n`, 5);

  const token = isQuickScan ? githubToken || null : getGitHubToken();
  const cloneUrl = buildAuthUrl(repoUrl, token);

  const repoName = repoUrl.split("/").pop()?.replace(".git", "") || "repo";
  const tempDir = path.join(
    os.tmpdir(),
    SOFTWARE_SECURITY_SCAN,
    `${repoName}-${branch.replace(/\//g, "-")}-${Date.now()}`
  );

  try {
    await fs.mkdir(tempDir, { recursive: true });
    runGitLfsInstall(scanId);

    return await new Promise<string | null>((resolve) => {
      const child = spawn(
        "git",
        ["clone", "-b", branch, "--single-branch", cloneUrl, tempDir],
        {
          detached: process.platform !== "win32",
          stdio: ["ignore", "pipe", "pipe"],
        }
      );
      if (process.platform !== "win32") child.unref();

      const cloneId = `${scanId}-clone`;
      proc.register(cloneId, child);

      let progressCount = 0;
      let cancelled = false;

      const onData = (data: Buffer) => {
        if (!cancelled) {
          progressCount++;
          emitLog(scanId, data.toString(), Math.min(20 + progressCount * 2, 45));
        }
      };
      child.stdout?.on("data", onData);
      child.stderr?.on("data", onData);

      child.on("close", (code) => {
        proc.unregister(cloneId);
        if (cancelled) {
          resolve(null);
          return;
        }
        if (code === 0) {
          repoCache.set(cacheKey, tempDir);
          emitLog(scanId, "\n✅ Clone successful!\n", 50);
          resolve(tempDir);
        } else {
          emitLog(scanId, `\n❌ Clone failed (exit ${code})\n`, 0);
          resolve(null);
        }
      });

      child.on("error", (err) => {
        proc.unregister(cloneId);
        emitLog(scanId, `\n❌ Clone error: ${err.message}\n`, 0);
        resolve(null);
      });

      sseEvents.once(`cancel:${scanId}`, () => {
        cancelled = true;
        proc.killProcess(child, cloneId);
        resolve(null);
      });

      // 30-minute timeout
      setTimeout(() => {
        if (proc.has(cloneId)) {
          proc.killProcess(child, cloneId);
          emitLog(scanId, "\n❌ Clone timeout\n", 0);
          resolve(null);
        }
      }, 1_800_000);
    });
  } catch (err: any) {
    emitLog(scanId, `\n❌ Exception: ${err.message}\n`, 0);
    return null;
  }
}

/* ── Clone by Tag ──────────────────────────────────────── */

export async function cloneRepositoryByTag(
  repoUrl: string,
  tag: string,
  isQuickScan: boolean,
  githubToken: string,
  scanId: string
): Promise<string | null> {
  const cacheKey = `${repoUrl}:tag-${tag}`;
  if (repoCache.has(cacheKey)) {
    const cached = repoCache.get(cacheKey)!;
    try {
      await fs.access(path.join(cached, ".git"));
      emitLog(scanId, `✅ Using cached repo (tag ${tag})\n`, 50);
      return cached;
    } catch {
      repoCache.delete(cacheKey);
    }
  }

  emitLog(
    scanId,
    `\n${"═".repeat(60)}\n📦 CLONING REPOSITORY \n${"═".repeat(60)}\n`,
    5
  );


  const token = isQuickScan ? githubToken || null : getGitHubToken();
  const cloneUrl = buildAuthUrl(repoUrl, token);

  const repoName = repoUrl.split("/").pop()?.replace(".git", "") || "repo";
  const tempDir = path.join(
    os.tmpdir(),
    SOFTWARE_SECURITY_SCAN,
    `${repoName}-tag-${tag.replace(/[^a-zA-Z0-9]/g, "-")}-${Date.now()}`
  );

  try {
    await fs.mkdir(tempDir, { recursive: true });
    runGitLfsInstall(scanId);

    return await new Promise<string | null>((resolve) => {
      const cloneProcess = spawn(
        "git",
        ["clone", "--no-checkout", cloneUrl, tempDir],
        {
          detached: process.platform !== "win32",
          stdio: ["ignore", "pipe", "pipe"],
        }
      );
      if (process.platform !== "win32") cloneProcess.unref();

      const cloneId = `${scanId}-clone-tag`;
      proc.register(cloneId, cloneProcess);
      let cancelled = false;

      const onData = (d: Buffer) => {
        if (!cancelled) emitLog(scanId, d.toString(), 25);
      };
      cloneProcess.stdout?.on("data", onData);
      cloneProcess.stderr?.on("data", onData);

      cloneProcess.on("close", async (code) => {
        proc.unregister(cloneId);
        if (cancelled || code !== 0) {
          if (!cancelled)
            emitLog(scanId, `\n❌ Clone failed (exit ${code})\n`, 0);
          resolve(null);
          return;
        }
        spawnSync("git", ["fetch", "origin", "--tags"], {
          cwd: tempDir,
          stdio: "pipe",
        });
        const co = spawnSync("git", ["checkout", tag], {
          cwd: tempDir,
          stdio: "pipe",
        });
        if (co.status !== 0) {
          emitLog(scanId, `\n❌ Failed to checkout tag ${tag}\n`, 0);
          resolve(null);
          return;
        }
        repoCache.set(cacheKey, tempDir);
        emitLog(
          scanId,
          `\n✅ Clone & tag checkout successful! Tag: ${tag}\n`,
          50
        );
        resolve(tempDir);
      });

      cloneProcess.on("error", (err) => {
        proc.unregister(cloneId);
        emitLog(scanId, `\n❌ Clone error: ${err.message}\n`, 0);
        resolve(null);
      });

      sseEvents.once(`cancel:${scanId}`, () => {
        cancelled = true;
        proc.killProcess(cloneProcess, cloneId);
        resolve(null);
      });
    });
  } catch (err: any) {
    emitLog(scanId, `\n❌ Exception: ${err.message}\n`, 0);
    return null;
  }
}

/* ── Resolve Repo Path (local or clone) ────────────────── */

export async function getRepoPath(
  repoUrl: string,
  branch: string,
  isQuickScan: boolean,
  githubToken: string,
  scanId: string
): Promise<string | null> {
  // Quick-scan with a local directory path
  if (isQuickScan && repoUrl && !repoUrl.startsWith("http")) {
    const cleanPath = repoUrl.trim();
    if (fsSync.existsSync(cleanPath)) {
      emitLog(scanId, `\n📁 Using local repo: ${cleanPath}\n`, 10);
      return cleanPath;
    }
  }
  return cloneRepository(repoUrl, branch, isQuickScan, githubToken, scanId);
}