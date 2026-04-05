// electron/main.ts
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { spawn, spawnSync, ChildProcess } from "child_process";
import fs from "fs/promises";
import fsSync from "fs";
import dotenv from "dotenv";
import https from "node:https";
import { Octokit } from "@octokit/rest";

/* ============================================================
   PATHS
============================================================ */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname, "..");

export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
export const SOFTWARE_DIGITAL_SIGNATURE = "software-digital-signature";
export const SIGNATURE_FILE_NAME = "signature.sig";
export const SOFTWARE_SECURITY_SCAN = "software-security-scans";
export const SOFTWARE_BILL_OF_MATERIALS = "software-bill-of-materials";

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

const envPaths = [
  path.join(process.env.APP_ROOT, '.env'),           // ROOT .env (dev + prod)
  path.join(__dirname, '.env'),                     // src/.env fallback
  path.join(process.resourcesPath || __dirname, '.env') // Packaged app
];

dotenv.config({ path: envPaths.find(p => fsSync.existsSync(p)) });
console.log('✅ .env loaded:', process.env.GITHUB_PAT ? 'GITHUB_PAT found' : 'No token');

/* ── Corporate Network SSL Fix ────────────────────────────────────
   Bypass self-signed certificate errors common behind corporate
   proxies/firewalls. This affects ALL outbound HTTPS from this
   process (Octokit, fetch, etc.).                                  */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

let win: BrowserWindow | null = null;
let splash: BrowserWindow | null = null;

/* ============================================================
   ACTIVE PROCESSES & CACHE
============================================================ */
const activeProcesses = new Map<string, ChildProcess>();
const repoCache = new Map<string, string>();

function debugLog(msg: string) {
  console.log(`[ELECTRON][${new Date().toISOString()}] ${msg}`);
}
/** log heading separator constant  */
const SEPARATOR_WIDTH = 80;

/* ============================================================
   TOOL PATHS
============================================================ */
function getOsFolder() {
  if (process.platform === "win32") return "win";
  if (process.platform === "darwin") return "darwin";
  return "linux";
}

function toolPath(tool: "gitleaks" | "trivy" | "opengrep" | "KeyGenerator" | "SoftwareSigner" | "SoftwareVerifier"): string {
  const ext = process.platform === "win32" ? ".exe" : "";
  const toolFile = tool + ext;
  return path.join(
    process.env.APP_ROOT!,
    "tools",
    getOsFolder(),
    tool,
    toolFile,
  );
}

function validateTool(tool: "gitleaks" | "trivy" | "opengrep" | "KeyGenerator" | "SoftwareSigner" | "SoftwareVerifier"): string | null {
  const fullPath = toolPath(tool);

  if (!fsSync.existsSync(fullPath)) {
    debugLog(`Tool not found: ${fullPath}`);
    return null;
  }

  // Check file permissions
  try {
    fsSync.accessSync(fullPath, fsSync.constants.X_OK);
  } catch (err: any) {
    debugLog(`${tool} not executable: ${fullPath}`);

    // Try to fix permissions on Unix
    if (process.platform !== "win32") {
      try {
        fsSync.chmodSync(fullPath, 0o755);
        debugLog(`Set execute permission on ${fullPath}`);
      } catch (chmodErr: any) {
        debugLog(`Failed to set permissions: ${chmodErr.message}`);
        return null;
      }
    }
  }

  debugLog(`Found ${tool} at: ${fullPath}`);
  return fullPath;
}

/* ============================================================
   KILL PROCESS
============================================================ */
function killProcess(child: ChildProcess, processId: string) {
  if (!child || !child.pid) {
    debugLog(`No PID for ${processId}`);
    return;
  }

  debugLog(`Killing ${processId} (PID: ${child.pid})`);

  try {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", child.pid.toString(), "/f", "/t"], {
        stdio: "ignore",
      });
    } else {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch (e) {
        child.kill("SIGKILL");
      }
    }
  } catch (err: any) {
    debugLog(`Kill error ${processId}: ${err.message}`);
    try {
      child.kill("SIGKILL");
    } catch {}
  }
}

/* --------------------------------------------------------
  Utility Get Repository Path
-------------------------------------------------------- */
const getRepoPath = async (
  event: any,
  repoUrl: string,
  branch: string,
  isQuickScan: boolean,
  githubToken: string,
  scanId: string,
): Promise<string | null> => {
  // Check if it's a local path (exists on filesystem)
  if (isQuickScan && repoUrl && repoUrl.trim() && !repoUrl.startsWith("http")) {
    const cleanPath = repoUrl.trim();

    if (fsSync.existsSync(cleanPath)) {
      event.sender.send(`scan-log:${scanId}`, {
        log: `\n📁 Using local repo: ${cleanPath} (branch: ${branch})\n`,
        progress: 10,
      });
      return cleanPath;
    }
  }

  return await cloneRepository(
    event,
    repoUrl,
    branch,
    isQuickScan,
    githubToken,
    scanId,
  );
};

/* ============================================================
   GIT LFS INSTALL
============================================================ */
function runGitLfsInstall(
  event: Electron.IpcMainInvokeEvent,
  scanId: string,
): void {
  try {
    event.sender.send(`scan-log:${scanId}`, {
      log: `\n📦 Running git lfs install...\n`,
      progress: 3,
    });

    const result = spawnSync("git", ["lfs", "install"], {
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 150000,
    });

    if (result.error) {
      event.sender.send(`scan-log:${scanId}`, {
        log: `⚠️ git lfs not found on system — skipping LFS (clone will continue)\n`,
        progress: 4,
      });
      return;
    }

    const stdout = result.stdout?.toString() || "";
    const stderr = result.stderr?.toString() || "";
    if (stdout) {
      event.sender.send(`scan-log:${scanId}`, { log: stdout, progress: 4 });
    }
    if (stderr) {
      event.sender.send(`scan-log:${scanId}`, { log: stderr, progress: 4 });
    }

    event.sender.send(`scan-log:${scanId}`, {
      log:
        result.status === 0
          ? `git lfs install done\n`
          : `⚠️ git lfs install exited ${result.status} — LFS may not be available (clone will continue)\n`,
      progress: 4,
    });
  } catch (err: any) {
    debugLog(`runGitLfsInstall failed: ${err.message}`);
    event.sender.send(`scan-log:${scanId}`, {
      log: `⚠️ git lfs install failed (${err.message}) — continuing without LFS\n`,
      progress: 4,
    });
  }
}

/* ============================================================
   CLONE REPOSITORY
============================================================ */
function getGitHubToken(): string | null {
  return process.env.GITHUB_PAT || null;
}

async function cloneRepository(
  event: Electron.IpcMainInvokeEvent,
  repoUrl: string,
  branch: string,
  isQuickScan: boolean,
  githubToken: string,
  scanId: string,
): Promise<string | null> {
  const cacheKey = `${repoUrl}:${branch}`;

  // Check cache
  if (repoCache.has(cacheKey)) {
    const cachedPath = repoCache.get(cacheKey)!;
    try {
      await fs.access(path.join(cachedPath, ".git"));
      debugLog(`Using cached repo: ${cachedPath}`);

      event.sender.send(`scan-log:${scanId}`, {
        log: `✅ Using cached repository\n   Path: ${cachedPath}\n   Branch: ${branch}\n\n`,
        progress: 50,
      });

      return cachedPath;
    } catch {
      repoCache.delete(cacheKey);
    }
  }

  // Clone

  event.sender.send(`scan-log:${scanId}`, {
    log: `\n${"═".repeat(SEPARATOR_WIDTH)}\n📦 CLONING REPOSITORY\n${"═".repeat(SEPARATOR_WIDTH)}\n`,
    progress: 5,
  });

  event.sender.send(`scan-log:${scanId}`, {
    log: `Repository: ${repoUrl}\nBranch: ${branch}\n\n`,
    progress: 10,
  });

  // For quickScan: only use the user-provided githubToken (don't fall back to env PAT)
  // This allows public repos to clone anonymously so LFS works without token scope issues
  let token: string | null = null;
  if (isQuickScan) {
    token = githubToken || null; // only use explicitly provided token
  } else {
    token = getGitHubToken(); // product flow: fall back to env PAT
  }

  let cloneUrl = repoUrl;
  if (token && !repoUrl.includes('x-access-token')) {
    cloneUrl = repoUrl.replace('https://', `https://x-access-token:${token}@`);
  }

  const repoName = repoUrl.split("/").pop()?.replace(".git", "") || "repo";
  const timestamp = Date.now();
  const tempDir = path.join(
    app.getPath("temp"),
    SOFTWARE_SECURITY_SCAN,
    `${repoName}-${branch.replace(/\//g, "-")}-${timestamp}`,
  );

  try {
    await fs.mkdir(tempDir, { recursive: true });

    // Run git lfs install synchronously BEFORE clone
    runGitLfsInstall(event, scanId);

    return await new Promise<string | null>((resolve) => {
      const args = ["clone", "-b", branch, "--single-branch", cloneUrl, tempDir];

      event.sender.send(`scan-log:${scanId}`, {
        log: `$ git clone in-progress ...\n\n`,
        progress: 15,
      });

      const child = spawn("git", args, {
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env },
      });

      child.unref();
      const cloneId = `${scanId}-clone`;
      activeProcesses.set(cloneId, child);

      let cancelled = false;
      let progressCount = 0;

      child.stdout?.on("data", (data) => {
        progressCount++;
        event.sender.send(`scan-log:${scanId}`, {
          log: data.toString(),
          progress: Math.min(20 + progressCount * 2, 45),
        });
      });

      child.stderr?.on("data", (data) => {
        progressCount++;
        event.sender.send(`scan-log:${scanId}`, {
          log: data.toString(),
          progress: Math.min(20 + progressCount * 2, 45),
        });
      });

      child.on("close", (code) => {
        activeProcesses.delete(cloneId);

        if (cancelled) {
          resolve(null);
          return;
        }

        if (code === 0) {
          repoCache.set(cacheKey, tempDir);

          event.sender.send(`scan-log:${scanId}`, {
            log: `\n✅ Clone successful!\n   Location: ${tempDir}\n${"═".repeat(SEPARATOR_WIDTH)}\n\n`,
            progress: 50,
          });

          resolve(tempDir);
        } else {
          event.sender.send(`scan-log:${scanId}`, {
            log: `\n❌ Clone failed with exit code ${code}\n`,
            progress: 0,
          });
          resolve(null);
        }
      });

      child.on("error", (err) => {
        activeProcesses.delete(cloneId);
        event.sender.send(`scan-log:${scanId}`, {
          log: `\n❌ Clone error: ${err.message}\n`,
          progress: 0,
        });
        resolve(null);
      });

      // Cancel handler
      const cancelHandler = () => {
        cancelled = true;
        debugLog(`Cancelling clone: ${cloneId}`);
        killProcess(child, cloneId);
        activeProcesses.delete(cloneId);
        resolve(null);
      };

      ipcMain.once(`scan:cancel-${scanId}`, cancelHandler);

      // Timeout after 30 minutes
      setTimeout(() => {
        if (activeProcesses.has(cloneId)) {
          killProcess(child, cloneId);
          event.sender.send(`scan-log:${scanId}`, {
            log: `\n❌ Clone timeout after 30 minutes\n`,
            progress: 0,
          });
          resolve(null);
        }
      }, 1800000);
    });
  } catch (err: any) {
    event.sender.send(`scan-log:${scanId}`, {
      log: `\n❌ Exception: ${err.message}\n`,
      progress: 0,
    });
    return null;
  }
}

/* ============================================================
   CLONE REPOSITORY BY TAG
============================================================ */
async function cloneRepositoryByTag(
  event: Electron.IpcMainInvokeEvent,
  repoUrl: string,
  tag: string,
  isQuickScan: boolean,
  githubToken: string,
  scanId: string,
): Promise<string | null> {
  const cacheKey = `${repoUrl}:tag-${tag}`;

  // Check cache first
  if (repoCache.has(cacheKey)) {
    const cachedPath = repoCache.get(cacheKey)!;
    try {
      await fs.access(path.join(cachedPath, ".git"));
      debugLog(`Using cached repo (tag): ${cachedPath}`);

      event.sender.send(`scan-log:${scanId}`, {
        log: `✅ Using cached repository (tag)\n  Path: ${cachedPath}\n  Tag: ${tag}\n\n`,
        progress: 50,
      });
      return cachedPath;
    } catch {
      repoCache.delete(cacheKey);
    }
  }

  // Clone logging
  event.sender.send(`scan-log:${scanId}`, {
    log: `\n${"═".repeat(SEPARATOR_WIDTH)}\n📦 CLONING REPOSITORY (TAG)\n${"═".repeat(SEPARATOR_WIDTH)}\n`,
    progress: 5,
  });

  event.sender.send(`scan-log:${scanId}`, {
    log: `Repository: ${repoUrl}\nTag: ${tag}\n\n`,
    progress: 10,
  });

  // For quickScan: only use the user-provided githubToken (don't fall back to env PAT)
  // This allows public repos to clone anonymously so LFS works without token scope issues
  let token: string | null = null;
  if (isQuickScan) {
    token = githubToken || null;
  } else {
    token = getGitHubToken();
  }

  let cloneUrl = repoUrl;
  if (token && !repoUrl.includes('x-access-token')) {
    cloneUrl = repoUrl.replace('https://', `https://x-access-token:${token}@`);
  }

  const repoName = repoUrl.split("/").pop()?.replace(".git", "") || "repo";
  const timestamp = Date.now();
  const tempDir = path.join(
    app.getPath("temp"),
    SOFTWARE_SECURITY_SCAN,
    `${repoName}-tag-${tag.replace(/[^a-zA-Z0-9]/g, "-")}-${timestamp}`,
  );

  try {
    await fs.mkdir(tempDir, { recursive: true });

    // Run git lfs install
    runGitLfsInstall(event, scanId);

    return await new Promise<string | null>((resolve) => {
      // Step 1: Clone WITHOUT single-branch to get ALL tags
      const cloneArgs = ["clone", "--no-checkout", cloneUrl, tempDir];

      event.sender.send(`scan-log:${scanId}`, {
        log: `$ git clone (tag mode) in-progress ...\n\n`,
        progress: 15,
      });

      const cloneProcess = spawn("git", cloneArgs, {
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env },
      });

      cloneProcess.unref();
      const cloneId = `${scanId}-clone-tag`;
      activeProcesses.set(cloneId, cloneProcess);

      let cancelled = false;
      let progressCount = 0;

      const handleData = (data: Buffer) => {
        if (cancelled) return;
        progressCount++;
        event.sender.send(`scan-log:${scanId}`, {
          log: data.toString(),
          progress: Math.min(20 + progressCount * 2, 30),
        });
      };

      cloneProcess.stdout?.on("data", handleData);
      cloneProcess.stderr?.on("data", handleData);

      cloneProcess.on("close", async (code) => {
        activeProcesses.delete(cloneId);

        if (cancelled || code !== 0) {
          if (!cancelled) {
            event.sender.send(`scan-log:${scanId}`, {
              log: `\n❌ Clone failed with exit code ${code}\n`,
              progress: 0,
            });
          }
          resolve(null);
          return;
        }

        // 1. Fetch ALL tags before checkout
        event.sender.send(`scan-log:${scanId}`, {
          log: `\n🔄 Fetching tags...\n\n`,
          progress: 35,
        });

        const fetchProcess = spawn("git", ["fetch", "origin", "--tags"], {
          cwd: tempDir,
          detached: true,
          stdio: ["ignore", "pipe", "pipe"],
        });

        fetchProcess.unref();
        const fetchId = `${scanId}-fetch-tags`;
        activeProcesses.set(fetchId, fetchProcess);

        fetchProcess.on("close", async (fetchCode) => {
          activeProcesses.delete(fetchId);

          if (fetchCode !== 0) {
            event.sender.send(`scan-log:${scanId}`, {
              log: `\n⚠️ Tag fetch warning (code: ${fetchCode}), proceeding...\n`,
              progress: 38,
            });
          }

          // Step 2: List available tags for debugging
          event.sender.send(`scan-log:${scanId}`, {
            log: `\n🔍 Checking out tag: ${tag}\n\n`,
            progress: 40,
          });

          // List tags first to debug
          const listTagsProcess = spawn("git", ["tag", "-l"], {
            cwd: tempDir,
            detached: true,
            stdio: ["ignore", "pipe", "pipe"],
          });

          listTagsProcess.stdout?.on("data", (data) => {
            const tags = data.toString().trim();
            if (tags) {
              event.sender.send(`scan-log:${scanId}`, {
                log: `Available tags:\n${tags}\n\n`,
                progress: 42,
              });
            }
          });

          listTagsProcess.on("close", async () => {
            // Step 3: Checkout the tag
            const checkoutProcess = spawn("git", ["checkout", tag], {
              cwd: tempDir,
              detached: true,
              stdio: ["ignore", "pipe", "pipe"],
            });

            const checkoutId = `${scanId}-checkout-tag`;
            activeProcesses.set(checkoutId, checkoutProcess);

            checkoutProcess.stdout?.on("data", (data) => {
              event.sender.send(`scan-log:${scanId}`, {
                log: data.toString(),
                progress: 45,
              });
            });

            checkoutProcess.stderr?.on("data", (data) => {
              event.sender.send(`scan-log:${scanId}`, {
                log: `[CHECKOUT] ${data.toString()}`,
                progress: 45,
              });
            });

            checkoutProcess.on("close", (checkoutCode) => {
              activeProcesses.delete(checkoutId);

              if (checkoutCode !== 0) {
                event.sender.send(`scan-log:${scanId}`, {
                  log: `\n❌ Failed to checkout tag ${tag} (code: ${checkoutCode})\n  Tag might not exist. Check "Available tags" above.\n`,
                  progress: 0,
                });
                resolve(null);
                return;
              }

              // Success!
              repoCache.set(cacheKey, tempDir);
              event.sender.send(`scan-log:${scanId}`, {
                log: `\n✅ Clone & tag checkout successful!\n  Location: ${tempDir}\n  Tag: ${tag}\n${"═".repeat(SEPARATOR_WIDTH)}\n\n`,
                progress: 50,
              });
              resolve(tempDir);
            });

            checkoutProcess.on("error", (err: Error) => {
              activeProcesses.delete(checkoutId);
              event.sender.send(`scan-log:${scanId}`, {
                log: `\n❌ Checkout error: ${err.message}\n`,
                progress: 0,
              });
              resolve(null);
            });
          });
        });
      });

      cloneProcess.on("error", (err: Error) => {
        activeProcesses.delete(cloneId);
        event.sender.send(`scan-log:${scanId}`, {
          log: `\n❌ Clone error: ${err.message}\n`,
          progress: 0,
        });
        resolve(null);
      });

      const cancelHandler = () => {
        cancelled = true;
        debugLog(`Cancelling clone-tag: ${cloneId}`);
        killProcess(cloneProcess, cloneId);
        activeProcesses.delete(cloneId);
        resolve(null);
      };

      ipcMain.once(`scan:cancel-${scanId}`, cancelHandler);

      // Timeout after 30 minutes
      setTimeout(() => {
        if (activeProcesses.has(cloneId)) {
          killProcess(cloneProcess, cloneId);
          event.sender.send(`scan-log:${scanId}`, {
            log: `\n❌ Clone timeout after 30 minutes\n`,
            progress: 0,
          });
          resolve(null);
        }
      }, 1800000);
    });
  } catch (err: any) {
    event.sender.send(`scan-log:${scanId}`, {
      log: `\n❌ Exception: ${err.message}\n`,
      progress: 0,
    });
    return null;
  }
}


/* ============================================================
   IPC HANDLERS
============================================================ */
function registerIPC() {
  /* --------------------------------------------------------
     GPG VERIFICATION
  -------------------------------------------------------- */
  ipcMain.handle("scan:verify-gpg", async (event, { repoUrl, branch, isQuickScan, githubToken, scanId }) => {
    debugLog(`[GPG] Starting verification for ${repoUrl} on branch ${branch}`);

      // Clone repo first
      const repoPath = await getRepoPath(
        event,
        repoUrl,
        branch,
        isQuickScan,
        githubToken,
        scanId,
      );
      if (!repoPath) {
        event.sender.send(`scan-complete:${scanId}`, {
          success: false,
          error: "Repository preparation failed",
        });
        return { success: false, error: "Repository preparation failed" };
      }

      return new Promise((resolve) => {
        event.sender.send(`scan-log:${scanId}`, {
          log: `\n${"═".repeat(SEPARATOR_WIDTH)}\n🛡️ GPG SIGNATURE VERIFICATION\n${"═".repeat(SEPARATOR_WIDTH)}\n\n`,
          progress: 52,
        });

        event.sender.send(`scan-log:${scanId}`, {
          log: `🔍 Analyzing ALL commit signatures on branch: ${branch}...\n\n`,
          progress: 55,
        });

        //check all commits on the branch
        const child = spawn(
          "git",
          ["log", "--show-signature", "--pretty=format:%H|%an|%aI|%s", branch],
          {
            cwd: repoPath,
            detached: true,
            stdio: ["ignore", "pipe", "pipe"],
          },
        );

        child.unref();
        activeProcesses.set(scanId, child);

        let buffer = "";
        let stderrBuffer = "";
        let commitCount = 0;
        let goodSignatures = 0;
        let cancelled = false;

        child.stdout?.on("data", (chunk) => {
          if (cancelled) return;
          buffer += chunk.toString();
        });

        child.stderr?.on("data", (chunk) => {
          if (cancelled) return;
          stderrBuffer += chunk.toString();
        });

        child.on("close", (code) => {
          activeProcesses.delete(scanId);

          if (cancelled) {
            resolve({ success: false, cancelled: true });
            return;
          }

          // Combine both outputs for analysis
          const fullOutput = buffer + "\n" + stderrBuffer;
          const lines = fullOutput.split("\n");

          // Parse commits and their signatures
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (line.includes("|")) {
              commitCount++;
              const [sha, author, date, subject] = line.split("|");

              // Look backwards from current line to find signature info
              let isGoodSig = false;
              let signatureBlock = "";

              // Check previous 20 lines for GPG signature (signature comes before commit)
              for (let j = Math.max(0, i - 20); j < i; j++) {
                signatureBlock += lines[j] + "\n";
              }

              // Check multiple GPG signature patterns
              if (
                signatureBlock.includes("Good signature from") ||
                signatureBlock.includes("gpg: Good signature") ||
                signatureBlock.includes("Signature made") ||
                (signatureBlock.includes("using RSA key") &&
                  signatureBlock.includes("Good")) ||
                (signatureBlock.includes("using ECDSA key") &&
                  signatureBlock.includes("Good"))
              ) {
                isGoodSig = true;
                goodSignatures++;
              }

              // Also check if commit has "Verified" badge (GitHub web signed)
              if (signatureBlock.includes("Verified") && !isGoodSig) {
                isGoodSig = true;
                goodSignatures++;
              }

              const log = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 Commit ${commitCount}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SHA     : ${sha.substring(0, 8)}
Author  : ${author}
Date    : ${date}
Message : ${subject}

GPG     : ${isGoodSig ? "✅ GOOD SIGNATURE" : "❌ MISSING/INVALID"}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

              event.sender.send(`scan-log:${scanId}`, {
                log,
                progress:
                  55 +
                  Math.min((commitCount / Math.max(commitCount, 1)) * 35, 35),
              });

              // Clear signature block for next commit
              signatureBlock = "";
            }
          }

          const successRate =
            commitCount > 0
              ? Math.round((goodSignatures / commitCount) * 100)
              : 0;

          const summary = `


╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║              🛡️  GPG SIGNED COMMITS VERIFICATION SUMMARY  🛡️                 ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝

Branch           : ${branch}
Total Commits    : ${commitCount}
Good Signatures  : ${goodSignatures}
Missing/Invalid  : ${commitCount - goodSignatures}
Success Rate     : ${successRate}%
Status           : ${code === 0 ? "✅ COMPLETE" : "❌ FAILED"}

${"═".repeat(SEPARATOR_WIDTH)}
`;

          event.sender.send(`scan-log:${scanId}`, {
            log: summary,
            progress: 100,
          });

          event.sender.send(`scan-complete:${scanId}`, {
            success: code === 0,
            totalCommits: commitCount,
            goodSignatures,
          });

          resolve({
            success: code === 0,
            totalCommits: commitCount,
            goodSignatures,
          });
        });

        child.on("error", (err) => {
          activeProcesses.delete(scanId);
          event.sender.send(`scan-complete:${scanId}`, {
            success: false,
            error: err.message,
          });
          resolve({ success: false, error: err.message });
        });

        // Cancel handler
        ipcMain.once(`scan:cancel-${scanId}`, () => {
          cancelled = true;
          debugLog(`Cancelling GPG scan: ${scanId}`);
          killProcess(child, scanId);
          activeProcesses.delete(scanId);
          resolve({ success: false, cancelled: true });
        });
      });
    },
  );

  /* --------------------------------------------------------
     GITLEAKS
  -------------------------------------------------------- */
  ipcMain.handle(
    "scan:gitleaks",
    async (event, { repoUrl, branch, isQuickScan, githubToken, scanId }) => {
      debugLog(`[GITLEAKS] Starting scan for ${repoUrl}`);

      const gitleaksPath = validateTool("gitleaks");
      if (!gitleaksPath) {
        event.sender.send(`scan-log:${scanId}`, {
          log: `\n❌ Gitleaks tool not found\n   Expected: ${toolPath("gitleaks")}\n\n`,
          progress: 0,
        });

        event.sender.send(`scan-complete:${scanId}`, {
          success: false,
          error: "Tool not found",
        });

        return { success: false, error: "Tool not found" };
      }

      // Clone repo first
      const repoPath = await getRepoPath(
        event,
        repoUrl,
        branch,
        isQuickScan,
        githubToken,
        scanId,
      );
      if (!repoPath) {
        event.sender.send(`scan-complete:${scanId}`, {
          success: false,
          error: "Repository preparation failed",
        });
        return { success: false, error: "Repository preparation failed" };
      }

      const reportPath = path.join(repoPath, "gitleaks-report.json");

      return new Promise((resolve) => {
        event.sender.send(`scan-log:${scanId}`, {
          log: `\n${"═".repeat(SEPARATOR_WIDTH)}\n🔐 SECRETS & CREDENTIALS DETECTION\n${"═".repeat(SEPARATOR_WIDTH)}\n\n`,
          progress: 52,
        });

        event.sender.send(`scan-log:${scanId}`, {
          log: `🔍 Scanning for hardcoded secrets and credentials...\n\n`,
          progress: 55,
        });

        // Windows-specific spawn options to prevent CMD popup
        const spawnOptions: any = {
          cwd: repoPath,
          stdio: ["ignore", "pipe", "pipe"],
          env: {
            ...process.env,
            NO_COLOR: "1", // Removed ANSI colors for cleaner parsing
          },
        };

        // Prevent CMD window popup on Windows
        if (process.platform === "win32") {
          spawnOptions.windowsHide = true;
          spawnOptions.shell = false;
          spawnOptions.detached = false;
        } else {
          spawnOptions.detached = true;
        }

        const child = spawn(
          gitleaksPath,
          [
            "detect",
            "--source",
            repoPath,
            "--report-path",
            reportPath,
            "--verbose",
          ],
          spawnOptions,
        );

        // Only unref on Unix systems
        if (process.platform !== "win32") {
          child.unref();
        }
        activeProcesses.set(scanId, child);

        let cancelled = false;

        child.stdout?.on("data", (data) => {
          if (cancelled) return;
          event.sender.send(`scan-log:${scanId}`, {
            log: data.toString(),
            progress: 70,
          });
        });

        child.stderr?.on("data", (data) => {
          if (cancelled) return;
          event.sender.send(`scan-log:${scanId}`, {
            log: data.toString(),
            progress: 85,
          });
        });

        child.on("close", async () => {
          activeProcesses.delete(scanId);

          if (cancelled) {
            resolve({ success: false, cancelled: true });
            return;
          }

          let findings = 0;
          if (fsSync.existsSync(reportPath)) {
            try {
              const report = JSON.parse(await fs.readFile(reportPath, "utf-8"));
              findings = report.length || 0;

              // Format and send detailed findings as logs
              if (findings > 0) {
                event.sender.send(`scan-log:${scanId}`, {
                  log: `\n🔍 DETAILED FINDINGS:\n${"═".repeat(SEPARATOR_WIDTH)}\n\n`,
                  progress: 90,
                });

                report.forEach((finding: any, index: number) => {
                  const secretLog = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 Secret ${index + 1}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Type        : ${finding.RuleID || "Unknown"}
Description : ${finding.Description || finding.RuleID || "N/A"}
File        : ${finding.File || "N/A"}
Line        : ${finding.StartLine || "N/A"}
Commit      : ${finding.Commit?.substring(0, 8) || "N/A"}
Author      : ${finding.Author || "N/A"}
Date        : ${finding.Date || "N/A"}

Match       : ${finding.Match?.substring(0, 80) || "N/A"}${finding.Match?.length > 80 ? "..." : ""}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

                  event.sender.send(`scan-log:${scanId}`, {
                    log: secretLog,
                    progress: 90 + Math.floor((index / findings) * 5),
                  });
                });
              }
            } catch (err) {
              debugLog(`Error parsing Gitleaks report: ${err}`);
            }
          }

          const summary = `

╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║                🔐  SECRETS & CREDENTIALS LEAKAGE SUMMARY  🔐                 ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝

Potential Secrets : ${findings}
Status            : ${findings > 0 ? "🚨 SECRETS DETECTED" : "✅ CLEAN"}
Severity          : ${findings > 0 ? "HIGH - Immediate action required" : "NONE"}

${"═".repeat(SEPARATOR_WIDTH)}
`;

          event.sender.send(`scan-log:${scanId}`, {
            log: summary,
            progress: 100,
          });

          event.sender.send(`scan-complete:${scanId}`, {
            success: true,
            findings,
          });

          resolve({ success: true, findings });
        });

        child.on("error", (err) => {
          activeProcesses.delete(scanId);
          event.sender.send(`scan-complete:${scanId}`, {
            success: false,
            error: err.message,
          });
          resolve({ success: false, error: err.message });
        });

        // Cancel handler
        ipcMain.once(`scan:cancel-${scanId}`, () => {
          cancelled = true;
          debugLog(`Cancelling Gitleaks scan: ${scanId}`);
          killProcess(child, scanId);
          activeProcesses.delete(scanId);
          resolve({ success: false, cancelled: true });
        });
      });
    },
  );

  /* --------------------------------------------------------
     TRIVY
  -------------------------------------------------------- */
  /* ============================================================
     HELPER: Format Vulnerability Scan Results into a Table
  ============================================================ */
  /* Format SBOM (Software Bill of Materials) from CycloneDX JSON */
  function formatSbomReport(cdx: any): string {
    const components: any[] = cdx.components || [];
    if (components.length === 0) return "\n   No packages detected.\n";

    let report = "\n";
    report += "╔═══════════════════════════════════════════════════════════════════════════════╗\n";
    report += "║                                                                               ║\n";
    report += "║              📦  SOFTWARE BILL OF MATERIALS (SBOM)  📦                       ║\n";
    report += "║                                                                               ║\n";
    report += "╚═══════════════════════════════════════════════════════════════════════════════╝\n";
    report += `\n   Format     : CycloneDX ${cdx.specVersion || ""}`;
    report += `\n   Serial No. : ${cdx.serialNumber || "N/A"}\n`;

    // Group components by type (library, framework, application, etc.)
    const grouped: Record<string, any[]> = {};
    for (const comp of components) {
      const t = comp.type || "unknown";
      if (!grouped[t]) grouped[t] = [];
      grouped[t].push(comp);
    }

    for (const [type, comps] of Object.entries(grouped)) {
      report += `\n📂 Type: ${type}    Components: ${comps.length}\n`;
      report += "   ────────────────────────────────────────────────────────\n";

      for (const comp of comps) {
        report += `   📦 ${comp.name}  v${comp.version || "N/A"}`;
        // Extract licenses from CycloneDX format
        if (comp.licenses && comp.licenses.length > 0) {
          const licIds = comp.licenses
            .map((l: any) => l.license?.id || l.license?.name || l.expression || "")
            .filter(Boolean);
          if (licIds.length > 0) report += `  [${licIds.join(", ")}]`;
        }
        if (comp.purl) report += `\n         purl: ${comp.purl}`;
        report += "\n";
      }
    }

    report += `\n   ── Total Packages: ${components.length} ──\n`;
    return report;
  }

  /* Format Vulnerability details */
  function formatVulnReport(results: any): string {
    if (!results.Results || results.Results.length === 0) return "";

    let report = "\n";
    report += "╔═══════════════════════════════════════════════════════════════════════════════╗\n";
    report += "║                                                                               ║\n";
    report += "║              🚨  DETAILED VULNERABILITY REPORT  🚨                           ║\n";
    report += "║                                                                               ║\n";
    report += "╚═══════════════════════════════════════════════════════════════════════════════╝\n";

    results.Results.forEach((target: any) => {
      if (target.Vulnerabilities && target.Vulnerabilities.length > 0) {
        report += `\n📂 Target: ${target.Target}\n`;
        report += `   Type:   ${target.Type}\n`;
        report +=
          "   ────────────────────────────────────────────────────────\n";

        target.Vulnerabilities.forEach((vuln: any) => {
          const severityIcon =
            vuln.Severity === "CRITICAL"
              ? "🔴"
              : vuln.Severity === "HIGH"
                ? "🟠"
                : vuln.Severity === "MEDIUM"
                  ? "🟡"
                  : "🔵";

          const nvdBaseUrl = process.env.VITE_NVD_BASE_URL || "https://nvd.nist.gov/vuln/detail/";
          report += `   ${severityIcon} [${vuln.Severity}] ${vuln.VulnerabilityID}\n`;
          report += `      🔗 ${nvdBaseUrl}${vuln.VulnerabilityID}\n`;
          report += `      📦 Package: ${vuln.PkgName} (${vuln.InstalledVersion})\n`;
          report += `      ⚠️ Title:   ${vuln.Title || "N/A"}\n`;

          if (vuln.FixedVersion) {
            report += `      ✅ Fixed in: ${vuln.FixedVersion}\n`;
          }
          report += "\n";
        });
      }
    });

    return report;
  }

  /* ============================================================
     SBOM GENERATION HANDLER
  ============================================================ */
  ipcMain.handle(
    "scan:sbom",
    async (event, { repoUrl, branch, isQuickScan, githubToken, scanId }) => {
      debugLog(`[SBOM] Starting Software Bill of Materials (SBOM) - Generation for ${repoUrl}`);

      const trivyPath = validateTool("trivy");
      if (!trivyPath) {
        event.sender.send(`scan-log:${scanId}`, {
          log: `\n❌ SBOM generator tool not found\n   Expected: ${toolPath("trivy")}\n\n`,
          progress: 0,
        });

        event.sender.send(`scan-complete:${scanId}`, {
          success: false,
          error: "Tool not found",
        });

        return { success: false, error: "Tool not found" };
      }

      // Clone repo first
      const repoPath = await getRepoPath(
        event,
        repoUrl,
        branch,
        isQuickScan,
        githubToken,
        scanId,
      );
      if (!repoPath) {
        event.sender.send(`scan-complete:${scanId}`, {
          success: false,
          error: "Repository preparation failed",
        });
        return { success: false, error: "Repository preparation failed" };
      }

      // Prepare CycloneDX SBOM output directory (same pattern as digital signature)
      const sbomTimestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, 19)
        .replace("T", "-");
      const sbomDir = path.join(
        app.getPath("temp"),
        SOFTWARE_BILL_OF_MATERIALS,
        sbomTimestamp,
      );
      fsSync.mkdirSync(sbomDir, { recursive: true });
      const sbomFilePath = path.join(sbomDir, "sbom-cyclonedx.json");

      return new Promise((resolve) => {
        event.sender.send(`scan-log:${scanId}`, {
          log: `\n${"═".repeat(SEPARATOR_WIDTH)}\n📦 SOFTWARE BILL OF MATERIALS (SBOM) GENERATION 📦\n${"═".repeat(SEPARATOR_WIDTH)}\n\n`,
          progress: 52,
        });

        event.sender.send(`scan-log:${scanId}`, {
          log: `🔍 Analyzing project dependencies...\n📦 Generating CycloneDX SBOM...\n📁 Output: ${sbomFilePath}\n\n`,
          progress: 55,
        });

        // Single Trivy invocation — CycloneDX format produces industry-standard SBOM
        const child = spawn(
          trivyPath,
          [
            "fs",
            "--format", "cyclonedx",
            "--skip-version-check",
            repoPath,
          ],
          {
            detached: true,
            stdio: ["ignore", "pipe", "pipe"],
            windowsHide: true,
          },
        );

        child.unref();
        activeProcesses.set(scanId, child);

        let jsonBuffer = "";
        let cancelled = false;

        child.stdout?.on("data", (chunk) => {
          if (cancelled) return;
          jsonBuffer += chunk.toString();
          event.sender.send(`scan-log:${scanId}`, {
            log: "📦 Enumerating packages and licenses...\n",
            progress: 70,
          });
        });

        child.stderr?.on("data", (data) => {
          if (cancelled) return;
          const msg = data.toString();
          if (!msg.includes("Update") && !msg.includes("deprecated")) {
            event.sender.send(`scan-log:${scanId}`, {
              log: msg,
              progress: 85,
            });
          }
        });

        child.on("close", (code) => {
          activeProcesses.delete(scanId);

          if (cancelled) {
            resolve({ success: false, cancelled: true });
            return;
          }

          if (code === 0) {
            try {
              const cdxJson = JSON.parse(jsonBuffer);
              const totalPackages = (cdxJson.components || []).length;

              // Write CycloneDX SBOM file to temp directory
              fsSync.writeFileSync(sbomFilePath, jsonBuffer, "utf-8");
              const sbomFileSize = fsSync.statSync(sbomFilePath).size;

              // Generate text report from CycloneDX data
              const sbomReport = formatSbomReport(cdxJson);
              event.sender.send(`scan-log:${scanId}`, {
                log: sbomReport,
                progress: 92,
              });

              // Summary
              const summary = `

╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║                       📦  SBOM GENERATION SUMMARY  📦                        ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝

Total Packages   : ${totalPackages}
Status           : ${totalPackages > 0 ? "✅ SBOM GENERATED SUCCESSFULLY" : "⚠️ NO PACKAGES DETECTED"}

 📄 CycloneDX SBOM File:
 ───────────────────────────────────────────────
  📁 Path   : ${sbomFilePath}
  💾 Size   : ${sbomFileSize} bytes
  📋 Format : CycloneDX ${cdxJson.specVersion || ""} (JSON)

${"═".repeat(SEPARATOR_WIDTH)}
`;

              event.sender.send(`scan-log:${scanId}`, {
                log: summary,
                progress: 100,
              });

              event.sender.send(`scan-complete:${scanId}`, {
                success: true,
                totalPackages,
                sbomFilePath,
              });

              resolve({ success: true, totalPackages, sbomFilePath });
            } catch (err: any) {
              console.error("SBOM Parse Error:", err);
              event.sender.send(`scan-complete:${scanId}`, {
                success: false,
                error: "Failed to parse SBOM results",
              });
              resolve({
                success: false,
                error: "Failed to parse SBOM results",
              });
            }
          } else {
            event.sender.send(`scan-complete:${scanId}`, {
              success: false,
              error: `SBOM generator exited with code ${code}`,
            });
            resolve({
              success: false,
              error: `SBOM generator exited with code ${code}`,
            });
          }
        });

        child.on("error", (err) => {
          activeProcesses.delete(scanId);
          event.sender.send(`scan-complete:${scanId}`, {
            success: false,
            error: err.message,
          });
          resolve({ success: false, error: err.message });
        });

        // Cancel Handler
        ipcMain.once(`scan:cancel-${scanId}`, () => {
          cancelled = true;
          debugLog(`Cancelling SBOM generation: ${scanId}`);
          killProcess(child, scanId);
          activeProcesses.delete(scanId);
          resolve({ success: false, cancelled: true });
        });
      });
    },
  );

  /* ============================================================
     TRIVY SCAN HANDLER
  ============================================================ */
  ipcMain.handle(
    "scan:vulnscan",
    async (event, { repoUrl, branch, isQuickScan, githubToken, scanId }) => {
      debugLog(`[VULN-SCAN] Starting vulnerability scan for ${repoUrl}`);

      const vulnScanPath = validateTool("trivy");
      if (!vulnScanPath) {
        event.sender.send(`scan-log:${scanId}`, {
          log: `\n❌ Vulnerability scanner tool not found\n   Expected: ${toolPath("trivy")}\n\n`,
          progress: 0,
        });

        event.sender.send(`scan-complete:${scanId}`, {
          success: false,
          error: "Tool not found",
        });

        return { success: false, error: "Tool not found" };
      }

      // Clone repo first
      const repoPath = await getRepoPath(
        event,
        repoUrl,
        branch,
        isQuickScan,
        githubToken,
        scanId,
      );
      if (!repoPath) {
        event.sender.send(`scan-complete:${scanId}`, {
          success: false,
          error: "Repository preparation failed",
        });
        return { success: false, error: "Repository preparation failed" };
      }

      return new Promise((resolve) => {
        event.sender.send(`scan-log:${scanId}`, {
          log: `\n${"═".repeat(SEPARATOR_WIDTH)}\n🚨 Vulnerability Scan 🚨\n${"═".repeat(SEPARATOR_WIDTH)}\n\n`,
          progress: 52,
        });

        event.sender.send(`scan-log:${scanId}`, {
          log: `🔍 Analyzing dependencies and security vulnerabilities...\n\n`,
          progress: 55,
        });

        // Spawn Trivy Process
        // We use --format json to parse details, but log progress to user via stdout listeners
        const child = spawn(
          vulnScanPath,
          [
            "fs",
            "--scanners",
            "vuln,secret,misconfig",
            "--skip-version-check",
            "--format",
            "json",
            repoPath,
          ],
          {
            detached: true,
            stdio: ["ignore", "pipe", "pipe"],
            windowsHide: true,
          },
        );

        child.unref();
        activeProcesses.set(scanId, child);

        let jsonBuffer = "";
        let cancelled = false;

        // Collect JSON output
        child.stdout?.on("data", (chunk) => {
          if (cancelled) return;
          jsonBuffer += chunk.toString();
          event.sender.send(`scan-log:${scanId}`, {
            log: "🔍 Analyzing dependencies and vulnerabilities...\n",
            progress: 70,
          });
        });

        // Capture standard error for warnings/progress
        child.stderr?.on("data", (data) => {
          if (cancelled) return;
          const msg = data.toString();

          // Filter out noisy warnings to keep logs clean
          if (!msg.includes("Update") && !msg.includes("deprecated")) {
            event.sender.send(`scan-log:${scanId}`, {
              log: msg,
              progress: 85,
            });
          }
        });

        child.on("close", (code) => {
          activeProcesses.delete(scanId);

          if (cancelled) {
            resolve({ success: false, cancelled: true });
            return;
          }

          if (code === 0) {
            try {
              // Parse JSON Result
              const results = JSON.parse(jsonBuffer);

              // Calculate Total Vulnerabilities with severity breakdown
              let vulns = 0;
              let critical = 0;
              let high = 0;
              let medium = 0;
              let low = 0;

              if (results.Results) {
                for (const r of results.Results) {
                  if (r.Vulnerabilities) {
                    for (const v of r.Vulnerabilities) {
                      vulns++;
                      const sev = (v.Severity || "").toUpperCase();
                      if (sev === "CRITICAL") critical++;
                      else if (sev === "HIGH") high++;
                      else if (sev === "MEDIUM") medium++;
                      else if (sev === "LOW") low++;
                    }
                  }
                }
              }

              // Generate Detailed Vulnerability Report
              const detailedReport = formatVulnReport(results);
              event.sender.send(`scan-log:${scanId}`, {
                log: detailedReport,
                progress: 95,
              });

              // Generate Summary Box
              const summary = `

╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║                 🚨  VULNERABILITY SCAN SUMMARY  🚨                           ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝

Vulnerabilities : ${vulns}
Critical        : ${critical}
High            : ${high}
Medium          : ${medium}
Low             : ${low}
Status          : ${vulns > 0 ? "🚨 VULNERABILITIES DETECTED" : "✅ NO VULNERABILITIES"}
Risk Level      : ${critical > 0 ? "CRITICAL" : high > 0 ? "HIGH" : medium > 0 ? "MEDIUM" : low > 0 ? "LOW" : "NONE"}

${"═".repeat(SEPARATOR_WIDTH)}
`;

              // Send Summary Log
              event.sender.send(`scan-log:${scanId}`, {
                log: summary,
                progress: 100,
              });

              // Send Complete Event
              event.sender.send(`scan-complete:${scanId}`, {
                success: true,
                vulnerabilities: vulns,
                critical,
                high,
                medium,
                low,
              });

              resolve({ success: true, vulnerabilities: vulns });
            } catch (err: any) {
              console.error("Vulnerability Scan Parse Error:", err);
              event.sender.send(`scan-complete:${scanId}`, {
                success: false,
                error: "Failed to parse vulnerability scan results",
              });
              resolve({
                success: false,
                error: "Failed to parse vulnerability scan results",
              });
            }
          } else {
            event.sender.send(`scan-complete:${scanId}`, {
              success: false,
              error: `Vulnerability scanner exited with code ${code}`,
            });
            resolve({
              success: false,
              error: `Vulnerability scanner exited with code ${code}`,
            });
          }
        });

        child.on("error", (err) => {
          activeProcesses.delete(scanId);
          event.sender.send(`scan-complete:${scanId}`, {
            success: false,
            error: err.message,
          });
          resolve({ success: false, error: err.message });
        });

        // Cancel Handler
        ipcMain.once(`scan:cancel-${scanId}`, () => {
          cancelled = true;
          debugLog(`Cancelling vulnerability scan: ${scanId}`);
          killProcess(child, scanId);
          activeProcesses.delete(scanId);
          resolve({ success: false, cancelled: true });
        });
      });
    },
  );

  /* ============================================================
     GITHUB RELEASE CREATION (Octokit)
  ============================================================ */
  ipcMain.handle(
    "release:github-create",
    async (event, { repoUrl, branch, version, githubToken, scanId }) => {
      // Quick Release passes token from UI; Product flow falls back to GITHUB_PAT env
      const token = githubToken || getGitHubToken();
      if (!token) {
        event.sender.send(`scan-log:${scanId}`, {
          log: `\n❌ GITHUB TOKEN MISSING\nProvide a token in the UI or set GITHUB_PAT environment variable\n`,
          progress: 0,
        });
        event.sender.send(`scan-complete:${scanId}`, {
          success: false,
          error: "GitHub token missing",
        });
        return { success: false, error: "GitHub token missing" };
      }

      // Parse repo info from URL
      const repoMatch = repoUrl.match(/github\.com[\/:]([^\/]+)\/([^\/\.]+)/);
      if (!repoMatch) {
        event.sender.send(`scan-log:${scanId}`, {
          log: `\n❌ Invalid GitHub URL: ${repoUrl}\n`,
          progress: 0,
        });
        return { success: false, error: "Invalid GitHub repository URL" };
      }

      const [, owner, repo] = repoMatch;
      const releaseTag = `${version}`; // Note : version is tag 1.0.0 format

      event.sender.send(`scan-log:${scanId}`, {
        log: `\n${"═".repeat(SEPARATOR_WIDTH)}\n🚀 GITHUB RELEASE CREATION\n${"═".repeat(SEPARATOR_WIDTH)}\n\n`,
        progress: 10,
      });

      event.sender.send(`scan-log:${scanId}`, {
        log: `🔹 Repository  : ${repoUrl}\n🔹 Owner/Repo   : ${owner}/${repo}\n🔹 Branch       : ${branch}\n🔹 Version      : ${version}\n🔹 Release Tag  : ${releaseTag}\n🔹 Release URL  : https://github.com/${owner}/${repo}/releases/tag/${releaseTag}\n\n`,
        progress: 20,
      });

      //  SSL fix: use a permissive HTTPS agent
      const sslAgent = new https.Agent({ rejectUnauthorized: false });
      const octokit = new Octokit({
        auth: token,
        request: { agent: sslAgent },
      });

      try {
        // 1. Check if tag already exists
        event.sender.send(`scan-log:${scanId}`, {
          log: `🔍 Checking if tag ${releaseTag} exists...\n`,
          progress: 30,
        });

        try {
          await octokit.rest.git.getRef({
            owner,
            repo,
            ref: `tags/${releaseTag}`,
          });
          event.sender.send(`scan-log:${scanId}`, {
            log: `⚠️  Tag ${releaseTag} already exists, will update...\n`,
            progress: 40,
          });
        } catch (e: any) {
          if (e.status !== 404) throw e;
          event.sender.send(`scan-log:${scanId}`, {
            log: `✅ Tag ${releaseTag} does not exist, creating new...\n`,
            progress: 40,
          });
        }

        // 2. Get branch SHA
        event.sender.send(`scan-log:${scanId}`, {
          log: `🔍 Fetching ${branch} branch SHA...\n`,
          progress: 50,
        });
        const { data: branchRef } = await octokit.rest.git.getRef({
          owner,
          repo,
          ref: `heads/${branch}`,
        });
        const branchSha = branchRef.object.sha;

        // 3. Create/Update tag ref
        event.sender.send(`scan-log:${scanId}`, {
          log: `🏷️  Creating tag ${releaseTag} on ${branchSha.slice(0, 7)}...\n`,
          progress: 60,
        });

        await octokit.rest.git.createRef({
          owner,
          repo,
          ref: `refs/tags/${releaseTag}`,
          sha: branchSha,
        });

        // 4. Create the release
        event.sender.send(`scan-log:${scanId}`, {
          log: `📦 Creating release ${releaseTag}...\n`,
          progress: 80,
        });

        const { data: release } = await octokit.rest.repos.createRelease({
          owner,
          repo,
          tag_name: releaseTag,
          target_commitish: branch,
          name: `Release ${version}`,
          body: `# Release ${version}\n\n**Created from ${branch} branch**\n\n- Tag: \`${releaseTag}\`\n- Commit: \`${branchSha.slice(0, 7)}\``,
          prerelease:
            version.includes("-") ||
            version.includes("rc") ||
            version.includes("beta"),
          draft: false,
        });

        // 5. Success summary
        const summary = `
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║                    🚀  GITHUB RELEASE CREATED  🚀                            ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝

Repository     : ${owner}/${repo}
Branch         : ${branch}
Tag            : ${releaseTag}
Status         : ✅ SUCCESS
Release ID     : ${release.id}
Release URL    : ${release.html_url}

📎 Direct Link : ${release.html_url}

${"═".repeat(SEPARATOR_WIDTH)}
`;

        event.sender.send(`scan-log:${scanId}`, {
          log: summary,
          progress: 100,
        });
        event.sender.send(`scan-complete:${scanId}`, {
          success: true,
          release: { id: release.id, url: release.html_url, tag: releaseTag },
        });

        return { success: true, release };
      } catch (error: any) {
        const errorMsg =
          error.status === 422
            ? "Release/tag already exists with different content"
            : error.message || "Unknown error";

        event.sender.send(`scan-log:${scanId}`, {
          log: `\n❌ Release creation failed:\n${errorMsg}\n\nHTTP ${error.status || "N/A"}\n`,
          progress: 0,
        });
        event.sender.send(`scan-complete:${scanId}`, {
          success: false,
          error: errorMsg,
        });

        return { success: false, error: errorMsg };
      }
    },
  );




  /* ============================================================
     KEY GENERATION
  ============================================================ */
  ipcMain.handle(
    "crypto:generate-keys",
    async (event, { type, size, curve, password, outputDir, scanId }) => {
      const exePath = validateTool("KeyGenerator");
      if (!exePath) {
        event.sender.send(`scan-log:${scanId}`, {
          log: `\n❌ TOOL ERROR: KeyGenerator not found!\nExpected: ${toolPath("KeyGenerator")}\n`,
          progress: 0,
        });
        return { success: false, error: "Tool not found" };
      }

      return new Promise((resolve) => {
        event.sender.send(`scan-log:${scanId}`, {
          log:
            `\n${"═".repeat(SEPARATOR_WIDTH)}\n🔑 KEY GENERATION STARTED\n${"═".repeat(SEPARATOR_WIDTH)}\n\n` +
            `🔹 Algorithm: ${type.toUpperCase()}${type === "rsa" ? ` (${size} bits)` : ` (${curve})`}\n` +
            `🔹 Output: ${outputDir}\n` +
            `🔹 Security: ${password ? "🔒 Protected" : "⚠️ No Password"}\n\n`,
          progress: 5,
        });

        const args: string[] = ["generate", type];
        if (type === "rsa" && size) args.push("-s", `${size}`);
        if (type === "ecdsa" && curve) args.push("-c", curve);
        if (password) args.push("-p", password);
        args.push("-o", outputDir);

        event.sender.send(`scan-log:${scanId}`, {
          log: `⏳ Executing...\n`,
          progress: 10,
        });

        const child = spawn(exePath, args, {
          stdio: ["ignore", "pipe", "pipe"],
        });

        activeProcesses.set(scanId, child);
        let buffer = "";
        let cancelled = false;

        if (child.stdout) {
          child.stdout.on("data", (chunk: Buffer) => {
            if (cancelled) return;
            const text = chunk.toString();
            buffer += text;
            event.sender.send(`scan-log:${scanId}`, {
              log: text,
              progress: 60,
            });
          });
        }

        if (child.stderr) {
          child.stderr.on("data", (chunk: Buffer) => {
            if (cancelled) return;
            const text = chunk.toString();
            buffer += text;
            event.sender.send(`scan-log:${scanId}`, {
              log: `\n🔴 [ERROR] ${text.trim()}\n`,
              progress: 50,
            });
          });
        }

        child.on("close", (code: number | null) => {
          activeProcesses.delete(scanId);
          if (cancelled) return;

          const trueSuccess = code === 0;

          const finalReport = `
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║                     🔑  KEY GENERATION REPORT  🔑                            ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝

RESULT             : ${code === 0 ? "✅ SUCCESS" : "❌ FAILED (" + code + ")"}
Algorithm          : ${type.toUpperCase()}
Timestamp          : ${new Date().toLocaleTimeString()}
${trueSuccess ? "✅ KEYS READY FOR SIGNING!" : "⚠️  Check error logs above"}

${"═".repeat(SEPARATOR_WIDTH)}
`;

          event.sender.send(`scan-log:${scanId}`, {
            log: finalReport,
            progress: 100,
          });
          event.sender.send(`scan-complete:${scanId}`, {
            success: trueSuccess,
          });
          resolve({ success: trueSuccess });
        });

        child.on("error", (error: Error) => {
          activeProcesses.delete(scanId);
          event.sender.send(`scan-log:${scanId}`, {
            log: `\n💥 SPAWN ERROR: ${error.message}`,
            progress: 0,
          });
          resolve({ success: false, error: error.message });
        });

        ipcMain.once(`scan:cancel-${scanId}`, () => {
          cancelled = true;
          if (child.pid) process.kill(child.pid, "SIGTERM");
          event.sender.send(`scan-log:${scanId}`, {
            log: `\n🛑 CANCELLED\n`,
            progress: 0,
          });
          resolve({ success: false, cancelled: true });
        });
      });
    },
  );


  
  /* ============================================================
     SIGN ARTIFACT 
  ============================================================ */
  ipcMain.handle(
    "crypto:sign-artifact",
    async (
      event,
      {
        repoUrl,
        branch,
        version,
        privateKeyPath,
        password,
        isQuickScan,
        localRepoLocation,
        githubToken,
        scanId,
      },
    ) => {
      const exePath = validateTool("SoftwareSigner");

      if (!exePath) {
        event.sender.send(`scan-log:${scanId}`, {
          log: `\n❌ TOOL ERROR: SoftwareSigner not found.\nExpected at: ${toolPath("SoftwareSigner")}\n`,
          progress: 0,
        });
        return { success: false, error: "Tool not found" };
      }

      // Determine repo path:
      // 1. Local repo path provided (quick scan local tab)
      // 2. Clone by tag when version is available (product flow / quick scan GitHub tab)
      // 3. Fall back to branch clone
      let repoPath: string | null = null;
      if (isQuickScan && localRepoLocation) {
        if (!fsSync.existsSync(localRepoLocation)) {
          event.sender.send(`scan-log:${scanId}`, {
            log: `\n❌ Local repository folder not found: ${localRepoLocation}\n`,
            progress: 0,
          });
          return { success: false, error: "Local repository folder not found" };
        }
        repoPath = localRepoLocation;
        event.sender.send(`scan-log:${scanId}`, {
          log: `\n📁 Using local repo: ${localRepoLocation}\n`,
          progress: 10,
        });
      } else if (version) {
        repoPath = await cloneRepositoryByTag(
          event,
          repoUrl,
          version,
          isQuickScan,
          githubToken,
          scanId,
        );
      } else {
        repoPath = await getRepoPath(
          event,
          repoUrl,
          branch,
          isQuickScan,
          githubToken,
          scanId,
        );
      }

      if (!repoPath) {
        event.sender.send(`scan-complete:${scanId}`, {
          success: false,
          error: "Repository preparation failed",
        });
        return { success: false, error: "Repository preparation failed" };
      }

      return new Promise((resolve) => {
        // Log (SECURE: Password not shown)
        event.sender.send(`scan-log:${scanId}`, {
          log: `\n${"═".repeat(SEPARATOR_WIDTH)}\n✍️ INITIATING CRYPTOGRAPHIC SIGNING\n${"═".repeat(SEPARATOR_WIDTH)}\n\n`,
          progress: 30,
        });

        const timestamp = new Date()
          .toISOString()
          .replace(/[:.]/g, "-")
          .slice(0, 19)
          .replace("T", "-");
        const tempDir = path.join(
          app.getPath("temp"),
          SOFTWARE_DIGITAL_SIGNATURE,
          timestamp,
        );

        fsSync.mkdirSync(tempDir, { recursive: true });
        const outputSigPath = path.join(tempDir, SIGNATURE_FILE_NAME);

        event.sender.send(`scan-log:${scanId}`, {
          log: `🔹 Target Repo : ${repoUrl}\n🔹 Branch      : ${branch}\n🔹 Signing Key : ${path.basename(privateKeyPath)}\n🔹 Security    : ${password ? "Password Protected 🔒" : "No Password ⚠️"}\n🔹 Output Path : ${outputSigPath}\n\n`,
          progress: 35,
        });

        const args = [
          "sign",
          "-c",
          repoPath,
          "-k",
          privateKeyPath,
          "-o",
          outputSigPath,
        ];
        if (password) args.push("-p", password);

        const child = spawn(exePath, args);
        activeProcesses.set(scanId, child);

        let buffer = "";
        let cancelled = false;

        child.stdout.on("data", (chunk) => {
          if (cancelled) return;
          const text = chunk.toString();
          buffer += text;
          event.sender.send(`scan-log:${scanId}`, { log: text, progress: 60 });
        });

        child.stderr.on("data", (chunk) => {
          if (cancelled) return;
          const text = chunk.toString();
          buffer += text;
          event.sender.send(`scan-log:${scanId}`, {
            log: `[STDERR] ${text}`,
            progress: 60,
          });
        });

        child.on("close", (code) => {
          activeProcesses.delete(scanId);
          if (cancelled) return;

          const success = code === 0;

          let sigSize = "0 B";
          if (success && fsSync.existsSync(outputSigPath)) {
            sigSize = `${fsSync.statSync(outputSigPath).size} bytes`;
          }

          const summary = `
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║                   ✍️  DIGITAL SIGNATURE REPORT  ✍️                           ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝

 Status        : ${success ? "✅ SIGNING SUCCESS " : "❌ SIGNING FAILED"}
 Repository    : ${repoUrl}
 Branch        : ${branch}
 Timestamp     : ${new Date().toLocaleTimeString()}

 ✍️ Signature Details:
 ───────────────────────────────────────────────
 📄 File       : ${outputSigPath}
 💾 Size       : ${sigSize}
 🔑 Key Used   : ${privateKeyPath}

${"═".repeat(SEPARATOR_WIDTH)}
`;

          event.sender.send(`scan-log:${scanId}`, {
            log: summary,
            progress: 100,
          });
          event.sender.send(`scan-complete:${scanId}`, { success });
          resolve({ success });
        });

        ipcMain.once(`scan:cancel-${scanId}`, () => {
          cancelled = true;
          if (child.pid)
            try {
              process.kill(child.pid);
            } catch (e) {}
          activeProcesses.delete(scanId);
          event.sender.send(`scan-log:${scanId}`, {
            log: "\n⚠️ PROCESS CANCELLED BY USER\n",
            progress: 0,
          });
          resolve({ success: false, cancelled: true });
        });
      });
    },
  );

  /* ============================================================
     SINGLE REPO SIGNATURE VERIFICATION 
  ============================================================ */
  ipcMain.handle(
    "verify:signature",
    async (
      event,
      {
        repoUrl,
        branch,
        version,
        publicKeyPath,
        signaturePath,
        isQuickScan,
        localRepoLocation,
        githubToken,
        scanId,
      },
    ) => {
      const exePath = validateTool("SoftwareVerifier");

      if (!exePath) {
        event.sender.send(`scan-log:${scanId}`, {
          log: `\n❌ TOOL ERROR: SoftwareVerifier not found.\nExpected at: ${toolPath("SoftwareVerifier")}\n`,
          progress: 0,
        });
        return { success: false, error: "SoftwareVerifier not found" };
      }

      if (!fsSync.existsSync(publicKeyPath)) {
        event.sender.send(`scan-log:${scanId}`, {
          log: `\n❌ Public key not found: ${publicKeyPath}\n`,
          progress: 0,
        });
        return { success: false, error: "Public key file not found" };
      }

      if (!fsSync.existsSync(signaturePath)) {
        event.sender.send(`scan-log:${scanId}`, {
          log: `\n❌ Signature file not found: ${signaturePath}\n`,
          progress: 0,
        });
        return { success: false, error: "Signature file not found" };
      }

      // Note : Clone using TAG ({version})
      const tagName = `${version}`;
      let repoPath;
      if (isQuickScan && localRepoLocation) {
        if (!fsSync.existsSync(localRepoLocation)) {
          event.sender.send(`scan-log:${scanId}`, {
            log: `\n❌ Local repository folder not found: ${localRepoLocation}\n`,
            progress: 0,
          });
          return { success: false, error: "Local repository folder not found" };
        }
        // If exist then its repoLocation
        repoPath = localRepoLocation;
      } else {
        repoPath = await cloneRepositoryByTag(
          event,
          repoUrl,
          tagName,
          isQuickScan,
          githubToken,
          scanId,
        );
      }
      if (!repoPath) {
        event.sender.send(`scan-complete:${scanId}`, {
          success: false,
          error: "Clone failed",
        });
        return {
          success: false,
          error: `Failed to clone repository at tag ${version}`,
        };
      }

      return new Promise((resolve) => {
        event.sender.send(`scan-log:${scanId}`, {
          log: `\n${"═".repeat(SEPARATOR_WIDTH)}\n🔍 DIGITAL SIGNATURE VERIFICATION\n${"═".repeat(SEPARATOR_WIDTH)}\n\n`,
          progress: 30,
        });

        event.sender.send(`scan-log:${scanId}`, {
          log: `🔹 Repository  : ${repoUrl}\n🔹 Release Tag : ${version}\n🔹 Branch      : ${branch}\n🔹 Public Key  : ${publicKeyPath}\n🔹 Signature   : ${signaturePath}\n🔹 Content Path: ${repoPath}\n\n`,
          progress: 40,
        });

        const args = [
          "verify",
          "-c",
          repoPath,
          "-k",
          publicKeyPath,
          "-s",
          signaturePath,
        ];

        const child = spawn(exePath, args, {
          stdio: ["ignore", "pipe", "pipe"],
          detached: true,
          shell: false,
        });

        activeProcesses.set(scanId, child);
        let buffer = "";
        let stderrBuffer = "";
        let cancelled = false;

        child.stdout?.on("data", (chunk) => {
          if (cancelled) return;
          const text = chunk.toString();
          buffer += text;
          event.sender.send(`scan-log:${scanId}`, { log: text, progress: 70 });
        });

        child.stderr?.on("data", (chunk) => {
          if (cancelled) return;
          const text = chunk.toString();
          stderrBuffer += text;
          event.sender.send(`scan-log:${scanId}`, {
            log: `[STDERR] ${text}`,
            progress: 70,
          });
        });

        child.on("close", (code) => {
          activeProcesses.delete(scanId);

          if (cancelled) {
            resolve({ success: false, verified: false, cancelled: true });
            return;
          }

          const verified = code === 0;
          const fullOutput = buffer + stderrBuffer;

          const summary = `
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║              🔍  DIGITAL SIGNATURE VERIFICATION REPORT  🔍                   ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝

Repository     : ${repoUrl}
Release Tag    : ${version}
Status         : ${verified ? "✅ SIGNATURE VALID" : "❌ SIGNATURE INVALID"}
Exit Code      : ${code}
Output Size    : ${Buffer.byteLength(fullOutput, "utf8")} bytes

${verified ? "🔓 Signature matches public key and content!" : "🔒 Signature verification failed!"}

${"═".repeat(SEPARATOR_WIDTH)}
`;

          event.sender.send(`scan-log:${scanId}`, {
            log: summary,
            progress: 100,
          });
          event.sender.send(`scan-complete:${scanId}`, {
            success: true,
            verified,
          });
          resolve({ success: true, verified });
        });

        child.on("error", (err) => {
          activeProcesses.delete(scanId);
          event.sender.send(`scan-log:${scanId}`, {
            log: `\n❌ Verification error: ${err.message}\n`,
            progress: 0,
          });
          event.sender.send(`scan-complete:${scanId}`, {
            success: false,
            error: err.message,
          });
          resolve({ success: false, verified: false, error: err.message });
        });

        // Cancellation handler
        ipcMain.once(`scan:cancel-${scanId}`, () => {
          cancelled = true;
          debugLog(`Cancelling signature verification: ${scanId}`);
          killProcess(child, scanId);
          activeProcesses.delete(scanId);
          event.sender.send(`scan-log:${scanId}`, {
            log: "\n⚠️ VERIFICATION CANCELLED\n",
            progress: 0,
          });
          resolve({ success: false, verified: false, cancelled: true });
        });
      });
    },
  );

  /* ============================================================
     DIALOG HANDLERS 
  ============================================================ */
  ipcMain.handle("dialog:select-folder", async (event) => {
    // Get the window that triggered this event
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return null;

    const { filePaths, canceled } = await dialog.showOpenDialog(win, {
      properties: ["openDirectory", "createDirectory", "promptToCreate"],
      title: "Select Output Directory",
      buttonLabel: "Select Folder",
    });

    return canceled || filePaths.length === 0 ? null : filePaths[0];
  });

  ipcMain.handle("dialog:select-file", async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return null;

    const { filePaths, canceled } = await dialog.showOpenDialog(win, {
      properties: ["openFile"],
      filters: [{ name: "Keys", extensions: ["pem", "key", "sig"] }],
      title: "Select Private Key",
      buttonLabel: "Select Key",
    });

    return canceled || filePaths.length === 0 ? null : filePaths[0];
  });

  /* --------------------------------------------------------
     CANCEL HANDLER
  -------------------------------------------------------- */
  ipcMain.handle("scan:cancel", async (_, { scanId }) => {
    debugLog(`Cancel requested: ${scanId}`);

    return new Promise<{ cancelled: boolean }>((resolve) => {
      let cleaned = false;

      // Cancel main process
      const child = activeProcesses.get(scanId);
      if (child) {
        debugLog(`Killing main process: ${scanId}`);
        killProcess(child, scanId);
        activeProcesses.delete(scanId);
        cleaned = true;
      }

      // Cancel clone process
      const cloneId = `${scanId}-clone`;
      const cloneChild = activeProcesses.get(cloneId);
      if (cloneChild) {
        debugLog(`Killing clone process: ${cloneId}`);
        killProcess(cloneChild, cloneId);
        activeProcesses.delete(cloneId);
        cleaned = true;
      }

      // Emit cancel events
      ipcMain.emit(`scan:cancel-${scanId}`);

      if (cleaned) {
        setTimeout(() => {
          debugLog(`Cancel complete: ${scanId}`);
          resolve({ cancelled: true });
        }, 500);
      } else {
        debugLog(`No active process found for: ${scanId}`);
        resolve({ cancelled: false });
      }
    });
  });

  /* --------------------------------------------------------
     WINDOW CONTROLS
  -------------------------------------------------------- */
  ipcMain.handle("window:minimize", () => win?.minimize());
  ipcMain.handle("window:maximize", () =>
    win?.isMaximized() ? win.unmaximize() : win?.maximize(),
  );
  ipcMain.handle("window:close", () => win?.close());
}

function cancelAllScans() {
  debugLog(`Cancelling all scans (${activeProcesses.size} processes)`);
  activeProcesses.forEach((child, id) => {
    killProcess(child, id);
  });
  activeProcesses.clear();
}

/* ============================================================
   WINDOW
============================================================ */
function createWindow() {
  splash = new BrowserWindow({
    width: 420,
    height: 280,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    show: true,
    backgroundColor: "#00000000",
  });

  splash.loadFile(path.join(process.env.VITE_PUBLIC!, "splash.html"));

  win = new BrowserWindow({
    width: 1280,
    height: 840,
    show: false,
    frame: false,
    titleBarStyle: "hidden",
    backgroundColor: "#060712",
    icon: path.join(process.env.VITE_PUBLIC!, "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
    },
  });

  registerIPC();

  if (VITE_DEV_SERVER_URL) win.loadURL(VITE_DEV_SERVER_URL);
  else win.loadFile(path.join(RENDERER_DIST, "index.html"));

  win.once("ready-to-show", () => {
    splash?.close();
    splash = null;
    win?.show();

    if (VITE_DEV_SERVER_URL) {
      win?.webContents.openDevTools({ mode: "detach" });
    }
  });

  win.webContents.on("before-input-event", (_, input) => {
    if (input.type === "keyDown") {
      if (
        input.key === "F12" ||
        (input.control && input.shift && input.key === "I")
      ) {
        if (win?.webContents.isDevToolsOpened()) {
          win?.webContents.closeDevTools();
        } else {
          win?.webContents.openDevTools({ mode: "detach" });
        }
      }
    }
  });
}

app.whenReady().then(() => {
  createWindow();
});

app.on("window-all-closed", () => {
  cancelAllScans();
  app.quit();
  win = null;
});

app.on("before-quit", () => {
  debugLog("App shutting down");
  cancelAllScans();
});
