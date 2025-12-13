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

function debugLog(msg: string) {
  console.log(`[ELECTRON][${new Date().toISOString()}] ${msg}`);
}

/* ============================================================
   TOOL PATHS
============================================================ */
function getOsFolder() {
  if (process.platform === "win32") return "win";
  if (process.platform === "darwin") return "darwin";
  return "linux";
}

function toolPath(tool: "gitleaks"): string {
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

function validateTool(tool: "gitleaks"): string | null {
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

/* ============================================================
   CLONE REPOSITORY
============================================================ */
async function cloneRepository(
  event: Electron.IpcMainInvokeEvent,
  repoUrl: string,
  branch: string,
  scanId: string
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
  debugLog(`Cloning ${repoUrl} (branch: ${branch})`);
  
  event.sender.send(`scan-log:${scanId}`, {
    log: `\n${"═".repeat(60)}\n📦 CLONING REPOSITORY\n${"═".repeat(60)}\n`,
    progress: 5,
  });
  
  event.sender.send(`scan-log:${scanId}`, {
    log: `Repository: ${repoUrl}\nBranch: ${branch}\n\n`,
    progress: 10,
  });

  const repoName = repoUrl.split("/").pop()?.replace(".git", "") || "repo";
  const timestamp = Date.now();
  const tempDir = path.join(
    app.getPath("temp"),
    "cipher-scans",
    `${repoName}-${branch.replace(/\//g, "-")}-${timestamp}`
  );

  try {
    await fs.mkdir(tempDir, { recursive: true });

    return await new Promise<string | null>((resolve) => {
      const args = ["clone", "-b", branch, "--single-branch", repoUrl, tempDir];
      
      event.sender.send(`scan-log:${scanId}`, {
        log: `$ git clone -b ${branch} --single-branch ${repoUrl}\n\n`,
        progress: 15,
      });

      const child = spawn("git", args, {
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
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
            log: `\n✅ Clone successful!\n   Location: ${tempDir}\n${"═".repeat(60)}\n\n`,
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

      // Timeout after 3 minutes
      setTimeout(() => {
        if (activeProcesses.has(cloneId)) {
          killProcess(child, cloneId);
          event.sender.send(`scan-log:${scanId}`, {
            log: `\n❌ Clone timeout after 3 minutes\n`,
            progress: 0,
          });
          resolve(null);
        }
      }, 180000);
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
  ipcMain.handle("scan:verify-gpg", async (event, { repoUrl, branch, scanId }) => {
    debugLog(`[GPG] Starting verification for ${repoUrl}`);
    
    // Clone repo first
    const repoPath = await cloneRepository(event, repoUrl, branch, scanId);
    if (!repoPath) {
      event.sender.send(`scan-complete:${scanId}`, {
        success: false,
        error: "Clone failed",
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
              progress: 50 + Math.min(commitCount, 50),
            });
          }
        }

        buffer = lines[lines.length - 1];
      });

      child.stderr?.on("data", (data) => {
        if (cancelled) return;
        event.sender.send(`scan-log:${scanId}`, {
          log: data.toString(),
          progress: 60,
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
║              GPG VERIFICATION SUMMARY                     ║
╚═══════════════════════════════════════════════════════════╝
Total Commits    : ${commitCount}
Good Signatures  : ${goodSignatures}
Missing/Invalid  : ${commitCount - goodSignatures}
Success Rate     : ${commitCount > 0 ? Math.round((goodSignatures / commitCount) * 100) : 0}%
Status           : ${code === 0 ? "✅ COMPLETE" : "❌ FAILED"}
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

        resolve({ success: code === 0, totalCommits: commitCount, goodSignatures });
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
  });

  /* --------------------------------------------------------
     GITLEAKS
  -------------------------------------------------------- */
  ipcMain.handle("scan:gitleaks", async (event, { repoUrl, branch, scanId }) => {
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
    const repoPath = await cloneRepository(event, repoUrl, branch, scanId);
    if (!repoPath) {
      event.sender.send(`scan-complete:${scanId}`, {
        success: false,
        error: "Clone failed",
      });
      return { success: false, error: "Clone failed" };
    }

    const reportPath = path.join(repoPath, "gitleaks-report.json");

    return new Promise((resolve) => {
      event.sender.send(`scan-log:${scanId}`, {
        log: `\n${"═".repeat(60)}\n🔍 GITLEAKS SECRETS SCAN\n${"═".repeat(60)}\n`,
        progress: 55,
      });

      const child = spawn(
        gitleaksPath,
        ["detect", "--source", repoPath, "--report-path", reportPath, "--verbose"],
        { 
          detached: true, 
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
        }
      );

      child.unref();
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

      child.on("close", async (code) => {
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
          } catch {}
        }

        const summary = `
╔═══════════════════════════════════════════════════════════╗
║                GITLEAKS SECRETS SUMMARY                   ║
╚═══════════════════════════════════════════════════════════╝
Potential Secrets : ${findings}
Status            : ${findings > 0 ? "⚠️ SECRETS DETECTED" : "✅ CLEAN"}
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
  });

  /* --------------------------------------------------------
     CANCEL HANDLER
  -------------------------------------------------------- */
  ipcMain.handle("scan:cancel", async (event, { scanId }) => {
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
    win?.isMaximized() ? win.unmaximize() : win?.maximize()
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
  
  win.webContents.on("before-input-event", (event, input) => {
    if (input.type === "keyDown") {
      if (input.key === "F12" || (input.control && input.shift && input.key === "I")) {
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
  debugLog("App shutting down");
  cancelAllScans();
});
