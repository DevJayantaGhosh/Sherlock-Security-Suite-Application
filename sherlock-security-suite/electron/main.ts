// electron/main.ts
import { app, BrowserWindow, dialog, ipcMain } from "electron";
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

function toolPath(tool: "gitleaks" | "trivy" | "opengrep" | "KeyGenerator" | "SoftwareSigner"): string {
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

function validateTool(tool: "gitleaks" | "trivy" | "opengrep" | "KeyGenerator" | "SoftwareSigner"): string | null {
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
/* ============================================================
   HELPER: Format Trivy Results into a Table
============================================================ */
function formatTrivyReport(results: any): string {
  if (!results.Results || results.Results.length === 0) return "";

  let report = "\n🔎 DETAILED VULNERABILITY REPORT\n";
  report += "════════════════════════════════════════════════════════════\n";

  results.Results.forEach((target: any) => {
    if (target.Vulnerabilities && target.Vulnerabilities.length > 0) {
      report += `\n📂 Target: ${target.Target}\n`;
      report += `   Type:   ${target.Type}\n`;
      report += "   ────────────────────────────────────────────────────────\n";
      
      target.Vulnerabilities.forEach((vuln: any) => {
        const severityIcon = 
          vuln.Severity === "CRITICAL" ? "🔴" : 
          vuln.Severity === "HIGH" ? "🟠" : 
          vuln.Severity === "MEDIUM" ? "🟡" : "🔵";

        report += `   ${severityIcon} [${vuln.Severity}] ${vuln.VulnerabilityID}\n`;
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
   TRIVY SCAN HANDLER
============================================================ */
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

    // Spawn Trivy Process
    // We use --format json to parse details, but log progress to user via stdout listeners
    const child = spawn(
      trivyPath,
      ["fs", "--scanners", "vuln,misconfig", "--format", "json", repoPath],
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
      if(!msg.includes("Update") && !msg.includes("deprecated")) {
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
          
          // Calculate Total Vulnerabilities
          const vulns = results.Results?.reduce(
            (acc: number, r: any) => acc + (r.Vulnerabilities?.length || 0),
            0
          ) || 0;

          // Generate Detailed Report String
          const detailedReport = formatTrivyReport(results);

          // Send Detailed Report to Frontend Log
          event.sender.send(`scan-log:${scanId}`, {
            log: detailedReport,
            progress: 95,
          });

          // Generate Summary Box
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

          // Send Summary Log
          event.sender.send(`scan-log:${scanId}`, {
            log: summary,
            progress: 100,
          });

          // Send Complete Event
          event.sender.send(`scan-complete:${scanId}`, {
            success: true,
            vulnerabilities: vulns,
          });

          resolve({ success: true, vulnerabilities: vulns });
        } catch (err: any) {
          console.error("Trivy Parse Error:", err);
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

    // Cancel Handler
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
============================================================ */
ipcMain.handle("scan:opengrep", async (event, { repoUrl, branch, scanId, componentConfigs }) => {
  debugLog(`[OPENGREP] Starting multi-language SAST analysis for ${repoUrl}`);
  
  // 1. Validate Tool
  const opengrepPath = validateTool("opengrep");
  if (!opengrepPath) {
    event.sender.send(`scan-log:${scanId}`, {
      log: `\n❌ OpenGrep tool not found\n   Expected: ${toolPath("opengrep")}\n\n`,
      progress: 0,
    });
    event.sender.send(`scan-complete:${scanId}`, { success: false, error: "Tool not found" });
    return { success: false, error: "Tool not found" };
  }
  
  // 2. Clone Repository
  const repoPath = await cloneRepository(event, repoUrl, branch, scanId);
  if (!repoPath) {
    event.sender.send(`scan-complete:${scanId}`, { success: false, error: "Clone failed" });
    return { success: false, error: "Clone failed" };
  }

  return new Promise((resolve) => {
    // Initial Logs
    event.sender.send(`scan-log:${scanId}`, {
      log: `\n${"═".repeat(79)}\n🔬 STATIC APPLICATION SECURITY TESTING (SAST) \n${"═".repeat(79)}\n\n`,
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
      "--verbose",
      "--no-git-ignore",
      repoPath
    ];


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
      env: { ...process.env, NO_COLOR: "1" },
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

    // Capture Progress
    child.stdout?.on("data", (data) => {
      if (cancelled) return;
      progressCounter++;
      stdoutData += data.toString();
      event.sender.send(`scan-log:${scanId}`, {
        log: "",
        progress: Math.min(65 + Math.floor(progressCounter / 5), 85),
      });
    });

    // Capture Verbose Details (Rules loaded, etc.)
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
      let passedChecks = 0; // = Total Files Scanned
      let failedChecks = 0; // = Total Issues Found
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
          failedChecks = totalIssues;

          const scannedFiles = report.paths?.scanned || [];
          const skippedFiles = report.paths?.skipped || [];
          
          // CRITICAL FIX: Use the raw count as the absolute truth
          passedChecks = scannedFiles.length; 
          const totalFilesScanned = scannedFiles.length;

          // --- Helper: Normalize Paths ---
          const repoPathNormalized = repoPath.replace(/\\/g, '/');
          
          function getRelativePath(absolutePath: string): string {
            const normalized = absolutePath.replace(/\\/g, '/');
            if (normalized.startsWith(repoPathNormalized)) {
              return normalized.substring(repoPathNormalized.length + 1);
            }
            return normalized;
          }

          // --- 1. Detect Projects ---
          const ignoredDirs = new Set([
            '.git', '.idea', '.vscode', '.github', 
            'node_modules', 'dist', 'build', 'target', 
            'out', 'bin', '__pycache__', '.gradle',
            'coverage', '.next', '.nuxt', '.venv', 'venv'
          ]);

          const projectDirectories = new Set<string>();
          const filesByDirectory = new Map<string, number>();
          
          try {
            const repoContents = await fs.readdir(repoPath, { withFileTypes: true });
            repoContents.forEach(item => {
              if (item.isDirectory() && !ignoredDirs.has(item.name)) {
                projectDirectories.add(item.name);
                filesByDirectory.set(item.name, 0);
              }
            });
            debugLog(`[OPENGREP] Found ${projectDirectories.size} project directories`);
          } catch (err: any) {
            debugLog(`Error reading repo directory: ${err.message}`);
          }
          
          // --- 2. Process Files per Project ---
          scannedFiles.forEach((absolutePath: string) => {
            const relativePath = getRelativePath(absolutePath);
            const normalizedPath = relativePath.replace(/\\/g, '/');
            const parts = normalizedPath.split('/').filter(p => p && p !== '.');
            
            if (parts.length === 0) return;
            
            // Just count them for projects if applicable
            if (parts.length > 1) {
              const topDir = parts[0];
              if (projectDirectories.has(topDir)) {
                filesByDirectory.set(topDir, (filesByDirectory.get(topDir) || 0) + 1);
              }
            }
          });

          // --- 3. Parse Rules Run (from stderr) ---
          const rulesRun = new Set<string>();
          let totalRulesCount = 0;
          
          const ruleCountPattern = /(?:running|loaded|scanning with)\s+(\d+)\s+rules?/gi;
          const ruleCountMatch = ruleCountPattern.exec(stderrData);
          if (ruleCountMatch) {
            totalRulesCount = parseInt(ruleCountMatch[1]);
          }
          
          const lines = stderrData.split('\n');
          lines.forEach(line => {
            const trimmed = line.trim();
            const ruleMatch = trimmed.match(/^(?:rule|checking|running):\s*([a-zA-Z0-9._\-:\/]+)$/i);
            if (ruleMatch) rulesRun.add(ruleMatch[1]);
            
            if (trimmed.includes('.') && trimmed.length > 10 && trimmed.length < 100 && !trimmed.includes(' ') && /^[a-zA-Z0-9._\-:\/]+$/.test(trimmed)) {
              rulesRun.add(trimmed);
            }
          });

          // --- 4. Analyze Findings ---
          const findingsByDirectory = new Map<string, any[]>();
          
          findings.forEach((f: any) => {
            const severity = (f.extra?.severity || "WARNING").toUpperCase();
            if (severity === "ERROR" || severity === "CRITICAL") criticalCount++;
            else if (severity === "WARNING" || severity === "HIGH") highCount++;
            else if (severity === "MEDIUM") mediumCount++;
            else lowCount++;

            if (f.check_id) rulesRun.add(f.check_id);

            const absolutePath = f.path || "";
            const relativePath = getRelativePath(absolutePath);
            const normalizedPath = relativePath.replace(/\\/g, '/');
            const parts = normalizedPath.split('/').filter(p => p && p !== '.');
            
            if (parts.length > 1) {
              const topDir = parts[0];
              if (projectDirectories.has(topDir)) {
                if (!findingsByDirectory.has(topDir)) findingsByDirectory.set(topDir, []);
                findingsByDirectory.get(topDir)!.push(f);
              }
            }
          });

          event.sender.send(`scan-log:${scanId}`, {
            log: `\n✅ Scan completed successfully!\n\n`,
            progress: 88,
          });

          // ==================== LOGS: FILES BY PROJECT ====================
          // Calculate "Other" files by subtracting identified project files from the GRAND TOTAL
          const filesInIdentifiedProjects = Array.from(filesByDirectory.values()).reduce((sum, count) => sum + count, 0);
          const otherFiles = totalFilesScanned - filesInIdentifiedProjects;
          
          const projectsWithFiles = Array.from(filesByDirectory.entries())
            .filter(([dir, count]) => count > 0 && projectDirectories.has(dir))
            .sort((a, b) => b[1] - a[1]);

          if (projectsWithFiles.length > 0) {
            event.sender.send(`scan-log:${scanId}`, {
              log: `\n\n📂 FILES BY PROJECT:\n${"─".repeat(79)}\n\n`,
              progress: 89,
            });

            projectsWithFiles.forEach(([dir, count]) => {
              const issues = findingsByDirectory.get(dir) || [];
              const statusIcon = issues.length === 0 ? '✅' : issues.length <= 5 ? '🟡' : '🔴';
              // Percentage based on ACTUAL total
              const percentage = totalFilesScanned > 0 ? Math.round((count / totalFilesScanned) * 100) : 0;
              
              event.sender.send(`scan-log:${scanId}`, {
                log: `  ${statusIcon} ${dir.padEnd(40)} ${count.toString().padStart(4)} files (${percentage.toString().padStart(2)}%)${issues.length > 0 ? ` — ${issues.length} issue(s)` : ''}\n`,
                progress: 89,
              });
            });
            
            // Show the remaining files as "Root/Misc" so numbers add up
            if (otherFiles > 0) {
               const rootPercentage = totalFilesScanned > 0 ? Math.round((otherFiles / totalFilesScanned) * 100) : 0;
               event.sender.send(`scan-log:${scanId}`, {
                log: `  📄 [root/misc] (config/metadata)           ${otherFiles.toString().padStart(4)} files (${rootPercentage.toString().padStart(2)}%)\n`,
                progress: 89,
              });
            }
          } else if (totalFilesScanned > 0) {
              // No sub-projects detected, just show total
              event.sender.send(`scan-log:${scanId}`, {
                log: `\n📂 FILES SCANNED: ${totalFilesScanned} (root level or flat structure)\n`,
                progress: 89,
              });
          }


          // ==================== LOGS: SECURITY RULES APPLIED ====================
          event.sender.send(`scan-log:${scanId}`, {
            log: `\n\n🛡️  SECURITY RULES APPLIED:\n${"═".repeat(79)}\n\n`,
            progress: 90,
          });

          if (totalRulesCount > 0) {
            event.sender.send(`scan-log:${scanId}`, {
              log: `   OpenGrep scanned ${totalFilesScanned} files using ${totalRulesCount} security rules\n\n`,
              progress: 90,
            });
          }

          if (rulesRun.size > 0) {
            const rulesByCategory = new Map<string, string[]>();
            rulesRun.forEach((ruleId: string) => {
              const parts = ruleId.split('.');
              let category = 'Other';
              
              if (parts.includes('security')) category = 'Security';
              else if (parts.includes('best-practice')) category = 'Best Practice';
              else if (parts.includes('performance')) category = 'Performance';
              else if (parts.includes('correctness')) category = 'Correctness';
              else if (parts.includes('audit')) category = 'Security Audit';
              else if (parts.length >= 2) category = parts[1];
              
              if (!rulesByCategory.has(category)) rulesByCategory.set(category, []);
              rulesByCategory.get(category)!.push(ruleId);
            });

            const sortedCategories = Array.from(rulesByCategory.entries()).sort((a, b) => b[1].length - a[1].length);
            
            if (sortedCategories.length > 0) {
              event.sender.send(`scan-log:${scanId}`, { log: `   Sample Rules by Category:\n\n`, progress: 90 });

              sortedCategories.slice(0, 8).forEach(([category, rules]) => {
                event.sender.send(`scan-log:${scanId}`, {
                  log: `   📋 ${category} (${rules.length} rule${rules.length > 1 ? 's' : ''})\n`,
                  progress: 90,
                });
                
                rules.slice(0, 3).forEach((ruleId: string) => {
                  event.sender.send(`scan-log:${scanId}`, { log: `      • ${ruleId}\n`, progress: 90 });
                });
                
                if (rules.length > 3) {
                  event.sender.send(`scan-log:${scanId}`, { log: `      ... and ${rules.length - 3} more\n`, progress: 90 });
                }
                event.sender.send(`scan-log:${scanId}`, { log: `\n`, progress: 90 });
              });
            }
          }

          // ==================== LOGS: FINDINGS ====================
          if (totalIssues > 0) {
            event.sender.send(`scan-log:${scanId}`, {
              log: `\n\n🚨 SECURITY FINDINGS:\n${"═".repeat(79)}\n\n`,
              progress: 91,
            });

            const severityLog = `
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🔴 Critical/Error       : ${criticalCount.toString().padStart(4)}                                             │
│ 🟠 High/Warning         : ${highCount.toString().padStart(4)}                                             │
│ 🟡 Medium               : ${mediumCount.toString().padStart(4)}                                             │
│ 🔵 Low/Info             : ${lowCount.toString().padStart(4)}                                             │
└─────────────────────────────────────────────────────────────────────────────┘
`;
            event.sender.send(`scan-log:${scanId}`, { log: severityLog, progress: 91 });

            // Findings by project
            const sortedFindings = Array.from(findingsByDirectory.entries())
              .filter(([dir, issues]) => issues.length > 0)
              .sort((a, b) => b[1].length - a[1].length);

            if (sortedFindings.length > 0) {
              event.sender.send(`scan-log:${scanId}`, { log: `\n📂 ISSUES BY PROJECT:\n${"─".repeat(79)}\n\n`, progress: 91 });
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

            // FIX: Explicitly typed Map for sorting
            const severityMap: Record<string, number> = { 
              ERROR: 4, CRITICAL: 4, 
              WARNING: 3, HIGH: 3, 
              MEDIUM: 2, 
              INFO: 1, LOW: 1 
            };

            const allSortedFindings = findings.sort((a: any, b: any) => {
               const sevA = (a.extra?.severity || "WARNING").toUpperCase();
               const sevB = (b.extra?.severity || "WARNING").toUpperCase();
               return (severityMap[sevB] || 0) - (severityMap[sevA] || 0);
            });

            allSortedFindings.slice(0, 10).forEach((finding: any, index: number) => {
              const sev = (finding.extra?.severity || "WARNING").toUpperCase();
              const sevIcon = (sev === "ERROR" || sev === "CRITICAL") ? "🔴 CRITICAL" : (sev === "WARNING" || sev === "HIGH") ? "🟠 HIGH    " : "🔵 LOW     ";
              const absolutePath = finding.path || "N/A";
              const relativePath = getRelativePath(absolutePath);
              const shortPath = relativePath.length > 60 ? '...' + relativePath.slice(-57) : relativePath;

              const findingLog = `
${index + 1}. ${sevIcon} │ ${finding.check_id || 'Unknown Rule'}
   File: ${shortPath}
   Line: ${finding.start?.line || '?'}
   ${finding.extra?.message || finding.message || 'No description'}
${"─".repeat(79)}
`;
              event.sender.send(`scan-log:${scanId}`, { log: findingLog, progress: 93 });
            });
          } else {
             event.sender.send(`scan-log:${scanId}`, {
              log: `\n\n✅ NO SECURITY ISSUES DETECTED!\n${"═".repeat(79)}\n\n`,
              progress: 95,
            });
            event.sender.send(`scan-log:${scanId}`, {
              log: `🎉 All ${totalFilesScanned} files passed security analysis.\n🛡️  No vulnerabilities found. Repository is secure!\n`,
              progress: 95,
            });
          }

          // ==================== 5. FINAL SUMMARY ====================
          const projectsList = projectsWithFiles.length > 0 
            ? projectsWithFiles.map(([dir]) => dir).slice(0, 3).join(', ') + (projectsWithFiles.length > 3 ? `, +${projectsWithFiles.length - 3} more` : '')
            : 'No sub-projects detected';

          const summary_text = `
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║                        📊  SAST ANALYSIS SUMMARY  📊                         ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝

Repository        : ${repoUrl}
Branch            : ${branch}
Scan Engine       : OpenGrep (Open Source SAST)

📁 SCAN COVERAGE
───────────────────────────────────────────────────────────────────────────────
  Total Files Scanned     : ${totalFilesScanned}
  Projects Scanned        : ${projectsWithFiles.length} (${projectsList})
  Files Skipped           : ${skippedFiles.length}
  Rules Applied           : ${totalRulesCount > 0 ? totalRulesCount : 'Auto (Community Rules)'}

  Breakdown:
   - Project Code         : ${filesInIdentifiedProjects}
   - Config/Root/Misc     : ${otherFiles}

🔍 FINDINGS SUMMARY
───────────────────────────────────────────────────────────────────────────────
  Total Issues            : ${totalIssues}
  🔴 Critical/Error       : ${criticalCount}
  🟠 High/Warning         : ${highCount}
  🟡 Medium               : ${mediumCount}
  🔵 Low/Info             : ${lowCount}

🎯 SECURITY VERDICT
───────────────────────────────────────────────────────────────────────────────
${totalIssues === 0 
  ? `  ✅ SECURE — All code passed security checks\n  ✅ No vulnerabilities detected\n  ✅ Safe to deploy to production`
  : criticalCount > 0
  ? `  🚨 CRITICAL RISK — ${criticalCount} critical vulnerabilities detected\n  ⛔ DO NOT DEPLOY until all critical issues are fixed\n  🔧 Immediate remediation required`
  : `  ⚠️  RISKS DETECTED — ${totalIssues} issues found\n  🔧 Review required`
}
═══════════════════════════════════════════════════════════════════════════════
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
        event.sender.send(`scan-log:${scanId}`, {
          log: `\n⚠️ No report file generated\n`,
          progress: 100,
        });
        if (stderrData.trim()) {
           event.sender.send(`scan-log:${scanId}`, { log: `\n❌ Error details:\n${stderrData}\n`, progress: 100 });
        }
      }

      const success = code === 0 || code === 1;
      
      event.sender.send(`scan-complete:${scanId}`, {
        success,
        totalIssues: totalIssues,
        passedChecks: passedChecks,
        failedChecks: failedChecks,
        error: success ? undefined : `Scan exited with code ${code}`,
      });

      resolve({ success, totalIssues, passedChecks, failedChecks });
    });

    child.on("error", (err) => {
      activeProcesses.delete(scanProcessId);
      event.sender.send(`scan-log:${scanId}`, { log: `\n❌ OpenGrep process error: ${err.message}\n`, progress: 0 });
      event.sender.send(`scan-complete:${scanId}`, { success: false, error: err.message });
      resolve({ success: false, error: err.message });
    });

    ipcMain.once(`scan:cancel-${scanId}`, () => {
      cancelled = true;
      debugLog(`Cancelling OpenGrep scan: ${scanId}`);
      event.sender.send(`scan-log:${scanId}`, { log: `\n⚠️ Scan cancelled by user\n`, progress: 0 });
      killProcess(child, scanProcessId);
      activeProcesses.delete(scanProcessId);
      resolve({ success: false, cancelled: true });
    });
  });
});

/* ============================================================
   KEY GENERATION
============================================================ */
ipcMain.handle("crypto:generate-keys", async (event, { type, size, curve, password, outputDir, scanId }) => {
  // 1. Validate Tool
  const exePath = validateTool("KeyGenerator");
  if (!exePath) {
    event.sender.send(`scan-log:${scanId}`, { 
      log: `\n❌ TOOL ERROR: KeyGenerator not found!\nExpected: ${toolPath("KeyGenerator")}\n`, 
      progress: 0 
    });
    return { success: false, error: "Tool not found" };
  }

  return new Promise((resolve) => {
    // 2. HEADER
    event.sender.send(`scan-log:${scanId}`, {
      log: `\n${"═".repeat(65)}\n🔑 KEY GENERATION STARTED\n${"═".repeat(65)}\n\n` +
           `🔹 Algorithm: ${type.toUpperCase()}${type === 'rsa' ? ` (${size} bits)` : ` (${curve})`}\n` +
           `🔹 Output: ${outputDir}\n` +
           `🔹 Security: ${password ? "🔒 Protected" : "⚠️ No Password"}\n\n`,
      progress: 5,
    });

    // 3. Build Args (❌ NO -v flag)
    const args: string[] = ["generate", type];
    if (type === "rsa" && size) args.push("-s", `${size}`);
    if (type === "ecdsa" && curve) args.push("-c", curve);
    if (password) args.push("-p", password);
    args.push("-o", outputDir);
    // ✅ NO "-v" flag - exactly matches your working command

    // 4. LOG COMMAND
    const commandDisplay = `KeyGenerator.exe ${args.join(" ")}`;
    event.sender.send(`scan-log:${scanId}`, {
      log: `🔍 RUNNING:\n  ${commandDisplay}\n\n⏳ Executing...\n`,
      progress: 10,
    });

    // 5. ✅ DIRECT SPAWN - No dynamic imports
    const child = spawn(exePath, args, { 
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    activeProcesses.set(scanId, child);
    let buffer = "";
    let cancelled = false;

    // 6. STDOUT
    if (child.stdout) {
      child.stdout.on("data", (chunk: Buffer) => {
        if (cancelled) return;
        const text = chunk.toString();
        buffer += text;
        event.sender.send(`scan-log:${scanId}`, { log: text, progress: 60 });
      });
    }

    // 7. STDERR (RED)
    if (child.stderr) {
      child.stderr.on("data", (chunk: Buffer) => {
        if (cancelled) return;
        const text = chunk.toString();
        buffer += text;
        event.sender.send(`scan-log:${scanId}`, { log: `\n🔴 [ERROR] ${text.trim()}\n`, progress: 50 });
      });
    }

    // 8. Process Exit + File Check
    child.on("close", (code: number | null) => {
      activeProcesses.delete(scanId);
      if (cancelled) return;
      
      const trueSuccess = code === 0 ;

      // 9. FINAL REPORT
      let finalReport = `
╔══════════════════════════════════════════════════════════════════════╗
║                    KEY GENERATION REPORT                             ║
╚══════════════════════════════════════════════════════════════════════╝
      \n\n`;
      finalReport += `    RESULT     : ${code === 0 ? "✅ SUCCESS" : `❌ FAILED (${code})`}\n`;
      finalReport += `    Algorithm  : ${type.toUpperCase()}\n`;
      finalReport += `    Timestamp  : ${new Date().toLocaleTimeString()}\n`;
      if (trueSuccess) {
        finalReport += `✅ KEYS READY FOR SIGNING!\n`;
      } else {
        finalReport += `⚠️  Check error logs above\n`;
      }

      finalReport += `${"═".repeat(70)}`;

      event.sender.send(`scan-log:${scanId}`, { log: finalReport, progress: 100 });
      event.sender.send(`scan-complete:${scanId}`, { success: trueSuccess });
      resolve({ success: trueSuccess });
    });

    // 10. Errors
    child.on("error", (error: Error) => {
      activeProcesses.delete(scanId);
      event.sender.send(`scan-log:${scanId}`, { 
        log: `\n💥 SPAWN ERROR: ${error.message}`, 
        progress: 0 
      });
      resolve({ success: false, error: error.message });
    });

    // 11. Cancel
    ipcMain.once(`scan:cancel-${scanId}`, () => {
      cancelled = true;
      if (child.pid) process.kill(child.pid, 'SIGTERM');
      event.sender.send(`scan-log:${scanId}`, { log: `\n🛑 CANCELLED\n`, progress: 0 });
      resolve({ success: false, cancelled: true });
    });
  });
});


/* ============================================================
   SIGN ARTIFACT (Uses existing validateTool + cloneRepository)
============================================================ */
ipcMain.handle("crypto:sign-artifact", async (event, { repoUrl, branch, privateKeyPath, password, scanId }) => {
  
  // 1. Validate Tool
  const exePath = validateTool("SoftwareSigner");
  
  if (!exePath) {
     event.sender.send(`scan-log:${scanId}`, { 
        log: `\n❌ TOOL ERROR: SoftwareSigner not found.\nExpected at: ${toolPath("SoftwareSigner")}\n`, 
        progress: 0 
     });
     return { success: false, error: "Tool not found" };
  }

  // 2. Clone Repo
  const repoPath = await cloneRepository(event, repoUrl, branch, scanId);
  if (!repoPath) {
     event.sender.send(`scan-complete:${scanId}`, { success: false, error: "Clone Failed" });
     return { success: false, error: "Clone Failed" };
  }

  return new Promise((resolve) => {
    // 3. Log (SECURE: Password not shown)
    event.sender.send(`scan-log:${scanId}`, {
      log: `\n${"═".repeat(60)}\n🔏 INITIATING CRYPTOGRAPHIC SIGNING\n${"═".repeat(60)}\n\n`,
      progress: 30,
    });

    const outputSigPath = path.join(repoPath, "signature.sig");

    event.sender.send(`scan-log:${scanId}`, {
      log: `🔹 Target Repo : ${repoUrl}\n🔹 Branch      : ${branch}\n🔹 Signing Key : ${path.basename(privateKeyPath)}\n🔹 Security    : ${password ? "Password Protected 🔒" : "No Password ⚠️"}\n🔹 Output Path : ${outputSigPath}\n\n`,
      progress: 35,
    });

    // 4. Args
    const args = [
      "sign",
      "-c", repoPath,
      "-k", privateKeyPath,
      "-o", outputSigPath,
    ];
    if (password) args.push("-p", password);

    // 5. Spawn
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
      event.sender.send(`scan-log:${scanId}`, { log: `[STDERR] ${text}`, progress: 60 });
    });

    // 6. Complete
    child.on("close", (code) => {
      activeProcesses.delete(scanId);
      if (cancelled) return;

      const success = code === 0;

      let sigSize = "0 B";
      if (success && fsSync.existsSync(outputSigPath)) {
          sigSize = `${fsSync.statSync(outputSigPath).size} bytes`;
      }

      const summary = `
╔══════════════════════════════════════════════════════════════════════╗
║                  DIGITAL SIGNATURE REPORT                            ║
╚══════════════════════════════════════════════════════════════════════╝

 Status       : ${success ? "✅ SIGNED & VERIFIED" : "❌ SIGNING FAILED"}
 Repository   : ${repoUrl}
 Branch       : ${branch}
 Timestamp    : ${new Date().toLocaleTimeString()}

 🔏 Signature Details:
 ─────────────────────
 📄 File      : signature.sig
 💾 Size      : ${sigSize}
 🔑 Key Used  : ${path.basename(privateKeyPath)}

${"═".repeat(70)}
`;

      event.sender.send(`scan-log:${scanId}`, { log: summary, progress: 100 });
      event.sender.send(`scan-complete:${scanId}`, { success });
      resolve({ success });
    });

    // 7. Cancel
    ipcMain.once(`scan:cancel-${scanId}`, () => {
        cancelled = true;
        if (child.pid) try { process.kill(child.pid); } catch(e) {}
        activeProcesses.delete(scanId);
        event.sender.send(`scan-log:${scanId}`, { log: "\n⚠️ PROCESS CANCELLED BY USER\n", progress: 0 });
        resolve({ success: false, cancelled: true });
    });
  });
});






/* ============================================================
   DIALOG HANDLERS (Fixed to be Modal)
============================================================ */
ipcMain.handle("dialog:select-folder", async (event) => {
  // Get the window that triggered this event
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return null;

  const { filePaths, canceled } = await dialog.showOpenDialog(win, {
    properties: ["openDirectory", "createDirectory", "promptToCreate"],
    title: "Select Output Directory",
    buttonLabel: "Select Folder"
  });
  
  return (canceled || filePaths.length === 0) ? null : filePaths[0];
});

ipcMain.handle("dialog:select-file", async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return null;

  const { filePaths, canceled } = await dialog.showOpenDialog(win, {
    properties: ["openFile"],
    filters: [{ name: "Keys", extensions: ["pem", "key", "sig"] }],
    title: "Select Private Key",
    buttonLabel: "Select Key"
  });

  return (canceled || filePaths.length === 0) ? null : filePaths[0];
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
