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

function toolPath(tool: "gitleaks" | "trivy" | "opengrep"): string {
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

function validateTool(tool: "gitleaks" | "trivy" | "opengrep"): string | null {
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
    debugLog(`[GPG] Starting verification for ${repoUrl} on branch ${branch}`);
    
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
      event.sender.send(`scan-log:${scanId}`, {
        log: `\n${"═".repeat(60)}\n🔐 GPG SIGNATURE VERIFICATION\n${"═".repeat(60)}\n\n`,
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
        }
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
              (signatureBlock.includes("using RSA key") && signatureBlock.includes("Good")) ||
              (signatureBlock.includes("using ECDSA key") && signatureBlock.includes("Good"))
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
              progress: 55 + Math.min((commitCount / Math.max(commitCount, 1)) * 35, 35),
            });

            // Clear signature block for next commit
            signatureBlock = "";
          }
        }
        
        const successRate = commitCount > 0 ? Math.round((goodSignatures / commitCount) * 100) : 0;
        
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

${"═".repeat(79)}
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
      log: `\n${"═".repeat(60)}\n🔐 SECRETS & CREDENTIALS DETECTION\n${"═".repeat(60)}\n\n`,
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
        NO_COLOR: '1', // Removed ANSI colors for cleaner parsing
      }
    };

    // Prevent CMD window popup on Windows
    if (process.platform === 'win32') {
      spawnOptions.windowsHide = true;
      spawnOptions.shell = false;
      spawnOptions.detached = false; 
    } else {
      spawnOptions.detached = true;
    }

    const child = spawn(
      gitleaksPath,
      ["detect", "--source", repoPath, "--report-path", reportPath, "--verbose"],
      spawnOptions
    );

    // Only unref on Unix systems
    if (process.platform !== 'win32') {
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
          
          // Format and send detailed findings as logs
          if (findings > 0) {
            event.sender.send(`scan-log:${scanId}`, {
              log: `\n🔍 DETAILED FINDINGS:\n${"═".repeat(79)}\n\n`,
              progress: 90,
            });
            
            report.forEach((finding: any, index: number) => {
              const secretLog = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 Secret ${index + 1}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Type        : ${finding.RuleID || 'Unknown'}
Description : ${finding.Description || finding.RuleID || 'N/A'}
File        : ${finding.File || 'N/A'}
Line        : ${finding.StartLine || 'N/A'}
Commit      : ${finding.Commit?.substring(0, 8) || 'N/A'}
Author      : ${finding.Author || 'N/A'}
Date        : ${finding.Date || 'N/A'}

Match       : ${finding.Match?.substring(0, 80) || 'N/A'}${finding.Match?.length > 80 ? '...' : ''}
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

${"═".repeat(79)}
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
     TRIVY
  -------------------------------------------------------- */
  ipcMain.handle("scan:trivy", async (event, { repoUrl, branch, scanId }) => {
    debugLog(`[TRIVY] Starting SBOM scan for ${repoUrl}`);
    
    const trivyPath = validateTool("trivy");
    if (!trivyPath) {
      event.sender.send(`scan-log:${scanId}`, {
        log: `\n❌ Trivy tool not found\n   Expected: ${toolPath("trivy")}\n\n`,
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

    return new Promise((resolve) => {
      event.sender.send(`scan-log:${scanId}`, {
        log: `\n${"═".repeat(60)}\n🛡️ TRIVY SBOM & VULNERABILITY SCAN\n${"═".repeat(60)}\n\n`,
        progress: 52,
      });

      event.sender.send(`scan-log:${scanId}`, {
        log: `🔍 Analyzing dependencies and security vulnerabilities...\n📦 Building Software Bill of Materials (SBOM)...\n\n`,
        progress: 55,
      });

      const child = spawn(
        trivyPath,
        ["fs", "--security-checks", "vuln,config", "--format", "json", repoPath],
        { 
          detached: true, 
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
        }
      );

      child.unref();
      activeProcesses.set(scanId, child);
      
      let jsonBuffer = "";
      let cancelled = false;

      child.stdout?.on("data", (chunk) => {
        if (cancelled) return;
        jsonBuffer += chunk.toString();
        event.sender.send(`scan-log:${scanId}`, {
          log: "🔍 Analyzing dependencies and vulnerabilities...\n",
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

╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║                 🚨  SBOM & VULNERABILITY SCAN SUMMARY  🚨                    ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝

Vulnerabilities : ${vulns}
Status          : ${vulns > 0 ? "🚨 VULNERABILITIES DETECTED" : "✅ NO VULNERABILITIES"}
Risk Level      : ${vulns > 10 ? "CRITICAL" : vulns > 5 ? "HIGH" : vulns > 0 ? "MEDIUM" : "NONE"}

${"═".repeat(79)}
`;

            event.sender.send(`scan-log:${scanId}`, {
              log: summary,
              progress: 100,
            });

            event.sender.send(`scan-complete:${scanId}`, {
              success: true,
              vulnerabilities: vulns,
            });

            resolve({ success: true, vulnerabilities: vulns });
          } catch (err: any) {
            event.sender.send(`scan-complete:${scanId}`, {
              success: false,
              error: "Failed to parse Trivy results",
            });
            resolve({ success: false, error: "Failed to parse Trivy results" });
          }
        } else {
          event.sender.send(`scan-complete:${scanId}`, {
            success: false,
            error: `Trivy exited with code ${code}`,
          });
          resolve({ success: false, error: `Trivy exited with code ${code}` });
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

      // Cancel handler
      ipcMain.once(`scan:cancel-${scanId}`, () => {
        cancelled = true;
        debugLog(`Cancelling Trivy scan: ${scanId}`);
        killProcess(child, scanId);
        activeProcesses.delete(scanId);
        resolve({ success: false, cancelled: true });
      });
    });
  });


/* ============================================================
   OPENGREP - MULTI-LANGUAGE STATIC APPLICATION SECURITY SCANNING
   FINAL PRODUCTION VERSION - ALL ISSUES FIXED
   - Accurate file counting (no duplicates)
   - Language breakdown matches total files
   - Clean professional output
============================================================ */
ipcMain.handle("scan:opengrep", async (event, { repoUrl, branch, scanId, componentConfigs }) => {
  debugLog(`[OPENGREP] Starting multi-language SAST analysis for ${repoUrl}`);
  
  const opengrepPath = validateTool("opengrep");
  if (!opengrepPath) {
    event.sender.send(`scan-log:${scanId}`, {
      log: `\n❌ OpenGrep tool not found\n   Expected: ${toolPath("opengrep")}\n\n`,
      progress: 0,
    });
    
    event.sender.send(`scan-complete:${scanId}`, {
      success: false,
      error: "Tool not found",
    });
    
    return { success: false, error: "Tool not found" };
  }
  
  const repoPath = await cloneRepository(event, repoUrl, branch, scanId);
  if (!repoPath) {
    event.sender.send(`scan-complete:${scanId}`, {
      success: false,
      error: "Clone failed",
    });
    return { success: false, error: "Clone failed" };
  }

  return new Promise((resolve) => {
    event.sender.send(`scan-log:${scanId}`, {
      log: `\n${"═".repeat(79)}\n🔬 STATIC APPLICATION SECURITY TESTING (SAST) - OpenGrep\n${"═".repeat(79)}\n\n`,
      progress: 52,
    });

    event.sender.send(`scan-log:${scanId}`, {
      log: `📦 Repository: ${repoUrl}\n🌿 Branch: ${branch}\n\n\n`,
      progress: 54,
    });

    const reportPath = path.join(repoPath, "opengrep-report.json");

    const args = [
      "scan",
      "--config", "auto",
      "--json",
      "--output", reportPath,
      "--no-git-ignore",
      repoPath
    ];

    event.sender.send(`scan-log:${scanId}`, {
      log: `$ opengrep scan --config auto --json\n\n`,
      progress: 55,
    });

    event.sender.send(`scan-log:${scanId}`, {
      log: `🔍 Scanning entire repository recursively (all folders)...\n`,
      progress: 60,
    });

    event.sender.send(`scan-log:${scanId}`, {
      log: `⏳ This may take 1-3 minutes...\n\n`,
      progress: 62,
    });

    const spawnOptions: any = {
      cwd: repoPath,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        NO_COLOR: "1",
      },
      windowsHide: true,
      shell: false,
      detached: false,
    };

    const child = spawn(opengrepPath, args, spawnOptions);
    const scanProcessId = `${scanId}-opengrep`;
    activeProcesses.set(scanProcessId, child);

    let cancelled = false;
    let progressCounter = 0;
    let stdoutData = "";
    let stderrData = "";

    child.stdout?.on("data", (data) => {
      if (cancelled) return;
      progressCounter++;
      stdoutData += data.toString();
      
      event.sender.send(`scan-log:${scanId}`, {
        log: "",
        progress: Math.min(65 + Math.floor(progressCounter / 5), 85),
      });
    });

    child.stderr?.on("data", (data) => {
      if (cancelled) return;
      stderrData += data.toString();
    });

    child.on("close", async (code) => {
      activeProcesses.delete(scanProcessId);
      
      if (cancelled) {
        resolve({ success: false, cancelled: true });
        return;
      }

      debugLog(`[OPENGREP] Process exited with code: ${code}`);

      let totalIssues = 0;
      let passedChecks = 0;
      let failedChecks = 0;
      let findings: any[] = [];
      let criticalCount = 0;
      let highCount = 0;
      let mediumCount = 0;
      let lowCount = 0;

      if (fsSync.existsSync(reportPath)) {
        try {
          const reportContent = await fs.readFile(reportPath, "utf-8");
          const report = JSON.parse(reportContent);
          
          findings = report.results || [];
          totalIssues = findings.length;

          const scannedFiles = report.paths?.scanned || [];
          const skippedFiles = report.paths?.skipped || [];

          // Helper function to convert absolute path to relative
          const repoPathNormalized = repoPath.replace(/\\/g, '/');
          
          function getRelativePath(absolutePath: string): string {
            const normalized = absolutePath.replace(/\\/g, '/');
            
            if (normalized.startsWith(repoPathNormalized)) {
              return normalized.substring(repoPathNormalized.length + 1);
            }
            
            return normalized;
          }

          // Detect actual project directories (ignore common non-project folders)
          const ignoredDirs = new Set([
            '.git', '.idea', '.vscode', '.github', 
            'node_modules', 'dist', 'build', 'target', 
            'out', 'bin', '__pycache__', '.gradle',
            'coverage', '.next', '.nuxt', '.venv', 'venv'
          ]);

          const projectDirectories = new Set<string>();
          const filesByDirectory = new Map<string, number>();
          const filesByLanguage = new Map<string, number>();
          let rootLevelFiles = 0;
          
          // Scan actual repository directory structure to find projects
          try {
            const repoContents = await fs.readdir(repoPath, { withFileTypes: true });
            
            repoContents.forEach(item => {
              if (item.isDirectory() && !ignoredDirs.has(item.name)) {
                projectDirectories.add(item.name);
                filesByDirectory.set(item.name, 0);
              }
            });
            
            debugLog(`[OPENGREP] Found ${projectDirectories.size} project directories: ${Array.from(projectDirectories).join(', ')}`);
          } catch (err: any) {
            debugLog(`Error reading repo directory: ${err.message}`);
          }
          
          // Process scanned files - COUNT ALL FILES (FINAL FIX - NO DUPLICATES)
          scannedFiles.forEach((absolutePath: string) => {
            const relativePath = getRelativePath(absolutePath);
            const normalizedPath = relativePath.replace(/\\/g, '/');
            const parts = normalizedPath.split('/').filter(p => p && p !== '.');
            
            if (parts.length === 0) return;
            
            // Determine which project this file belongs to
            if (parts.length === 1) {
              // Root level file (pom.xml, README.md, etc.)
              rootLevelFiles++;
            } else {
              const topDir = parts[0];
              
              // Count ALL files in project directories
              if (projectDirectories.has(topDir)) {
                filesByDirectory.set(topDir, (filesByDirectory.get(topDir) || 0) + 1);
              }
            }
            
            // Track languages - ALL files, NO DUPLICATES (FINAL FIX)
            const fileName = absolutePath.split(/[/\\]/).pop() || '';
            const ext = fileName.split('.').pop()?.toLowerCase() || '';

            // Enhanced language map
            const langMap: Record<string, string> = {
              // Programming languages
              'java': 'Java',
              'js': 'JavaScript',
              'jsx': 'JavaScript',
              'ts': 'TypeScript',
              'tsx': 'TypeScript',
              'py': 'Python',
              'cs': 'C#',
              'go': 'Go',
              'rb': 'Ruby',
              'php': 'PHP',
              'kt': 'Kotlin',
              'swift': 'Swift',
              'rs': 'Rust',
              'c': 'C',
              'cpp': 'C++',
              'cc': 'C++',
              'cxx': 'C++',
              'h': 'C/C++',
              'hpp': 'C/C++',
              
              // Web languages
              'html': 'HTML',
              'htm': 'HTML',
              'css': 'CSS',
              'scss': 'SCSS',
              'sass': 'SASS',
              'less': 'LESS',
              
              // Data/Config formats
              'json': 'JSON',
              'xml': 'XML',
              'yaml': 'YAML',
              'yml': 'YAML',
              'properties': 'Properties',
              'gradle': 'Gradle',
              'sql': 'SQL',
              
              // Documentation
              'md': 'Markdown',
              'markdown': 'Markdown',
              'txt': 'Text',
              
              // Scripts
              'sh': 'Shell',
              'bash': 'Shell',
              'bat': 'Batch',
              'cmd': 'Batch',
              
              // Media
              'svg': 'SVG',
              'png': 'Image',
              'jpg': 'Image',
              'jpeg': 'Image',
              'gif': 'Image',
              'ico': 'Icon',
              'webp': 'Image',
            };

            // Special config files (without extension or special names)
            const configFilePatterns = [
              'gitignore', 'dockerignore', 'npmignore',
              'editorconfig', 'prettierrc', 'eslintrc',
              'babelrc', 'npmrc', 'yarnrc',
              'dockerfile', 'makefile', 'rakefile',
              'gemfile', 'podfile', 'cartfile'
            ];

            let language = '';

            // Check if it's a special config file
            if (configFilePatterns.some(pattern => fileName.toLowerCase().includes(pattern))) {
              language = 'Config';
            } 
            // Check for .config, .ini, .conf extensions
            else if (['config', 'ini', 'conf'].includes(ext)) {
              language = 'Config';
            }
            // Check recognized extensions
            else if (langMap[ext]) {
              language = langMap[ext];
            }
            // Everything else is "Other"
            else {
              language = 'Other';
            }

            // Count each file exactly ONCE
            filesByLanguage.set(language, (filesByLanguage.get(language) || 0) + 1);
          });

          // Analyze findings
          const findingsByDirectory = new Map<string, any[]>();
          const findingsByLanguage = new Map<string, number>();
          
          findings.forEach((f: any) => {
            const severity = (f.extra?.severity || "WARNING").toUpperCase();
            if (severity === "ERROR" || severity === "CRITICAL") criticalCount++;
            else if (severity === "WARNING" || severity === "HIGH") highCount++;
            else if (severity === "MEDIUM") mediumCount++;
            else lowCount++;

            const absolutePath = f.path || "";
            const relativePath = getRelativePath(absolutePath);
            const normalizedPath = relativePath.replace(/\\/g, '/');
            const parts = normalizedPath.split('/').filter(p => p && p !== '.');
            
            if (parts.length > 1) {
              const topDir = parts[0];
              
              if (projectDirectories.has(topDir)) {
                if (!findingsByDirectory.has(topDir)) {
                  findingsByDirectory.set(topDir, []);
                }
                findingsByDirectory.get(topDir)!.push(f);
              }
            }

            const language = f.extra?.metadata?.language || "Unknown";
            findingsByLanguage.set(language, (findingsByLanguage.get(language) || 0) + 1);
          });

          passedChecks = Math.max(0, scannedFiles.length - totalIssues);
          failedChecks = totalIssues;

          event.sender.send(`scan-log:${scanId}`, {
            log: `\n✅ Scan completed successfully!\n\n`,
            progress: 88,
          });

          // ==================== PROJECT STRUCTURE ====================
          const projectsWithFiles = Array.from(filesByDirectory.entries())
            .filter(([dir, count]) => count > 0 && projectDirectories.has(dir))
            .sort((a, b) => b[1] - a[1]);

          if (projectsWithFiles.length > 0) {
            event.sender.send(`scan-log:${scanId}`, {
              log: `\n📦 DETECTED PROJECTS:\n${"═".repeat(79)}\n\n`,
              progress: 88,
            });

            projectsWithFiles.forEach(([dir, count]) => {
              const issues = findingsByDirectory.get(dir) || [];
              const statusIcon = issues.length === 0 ? '✅' : issues.length <= 5 ? '🟡' : '🔴';
              
              event.sender.send(`scan-log:${scanId}`, {
                log: `   ${statusIcon} ${dir}/ — ${count} files scanned${issues.length > 0 ? ` — ${issues.length} issue(s) found` : ' — Clean ✓'}\n`,
                progress: 88,
              });
            });

            if (rootLevelFiles > 0) {
              event.sender.send(`scan-log:${scanId}`, {
                log: `   📄 [root]/ — ${rootLevelFiles} config/metadata files\n`,
                progress: 88,
              });
            }
          }

          // ==================== SCAN STATISTICS ====================
          event.sender.send(`scan-log:${scanId}`, {
            log: `\n\n📊 SCAN STATISTICS:\n${"═".repeat(79)}\n\n`,
            progress: 89,
          });

          // Calculate totals properly
          const totalProjectFiles = Array.from(filesByDirectory.values()).reduce((sum, count) => sum + count, 0);
          const totalFilesScanned = totalProjectFiles + rootLevelFiles;

          const statsLog = `
┌─────────────────────────────────────────────────────────────────────────────┐
│ 📁 Projects Detected    : ${projectsWithFiles.length.toString().padStart(4)}                                             │
│ 📄 Project Files        : ${totalProjectFiles.toString().padStart(4)} (source code files)                        │
│ 📝 Root/Config Files    : ${rootLevelFiles.toString().padStart(4)} (metadata, configs)                          │
│ 📊 Total Files Scanned  : ${totalFilesScanned.toString().padStart(4)}                                             │
│ ⏭️  Files Skipped        : ${skippedFiles.length.toString().padStart(4)}                                             │
│ 🔤 Languages Detected   : ${filesByLanguage.size.toString().padStart(4)}                                             │
│ 🔍 Total Issues Found   : ${totalIssues.toString().padStart(4)}                                             │
└─────────────────────────────────────────────────────────────────────────────┘
`;

          event.sender.send(`scan-log:${scanId}`, {
            log: statsLog,
            progress: 89,
          });

          // ==================== LANGUAGE BREAKDOWN ====================
          if (filesByLanguage.size > 0) {
            event.sender.send(`scan-log:${scanId}`, {
              log: `\n🔤 LANGUAGE BREAKDOWN:\n${"─".repeat(79)}\n\n`,
              progress: 90,
            });

            const sortedLangs = Array.from(filesByLanguage.entries())
              .sort((a, b) => b[1] - a[1])
              .slice(0, 10);
            
            sortedLangs.forEach(([lang, count]) => {
              const issues = findingsByLanguage.get(lang) || 0;
              const percentage = Math.round((count / totalFilesScanned) * 100);
              const barLength = Math.min(Math.floor(percentage / 2.5), 40);
              const bar = '█'.repeat(barLength) + '░'.repeat(Math.max(0, 40 - barLength));
              
              event.sender.send(`scan-log:${scanId}`, {
                log: `  ${lang.padEnd(15)} │${bar}│ ${count.toString().padStart(4)} files (${percentage.toString().padStart(2)}%)${issues > 0 ? ` — ${issues} issue(s)` : ''}\n`,
                progress: 90,
              });
            });

            if (filesByLanguage.size > 10) {
              event.sender.send(`scan-log:${scanId}`, {
                log: `  ... and ${filesByLanguage.size - 10} more languages\n`,
                progress: 90,
              });
            }
          }

          // ==================== PROJECT FILE BREAKDOWN ====================
          if (projectsWithFiles.length > 0) {
            event.sender.send(`scan-log:${scanId}`, {
              log: `\n\n📂 FILES BY PROJECT:\n${"─".repeat(79)}\n\n`,
              progress: 90,
            });

            projectsWithFiles.forEach(([dir, count]) => {
              const issues = findingsByDirectory.get(dir) || [];
              const statusIcon = issues.length === 0 ? '✅' : issues.length <= 5 ? '🟡' : '🔴';
              const percentage = totalProjectFiles > 0 ? Math.round((count / totalProjectFiles) * 100) : 0;
              
              event.sender.send(`scan-log:${scanId}`, {
                log: `  ${statusIcon} ${dir.padEnd(40)} ${count.toString().padStart(4)} files (${percentage.toString().padStart(2)}%)${issues.length > 0 ? ` — ${issues.length} issue(s)` : ''}\n`,
                progress: 90,
              });
            });

            if (rootLevelFiles > 0) {
              const rootPercentage = Math.round((rootLevelFiles / totalFilesScanned) * 100);
              event.sender.send(`scan-log:${scanId}`, {
                log: `  📝 [root] (config/metadata)              ${rootLevelFiles.toString().padStart(4)} files (${rootPercentage.toString().padStart(2)}%)\n`,
                progress: 90,
              });
            }
          }

          // ==================== SECURITY FINDINGS ====================
          if (totalIssues > 0) {
            event.sender.send(`scan-log:${scanId}`, {
              log: `\n\n🚨 SECURITY FINDINGS:\n${"═".repeat(79)}\n\n`,
              progress: 91,
            });

            const severityLog = `
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🔴 Critical/Error  : ${criticalCount.toString().padStart(4)}                                                 │
│ 🟠 High/Warning    : ${highCount.toString().padStart(4)}                                                 │
│ 🟡 Medium          : ${mediumCount.toString().padStart(4)}                                                 │
│ 🔵 Low/Info        : ${lowCount.toString().padStart(4)}                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
`;
            event.sender.send(`scan-log:${scanId}`, {
              log: severityLog,
              progress: 91,
            });

            // Findings by project
            const sortedFindings = Array.from(findingsByDirectory.entries())
              .filter(([dir, issues]) => issues.length > 0)
              .sort((a, b) => b[1].length - a[1].length);

            if (sortedFindings.length > 0) {
              event.sender.send(`scan-log:${scanId}`, {
                log: `\n📂 ISSUES BY PROJECT:\n${"─".repeat(79)}\n\n`,
                progress: 91,
              });

              sortedFindings.forEach(([dir, dirFindings]) => {
                const critical = dirFindings.filter(f => {
                  const sev = (f.extra?.severity || "WARNING").toUpperCase();
                  return sev === "ERROR" || sev === "CRITICAL";
                }).length;
                
                const high = dirFindings.filter(f => {
                  const sev = (f.extra?.severity || "WARNING").toUpperCase();
                  return sev === "WARNING" || sev === "HIGH";
                }).length;

                event.sender.send(`scan-log:${scanId}`, {
                  log: `  📂 ${dir}/ — ${dirFindings.length} total | 🔴 ${critical} critical | 🟠 ${high} high\n`,
                  progress: 91,
                });
              });
            }

            // Top findings
            event.sender.send(`scan-log:${scanId}`, {
              log: `\n\n🔍 TOP ${Math.min(10, totalIssues)} CRITICAL FINDINGS:\n${"═".repeat(79)}\n\n`,
              progress: 92,
            });

            const allSortedFindings = findings.sort((a, b) => {
              const severityOrder: Record<string, number> = {
                ERROR: 4, CRITICAL: 4, WARNING: 3, HIGH: 3,
                MEDIUM: 2, INFO: 1, LOW: 1,
              };
              const sevA = (a.extra?.severity || "WARNING").toUpperCase();
              const sevB = (b.extra?.severity || "WARNING").toUpperCase();
              return (severityOrder[sevB] || 0) - (severityOrder[sevA] || 0);
            });

            const topFindings = allSortedFindings.slice(0, 10);

            topFindings.forEach((finding: any, index: number) => {
              const severity = (finding.extra?.severity || "WARNING").toUpperCase();
              const severityIcon = 
                severity === "ERROR" || severity === "CRITICAL" ? "🔴 CRITICAL" :
                severity === "WARNING" || severity === "HIGH" ? "🟠 HIGH    " :
                severity === "MEDIUM" ? "🟡 MEDIUM  " : "🔵 LOW     ";

              const absolutePath = finding.path || "N/A";
              const relativePath = getRelativePath(absolutePath);
              const shortPath = relativePath.length > 60 ? '...' + relativePath.slice(-57) : relativePath;

              const findingLog = `
${index + 1}. ${severityIcon} │ ${finding.check_id || 'Unknown Rule'}
   File: ${shortPath}
   Line: ${finding.start?.line || '?'}
   ${finding.extra?.message || finding.message || 'No description'}
${"─".repeat(79)}
`;
              
              event.sender.send(`scan-log:${scanId}`, {
                log: findingLog,
                progress: 92 + Math.floor(((index + 1) / topFindings.length) * 3),
              });
            });

            if (totalIssues > 10) {
              event.sender.send(`scan-log:${scanId}`, {
                log: `\n   ... and ${totalIssues - 10} more findings (check opengrep-report.json for details)\n`,
                progress: 95,
              });
            }

          } else {
            event.sender.send(`scan-log:${scanId}`, {
              log: `\n\n✅ NO SECURITY ISSUES DETECTED!\n${"═".repeat(79)}\n\n`,
              progress: 95,
            });

            event.sender.send(`scan-log:${scanId}`, {
              log: `🎉 All ${totalFilesScanned} files across ${projectsWithFiles.length} project(s) passed security analysis.\n`,
              progress: 95,
            });
            
            event.sender.send(`scan-log:${scanId}`, {
              log: `🛡️  No vulnerabilities found. Repository is secure!\n`,
              progress: 95,
            });
          }

          // ==================== FINAL SUMMARY ====================
          const projectsList = projectsWithFiles.length > 0 
            ? projectsWithFiles.map(([dir]) => dir).slice(0, 3).join(', ') + 
              (projectsWithFiles.length > 3 ? `, +${projectsWithFiles.length - 3} more` : '')
            : 'No projects detected';

          const summary_text = `


╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║              📊  SAST ANALYSIS SUMMARY - OpenGrep Scanner  📊                 ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝

Repository        : ${repoUrl}
Branch            : ${branch}
Scan Engine       : OpenGrep (Open Source SAST)

📁 SCAN COVERAGE
${"─".repeat(79)}
  Projects Scanned        : ${projectsWithFiles.length} (${projectsList})
  Project Files           : ${totalProjectFiles}
  Root/Config Files       : ${rootLevelFiles}
  Total Files Scanned     : ${totalFilesScanned}
  Files Skipped           : ${skippedFiles.length}
  Languages Detected      : ${filesByLanguage.size}
  Rules Applied           : Auto (Community Rules)

🔍 FINDINGS SUMMARY
${"─".repeat(79)}
  Total Issues            : ${totalIssues}
  🔴 Critical/Error       : ${criticalCount}
  🟠 High/Warning         : ${highCount}
  🟡 Medium               : ${mediumCount}
  🔵 Low/Info             : ${lowCount}

🎯 SECURITY VERDICT
${"─".repeat(79)}
${totalIssues === 0 
  ? `  ✅ SECURE — All ${projectsWithFiles.length} project(s) passed security checks
  ✅ No vulnerabilities detected
  ✅ Safe to deploy to production`
  : criticalCount > 0
  ? `  🚨 CRITICAL RISK — ${criticalCount} critical vulnerabilities detected
  ⛔ DO NOT DEPLOY until all critical issues are fixed
  🔧 Immediate remediation required`
  : highCount > 0
  ? `  🟠 HIGH RISK — ${highCount} high severity issues found
  ⚠️  Review and fix before deployment
  🔧 Remediation recommended`
  : totalIssues <= 5
  ? `  🟡 LOW RISK — ${totalIssues} minor issues detected
  ℹ️  Review findings before release
  🔧 Non-critical remediation`
  : `  🟡 MEDIUM RISK — ${totalIssues} security issues found
  ⚠️  Security review required before production
  🔧 Address issues before deployment`
}

📝 RECOMMENDATION
${"─".repeat(79)}
${totalIssues === 0
  ? `  All security checks passed across ${projectsWithFiles.length} project(s). Production-ready.`
  : criticalCount > 0
  ? `  Fix ${criticalCount} critical vulnerability(ies) immediately. DO NOT RELEASE.`
  : totalIssues <= 5
  ? `  Review and fix ${totalIssues} minor issue(s). Low priority.`
  : `  Address ${totalIssues} security issue(s) before production deployment.`
}

${"═".repeat(79)}
`;

          event.sender.send(`scan-log:${scanId}`, {
            log: summary_text,
            progress: 100,
          });

        } catch (err: any) {
          debugLog(`Error parsing OpenGrep report: ${err.message}`);
          
          event.sender.send(`scan-log:${scanId}`, {
            log: `\n❌ Error parsing report: ${err.message}\n`,
            progress: 100,
          });
        }
      } else {
        debugLog(`[OPENGREP] Report file not found at: ${reportPath}`);
        
        event.sender.send(`scan-log:${scanId}`, {
          log: `\n⚠️ No report file generated\n`,
          progress: 100,
        });

        if (stderrData.trim()) {
          event.sender.send(`scan-log:${scanId}`, {
            log: `\n❌ Error details:\n${stderrData}\n`,
            progress: 100,
          });
        }
      }

      const success = code === 0 || code === 1;
      
      event.sender.send(`scan-complete:${scanId}`, {
        success,
        totalIssues,
        passedChecks,
        failedChecks,
        error: success ? undefined : `Scan exited with code ${code}`,
      });

      resolve({ success, totalIssues, passedChecks, failedChecks });
    });

    child.on("error", (err) => {
      activeProcesses.delete(scanProcessId);
      
      event.sender.send(`scan-log:${scanId}`, {
        log: `\n❌ OpenGrep process error: ${err.message}\n`,
        progress: 0,
      });
      
      event.sender.send(`scan-complete:${scanId}`, {
        success: false,
        error: err.message,
      });
      
      resolve({ success: false, error: err.message });
    });

    ipcMain.once(`scan:cancel-${scanId}`, () => {
      cancelled = true;
      debugLog(`Cancelling OpenGrep scan: ${scanId}`);
      
      event.sender.send(`scan-log:${scanId}`, {
        log: `\n⚠️ Scan cancelled by user\n`,
        progress: 0,
      });
      
      killProcess(child, scanProcessId);
      activeProcesses.delete(scanProcessId);
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
