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

  /* --------------------------------------------------------
     CODEQL
  -------------------------------------------------------- */
ipcMain.handle("scan:codeql", async (event, { repoUrl, branch, scanId, componentConfigs }) => {
  debugLog(`[CODEQL] Starting SAST analysis for ${repoUrl}`);
  
  const codeqlPath = validateTool("codeql");
  if (!codeqlPath) {
    event.sender.send(`scan-log:${scanId}`, {
      log: `\n❌ CodeQL tool not found\n   Expected: ${toolPath("codeql")}\n   Download from: https://github.com/github/codeql-cli-binaries/releases\n\n`,
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

  let cancelled = false;
  const componentResults: Array<{
    language: string;
    workingDirectory?: string;
    issues: number;
    success: boolean;
    sarifPath?: string;
  }> = [];

  // Default to javascript-typescript if no configs provided
  const configs = componentConfigs && componentConfigs.length > 0
    ? componentConfigs
    : [{ language: "javascript-typescript" }];

  event.sender.send(`scan-log:${scanId}`, {
    log: `\n${"═".repeat(79)}\n🔬 STATIC APPLICATION SECURITY TESTING (SAST) ANALYSIS\n${"═".repeat(79)}\n\n`,
    progress: 52,
  });

  event.sender.send(`scan-log:${scanId}`, {
    log: `📊 Total Components to Scan: ${configs.length}\n🔧 Repository: ${repoUrl}\n🌿 Branch: ${branch}\n\n`,
    progress: 54,
  });

  // Process each component sequentially
  for (let i = 0; i < configs.length; i++) {
    if (cancelled) break;

    const config = configs[i];
    const componentNum = i + 1;
    const baseProgress = 55 + (i * 40 / configs.length);

    event.sender.send(`scan-log:${scanId}`, {
      log: `\n${"─".repeat(79)}\n📦 COMPONENT ${componentNum} OF ${configs.length}\n${"─".repeat(79)}\n`,
      progress: baseProgress,
    });

    event.sender.send(`scan-log:${scanId}`, {
      log: `Language          : ${config.language}\n`,
      progress: baseProgress + 1,
    });

    if (config.workingDirectory) {
      event.sender.send(`scan-log:${scanId}`, {
        log: `Working Directory : ${config.workingDirectory}\n`,
        progress: baseProgress + 2,
      });
    }

    if (config.buildCommand) {
      event.sender.send(`scan-log:${scanId}`, {
        log: `Build Command     : ${config.buildCommand}\n`,
        progress: baseProgress + 3,
      });
    }

    event.sender.send(`scan-log:${scanId}`, {
      log: `\n`,
      progress: baseProgress + 4,
    });

    // Scan this component
    const result = await scanComponent(
      event,
      codeqlPath,
      repoPath,
      config,
      scanId,
      componentNum,
      baseProgress
    );

    if (result.cancelled) {
      cancelled = true;
      break;
    }

    componentResults.push({
      language: config.language,
      workingDirectory: config.workingDirectory,
      issues: result.issues,
      success: result.success,
      sarifPath: result.sarifPath,
    });

    // Show component completion
    event.sender.send(`scan-log:${scanId}`, {
      log: `\n${result.success ? "✅" : "❌"} Component ${componentNum} ${result.success ? "completed successfully" : "failed"} - ${result.success ? result.issues : "N/A"} issue${result.issues !== 1 ? "s" : ""} found\n`,
      progress: baseProgress + 40,
    });
  }

  if (cancelled) {
    return { success: false, cancelled: true };
  }

  // Calculate statistics
  const totalIssues = componentResults.reduce((sum, r) => sum + r.issues, 0);
  const allSuccessful = componentResults.every(r => r.success);
  const successfulComponents = componentResults.filter(r => r.success).length;
  const failedComponents = componentResults.length - successfulComponents;
  
  // ✅ Only make security claims if all components succeeded
  const canMakeSecurityVerdict = allSuccessful;

  // Detailed findings breakdown
  if (totalIssues > 0 && canMakeSecurityVerdict) {
    event.sender.send(`scan-log:${scanId}`, {
      log: `\n\n🔍 DETAILED FINDINGS BREAKDOWN:\n${"═".repeat(79)}\n\n`,
      progress: 95,
    });

    componentResults.forEach((comp, index) => {
      if (comp.issues > 0) {
        const findingLog = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 Component ${index + 1}: ${comp.language}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Language         : ${comp.language}
${comp.workingDirectory ? `Working Directory: ${comp.workingDirectory}\n` : ''}Issues Found     : ${comp.issues}
Status           : ${comp.success ? "✅ Analysis Complete" : "❌ Analysis Failed"}
${comp.sarifPath ? `SARIF Report     : ${comp.sarifPath}\n` : ''}
Risk Level       : ${
  comp.issues === 0 ? "✅ NONE" :
  comp.issues <= 3 ? "🟡 LOW" :
  comp.issues <= 10 ? "🟠 MEDIUM" :
  comp.issues <= 20 ? "🔴 HIGH" :
  "🚨 CRITICAL"
}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
        
        event.sender.send(`scan-log:${scanId}`, {
          log: findingLog,
          progress: 95 + Math.floor(((index + 1) / componentResults.length) * 3),
        });
      }
    });
  }

  //final summary
  const summary = `


╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║     📊  STATIC APPLICATION SECURITY TESTING (SAST) ANALYSIS SUMMARY  📊      ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝

Repository        : ${repoUrl}
Branch            : ${branch}
Total Components  : ${componentResults.length}
Successful Scans  : ${successfulComponents}
Failed Scans      : ${failedComponents}
Total Issues      : ${canMakeSecurityVerdict ? totalIssues : "N/A (Scan Failed)"}
Overall Status    : ${allSuccessful ? "✅ ALL COMPONENTS ANALYZED SUCCESSFULLY" : "❌ ANALYSIS FAILED"}

${componentResults.length > 1 || !allSuccessful ? `
Component Breakdown:
${"─".repeat(79)}
${componentResults.map((r, i) => `
  ${i + 1}. ${r.language}${r.workingDirectory ? ` (${r.workingDirectory})` : ""}
     Status: ${r.success ? "✅ Success" : "❌ Failed"}
     Issues: ${r.success ? r.issues : "N/A"}
     Risk  : ${
       !r.success ? "⚠️ Unable to assess" :
       r.issues === 0 ? "✅ None" :
       r.issues <= 3 ? "🟡 Low" :
       r.issues <= 10 ? "🟠 Medium" :
       r.issues <= 20 ? "🔴 High" :
       "🚨 Critical"
     }
`).join('')}
${"─".repeat(79)}
` : ''}

Security Verdict  : ${
  !canMakeSecurityVerdict ? "❌ ANALYSIS INCOMPLETE - Cannot determine security status" :
  totalIssues === 0 ? "✅ NO SECURITY ISSUES DETECTED - Code is secure" :
  totalIssues <= 5 ? "🟡 LOW RISK - Minor issues require attention" :
  totalIssues <= 15 ? "🟠 MEDIUM RISK - Security issues should be addressed" :
  totalIssues <= 30 ? "🔴 HIGH RISK - Immediate security review recommended" :
  "🚨 CRITICAL RISK - Urgent security remediation required"
}

Recommendation    : ${
  !canMakeSecurityVerdict ? "⚠️ Fix build/analysis errors before proceeding. See troubleshooting section below." :
  totalIssues === 0 ? "Code passes security analysis. Safe to proceed with release." :
  totalIssues <= 5 ? "Review and fix minor issues before release." :
  totalIssues <= 15 ? "Address security issues before deploying to production." :
  totalIssues <= 30 ? "Mandatory security review required before release." :
  "DO NOT RELEASE - Critical security vulnerabilities detected."
}

${!canMakeSecurityVerdict ? `
╔═══════════════════════════════════════════════════════════════════════════════╗
║                           ⚠️  TROUBLESHOOTING  ⚠️                            ║
╚═══════════════════════════════════════════════════════════════════════════════╝

Analysis failed for one or more components. Common causes:

1. BUILD TOOL NOT FOUND
   • Maven (Java): Install Maven and add to system PATH
   • Gradle (Java): Install Gradle and add to system PATH
   • MSBuild (C#): Install Visual Studio Build Tools
   • Make (C/C++): Install build-essential or similar
   • Solution: Verify with 'mvn --version' or equivalent command

2. ALTERNATIVE: USE BUILD-MODE NONE (Recommended)
   • For Java/C#/Kotlin projects, you can scan without building
   • Remove 'buildCommand' from componentConfig
   • CodeQL will use --build-mode none automatically
   • Supported: Java, C#, Kotlin (CodeQL 2.16.5+)
   • Note: Slightly lower accuracy for complex projects

3. INTERPRETED LANGUAGES (No Build Needed)
   • JavaScript/TypeScript, Python, Ruby never need builds
   • Simply omit the buildCommand
   • Analysis works automatically

4. MISSING DEPENDENCIES
   • Ensure all project dependencies are properly configured
   • Check pom.xml (Maven), build.gradle (Gradle), or .csproj files

5. PERMISSION ISSUES
   • Verify read/write access to project directory
   • Run application with appropriate permissions

For more help: https://docs.github.com/en/code-security/code-scanning

` : ''}
${"═".repeat(79)}
`;

  event.sender.send(`scan-log:${scanId}`, {
    log: summary,
    progress: 100,
  });

  event.sender.send(`scan-complete:${scanId}`, {
    success: allSuccessful,
    totalIssues: canMakeSecurityVerdict ? totalIssues : undefined,
    componentResults: componentResults.map(r => ({
      language: r.language,
      workingDirectory: r.workingDirectory,
      issues: r.issues,
      success: r.success,
    })),
  });

  return { 
    success: allSuccessful, 
    totalIssues: canMakeSecurityVerdict ? totalIssues : undefined,
    componentResults: componentResults.map(r => ({
      language: r.language,
      workingDirectory: r.workingDirectory,
      issues: r.issues,
      success: r.success,
    }))
  };
});

/**
 * Scan a single component with CodeQL
 */
async function scanComponent(
  event: Electron.IpcMainInvokeEvent,
  codeqlPath: string,
  repoPath: string,
  config: { language: string; buildCommand?: string; workingDirectory?: string },
  scanId: string,
  componentNum: number,
  baseProgress: number
): Promise<{ success: boolean; issues: number; cancelled: boolean; sarifPath?: string }> {
  
  const workDir = config.workingDirectory 
    ? path.join(repoPath, config.workingDirectory)
    : repoPath;

  if (config.workingDirectory && !fsSync.existsSync(workDir)) {
    event.sender.send(`scan-log:${scanId}`, {
      log: `\n❌ Working directory not found: ${config.workingDirectory}\n`,
      progress: baseProgress + 5,
    });
    return { success: false, issues: 0, cancelled: false };
  }

  const dbPath = path.join(workDir, `codeql-db-${componentNum}`);
  const sarifPath = path.join(workDir, `codeql-results-${componentNum}.sarif`);
  
  let cancelled = false;

  return new Promise((resolve) => {
    event.sender.send(`scan-log:${scanId}`, {
      log: `🔧 Step 1/2: Creating CodeQL database for ${config.language}...\n`,
      progress: baseProgress + 5,
    });

    const createArgs = [
      "database",
      "create",
      dbPath,
      `--language=${config.language}`,
      "--source-root",
      workDir,
      "--overwrite",
    ];

    // ✅ WORKING BUILD HANDLING
    const normalizedLang = config.language.toLowerCase();
    
    if (config.buildCommand) {
      createArgs.push("--command", config.buildCommand);
      event.sender.send(`scan-log:${scanId}`, {
        log: `🏗️  Using custom build command\n`,
        progress: baseProgress + 6,
      });
    } else if (["java", "csharp", "kotlin"].includes(normalizedLang)) {
      createArgs.push("--build-mode", "none");
      event.sender.send(`scan-log:${scanId}`, {
        log: `🚀 Using build-mode=none (no build required)\n`,
        progress: baseProgress + 6,
      });
    } else if (["javascript", "typescript", "javascript-typescript"].includes(normalizedLang)) {
      // ✅ FIX: Use dummy no-op command (echo) instead of empty string
      if (process.platform === "win32") {
        createArgs.push("--command", "echo Skipping build");
      } else {
        createArgs.push("--command", "echo 'Skipping build'");
      }
      event.sender.send(`scan-log:${scanId}`, {
        log: `✅ Using no-op command to skip autobuild\n`,
        progress: baseProgress + 6,
      });
    } else if (["python", "ruby"].includes(normalizedLang)) {
      event.sender.send(`scan-log:${scanId}`, {
        log: `✅ ${config.language} doesn't require compilation\n`,
        progress: baseProgress + 6,
      });
    } else {
      event.sender.send(`scan-log:${scanId}`, {
        log: `⚠️  Warning: ${config.language} may require a build command\n`,
        progress: baseProgress + 6,
      });
    }

    event.sender.send(`scan-log:${scanId}`, {
      log: `$ codeql ${createArgs.join(" ")}\n\n`,
      progress: baseProgress + 7,
    });

    const spawnOptions: any = {
      cwd: workDir,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        NO_COLOR: "1",
      },
    };

    if (process.platform === "win32") {
      spawnOptions.windowsHide = true;
      spawnOptions.shell = false;
      spawnOptions.detached = false;
    } else {
      spawnOptions.detached = true;
    }

    const createDb = spawn(codeqlPath, createArgs, spawnOptions);

    if (process.platform !== "win32") {
      createDb.unref();
    }

    const createId = `${scanId}-create-${componentNum}`;
    activeProcesses.set(createId, createDb);

    createDb.stdout?.on("data", (data) => {
      if (cancelled) return;
      event.sender.send(`scan-log:${scanId}`, {
        log: data.toString(),
        progress: baseProgress + 10,
      });
    });

    createDb.stderr?.on("data", (data) => {
      if (cancelled) return;
      event.sender.send(`scan-log:${scanId}`, {
        log: data.toString(),
        progress: baseProgress + 15,
      });
    });

    createDb.on("close", (code) => {
      activeProcesses.delete(createId);
      
      if (cancelled) {
        resolve({ success: false, issues: 0, cancelled: true });
        return;
      }
      
      if (code !== 0) {
        event.sender.send(`scan-log:${scanId}`, {
          log: `\n❌ Database creation failed with exit code ${code}\n`,
          progress: baseProgress + 20,
        });
        resolve({ success: false, issues: 0, cancelled: false });
        return;
      }

      event.sender.send(`scan-log:${scanId}`, {
        log: `\n✅ Database created successfully!\n\n🔬 Step 2/2: Running security analysis...\n🧪 Detecting vulnerabilities and security patterns...\n\n`,
        progress: baseProgress + 20,
      });

      const analyzeArgs = [
        "database",
        "analyze",
        dbPath,
        "--format=sarif-latest",
        "--output",
        sarifPath,
      ];

      event.sender.send(`scan-log:${scanId}`, {
        log: `$ codeql ${analyzeArgs.join(" ")}\n\n`,
        progress: baseProgress + 22,
      });

      const analyze = spawn(codeqlPath, analyzeArgs, spawnOptions);

      if (process.platform !== "win32") {
        analyze.unref();
      }

      const analyzeId = `${scanId}-analyze-${componentNum}`;
      activeProcesses.set(analyzeId, analyze);

      analyze.stdout?.on("data", (data) => {
        if (cancelled) return;
        event.sender.send(`scan-log:${scanId}`, {
          log: data.toString(),
          progress: baseProgress + 30,
        });
      });

      analyze.stderr?.on("data", (data) => {
        if (cancelled) return;
        event.sender.send(`scan-log:${scanId}`, {
          log: data.toString(),
          progress: baseProgress + 35,
        });
      });

      analyze.on("close", async (analyzeCode) => {
        activeProcesses.delete(analyzeId);
        
        if (cancelled) {
          resolve({ success: false, issues: 0, cancelled: true });
          return;
        }

        let issues = 0;
        if (fsSync.existsSync(sarifPath)) {
          try {
            const sarif = JSON.parse(await fs.readFile(sarifPath, "utf-8"));
            issues = sarif.runs?.[0]?.results?.length || 0;
          } catch (err) {
            debugLog(`Error parsing SARIF: ${err}`);
          }
        }

        const verdict = 
          issues === 0 ? "✅ Clean" :
          issues <= 3 ? "🟡 Low Risk" :
          issues <= 10 ? "🟠 Medium Risk" :
          "🔴 High Risk";

        event.sender.send(`scan-log:${scanId}`, {
          log: `\n✅ Analysis complete for ${config.language}!\n   Issues Found: ${issues}\n   Risk Level: ${verdict}\n`,
          progress: baseProgress + 40,
        });

        resolve({ 
          success: analyzeCode === 0, 
          issues, 
          cancelled: false,
          sarifPath: sarifPath
        });
      });

      analyze.on("error", (err) => {
        activeProcesses.delete(analyzeId);
        event.sender.send(`scan-log:${scanId}`, {
          log: `\n❌ Analysis error: ${err.message}\n`,
          progress: baseProgress + 40,
        });
        resolve({ success: false, issues: 0, cancelled: false });
      });
    });

    createDb.on("error", (err) => {
      activeProcesses.delete(createId);
      event.sender.send(`scan-log:${scanId}`, {
        log: `\n❌ Database creation error: ${err.message}\n`,
        progress: baseProgress + 20,
      });
      resolve({ success: false, issues: 0, cancelled: false });
    });

    const cancelHandler = () => {
      cancelled = true;
      debugLog(`Cancelling component ${componentNum} scan`);
      
      const activeChild = activeProcesses.get(createId) || activeProcesses.get(`${scanId}-analyze-${componentNum}`);
      if (activeChild) {
        killProcess(activeChild, createId);
      }
      
      resolve({ success: false, issues: 0, cancelled: true });
    };

    ipcMain.once(`scan:cancel-${scanId}`, cancelHandler);
  });
}





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
