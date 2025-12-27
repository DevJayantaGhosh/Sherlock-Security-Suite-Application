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
   OPENGREP - MULTI-LANGUAGE STATIC APPLICATION SECURITY TESTING
============================================================ */
ipcMain.handle("scan:opengrep", async (event, { repoUrl, branch, scanId, componentConfigs }) => {
  debugLog(`[OPENGREP] Starting multi-language SAST analysis for ${repoUrl}`);
  
  const opengrepPath = validateTool("opengrep");
  if (!opengrepPath) {
    event.sender.send(`scan-log:${scanId}`, {
      log: `\n❌ OpenGrep tool not found\n   Expected: ${toolPath("opengrep")}\n   Download: https://github.com/semgrep/semgrep/releases\n\n`,
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
      log: `🔧 Repository: ${repoUrl}\n🌿 Branch: ${branch}\n📦 Engine: OpenGrep (Open Source SAST Scanner)\n🎯 Supports: Java, JavaScript, Python, C#, Go, Ruby, PHP, TypeScript\n\n`,
      progress: 54,
    });

    const reportPath = path.join(repoPath, "opengrep-report.json");

    // FIXED: Removed --metrics flag and simplified args
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
      log: `🔍 Analyzing all projects in repository for security vulnerabilities...\n`,
      progress: 60,
    });

    event.sender.send(`scan-log:${scanId}`, {
      log: `⏳ Scanning multiple projects may take 1-2 minutes...\n\n`,
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
      const text = data.toString();
      stdoutData += text;
      
      if (text.trim()) {
        event.sender.send(`scan-log:${scanId}`, {
          log: text,
          progress: Math.min(65 + progressCounter, 85),
        });
      }
    });

    child.stderr?.on("data", (data) => {
      if (cancelled) return;
      const text = data.toString();
      stderrData += text;
      
      // Show stderr output to user
      event.sender.send(`scan-log:${scanId}`, {
        log: text,
        progress: 80,
      });
    });

    child.on("close", async (code) => {
      activeProcesses.delete(scanProcessId);
      
      if (cancelled) {
        resolve({ success: false, cancelled: true });
        return;
      }

      // Log exit code for debugging
      debugLog(`[OPENGREP] Process exited with code: ${code}`);

      let totalIssues = 0;
      let passedChecks = 0;
      let failedChecks = 0;
      let findings: any[] = [];
      let criticalCount = 0;
      let highCount = 0;
      let mediumCount = 0;
      let lowCount = 0;

      // Group findings by project/directory
      const projectFindings = new Map<string, any[]>();

      // Check if report file exists
      if (fsSync.existsSync(reportPath)) {
        try {
          const reportContent = await fs.readFile(reportPath, "utf-8");
          debugLog(`[OPENGREP] Report file size: ${reportContent.length} bytes`);
          
          const report = JSON.parse(reportContent);
          
          findings = report.results || [];
          totalIssues = findings.length;
          
          // Group findings by project directory
          findings.forEach((f: any) => {
            const severity = (f.extra?.severity || "WARNING").toUpperCase();
            if (severity === "ERROR" || severity === "CRITICAL") criticalCount++;
            else if (severity === "WARNING" || severity === "HIGH") highCount++;
            else if (severity === "MEDIUM") mediumCount++;
            else lowCount++;

            // Extract project directory (first level subdirectory)
            const relativePath = f.path || "";
            const parts = relativePath.split(path.sep);
            const projectDir = parts[0] || "root";
            
            if (!projectFindings.has(projectDir)) {
              projectFindings.set(projectDir, []);
            }
            projectFindings.get(projectDir)!.push(f);
          });

          passedChecks = Math.max(0, (report.paths?.scanned?.length || 0) - totalIssues);
          failedChecks = totalIssues;

          event.sender.send(`scan-log:${scanId}`, {
            log: `\n✅ Scan completed successfully!\n\n`,
            progress: 88,
          });

          // Show per-project breakdown
          if (projectFindings.size > 1) {
            event.sender.send(`scan-log:${scanId}`, {
              log: `\n📊 MULTI-PROJECT BREAKDOWN:\n${"═".repeat(79)}\n\n`,
              progress: 89,
            });

            let projectIndex = 0;
            for (const [projectDir, projectIssues] of projectFindings.entries()) {
              projectIndex++;
              const projectLog = `
┌─────────────────────────────────────────────────────────────────────────────┐
│ Project ${projectIndex}: ${projectDir.padEnd(65)}│
├─────────────────────────────────────────────────────────────────────────────┤
│ Issues Found: ${projectIssues.length.toString().padEnd(63)}│
│ Critical/High: ${projectIssues.filter(f => {
  const sev = (f.extra?.severity || "WARNING").toUpperCase();
  return sev === "ERROR" || sev === "CRITICAL" || sev === "WARNING" || sev === "HIGH";
}).length.toString().padEnd(62)}│
└─────────────────────────────────────────────────────────────────────────────┘
`;
              event.sender.send(`scan-log:${scanId}`, {
                log: projectLog,
                progress: 89,
              });
            }

            event.sender.send(`scan-log:${scanId}`, {
              log: `\n`,
              progress: 89,
            });
          }

          event.sender.send(`scan-log:${scanId}`, {
            log: `\n🔍 TOP SECURITY FINDINGS:\n${"═".repeat(79)}\n\n`,
            progress: 90,
          });

          if (findings.length > 0) {
            // Show top 10 most critical findings
            const sortedFindings = findings.sort((a, b) => {
              const severityOrder: Record<string, number> = {
                ERROR: 4,
                CRITICAL: 4,
                WARNING: 3,
                HIGH: 3,
                MEDIUM: 2,
                INFO: 1,
                LOW: 1,
              };
              const sevA = (a.extra?.severity || "WARNING").toUpperCase();
              const sevB = (b.extra?.severity || "WARNING").toUpperCase();
              return (severityOrder[sevB] || 0) - (severityOrder[sevA] || 0);
            });

            const topFindings = sortedFindings.slice(0, 10);

            topFindings.forEach((finding: any, index: number) => {
              const severity = (finding.extra?.severity || "WARNING").toUpperCase();
              const severityIcon = 
                severity === "ERROR" || severity === "CRITICAL" ? "🔴" :
                severity === "WARNING" || severity === "HIGH" ? "🟠" :
                "🟡";

              const relativePath = finding.path || "N/A";
              const parts = relativePath.split(path.sep);
              const projectDir = parts[0] || "root";

              const findingLog = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${severityIcon} Finding ${index + 1}/${topFindings.length} [Project: ${projectDir}]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Rule ID     : ${finding.check_id || 'N/A'}
Severity    : ${severity}
File        : ${relativePath}
Line        : ${finding.start?.line || 'N/A'}
Message     : ${finding.extra?.message || finding.message || 'N/A'}
${finding.extra?.metadata?.source ? `Source      : ${finding.extra.metadata.source}\n` : ''}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
              
              event.sender.send(`scan-log:${scanId}`, {
                log: findingLog,
                progress: 90 + Math.floor(((index + 1) / topFindings.length) * 5),
              });
            });

            if (findings.length > 10) {
              event.sender.send(`scan-log:${scanId}`, {
                log: `\n... and ${findings.length - 10} more findings across all projects\n`,
                progress: 95,
              });
            }
          } else {
            event.sender.send(`scan-log:${scanId}`, {
              log: `✅ No security issues detected in any project!\n`,
              progress: 95,
            });
          }

          const summary_text = `


╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║     📊  STATIC APPLICATION SECURITY TESTING (SAST) ANALYSIS SUMMARY  📊      ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝

Repository        : ${repoUrl}
Branch            : ${branch}
Engine            : OpenGrep (Open Source SAST Scanner)
Languages Scanned : Java, JavaScript, Python, C#, Go, Ruby, PHP, TypeScript

Scan Coverage:
  📁 Projects Found : ${projectFindings.size}
  📄 Files Scanned  : ${report.paths?.scanned?.length || 0}
  ❌ Issues Found   : ${failedChecks}
  
Severity Breakdown:
  🔴 Critical/Error : ${criticalCount}
  🟠 High/Warning   : ${highCount}
  🟡 Medium/Info    : ${mediumCount}
  
Total Issues      : ${totalIssues}

Projects Analyzed:
${Array.from(projectFindings.entries())
  .map(([dir, issues]) => `  • ${dir}: ${issues.length} issue(s)`)
  .join('\n') || '  • No projects with issues'}

Overall Status    : ${code === 0 ? "✅ SCAN COMPLETED" : "⚠️ SCAN COMPLETED WITH WARNINGS"}

Security Verdict  : ${
  totalIssues === 0 ? "✅ NO SECURITY ISSUES DETECTED - All projects are secure" :
  criticalCount > 0 ? "🚨 CRITICAL RISK - Urgent security remediation required" :
  totalIssues <= 5 ? "🟡 LOW RISK - Minor issues require attention" :
  totalIssues <= 15 ? "🟠 MEDIUM RISK - Security issues should be addressed" :
  "🔴 HIGH RISK - Immediate security review recommended"
}

Recommendation    : ${
  totalIssues === 0 ? "All projects pass security analysis. Safe to proceed with release." :
  criticalCount > 0 ? "DO NOT RELEASE - Critical vulnerabilities must be fixed immediately." :
  totalIssues <= 5 ? "Review and fix minor issues before release." :
  totalIssues <= 15 ? "Address security issues before deploying to production." :
  "Mandatory security review required before release."
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

        // Show stderr if available
        if (stderrData.trim()) {
          event.sender.send(`scan-log:${scanId}`, {
            log: `\n❌ Error details:\n${stderrData}\n`,
            progress: 100,
          });
        }
      }

      // Consider exit code 1 as success (findings found but scan completed)
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
