// electron/main.ts
import { app, BrowserWindow, ipcMain } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { spawn, ChildProcess } from "child_process";
import fs from "fs/promises";
import fsSync from "fs";

/* ============================================================
   PATHS
============================================================ */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname, "..");

export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let win: BrowserWindow | null = null;
let splash: BrowserWindow | null = null;

/* ============================================================
   ACTIVE PROCESSES & CACHE
============================================================ */
const activeProcesses = new Map<string, ChildProcess>();
const repoCache = new Map<string, string>();

function debugMsg(msg: string) {
  console.log(`[SCAN][${new Date().toISOString()}] ${msg}`);
}

/* ============================================================
   TOOL PATHS - With existence check
============================================================ */
function getOsFolder() {
  if (process.platform === "win32") return "win";
  if (process.platform === "darwin") return "darwin";
  return "linux";
}

function toolPath(tool: "gitleaks" | "trivy" | "codeql"): string {
  const ext = process.platform === "win32" ? ".exe" : "";
  const toolFile = tool + ext;
  return path.join(
    process.env.APP_ROOT!,
    "tools",
    getOsFolder(),
    tool,
    toolFile
  );
}

function validateTool(tool: "gitleaks" | "trivy" | "codeql"): string | null {
  const fullPath = toolPath(tool);

  if (!fsSync.existsSync(fullPath)) {
    debugMsg(`[TOOL ERROR] Tool not found: ${fullPath}`);
    return null;
  }

  debugMsg(`[TOOL OK] Found ${tool} at: ${fullPath}`);
  return fullPath;
}

/* ============================================================
   HELPER: Kill process immediately (cross-platform)
============================================================ */
function killProcessImmediately(child: ChildProcess, scanId: string) {
  if (!child || !child.pid) {
    debugMsg(`[KILL] No PID for ${scanId}`);
    return;
  }

  debugMsg(`[KILL] Killing ${scanId} (PID: ${child.pid})`);

  try {
    if (process.platform === "win32") {
      // Windows: Kill entire process tree
      spawn("taskkill", ["/pid", child.pid.toString(), "/f", "/t"], {
        stdio: "ignore",
      });
    } else {
      // Unix: Kill process group with SIGKILL
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch (e) {
        // Fallback if process group kill fails
        child.kill("SIGKILL");
      }
    }
  } catch (err: any) {
    debugMsg(`[KILL ERROR] ${scanId}: ${err.message}`);
    // Last resort: try regular kill
    try {
      child.kill("SIGKILL");
    } catch { }
  }
}

/* ============================================================
   HELPER: Validate & Auto-Clone Repo for ANY branch
============================================================ */
async function ensureRepo(
  event: Electron.IpcMainInvokeEvent,
  repoUrl: string,
  branch: string,
  scanId: string,
  step: string
): Promise<string | null> {
  const cacheKey = `${repoUrl}:${branch}`;

  // Check cache first
  if (repoCache.has(cacheKey)) {
    const cachedPath = repoCache.get(cacheKey)!;
    try {
      await fs.access(path.join(cachedPath, ".git"));

      // Verify correct branch is checked out
      const branchCheck = spawn("git", ["branch", "--show-current"], {
        cwd: cachedPath,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let currentBranch = "";
      branchCheck.stdout?.on("data", (data) => {
        currentBranch = data.toString().trim();
      });

      await new Promise((resolve) => branchCheck.on("close", resolve));

      if (currentBranch === branch) {
        debugMsg(`Using cached repo: ${cachedPath} (branch: ${branch})`);
        event.sender.send(`scan-log:${scanId}`, {
          tool: "clone",
          log: `✅ Using cached repository\n`,
          progress: 50,
          repoUrl,
          step,
        });
        event.sender.send(`scan-log:${scanId}`, {
          tool: "clone",
          log: `   Path: ${cachedPath}\n`,
          progress: 50,
          repoUrl,
          step,
        });
        event.sender.send(`scan-log:${scanId}`, {
          tool: "clone",
          log: `   Branch: ${branch}\n\n`,
          progress: 50,
          repoUrl,
          step,
        });
        return cachedPath;
      } else {
        // Wrong branch cached, remove it
        repoCache.delete(cacheKey);
        debugMsg(`Cache has wrong branch (${currentBranch} != ${branch}), re-cloning`);
      }
    } catch {
      repoCache.delete(cacheKey);
    }
  }

  // Auto-clone if not found
  debugMsg(`Cloning ${repoUrl} (branch: ${branch})`);

  event.sender.send(`scan-log:${scanId}`, {
    tool: "clone",
    log: `\n${"═".repeat(60)}\n`,
    progress: 5,
    repoUrl,
    step,
  });

  event.sender.send(`scan-log:${scanId}`, {
    tool: "clone",
    log: `📦 CLONING REPOSITORY\n`,
    progress: 8,
    repoUrl,
    step,
  });

  event.sender.send(`scan-log:${scanId}`, {
    tool: "clone",
    log: `${"═".repeat(60)}\n`,
    progress: 10,
    repoUrl,
    step,
  });

  event.sender.send(`scan-log:${scanId}`, {
    tool: "clone",
    log: `Repository : ${repoUrl}\n`,
    progress: 12,
    repoUrl,
    step,
  });

  event.sender.send(`scan-log:${scanId}`, {
    tool: "clone",
    log: `Branch     : ${branch}\n`,
    progress: 15,
    repoUrl,
    step,
  });

  // Generate unique folder name with timestamp
  const repoName = repoUrl.split("/").pop()?.replace(".git", "") || "repo";
  const timestamp = Date.now();
  const tempDir = path.join(
    app.getPath("temp"),
    "cipher-scans",
    `${repoName}-${branch.replace(/\//g, "-")}-${timestamp}`
  );

  try {
    await fs.mkdir(tempDir, { recursive: true });

    event.sender.send(`scan-log:${scanId}`, {
      tool: "clone",
      log: `Target Dir : ${tempDir}\n\n`,
      progress: 18,
      repoUrl,
      step,
    });

    const result = await new Promise<boolean>((resolve) => {
      // Clone with specific branch using -b flag
      const args = ["clone", "-b", branch, "--single-branch", repoUrl, tempDir];

      event.sender.send(`scan-log:${scanId}`, {
        tool: "clone",
        log: `$ git clone -b ${branch} --single-branch ${repoUrl}\n\n`,
        progress: 20,
        repoUrl,
        step,
      });

      const child = spawn("git", args, {
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
      });

      child.unref();
      const cloneProcessId = `${scanId}-clone`;
      activeProcesses.set(cloneProcessId, child);

      let progressLines = 0;
      let cancelled = false;

      child.stdout?.on("data", (data) => {
        const text = data.toString();
        progressLines++;
        debugMsg(`[CLONE STDOUT] ${text.trim()}`);

        event.sender.send(`scan-log:${scanId}`, {
          tool: "clone",
          log: text,
          progress: Math.min(20 + progressLines * 2, 45),
          repoUrl,
          step,
        });
      });

      child.stderr?.on("data", (data) => {
        const text = data.toString();
        progressLines++;
        debugMsg(`[CLONE STDERR] ${text.trim()}`);

        // Git progress goes to stderr
        event.sender.send(`scan-log:${scanId}`, {
          tool: "clone",
          log: text,
          progress: Math.min(20 + progressLines * 2, 45),
          repoUrl,
          step,
        });
      });

      child.on("close", async (code) => {
        activeProcesses.delete(cloneProcessId);
        debugMsg(`[CLONE] Exit code: ${code}`);

        if (cancelled) {
          resolve(false);
          return;
        }

        if (code === 0) {
          // Verify branch
          const verifyBranch = spawn("git", ["branch", "--show-current"], {
            cwd: tempDir,
            stdio: ["ignore", "pipe", "pipe"],
          });

          let actualBranch = "";
          verifyBranch.stdout?.on("data", (data) => {
            actualBranch = data.toString().trim();
          });

          verifyBranch.on("close", () => {
            if (actualBranch === branch) {
              repoCache.set(cacheKey, tempDir);

              event.sender.send(`scan-log:${scanId}`, {
                tool: "clone",
                log: `\n✅ Clone successful!\n`,
                progress: 50,
                repoUrl,
                step,
              });

              event.sender.send(`scan-log:${scanId}`, {
                tool: "clone",
                log: `   Branch verified: ${actualBranch}\n`,
                progress: 50,
                repoUrl,
                step,
              });

              event.sender.send(`scan-log:${scanId}`, {
                tool: "clone",
                log: `   Location: ${tempDir}\n`,
                progress: 50,
                repoUrl,
                step,
              });

              event.sender.send(`scan-log:${scanId}`, {
                tool: "clone",
                log: `${"═".repeat(60)}\n\n`,
                progress: 50,
                repoUrl,
                step,
              });

              resolve(true);
            } else {
              event.sender.send(`scan-log:${scanId}`, {
                tool: "clone",
                log: `\n⚠️ Branch mismatch: expected '${branch}', got '${actualBranch}'\n`,
                progress: 0,
                repoUrl,
                step,
              });
              resolve(false);
            }
          });
        } else {
          event.sender.send(`scan-log:${scanId}`, {
            tool: "clone",
            log: `\n❌ Clone failed with exit code ${code}\n`,
            progress: 0,
            repoUrl,
            step,
          });

          event.sender.send(`scan-log:${scanId}`, {
            tool: "clone",
            log: `   This could mean:\n`,
            progress: 0,
            repoUrl,
            step,
          });

          event.sender.send(`scan-log:${scanId}`, {
            tool: "clone",
            log: `   • Branch '${branch}' does not exist\n`,
            progress: 0,
            repoUrl,
            step,
          });

          event.sender.send(`scan-log:${scanId}`, {
            tool: "clone",
            log: `   • Repository is private/inaccessible\n`,
            progress: 0,
            repoUrl,
            step,
          });

          event.sender.send(`scan-log:${scanId}`, {
            tool: "clone",
            log: `   • Network connectivity issue\n\n`,
            progress: 0,
            repoUrl,
            step,
          });

          resolve(false);
        }
      });

      child.on("error", (err) => {
        activeProcesses.delete(cloneProcessId);
        debugMsg(`[CLONE ERROR] ${err.message}`);

        event.sender.send(`scan-log:${scanId}`, {
          tool: "clone",
          log: `\n❌ Clone error: ${err.message}\n`,
          progress: 0,
          repoUrl,
          step,
        });

        event.sender.send(`scan-log:${scanId}`, {
          tool: "clone",
          log: `   Check if git is installed: git --version\n\n`,
          progress: 0,
          repoUrl,
          step,
        });

        resolve(false);
      });

      // ✅ Handle clone cancellation
      const cancelHandler = () => {
        cancelled = true;
        debugMsg(`[CLONE] Cancelling clone for ${scanId}`);
        killProcessImmediately(child, cloneProcessId);
        activeProcesses.delete(cloneProcessId);
        resolve(false);
      };

      ipcMain.once(`scan:cancel-${scanId}`, cancelHandler);
      ipcMain.once(`scan:cancel-${cloneProcessId}`, cancelHandler);

      // Timeout after 3 minutes
      setTimeout(() => {
        if (activeProcesses.has(cloneProcessId)) {
          debugMsg(`[CLONE] Timeout after 3 minutes`);
          killProcessImmediately(child, cloneProcessId);

          event.sender.send(`scan-log:${scanId}`, {
            tool: "clone",
            log: `\n❌ Clone timeout after 3 minutes\n`,
            progress: 0,
            repoUrl,
            step,
          });

          event.sender.send(`scan-log:${scanId}`, {
            tool: "clone",
            log: `   Repository might be too large or network is slow\n\n`,
            progress: 0,
            repoUrl,
            step,
          });

          resolve(false);
        }
      }, 180000);
    });

    return result ? tempDir : null;
  } catch (err: any) {
    debugMsg(`[CLONE EXCEPTION] ${err.message}`);

    event.sender.send(`scan-log:${scanId}`, {
      tool: "clone",
      log: `\n❌ Exception during clone: ${err.message}\n\n`,
      progress: 0,
      repoUrl,
      step,
    });

    return null;
  }
}

/* ============================================================
   IPC - All handlers inside registerIPC()
============================================================ */
function registerIPC() {
  /* --------------------------------------------------------
     STEP 1 — VERIFY GPG SIGNED COMMITS
  -------------------------------------------------------- */
  ipcMain.handle("scan:verify-gpg", async (event, { repoUrl, branch, scanId }) => {
    debugMsg(`[GPG] Starting verification for ${repoUrl}`);

    // Auto-clone if needed
    const repoPath = await ensureRepo(event, repoUrl, branch, scanId, "verify-gpg");
    if (!repoPath) {
      event.sender.send(`scan-complete:${scanId}`, {
        tool: "gpg",
        success: false,
        repoUrl,
        step: "verify-gpg",
      });
      return { success: false, error: "Clone failed" };
    }

    return new Promise((resolve) => {
      const child = spawn(
        "git",
        ["log", "--show-signature", "--pretty=format:%H|%an|%aI|%s", "-n", "50"],
        {
          cwd: repoPath,
          detached: true,
          stdio: ["ignore", "pipe", "pipe"],
        }
      );

      child.unref();
      activeProcesses.set(scanId, child);

      let buffer = "";
      let commitCount = 0;
      let goodSignatures = 0;
      let cancelled = false;

      child.stdout?.on("data", (chunk) => {
        if (cancelled) return;

        buffer += chunk.toString();
        const lines = buffer.split("\n");

        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i];

          if (line.includes("|")) {
            commitCount++;
            const [sha, author, date, subject] = line.split("|");
            const isGoodSig = buffer.includes("Good signature") || buffer.includes("gpg: Good");
            if (isGoodSig) goodSignatures++;

            const formattedLog = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 Commit ${commitCount}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SHA        : ${sha.substring(0, 8)}
Author     : ${author}
Date       : ${date}
Message    : ${subject}

GPG Status : ${isGoodSig ? "✅ GOOD SIGNATURE" : "❌ MISSING/INVALID SIGNATURE"}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

            event.sender.send(`scan-log:${scanId}`, {
              tool: "gpg",
              log: formattedLog,
              progress: 50 + Math.min(commitCount, 50),
              repoUrl,
              step: "verify-gpg",
            });
          }
        }

        buffer = lines[lines.length - 1];
      });

      child.stderr?.on("data", (data) => {
        if (cancelled) return;

        event.sender.send(`scan-log:${scanId}`, {
          tool: "gpg",
          log: data.toString(),
          progress: 60,
          repoUrl,
          step: "verify-gpg",
        });
      });

      child.on("close", (code) => {
        activeProcesses.delete(scanId);

        if (cancelled) {
          resolve({ success: false, cancelled: true });
          return;
        }

        const summary = `
╔═══════════════════════════════════════════════════════════╗
║                  GPG VERIFICATION SUMMARY                 ║
╚═══════════════════════════════════════════════════════════╝
Total Commits    : ${commitCount}
Good Signatures  : ${goodSignatures}
Missing/Invalid  : ${commitCount - goodSignatures}
Success Rate     : ${commitCount > 0 ? Math.round((goodSignatures / commitCount) * 100) : 0}%
Status           : ${code === 0 ? "✅ COMPLETE" : "❌ FAILED"}
`;

        event.sender.send(`scan-log:${scanId}`, {
          tool: "gpg",
          log: summary,
          progress: 100,
          repoUrl,
          step: "verify-gpg",
        });

        event.sender.send(`scan-complete:${scanId}`, {
          tool: "gpg",
          success: code === 0,
          totalCommits: commitCount,
          goodSignatures,
          repoUrl,
          step: "verify-gpg",
        });

        resolve({ success: code === 0, totalCommits: commitCount, goodSignatures });
      });

      child.on("error", (err) => {
        activeProcesses.delete(scanId);
        event.sender.send(`scan-complete:${scanId}`, {
          tool: "gpg",
          success: false,
          repoUrl,
          step: "verify-gpg",
        });
        resolve({ success: false, error: err.message });
      });

      ipcMain.once(`scan:cancel-${scanId}`, () => {
        cancelled = true;
        debugMsg(`[GPG] Received cancel signal for ${scanId}`);
        killProcessImmediately(child, scanId);
        activeProcesses.delete(scanId);
        resolve({ success: false, cancelled: true });
      });
    });
  });

  /* --------------------------------------------------------
     STEP 2 — GITLEAKS (with tool validation)
  -------------------------------------------------------- */
  ipcMain.handle("scan:gitleaks", async (event, { repoUrl, branch, scanId }) => {
    debugMsg(`[GITLEAKS] Starting scan for ${repoUrl}`);

    // Validate tool exists FIRST
    const gitleaksPath = validateTool("gitleaks");
    if (!gitleaksPath) {
      event.sender.send(`scan-log:${scanId}`, {
        tool: "gitleaks",
        log: `\n❌ Gitleaks tool not found\n`,
        progress: 0,
        repoUrl,
        step: "gitleaks",
      });
      event.sender.send(`scan-log:${scanId}`, {
        tool: "gitleaks",
        log: `   Expected location: ${toolPath("gitleaks")}\n`,
        progress: 0,
        repoUrl,
        step: "gitleaks",
      });
      event.sender.send(`scan-log:${scanId}`, {
        tool: "gitleaks",
        log: `   Please download Gitleaks from https://github.com/gitleaks/gitleaks/releases\n\n`,
        progress: 0,
        repoUrl,
        step: "gitleaks",
      });

      event.sender.send(`scan-complete:${scanId}`, {
        tool: "gitleaks",
        success: false,
        repoUrl,
        step: "gitleaks",
      });

      return { success: false, error: "Tool not found" };
    }

    debugMsg(`[GITLEAKS] Tool path validated: ${gitleaksPath}`);

    const repoPath = await ensureRepo(event, repoUrl, branch, scanId, "gitleaks");
    if (!repoPath) {
      event.sender.send(`scan-complete:${scanId}`, {
        tool: "gitleaks",
        success: false,
        repoUrl,
        step: "gitleaks",
      });
      return { success: false, error: "Clone failed" };
    }

    debugMsg(`[GITLEAKS] Repo path: ${repoPath}`);
    const reportPath = path.join(repoPath, "gitleaks-report.json");
    debugMsg(`[GITLEAKS] Report path: ${reportPath}`);

    return new Promise((resolve) => {
      const args = ["detect", "--source", repoPath, "--report-path", reportPath, "--verbose"];

      debugMsg(`[GITLEAKS] Spawning: ${gitleaksPath} ${args.join(" ")}`);

      let child: ChildProcess;
      try {
        child = spawn(gitleaksPath, args, {
          detached: true,
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true, // ✅ Hide console window on Windows
        });
      } catch (spawnError: any) {
        debugMsg(`[GITLEAKS] Spawn failed: ${spawnError.message}`);
        debugMsg(`[GITLEAKS] Error code: ${spawnError.code}`);
        debugMsg(`[GITLEAKS] Error errno: ${spawnError.errno}`);

        event.sender.send(`scan-log:${scanId}`, {
          tool: "gitleaks",
          log: `\n❌ Failed to start Gitleaks\n`,
          progress: 0,
          repoUrl,
          step: "gitleaks",
        });
        event.sender.send(`scan-log:${scanId}`, {
          tool: "gitleaks",
          log: `   Error: ${spawnError.message}\n`,
          progress: 0,
          repoUrl,
          step: "gitleaks",
        });
        event.sender.send(`scan-log:${scanId}`, {
          tool: "gitleaks",
          log: `   Tool path: ${gitleaksPath}\n`,
          progress: 0,
          repoUrl,
          step: "gitleaks",
        });
        event.sender.send(`scan-log:${scanId}`, {
          tool: "gitleaks",
          log: `   Check if binary is corrupted or has correct permissions\n\n`,
          progress: 0,
          repoUrl,
          step: "gitleaks",
        });

        event.sender.send(`scan-complete:${scanId}`, {
          tool: "gitleaks",
          success: false,
          repoUrl,
          step: "gitleaks",
        });

        return resolve({ success: false, error: spawnError.message });
      }

      if (!child || !child.pid) {
        debugMsg(`[GITLEAKS] Child process has no PID!`);
        event.sender.send(`scan-complete:${scanId}`, {
          tool: "gitleaks",
          success: false,
          repoUrl,
          step: "gitleaks",
        });
        return resolve({ success: false, error: "Failed to spawn process" });
      }

      debugMsg(`[GITLEAKS] Process spawned with PID: ${child.pid}`);
      child.unref();
      activeProcesses.set(scanId, child);

      let cancelled = false;

      child.stdout?.on("data", (data) => {
        if (cancelled) return;

        event.sender.send(`scan-log:${scanId}`, {
          tool: "gitleaks",
          log: data.toString(),
          progress: 60,
          repoUrl,
          step: "gitleaks",
        });
      });

      child.stderr?.on("data", (data) => {
        if (cancelled) return;

        event.sender.send(`scan-log:${scanId}`, {
          tool: "gitleaks",
          log: data.toString(),
          progress: 80,
          repoUrl,
          step: "gitleaks",
        });
      });

      child.on("close", async (code) => {
        activeProcesses.delete(scanId);
        debugMsg(`[GITLEAKS] Process closed with code: ${code}`);

        if (cancelled) {
          resolve({ success: false, cancelled: true });
          return;
        }

        let findings = 0;
        if (fsSync.existsSync(reportPath)) {
          try {
            const report = JSON.parse(await fs.readFile(reportPath, "utf-8"));
            findings = report.length || 0;
          } catch { }
        }

        const summary = `
╔═══════════════════════════════════════════════════════════╗
║                  GITLEAKS SCAN SUMMARY                    ║
╚═══════════════════════════════════════════════════════════╝
Potential Secrets Found : ${findings}
Status                  : ${findings > 0 ? "⚠️ SECRETS DETECTED" : "✅ CLEAN"}
╚═══════════════════════════════════════════════════════════╝
`;

        event.sender.send(`scan-log:${scanId}`, {
          tool: "gitleaks",
          log: summary,
          progress: 100,
          repoUrl,
          step: "gitleaks",
        });

        event.sender.send(`scan-complete:${scanId}`, {
          tool: "gitleaks",
          success: true,
          findings,
          repoUrl,
          step: "gitleaks",
        });

        resolve({ success: true, findings });
      });

      child.on("error", (err) => {
        activeProcesses.delete(scanId);
        debugMsg(`[GITLEAKS] Process error: ${err.message}`);

        event.sender.send(`scan-complete:${scanId}`, {
          tool: "gitleaks",
          success: false,
          repoUrl,
          step: "gitleaks",
        });
        resolve({ success: false, error: err.message });
      });

      ipcMain.once(`scan:cancel-${scanId}`, () => {
        cancelled = true;
        debugMsg(`[GITLEAKS] Received cancel signal for ${scanId}`);
        killProcessImmediately(child, scanId);
        activeProcesses.delete(scanId);
        resolve({ success: false, cancelled: true });
      });
    });
  });


  /* --------------------------------------------------------
     STEP 3 — TRIVY SBOM (with tool validation)
  -------------------------------------------------------- */
  ipcMain.handle("scan:trivy", async (event, { repoUrl, branch, scanId }) => {
    debugMsg(`[TRIVY] Starting SBOM scan for ${repoUrl}`);

    // ✅ Validate tool exists FIRST
    const trivyPath = validateTool("trivy");
    if (!trivyPath) {
      event.sender.send(`scan-log:${scanId}`, {
        tool: "trivy",
        log: `\n❌ Trivy tool not found\n`,
        progress: 0,
        repoUrl,
        step: "sbom-trivy",
      });
      event.sender.send(`scan-log:${scanId}`, {
        tool: "trivy",
        log: `   Expected location: ${toolPath("trivy")}\n`,
        progress: 0,
        repoUrl,
        step: "sbom-trivy",
      });
      event.sender.send(`scan-log:${scanId}`, {
        tool: "trivy",
        log: `   Please download Trivy and place in tools folder\n\n`,
        progress: 0,
        repoUrl,
        step: "sbom-trivy",
      });

      event.sender.send(`scan-complete:${scanId}`, {
        tool: "trivy",
        success: false,
        repoUrl,
        step: "sbom-trivy",
      });

      return { success: false, error: "Tool not found" };
    }

    const repoPath = await ensureRepo(event, repoUrl, branch, scanId, "sbom-trivy");
    if (!repoPath) {
      event.sender.send(`scan-complete:${scanId}`, {
        tool: "trivy",
        success: false,
        repoUrl,
        step: "sbom-trivy",
      });
      return { success: false, error: "Clone failed" };
    }

    return new Promise((resolve) => {
      const child = spawn(
        trivyPath, // ✅ Use validated path
        ["fs", "--security-checks", "vuln,config", "--format", "json", repoPath],
        { detached: true, stdio: ["ignore", "pipe", "pipe"] }
      );

      child.unref();
      activeProcesses.set(scanId, child);
      let jsonBuffer = "";
      let cancelled = false;

      child.stdout?.on("data", (chunk) => {
        if (cancelled) return;

        jsonBuffer += chunk.toString();
        event.sender.send(`scan-log:${scanId}`, {
          tool: "trivy",
          log: "🔍 Analyzing dependencies and vulnerabilities...\n",
          progress: 70,
          repoUrl,
          step: "sbom-trivy",
        });
      });

      child.stderr?.on("data", (data) => {
        if (cancelled) return;

        event.sender.send(`scan-log:${scanId}`, {
          tool: "trivy",
          log: data.toString(),
          progress: 85,
          repoUrl,
          step: "sbom-trivy",
        });
      });

      child.on("close", (code) => {
        activeProcesses.delete(scanId);

        if (cancelled) {
          resolve({ success: false, cancelled: true });
          return;
        }

        if (code === 0) {
          try {
            const results = JSON.parse(jsonBuffer);
            const vulns = results.Results?.reduce(
              (acc: number, r: any) => acc + (r.Vulnerabilities?.length || 0),
              0
            ) || 0;

            const summary = `
╔═══════════════════════════════════════════════════════════╗
║                   TRIVY SBOM SUMMARY                      ║
╚═══════════════════════════════════════════════════════════╝
Vulnerabilities Found : ${vulns}
Status                : ${vulns > 0 ? "⚠️ VULNERABILITIES DETECTED" : "✅ NO VULNERABILITIES"}
╚═══════════════════════════════════════════════════════════╝
`;

            event.sender.send(`scan-log:${scanId}`, {
              tool: "trivy",
              log: summary,
              progress: 100,
              repoUrl,
              step: "sbom-trivy",
            });

            event.sender.send(`scan-complete:${scanId}`, {
              tool: "trivy",
              success: true,
              vulns,
              repoUrl,
              step: "sbom-trivy",
            });

            resolve({ success: true, vulns });
          } catch (err: any) {
            event.sender.send(`scan-complete:${scanId}`, {
              tool: "trivy",
              success: false,
              repoUrl,
              step: "sbom-trivy",
            });
            resolve({ success: false, error: "Failed to parse Trivy results" });
          }
        } else {
          event.sender.send(`scan-complete:${scanId}`, {
            tool: "trivy",
            success: false,
            repoUrl,
            step: "sbom-trivy",
          });
          resolve({ success: false, error: `Trivy exited with code ${code}` });
        }
      });

      child.on("error", (err) => {
        activeProcesses.delete(scanId);
        event.sender.send(`scan-complete:${scanId}`, {
          tool: "trivy",
          success: false,
          repoUrl,
          step: "sbom-trivy",
        });
        resolve({ success: false, error: err.message });
      });

      ipcMain.once(`scan:cancel-${scanId}`, () => {
        cancelled = true;
        debugMsg(`[TRIVY] Received cancel signal for ${scanId}`);
        killProcessImmediately(child, scanId);
        activeProcesses.delete(scanId);
        resolve({ success: false, cancelled: true });
      });
    });
  });

  /* --------------------------------------------------------
     STEP 4 — CODEQL SAST (with tool validation)
  -------------------------------------------------------- */
  ipcMain.handle("scan:codeql", async (event, { repoUrl, branch, scanId }) => {
    debugMsg(`[CODEQL] Starting SAST analysis for ${repoUrl}`);

    // ✅ Validate tool exists FIRST
    const codeqlPath = validateTool("codeql");
    if (!codeqlPath) {
      event.sender.send(`scan-log:${scanId}`, {
        tool: "codeql",
        log: `\n❌ CodeQL tool not found\n`,
        progress: 0,
        repoUrl,
        step: "sast-codeql",
      });
      event.sender.send(`scan-log:${scanId}`, {
        tool: "codeql",
        log: `   Expected location: ${toolPath("codeql")}\n`,
        progress: 0,
        repoUrl,
        step: "sast-codeql",
      });
      event.sender.send(`scan-log:${scanId}`, {
        tool: "codeql",
        log: `   Please download CodeQL CLI and place in tools folder\n\n`,
        progress: 0,
        repoUrl,
        step: "sast-codeql",
      });

      event.sender.send(`scan-complete:${scanId}`, {
        tool: "codeql",
        success: false,
        repoUrl,
        step: "sast-codeql",
      });

      return { success: false, error: "Tool not found" };
    }

    const repoPath = await ensureRepo(event, repoUrl, branch, scanId, "sast-codeql");
    if (!repoPath) {
      event.sender.send(`scan-complete:${scanId}`, {
        tool: "codeql",
        success: false,
        repoUrl,
        step: "sast-codeql",
      });
      return { success: false, error: "Clone failed" };
    }

    const dbPath = path.join(repoPath, "codeql-db");
    const sarifPath = path.join(repoPath, "codeql-results.sarif");
    let cancelled = false;

    return new Promise((resolve) => {
      // Step 1: Create database
      event.sender.send(`scan-log:${scanId}`, {
        tool: "codeql",
        log: "📊 Creating CodeQL database...\n",
        progress: 50,
        repoUrl,
        step: "sast-codeql",
      });

      const createDb = spawn(
        codeqlPath, // ✅ Use validated path
        ["database", "create", dbPath, "--language=javascript", "--source-root", repoPath],
        { detached: true, stdio: ["ignore", "pipe", "pipe"] }
      );

      createDb.unref();
      activeProcesses.set(scanId, createDb);

      createDb.stdout?.on("data", (data) => {
        if (cancelled) return;

        event.sender.send(`scan-log:${scanId}`, {
          tool: "codeql",
          log: data.toString(),
          progress: 60,
          repoUrl,
          step: "sast-codeql",
        });
      });

      createDb.stderr?.on("data", (data) => {
        if (cancelled) return;

        event.sender.send(`scan-log:${scanId}`, {
          tool: "codeql",
          log: data.toString(),
          progress: 65,
          repoUrl,
          step: "sast-codeql",
        });
      });

      createDb.on("close", (code) => {
        if (cancelled) {
          activeProcesses.delete(scanId);
          resolve({ success: false, cancelled: true });
          return;
        }

        if (code !== 0) {
          activeProcesses.delete(scanId);
          event.sender.send(`scan-complete:${scanId}`, {
            tool: "codeql",
            success: false,
            repoUrl,
            step: "sast-codeql",
          });
          resolve({ success: false, error: `Database creation failed with code ${code}` });
          return;
        }

        // Step 2: Analyze
        event.sender.send(`scan-log:${scanId}`, {
          tool: "codeql",
          log: "\n🔬 Running CodeQL analysis...\n",
          progress: 70,
          repoUrl,
          step: "sast-codeql",
        });

        const analyze = spawn(
          codeqlPath, // ✅ Use validated path
          [
            "database",
            "analyze",
            dbPath,
            "--format=sarif-latest",
            "--output",
            sarifPath,
          ],
          { detached: true, stdio: ["ignore", "pipe", "pipe"] }
        );

        analyze.unref();
        activeProcesses.set(scanId, analyze);

        analyze.stdout?.on("data", (data) => {
          if (cancelled) return;

          event.sender.send(`scan-log:${scanId}`, {
            tool: "codeql",
            log: data.toString(),
            progress: 85,
            repoUrl,
            step: "sast-codeql",
          });
        });

        analyze.stderr?.on("data", (data) => {
          if (cancelled) return;

          event.sender.send(`scan-log:${scanId}`, {
            tool: "codeql",
            log: data.toString(),
            progress: 90,
            repoUrl,
            step: "sast-codeql",
          });
        });

        analyze.on("close", (analyzeCode) => {
          activeProcesses.delete(scanId);

          if (cancelled) {
            resolve({ success: false, cancelled: true });
            return;
          }

          const summary = `
╔═══════════════════════════════════════════════════════════╗
║                  CODEQL SAST SUMMARY                      ║
╚═══════════════════════════════════════════════════════════╝
Analysis Status : ${analyzeCode === 0 ? "✅ COMPLETE" : "❌ FAILED"}
SARIF Report    : ${sarifPath}
╚═══════════════════════════════════════════════════════════╝
`;

          event.sender.send(`scan-log:${scanId}`, {
            tool: "codeql",
            log: summary,
            progress: 100,
            repoUrl,
            step: "sast-codeql",
          });

          event.sender.send(`scan-complete:${scanId}`, {
            tool: "codeql",
            success: analyzeCode === 0,
            repoUrl,
            step: "sast-codeql",
          });

          resolve({ success: analyzeCode === 0 });
        });
      });

      createDb.on("error", (err) => {
        activeProcesses.delete(scanId);
        event.sender.send(`scan-complete:${scanId}`, {
          tool: "codeql",
          success: false,
          repoUrl,
          step: "sast-codeql",
        });
        resolve({ success: false, error: err.message });
      });

      ipcMain.once(`scan:cancel-${scanId}`, () => {
        cancelled = true;
        debugMsg(`[CODEQL] Received cancel signal for ${scanId}`);
        killProcessImmediately(createDb, scanId);
        activeProcesses.delete(scanId);
        resolve({ success: false, cancelled: true });
      });
    });
  });


  /* --------------------------------------------------------
     CANCEL HANDLER - Async (non-blocking for renderer)
  -------------------------------------------------------- */
  ipcMain.on("scan:cancel-async", (event, { scanId }) => {
    debugMsg(`[CANCEL ASYNC] Received: ${scanId}`);

    // Cancel main process
    const child = activeProcesses.get(scanId);
    if (child) {
      killProcessImmediately(child, scanId);
      activeProcesses.delete(scanId);
    }

    // Cancel clone process
    const cloneProcessId = `${scanId}-clone`;
    const cloneChild = activeProcesses.get(cloneProcessId);
    if (cloneChild) {
      killProcessImmediately(cloneChild, cloneProcessId);
      activeProcesses.delete(cloneProcessId);
    }

    // Emit cancel events
    ipcMain.emit(`scan:cancel-${scanId}`);
    ipcMain.emit(`scan:cancel-${cloneProcessId}`);

    // No response - fire and forget
  });

  // ✅ Keep the old handler for backward compatibility if needed
  ipcMain.handle("scan:cancel", (event, { scanId }) => {
    debugMsg(`[CANCEL SYNC] Received: ${scanId}`);

    const child = activeProcesses.get(scanId);
    if (child) {
      killProcessImmediately(child, scanId);
      activeProcesses.delete(scanId);
    }

    const cloneProcessId = `${scanId}-clone`;
    const cloneChild = activeProcesses.get(cloneProcessId);
    if (cloneChild) {
      killProcessImmediately(cloneChild, cloneProcessId);
      activeProcesses.delete(cloneProcessId);
    }

    ipcMain.emit(`scan:cancel-${scanId}`);
    ipcMain.emit(`scan:cancel-${cloneProcessId}`);

    return { cancelled: true };
  });

  /* --------------------------------------------------------
     WINDOW CONTROLS
  -------------------------------------------------------- */
  ipcMain.handle("window:minimize", () => win?.minimize());
  ipcMain.handle("window:maximize", () =>
    win?.isMaximized() ? win.unmaximize() : win?.maximize()
  );
  ipcMain.handle("window:close", () => win?.close());
}

function cancelAllScans() {
  debugMsg(`[CANCEL ALL] Killing all ${activeProcesses.size} processes`);

  activeProcesses.forEach((child, scanId) => {
    killProcessImmediately(child, scanId);
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

    // ✅ Open DevTools automatically in development
    if (VITE_DEV_SERVER_URL) {
      win?.webContents.openDevTools({ mode: "detach" });
    }
  });

  // ✅ Add keyboard shortcut to toggle DevTools (Ctrl+Shift+I or F12)
  win.webContents.on("before-input-event", (event, input) => {
    if (input.type === "keyDown") {
      // F12 or Ctrl+Shift+I
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

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  cancelAllScans();
  app.quit();
  win = null;
});

app.on("before-quit", () => {
  debugMsg("[APP] Shutting down - cancelling all scans");
  cancelAllScans();
});

