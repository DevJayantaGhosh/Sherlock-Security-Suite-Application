import { app, BrowserWindow, ipcMain } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { spawn } from "child_process";
import fs from "fs/promises";
import fsSync from "fs";
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win = null;
let splash = null;
const activeProcesses = /* @__PURE__ */ new Map();
const repoCache = /* @__PURE__ */ new Map();
function debugLog(msg) {
  console.log(`[ELECTRON][${(/* @__PURE__ */ new Date()).toISOString()}] ${msg}`);
}
function getOsFolder() {
  if (process.platform === "win32") return "win";
  if (process.platform === "darwin") return "darwin";
  return "linux";
}
function toolPath(tool) {
  const ext = process.platform === "win32" ? ".exe" : "";
  const toolFile = tool + ext;
  return path.join(
    process.env.APP_ROOT,
    "tools",
    getOsFolder(),
    tool,
    toolFile
  );
}
function validateTool(tool) {
  const fullPath = toolPath(tool);
  if (!fsSync.existsSync(fullPath)) {
    debugLog(`Tool not found: ${fullPath}`);
    return null;
  }
  try {
    fsSync.accessSync(fullPath, fsSync.constants.X_OK);
  } catch (err) {
    debugLog(`${tool} not executable: ${fullPath}`);
    if (process.platform !== "win32") {
      try {
        fsSync.chmodSync(fullPath, 493);
        debugLog(`Set execute permission on ${fullPath}`);
      } catch (chmodErr) {
        debugLog(`Failed to set permissions: ${chmodErr.message}`);
        return null;
      }
    }
  }
  debugLog(`Found ${tool} at: ${fullPath}`);
  return fullPath;
}
function killProcess(child, processId) {
  if (!child || !child.pid) {
    debugLog(`No PID for ${processId}`);
    return;
  }
  debugLog(`Killing ${processId} (PID: ${child.pid})`);
  try {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", child.pid.toString(), "/f", "/t"], {
        stdio: "ignore"
      });
    } else {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch (e) {
        child.kill("SIGKILL");
      }
    }
  } catch (err) {
    debugLog(`Kill error ${processId}: ${err.message}`);
    try {
      child.kill("SIGKILL");
    } catch {
    }
  }
}
async function cloneRepository(event, repoUrl, branch, scanId) {
  var _a;
  const cacheKey = `${repoUrl}:${branch}`;
  if (repoCache.has(cacheKey)) {
    const cachedPath = repoCache.get(cacheKey);
    try {
      await fs.access(path.join(cachedPath, ".git"));
      debugLog(`Using cached repo: ${cachedPath}`);
      event.sender.send(`scan-log:${scanId}`, {
        log: `✅ Using cached repository
   Path: ${cachedPath}
   Branch: ${branch}

`,
        progress: 50
      });
      return cachedPath;
    } catch {
      repoCache.delete(cacheKey);
    }
  }
  debugLog(`Cloning ${repoUrl} (branch: ${branch})`);
  event.sender.send(`scan-log:${scanId}`, {
    log: `
${"═".repeat(60)}
📦 CLONING REPOSITORY
${"═".repeat(60)}
`,
    progress: 5
  });
  event.sender.send(`scan-log:${scanId}`, {
    log: `Repository: ${repoUrl}
Branch: ${branch}

`,
    progress: 10
  });
  const repoName = ((_a = repoUrl.split("/").pop()) == null ? void 0 : _a.replace(".git", "")) || "repo";
  const timestamp = Date.now();
  const tempDir = path.join(
    app.getPath("temp"),
    "cipher-scans",
    `${repoName}-${branch.replace(/\//g, "-")}-${timestamp}`
  );
  try {
    await fs.mkdir(tempDir, { recursive: true });
    return await new Promise((resolve) => {
      var _a2, _b;
      const args = ["clone", "-b", branch, "--single-branch", repoUrl, tempDir];
      event.sender.send(`scan-log:${scanId}`, {
        log: `$ git clone -b ${branch} --single-branch ${repoUrl}

`,
        progress: 15
      });
      const child = spawn("git", args, {
        detached: true,
        stdio: ["ignore", "pipe", "pipe"]
      });
      child.unref();
      const cloneId = `${scanId}-clone`;
      activeProcesses.set(cloneId, child);
      let cancelled = false;
      let progressCount = 0;
      (_a2 = child.stdout) == null ? void 0 : _a2.on("data", (data) => {
        progressCount++;
        event.sender.send(`scan-log:${scanId}`, {
          log: data.toString(),
          progress: Math.min(20 + progressCount * 2, 45)
        });
      });
      (_b = child.stderr) == null ? void 0 : _b.on("data", (data) => {
        progressCount++;
        event.sender.send(`scan-log:${scanId}`, {
          log: data.toString(),
          progress: Math.min(20 + progressCount * 2, 45)
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
            log: `
✅ Clone successful!
   Location: ${tempDir}
${"═".repeat(60)}

`,
            progress: 50
          });
          resolve(tempDir);
        } else {
          event.sender.send(`scan-log:${scanId}`, {
            log: `
❌ Clone failed with exit code ${code}
`,
            progress: 0
          });
          resolve(null);
        }
      });
      child.on("error", (err) => {
        activeProcesses.delete(cloneId);
        event.sender.send(`scan-log:${scanId}`, {
          log: `
❌ Clone error: ${err.message}
`,
          progress: 0
        });
        resolve(null);
      });
      const cancelHandler = () => {
        cancelled = true;
        debugLog(`Cancelling clone: ${cloneId}`);
        killProcess(child, cloneId);
        activeProcesses.delete(cloneId);
        resolve(null);
      };
      ipcMain.once(`scan:cancel-${scanId}`, cancelHandler);
      setTimeout(() => {
        if (activeProcesses.has(cloneId)) {
          killProcess(child, cloneId);
          event.sender.send(`scan-log:${scanId}`, {
            log: `
❌ Clone timeout after 3 minutes
`,
            progress: 0
          });
          resolve(null);
        }
      }, 18e4);
    });
  } catch (err) {
    event.sender.send(`scan-log:${scanId}`, {
      log: `
❌ Exception: ${err.message}
`,
      progress: 0
    });
    return null;
  }
}
function registerIPC() {
  ipcMain.handle("scan:verify-gpg", async (event, { repoUrl, branch, scanId }) => {
    debugLog(`[GPG] Starting verification for ${repoUrl} on branch ${branch}`);
    const repoPath = await cloneRepository(event, repoUrl, branch, scanId);
    if (!repoPath) {
      event.sender.send(`scan-complete:${scanId}`, {
        success: false,
        error: "Clone failed"
      });
      return { success: false, error: "Clone failed" };
    }
    return new Promise((resolve) => {
      var _a, _b;
      event.sender.send(`scan-log:${scanId}`, {
        log: `
${"═".repeat(60)}
🔐 GPG SIGNATURE VERIFICATION
${"═".repeat(60)}

`,
        progress: 52
      });
      event.sender.send(`scan-log:${scanId}`, {
        log: `🔍 Analyzing ALL commit signatures on branch: ${branch}...

`,
        progress: 55
      });
      const child = spawn(
        "git",
        ["log", "--show-signature", "--pretty=format:%H|%an|%aI|%s", branch],
        {
          cwd: repoPath,
          detached: true,
          stdio: ["ignore", "pipe", "pipe"]
        }
      );
      child.unref();
      activeProcesses.set(scanId, child);
      let buffer = "";
      let stderrBuffer = "";
      let commitCount = 0;
      let goodSignatures = 0;
      let cancelled = false;
      (_a = child.stdout) == null ? void 0 : _a.on("data", (chunk) => {
        if (cancelled) return;
        buffer += chunk.toString();
      });
      (_b = child.stderr) == null ? void 0 : _b.on("data", (chunk) => {
        if (cancelled) return;
        stderrBuffer += chunk.toString();
      });
      child.on("close", (code) => {
        activeProcesses.delete(scanId);
        if (cancelled) {
          resolve({ success: false, cancelled: true });
          return;
        }
        const fullOutput = buffer + "\n" + stderrBuffer;
        const lines = fullOutput.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.includes("|")) {
            commitCount++;
            const [sha, author, date, subject] = line.split("|");
            let isGoodSig = false;
            let signatureBlock = "";
            for (let j = Math.max(0, i - 20); j < i; j++) {
              signatureBlock += lines[j] + "\n";
            }
            if (signatureBlock.includes("Good signature from") || signatureBlock.includes("gpg: Good signature") || signatureBlock.includes("Signature made") || signatureBlock.includes("using RSA key") && signatureBlock.includes("Good") || signatureBlock.includes("using ECDSA key") && signatureBlock.includes("Good")) {
              isGoodSig = true;
              goodSignatures++;
            }
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
              progress: 55 + Math.min(commitCount / Math.max(commitCount, 1) * 35, 35)
            });
            signatureBlock = "";
          }
        }
        const successRate = commitCount > 0 ? Math.round(goodSignatures / commitCount * 100) : 0;
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
          progress: 100
        });
        event.sender.send(`scan-complete:${scanId}`, {
          success: code === 0,
          totalCommits: commitCount,
          goodSignatures
        });
        resolve({ success: code === 0, totalCommits: commitCount, goodSignatures });
      });
      child.on("error", (err) => {
        activeProcesses.delete(scanId);
        event.sender.send(`scan-complete:${scanId}`, {
          success: false,
          error: err.message
        });
        resolve({ success: false, error: err.message });
      });
      ipcMain.once(`scan:cancel-${scanId}`, () => {
        cancelled = true;
        debugLog(`Cancelling GPG scan: ${scanId}`);
        killProcess(child, scanId);
        activeProcesses.delete(scanId);
        resolve({ success: false, cancelled: true });
      });
    });
  });
  ipcMain.handle("scan:gitleaks", async (event, { repoUrl, branch, scanId }) => {
    debugLog(`[GITLEAKS] Starting scan for ${repoUrl}`);
    const gitleaksPath = validateTool("gitleaks");
    if (!gitleaksPath) {
      event.sender.send(`scan-log:${scanId}`, {
        log: `
❌ Gitleaks tool not found
   Expected: ${toolPath("gitleaks")}

`,
        progress: 0
      });
      event.sender.send(`scan-complete:${scanId}`, {
        success: false,
        error: "Tool not found"
      });
      return { success: false, error: "Tool not found" };
    }
    const repoPath = await cloneRepository(event, repoUrl, branch, scanId);
    if (!repoPath) {
      event.sender.send(`scan-complete:${scanId}`, {
        success: false,
        error: "Clone failed"
      });
      return { success: false, error: "Clone failed" };
    }
    const reportPath = path.join(repoPath, "gitleaks-report.json");
    return new Promise((resolve) => {
      var _a, _b;
      event.sender.send(`scan-log:${scanId}`, {
        log: `
${"═".repeat(60)}
🔐 SECRETS & CREDENTIALS DETECTION
${"═".repeat(60)}

`,
        progress: 52
      });
      event.sender.send(`scan-log:${scanId}`, {
        log: `🔍 Scanning for hardcoded secrets and credentials...

`,
        progress: 55
      });
      const spawnOptions = {
        cwd: repoPath,
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          NO_COLOR: "1"
          // Removed ANSI colors for cleaner parsing
        }
      };
      if (process.platform === "win32") {
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
      if (process.platform !== "win32") {
        child.unref();
      }
      activeProcesses.set(scanId, child);
      let cancelled = false;
      (_a = child.stdout) == null ? void 0 : _a.on("data", (data) => {
        if (cancelled) return;
        event.sender.send(`scan-log:${scanId}`, {
          log: data.toString(),
          progress: 70
        });
      });
      (_b = child.stderr) == null ? void 0 : _b.on("data", (data) => {
        if (cancelled) return;
        event.sender.send(`scan-log:${scanId}`, {
          log: data.toString(),
          progress: 85
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
            if (findings > 0) {
              event.sender.send(`scan-log:${scanId}`, {
                log: `
🔍 DETAILED FINDINGS:
${"═".repeat(79)}

`,
                progress: 90
              });
              report.forEach((finding, index) => {
                var _a2, _b2, _c;
                const secretLog = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 Secret ${index + 1}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Type        : ${finding.RuleID || "Unknown"}
Description : ${finding.Description || finding.RuleID || "N/A"}
File        : ${finding.File || "N/A"}
Line        : ${finding.StartLine || "N/A"}
Commit      : ${((_a2 = finding.Commit) == null ? void 0 : _a2.substring(0, 8)) || "N/A"}
Author      : ${finding.Author || "N/A"}
Date        : ${finding.Date || "N/A"}

Match       : ${((_b2 = finding.Match) == null ? void 0 : _b2.substring(0, 80)) || "N/A"}${((_c = finding.Match) == null ? void 0 : _c.length) > 80 ? "..." : ""}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
                event.sender.send(`scan-log:${scanId}`, {
                  log: secretLog,
                  progress: 90 + Math.floor(index / findings * 5)
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
          progress: 100
        });
        event.sender.send(`scan-complete:${scanId}`, {
          success: true,
          findings
        });
        resolve({ success: true, findings });
      });
      child.on("error", (err) => {
        activeProcesses.delete(scanId);
        event.sender.send(`scan-complete:${scanId}`, {
          success: false,
          error: err.message
        });
        resolve({ success: false, error: err.message });
      });
      ipcMain.once(`scan:cancel-${scanId}`, () => {
        cancelled = true;
        debugLog(`Cancelling Gitleaks scan: ${scanId}`);
        killProcess(child, scanId);
        activeProcesses.delete(scanId);
        resolve({ success: false, cancelled: true });
      });
    });
  });
  ipcMain.handle("scan:trivy", async (event, { repoUrl, branch, scanId }) => {
    debugLog(`[TRIVY] Starting SBOM scan for ${repoUrl}`);
    const trivyPath = validateTool("trivy");
    if (!trivyPath) {
      event.sender.send(`scan-log:${scanId}`, {
        log: `
❌ Trivy tool not found
   Expected: ${toolPath("trivy")}

`,
        progress: 0
      });
      event.sender.send(`scan-complete:${scanId}`, {
        success: false,
        error: "Tool not found"
      });
      return { success: false, error: "Tool not found" };
    }
    const repoPath = await cloneRepository(event, repoUrl, branch, scanId);
    if (!repoPath) {
      event.sender.send(`scan-complete:${scanId}`, {
        success: false,
        error: "Clone failed"
      });
      return { success: false, error: "Clone failed" };
    }
    return new Promise((resolve) => {
      var _a, _b;
      event.sender.send(`scan-log:${scanId}`, {
        log: `
${"═".repeat(60)}
🛡️ TRIVY SBOM & VULNERABILITY SCAN
${"═".repeat(60)}

`,
        progress: 52
      });
      event.sender.send(`scan-log:${scanId}`, {
        log: `🔍 Analyzing dependencies and security vulnerabilities...
📦 Building Software Bill of Materials (SBOM)...

`,
        progress: 55
      });
      const child = spawn(
        trivyPath,
        ["fs", "--security-checks", "vuln,config", "--format", "json", repoPath],
        {
          detached: true,
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true
        }
      );
      child.unref();
      activeProcesses.set(scanId, child);
      let jsonBuffer = "";
      let cancelled = false;
      (_a = child.stdout) == null ? void 0 : _a.on("data", (chunk) => {
        if (cancelled) return;
        jsonBuffer += chunk.toString();
        event.sender.send(`scan-log:${scanId}`, {
          log: "🔍 Analyzing dependencies and vulnerabilities...\n",
          progress: 70
        });
      });
      (_b = child.stderr) == null ? void 0 : _b.on("data", (data) => {
        if (cancelled) return;
        event.sender.send(`scan-log:${scanId}`, {
          log: data.toString(),
          progress: 85
        });
      });
      child.on("close", (code) => {
        var _a2;
        activeProcesses.delete(scanId);
        if (cancelled) {
          resolve({ success: false, cancelled: true });
          return;
        }
        if (code === 0) {
          try {
            const results = JSON.parse(jsonBuffer);
            const vulns = ((_a2 = results.Results) == null ? void 0 : _a2.reduce(
              (acc, r) => {
                var _a3;
                return acc + (((_a3 = r.Vulnerabilities) == null ? void 0 : _a3.length) || 0);
              },
              0
            )) || 0;
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
              progress: 100
            });
            event.sender.send(`scan-complete:${scanId}`, {
              success: true,
              vulnerabilities: vulns
            });
            resolve({ success: true, vulnerabilities: vulns });
          } catch (err) {
            event.sender.send(`scan-complete:${scanId}`, {
              success: false,
              error: "Failed to parse Trivy results"
            });
            resolve({ success: false, error: "Failed to parse Trivy results" });
          }
        } else {
          event.sender.send(`scan-complete:${scanId}`, {
            success: false,
            error: `Trivy exited with code ${code}`
          });
          resolve({ success: false, error: `Trivy exited with code ${code}` });
        }
      });
      child.on("error", (err) => {
        activeProcesses.delete(scanId);
        event.sender.send(`scan-complete:${scanId}`, {
          success: false,
          error: err.message
        });
        resolve({ success: false, error: err.message });
      });
      ipcMain.once(`scan:cancel-${scanId}`, () => {
        cancelled = true;
        debugLog(`Cancelling Trivy scan: ${scanId}`);
        killProcess(child, scanId);
        activeProcesses.delete(scanId);
        resolve({ success: false, cancelled: true });
      });
    });
  });
  ipcMain.handle("scan:opengrep", async (event, { repoUrl, branch, scanId, componentConfigs }) => {
    debugLog(`[OPENGREP] Starting multi-language SAST analysis for ${repoUrl}`);
    const opengrepPath = validateTool("opengrep");
    if (!opengrepPath) {
      event.sender.send(`scan-log:${scanId}`, {
        log: `
❌ OpenGrep tool not found
   Expected: ${toolPath("opengrep")}

`,
        progress: 0
      });
      event.sender.send(`scan-complete:${scanId}`, {
        success: false,
        error: "Tool not found"
      });
      return { success: false, error: "Tool not found" };
    }
    const repoPath = await cloneRepository(event, repoUrl, branch, scanId);
    if (!repoPath) {
      event.sender.send(`scan-complete:${scanId}`, {
        success: false,
        error: "Clone failed"
      });
      return { success: false, error: "Clone failed" };
    }
    return new Promise((resolve) => {
      var _a, _b;
      event.sender.send(`scan-log:${scanId}`, {
        log: `
${"═".repeat(79)}
🔬 STATIC APPLICATION SECURITY TESTING (SAST) - OpenGrep
${"═".repeat(79)}

`,
        progress: 52
      });
      event.sender.send(`scan-log:${scanId}`, {
        log: `📦 Repository: ${repoUrl}
🌿 Branch: ${branch}


`,
        progress: 54
      });
      const reportPath = path.join(repoPath, "opengrep-report.json");
      const args = [
        "scan",
        "--config",
        "auto",
        "--json",
        "--output",
        reportPath,
        "--no-git-ignore",
        repoPath
      ];
      event.sender.send(`scan-log:${scanId}`, {
        log: `$ opengrep scan --config auto --json

`,
        progress: 55
      });
      event.sender.send(`scan-log:${scanId}`, {
        log: `🔍 Scanning entire repository recursively (all folders)...
`,
        progress: 60
      });
      event.sender.send(`scan-log:${scanId}`, {
        log: `⏳ This may take 1-3 minutes...

`,
        progress: 62
      });
      const spawnOptions = {
        cwd: repoPath,
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          NO_COLOR: "1"
        },
        windowsHide: true,
        shell: false,
        detached: false
      };
      const child = spawn(opengrepPath, args, spawnOptions);
      const scanProcessId = `${scanId}-opengrep`;
      activeProcesses.set(scanProcessId, child);
      let cancelled = false;
      let progressCounter = 0;
      let stdoutData = "";
      let stderrData = "";
      (_a = child.stdout) == null ? void 0 : _a.on("data", (data) => {
        if (cancelled) return;
        progressCounter++;
        stdoutData += data.toString();
        event.sender.send(`scan-log:${scanId}`, {
          log: "",
          progress: Math.min(65 + Math.floor(progressCounter / 5), 85)
        });
      });
      (_b = child.stderr) == null ? void 0 : _b.on("data", (data) => {
        if (cancelled) return;
        stderrData += data.toString();
      });
      child.on("close", async (code) => {
        var _a2, _b2;
        activeProcesses.delete(scanProcessId);
        if (cancelled) {
          resolve({ success: false, cancelled: true });
          return;
        }
        debugLog(`[OPENGREP] Process exited with code: ${code}`);
        let totalIssues = 0;
        let passedChecks = 0;
        let failedChecks = 0;
        let findings = [];
        let criticalCount = 0;
        let highCount = 0;
        let mediumCount = 0;
        let lowCount = 0;
        if (fsSync.existsSync(reportPath)) {
          try {
            let getRelativePath = function(absolutePath) {
              const normalized = absolutePath.replace(/\\/g, "/");
              if (normalized.startsWith(repoPathNormalized)) {
                return normalized.substring(repoPathNormalized.length + 1);
              }
              return normalized;
            };
            const reportContent = await fs.readFile(reportPath, "utf-8");
            const report = JSON.parse(reportContent);
            findings = report.results || [];
            totalIssues = findings.length;
            const scannedFiles = ((_a2 = report.paths) == null ? void 0 : _a2.scanned) || [];
            const skippedFiles = ((_b2 = report.paths) == null ? void 0 : _b2.skipped) || [];
            const repoPathNormalized = repoPath.replace(/\\/g, "/");
            const ignoredDirs = /* @__PURE__ */ new Set([
              ".git",
              ".idea",
              ".vscode",
              ".github",
              "node_modules",
              "dist",
              "build",
              "target",
              "out",
              "bin",
              "__pycache__",
              ".gradle",
              "coverage",
              ".next",
              ".nuxt",
              ".venv",
              "venv"
            ]);
            const projectDirectories = /* @__PURE__ */ new Set();
            const filesByDirectory = /* @__PURE__ */ new Map();
            const filesByLanguage = /* @__PURE__ */ new Map();
            let rootLevelFiles = 0;
            try {
              const repoContents = await fs.readdir(repoPath, { withFileTypes: true });
              repoContents.forEach((item) => {
                if (item.isDirectory() && !ignoredDirs.has(item.name)) {
                  projectDirectories.add(item.name);
                  filesByDirectory.set(item.name, 0);
                }
              });
              debugLog(`[OPENGREP] Found ${projectDirectories.size} project directories: ${Array.from(projectDirectories).join(", ")}`);
            } catch (err) {
              debugLog(`Error reading repo directory: ${err.message}`);
            }
            scannedFiles.forEach((absolutePath) => {
              var _a3;
              const relativePath = getRelativePath(absolutePath);
              const normalizedPath = relativePath.replace(/\\/g, "/");
              const parts = normalizedPath.split("/").filter((p) => p && p !== ".");
              if (parts.length === 0) return;
              if (parts.length === 1) {
                rootLevelFiles++;
              } else {
                const topDir = parts[0];
                if (projectDirectories.has(topDir)) {
                  filesByDirectory.set(topDir, (filesByDirectory.get(topDir) || 0) + 1);
                }
              }
              const fileName = absolutePath.split(/[/\\]/).pop() || "";
              const ext = ((_a3 = fileName.split(".").pop()) == null ? void 0 : _a3.toLowerCase()) || "";
              const langMap = {
                // Programming languages
                "java": "Java",
                "js": "JavaScript",
                "jsx": "JavaScript",
                "ts": "TypeScript",
                "tsx": "TypeScript",
                "py": "Python",
                "cs": "C#",
                "go": "Go",
                "rb": "Ruby",
                "php": "PHP",
                "kt": "Kotlin",
                "swift": "Swift",
                "rs": "Rust",
                "c": "C",
                "cpp": "C++",
                "cc": "C++",
                "cxx": "C++",
                "h": "C/C++",
                "hpp": "C/C++",
                // Web languages
                "html": "HTML",
                "htm": "HTML",
                "css": "CSS",
                "scss": "SCSS",
                "sass": "SASS",
                "less": "LESS",
                // Data/Config formats
                "json": "JSON",
                "xml": "XML",
                "yaml": "YAML",
                "yml": "YAML",
                "properties": "Properties",
                "gradle": "Gradle",
                "sql": "SQL",
                // Documentation
                "md": "Markdown",
                "markdown": "Markdown",
                "txt": "Text",
                // Scripts
                "sh": "Shell",
                "bash": "Shell",
                "bat": "Batch",
                "cmd": "Batch",
                // Media
                "svg": "SVG",
                "png": "Image",
                "jpg": "Image",
                "jpeg": "Image",
                "gif": "Image",
                "ico": "Icon",
                "webp": "Image"
              };
              const configFilePatterns = [
                "gitignore",
                "dockerignore",
                "npmignore",
                "editorconfig",
                "prettierrc",
                "eslintrc",
                "babelrc",
                "npmrc",
                "yarnrc",
                "dockerfile",
                "makefile",
                "rakefile",
                "gemfile",
                "podfile",
                "cartfile"
              ];
              let language = "";
              if (configFilePatterns.some((pattern) => fileName.toLowerCase().includes(pattern))) {
                language = "Config";
              } else if (["config", "ini", "conf"].includes(ext)) {
                language = "Config";
              } else if (langMap[ext]) {
                language = langMap[ext];
              } else {
                language = "Other";
              }
              filesByLanguage.set(language, (filesByLanguage.get(language) || 0) + 1);
            });
            const findingsByDirectory = /* @__PURE__ */ new Map();
            const findingsByLanguage = /* @__PURE__ */ new Map();
            findings.forEach((f) => {
              var _a3, _b3, _c;
              const severity = (((_a3 = f.extra) == null ? void 0 : _a3.severity) || "WARNING").toUpperCase();
              if (severity === "ERROR" || severity === "CRITICAL") criticalCount++;
              else if (severity === "WARNING" || severity === "HIGH") highCount++;
              else if (severity === "MEDIUM") mediumCount++;
              else lowCount++;
              const absolutePath = f.path || "";
              const relativePath = getRelativePath(absolutePath);
              const normalizedPath = relativePath.replace(/\\/g, "/");
              const parts = normalizedPath.split("/").filter((p) => p && p !== ".");
              if (parts.length > 1) {
                const topDir = parts[0];
                if (projectDirectories.has(topDir)) {
                  if (!findingsByDirectory.has(topDir)) {
                    findingsByDirectory.set(topDir, []);
                  }
                  findingsByDirectory.get(topDir).push(f);
                }
              }
              const language = ((_c = (_b3 = f.extra) == null ? void 0 : _b3.metadata) == null ? void 0 : _c.language) || "Unknown";
              findingsByLanguage.set(language, (findingsByLanguage.get(language) || 0) + 1);
            });
            passedChecks = Math.max(0, scannedFiles.length - totalIssues);
            failedChecks = totalIssues;
            event.sender.send(`scan-log:${scanId}`, {
              log: `
✅ Scan completed successfully!

`,
              progress: 88
            });
            const projectsWithFiles = Array.from(filesByDirectory.entries()).filter(([dir, count]) => count > 0 && projectDirectories.has(dir)).sort((a, b) => b[1] - a[1]);
            if (projectsWithFiles.length > 0) {
              event.sender.send(`scan-log:${scanId}`, {
                log: `
📦 DETECTED PROJECTS:
${"═".repeat(79)}

`,
                progress: 88
              });
              projectsWithFiles.forEach(([dir, count]) => {
                const issues = findingsByDirectory.get(dir) || [];
                const statusIcon = issues.length === 0 ? "✅" : issues.length <= 5 ? "🟡" : "🔴";
                event.sender.send(`scan-log:${scanId}`, {
                  log: `   ${statusIcon} ${dir}/ — ${count} files scanned${issues.length > 0 ? ` — ${issues.length} issue(s) found` : " — Clean ✓"}
`,
                  progress: 88
                });
              });
              if (rootLevelFiles > 0) {
                event.sender.send(`scan-log:${scanId}`, {
                  log: `   📄 [root]/ — ${rootLevelFiles} config/metadata files
`,
                  progress: 88
                });
              }
            }
            event.sender.send(`scan-log:${scanId}`, {
              log: `

📊 SCAN STATISTICS:
${"═".repeat(79)}

`,
              progress: 89
            });
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
              progress: 89
            });
            if (filesByLanguage.size > 0) {
              event.sender.send(`scan-log:${scanId}`, {
                log: `
🔤 LANGUAGE BREAKDOWN:
${"─".repeat(79)}

`,
                progress: 90
              });
              const sortedLangs = Array.from(filesByLanguage.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
              sortedLangs.forEach(([lang, count]) => {
                const issues = findingsByLanguage.get(lang) || 0;
                const percentage = Math.round(count / totalFilesScanned * 100);
                const barLength = Math.min(Math.floor(percentage / 2.5), 40);
                const bar = "█".repeat(barLength) + "░".repeat(Math.max(0, 40 - barLength));
                event.sender.send(`scan-log:${scanId}`, {
                  log: `  ${lang.padEnd(15)} │${bar}│ ${count.toString().padStart(4)} files (${percentage.toString().padStart(2)}%)${issues > 0 ? ` — ${issues} issue(s)` : ""}
`,
                  progress: 90
                });
              });
              if (filesByLanguage.size > 10) {
                event.sender.send(`scan-log:${scanId}`, {
                  log: `  ... and ${filesByLanguage.size - 10} more languages
`,
                  progress: 90
                });
              }
            }
            if (projectsWithFiles.length > 0) {
              event.sender.send(`scan-log:${scanId}`, {
                log: `

📂 FILES BY PROJECT:
${"─".repeat(79)}

`,
                progress: 90
              });
              projectsWithFiles.forEach(([dir, count]) => {
                const issues = findingsByDirectory.get(dir) || [];
                const statusIcon = issues.length === 0 ? "✅" : issues.length <= 5 ? "🟡" : "🔴";
                const percentage = totalProjectFiles > 0 ? Math.round(count / totalProjectFiles * 100) : 0;
                event.sender.send(`scan-log:${scanId}`, {
                  log: `  ${statusIcon} ${dir.padEnd(40)} ${count.toString().padStart(4)} files (${percentage.toString().padStart(2)}%)${issues.length > 0 ? ` — ${issues.length} issue(s)` : ""}
`,
                  progress: 90
                });
              });
              if (rootLevelFiles > 0) {
                const rootPercentage = Math.round(rootLevelFiles / totalFilesScanned * 100);
                event.sender.send(`scan-log:${scanId}`, {
                  log: `  📝 [root] (config/metadata)              ${rootLevelFiles.toString().padStart(4)} files (${rootPercentage.toString().padStart(2)}%)
`,
                  progress: 90
                });
              }
            }
            if (totalIssues > 0) {
              event.sender.send(`scan-log:${scanId}`, {
                log: `

🚨 SECURITY FINDINGS:
${"═".repeat(79)}

`,
                progress: 91
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
                progress: 91
              });
              const sortedFindings = Array.from(findingsByDirectory.entries()).filter(([dir, issues]) => issues.length > 0).sort((a, b) => b[1].length - a[1].length);
              if (sortedFindings.length > 0) {
                event.sender.send(`scan-log:${scanId}`, {
                  log: `
📂 ISSUES BY PROJECT:
${"─".repeat(79)}

`,
                  progress: 91
                });
                sortedFindings.forEach(([dir, dirFindings]) => {
                  const critical = dirFindings.filter((f) => {
                    var _a3;
                    const sev = (((_a3 = f.extra) == null ? void 0 : _a3.severity) || "WARNING").toUpperCase();
                    return sev === "ERROR" || sev === "CRITICAL";
                  }).length;
                  const high = dirFindings.filter((f) => {
                    var _a3;
                    const sev = (((_a3 = f.extra) == null ? void 0 : _a3.severity) || "WARNING").toUpperCase();
                    return sev === "WARNING" || sev === "HIGH";
                  }).length;
                  event.sender.send(`scan-log:${scanId}`, {
                    log: `  📂 ${dir}/ — ${dirFindings.length} total | 🔴 ${critical} critical | 🟠 ${high} high
`,
                    progress: 91
                  });
                });
              }
              event.sender.send(`scan-log:${scanId}`, {
                log: `

🔍 TOP ${Math.min(10, totalIssues)} CRITICAL FINDINGS:
${"═".repeat(79)}

`,
                progress: 92
              });
              const allSortedFindings = findings.sort((a, b) => {
                var _a3, _b3;
                const severityOrder = {
                  ERROR: 4,
                  CRITICAL: 4,
                  WARNING: 3,
                  HIGH: 3,
                  MEDIUM: 2,
                  INFO: 1,
                  LOW: 1
                };
                const sevA = (((_a3 = a.extra) == null ? void 0 : _a3.severity) || "WARNING").toUpperCase();
                const sevB = (((_b3 = b.extra) == null ? void 0 : _b3.severity) || "WARNING").toUpperCase();
                return (severityOrder[sevB] || 0) - (severityOrder[sevA] || 0);
              });
              const topFindings = allSortedFindings.slice(0, 10);
              topFindings.forEach((finding, index) => {
                var _a3, _b3, _c;
                const severity = (((_a3 = finding.extra) == null ? void 0 : _a3.severity) || "WARNING").toUpperCase();
                const severityIcon = severity === "ERROR" || severity === "CRITICAL" ? "🔴 CRITICAL" : severity === "WARNING" || severity === "HIGH" ? "🟠 HIGH    " : severity === "MEDIUM" ? "🟡 MEDIUM  " : "🔵 LOW     ";
                const absolutePath = finding.path || "N/A";
                const relativePath = getRelativePath(absolutePath);
                const shortPath = relativePath.length > 60 ? "..." + relativePath.slice(-57) : relativePath;
                const findingLog = `
${index + 1}. ${severityIcon} │ ${finding.check_id || "Unknown Rule"}
   File: ${shortPath}
   Line: ${((_b3 = finding.start) == null ? void 0 : _b3.line) || "?"}
   ${((_c = finding.extra) == null ? void 0 : _c.message) || finding.message || "No description"}
${"─".repeat(79)}
`;
                event.sender.send(`scan-log:${scanId}`, {
                  log: findingLog,
                  progress: 92 + Math.floor((index + 1) / topFindings.length * 3)
                });
              });
              if (totalIssues > 10) {
                event.sender.send(`scan-log:${scanId}`, {
                  log: `
   ... and ${totalIssues - 10} more findings (check opengrep-report.json for details)
`,
                  progress: 95
                });
              }
            } else {
              event.sender.send(`scan-log:${scanId}`, {
                log: `

✅ NO SECURITY ISSUES DETECTED!
${"═".repeat(79)}

`,
                progress: 95
              });
              event.sender.send(`scan-log:${scanId}`, {
                log: `🎉 All ${totalFilesScanned} files across ${projectsWithFiles.length} project(s) passed security analysis.
`,
                progress: 95
              });
              event.sender.send(`scan-log:${scanId}`, {
                log: `🛡️  No vulnerabilities found. Repository is secure!
`,
                progress: 95
              });
            }
            const projectsList = projectsWithFiles.length > 0 ? projectsWithFiles.map(([dir]) => dir).slice(0, 3).join(", ") + (projectsWithFiles.length > 3 ? `, +${projectsWithFiles.length - 3} more` : "") : "No projects detected";
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
${totalIssues === 0 ? `  ✅ SECURE — All ${projectsWithFiles.length} project(s) passed security checks
  ✅ No vulnerabilities detected
  ✅ Safe to deploy to production` : criticalCount > 0 ? `  🚨 CRITICAL RISK — ${criticalCount} critical vulnerabilities detected
  ⛔ DO NOT DEPLOY until all critical issues are fixed
  🔧 Immediate remediation required` : highCount > 0 ? `  🟠 HIGH RISK — ${highCount} high severity issues found
  ⚠️  Review and fix before deployment
  🔧 Remediation recommended` : totalIssues <= 5 ? `  🟡 LOW RISK — ${totalIssues} minor issues detected
  ℹ️  Review findings before release
  🔧 Non-critical remediation` : `  🟡 MEDIUM RISK — ${totalIssues} security issues found
  ⚠️  Security review required before production
  🔧 Address issues before deployment`}

📝 RECOMMENDATION
${"─".repeat(79)}
${totalIssues === 0 ? `  All security checks passed across ${projectsWithFiles.length} project(s). Production-ready.` : criticalCount > 0 ? `  Fix ${criticalCount} critical vulnerability(ies) immediately. DO NOT RELEASE.` : totalIssues <= 5 ? `  Review and fix ${totalIssues} minor issue(s). Low priority.` : `  Address ${totalIssues} security issue(s) before production deployment.`}

${"═".repeat(79)}
`;
            event.sender.send(`scan-log:${scanId}`, {
              log: summary_text,
              progress: 100
            });
          } catch (err) {
            debugLog(`Error parsing OpenGrep report: ${err.message}`);
            event.sender.send(`scan-log:${scanId}`, {
              log: `
❌ Error parsing report: ${err.message}
`,
              progress: 100
            });
          }
        } else {
          debugLog(`[OPENGREP] Report file not found at: ${reportPath}`);
          event.sender.send(`scan-log:${scanId}`, {
            log: `
⚠️ No report file generated
`,
            progress: 100
          });
          if (stderrData.trim()) {
            event.sender.send(`scan-log:${scanId}`, {
              log: `
❌ Error details:
${stderrData}
`,
              progress: 100
            });
          }
        }
        const success = code === 0 || code === 1;
        event.sender.send(`scan-complete:${scanId}`, {
          success,
          totalIssues,
          passedChecks,
          failedChecks,
          error: success ? void 0 : `Scan exited with code ${code}`
        });
        resolve({ success, totalIssues, passedChecks, failedChecks });
      });
      child.on("error", (err) => {
        activeProcesses.delete(scanProcessId);
        event.sender.send(`scan-log:${scanId}`, {
          log: `
❌ OpenGrep process error: ${err.message}
`,
          progress: 0
        });
        event.sender.send(`scan-complete:${scanId}`, {
          success: false,
          error: err.message
        });
        resolve({ success: false, error: err.message });
      });
      ipcMain.once(`scan:cancel-${scanId}`, () => {
        cancelled = true;
        debugLog(`Cancelling OpenGrep scan: ${scanId}`);
        event.sender.send(`scan-log:${scanId}`, {
          log: `
⚠️ Scan cancelled by user
`,
          progress: 0
        });
        killProcess(child, scanProcessId);
        activeProcesses.delete(scanProcessId);
        resolve({ success: false, cancelled: true });
      });
    });
  });
  ipcMain.handle("scan:cancel", async (event, { scanId }) => {
    debugLog(`Cancel requested: ${scanId}`);
    return new Promise((resolve) => {
      let cleaned = false;
      const child = activeProcesses.get(scanId);
      if (child) {
        debugLog(`Killing main process: ${scanId}`);
        killProcess(child, scanId);
        activeProcesses.delete(scanId);
        cleaned = true;
      }
      const cloneId = `${scanId}-clone`;
      const cloneChild = activeProcesses.get(cloneId);
      if (cloneChild) {
        debugLog(`Killing clone process: ${cloneId}`);
        killProcess(cloneChild, cloneId);
        activeProcesses.delete(cloneId);
        cleaned = true;
      }
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
  ipcMain.handle("window:minimize", () => win == null ? void 0 : win.minimize());
  ipcMain.handle(
    "window:maximize",
    () => (win == null ? void 0 : win.isMaximized()) ? win.unmaximize() : win == null ? void 0 : win.maximize()
  );
  ipcMain.handle("window:close", () => win == null ? void 0 : win.close());
}
function cancelAllScans() {
  debugLog(`Cancelling all scans (${activeProcesses.size} processes)`);
  activeProcesses.forEach((child, id) => {
    killProcess(child, id);
  });
  activeProcesses.clear();
}
function createWindow() {
  splash = new BrowserWindow({
    width: 420,
    height: 280,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    show: true,
    backgroundColor: "#00000000"
  });
  splash.loadFile(path.join(process.env.VITE_PUBLIC, "splash.html"));
  win = new BrowserWindow({
    width: 1280,
    height: 840,
    show: false,
    frame: false,
    titleBarStyle: "hidden",
    backgroundColor: "#060712",
    icon: path.join(process.env.VITE_PUBLIC, "icon.png"),
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs")
    }
  });
  registerIPC();
  if (VITE_DEV_SERVER_URL) win.loadURL(VITE_DEV_SERVER_URL);
  else win.loadFile(path.join(RENDERER_DIST, "index.html"));
  win.once("ready-to-show", () => {
    splash == null ? void 0 : splash.close();
    splash = null;
    win == null ? void 0 : win.show();
    if (VITE_DEV_SERVER_URL) {
      win == null ? void 0 : win.webContents.openDevTools({ mode: "detach" });
    }
  });
  win.webContents.on("before-input-event", (event, input) => {
    if (input.type === "keyDown") {
      if (input.key === "F12" || input.control && input.shift && input.key === "I") {
        if (win == null ? void 0 : win.webContents.isDevToolsOpened()) {
          win == null ? void 0 : win.webContents.closeDevTools();
        } else {
          win == null ? void 0 : win.webContents.openDevTools({ mode: "detach" });
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
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
