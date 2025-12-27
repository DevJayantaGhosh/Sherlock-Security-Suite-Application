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
   Download: https://github.com/semgrep/semgrep/releases

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
        log: `🔧 Repository: ${repoUrl}
🌿 Branch: ${branch}
📦 Engine: OpenGrep (Open Source SAST Scanner)
🎯 Supports: Java, JavaScript, Python, C#, Go, Ruby, PHP, TypeScript

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
        log: `🔍 Analyzing all projects in repository for security vulnerabilities...
`,
        progress: 60
      });
      event.sender.send(`scan-log:${scanId}`, {
        log: `⏳ Scanning multiple projects may take 1-2 minutes...

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
      let stderrData = "";
      (_a = child.stdout) == null ? void 0 : _a.on("data", (data) => {
        if (cancelled) return;
        progressCounter++;
        const text = data.toString();
        if (text.trim()) {
          event.sender.send(`scan-log:${scanId}`, {
            log: text,
            progress: Math.min(65 + progressCounter, 85)
          });
        }
      });
      (_b = child.stderr) == null ? void 0 : _b.on("data", (data) => {
        if (cancelled) return;
        const text = data.toString();
        stderrData += text;
        event.sender.send(`scan-log:${scanId}`, {
          log: text,
          progress: 80
        });
      });
      child.on("close", async (code) => {
        var _a2, _b2, _c, _d;
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
        const projectFindings = /* @__PURE__ */ new Map();
        if (fsSync.existsSync(reportPath)) {
          try {
            const reportContent = await fs.readFile(reportPath, "utf-8");
            debugLog(`[OPENGREP] Report file size: ${reportContent.length} bytes`);
            const report = JSON.parse(reportContent);
            findings = report.results || [];
            totalIssues = findings.length;
            findings.forEach((f) => {
              var _a3;
              const severity = (((_a3 = f.extra) == null ? void 0 : _a3.severity) || "WARNING").toUpperCase();
              if (severity === "ERROR" || severity === "CRITICAL") criticalCount++;
              else if (severity === "WARNING" || severity === "HIGH") highCount++;
              else if (severity === "MEDIUM") mediumCount++;
              else lowCount++;
              const relativePath = f.path || "";
              const parts = relativePath.split(path.sep);
              const projectDir = parts[0] || "root";
              if (!projectFindings.has(projectDir)) {
                projectFindings.set(projectDir, []);
              }
              projectFindings.get(projectDir).push(f);
            });
            passedChecks = Math.max(0, (((_b2 = (_a2 = report.paths) == null ? void 0 : _a2.scanned) == null ? void 0 : _b2.length) || 0) - totalIssues);
            failedChecks = totalIssues;
            event.sender.send(`scan-log:${scanId}`, {
              log: `
✅ Scan completed successfully!

`,
              progress: 88
            });
            if (projectFindings.size > 1) {
              event.sender.send(`scan-log:${scanId}`, {
                log: `
📊 MULTI-PROJECT BREAKDOWN:
${"═".repeat(79)}

`,
                progress: 89
              });
              let projectIndex = 0;
              for (const [projectDir, projectIssues] of projectFindings.entries()) {
                projectIndex++;
                const projectLog = `
┌─────────────────────────────────────────────────────────────────────────────┐
│ Project ${projectIndex}: ${projectDir.padEnd(65)}│
├─────────────────────────────────────────────────────────────────────────────┤
│ Issues Found: ${projectIssues.length.toString().padEnd(63)}│
│ Critical/High: ${projectIssues.filter((f) => {
                  var _a3;
                  const sev = (((_a3 = f.extra) == null ? void 0 : _a3.severity) || "WARNING").toUpperCase();
                  return sev === "ERROR" || sev === "CRITICAL" || sev === "WARNING" || sev === "HIGH";
                }).length.toString().padEnd(62)}│
└─────────────────────────────────────────────────────────────────────────────┘
`;
                event.sender.send(`scan-log:${scanId}`, {
                  log: projectLog,
                  progress: 89
                });
              }
              event.sender.send(`scan-log:${scanId}`, {
                log: `
`,
                progress: 89
              });
            }
            event.sender.send(`scan-log:${scanId}`, {
              log: `
🔍 TOP SECURITY FINDINGS:
${"═".repeat(79)}

`,
              progress: 90
            });
            if (findings.length > 0) {
              const sortedFindings = findings.sort((a, b) => {
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
              const topFindings = sortedFindings.slice(0, 10);
              topFindings.forEach((finding, index) => {
                var _a3, _b3, _c2, _d2, _e;
                const severity = (((_a3 = finding.extra) == null ? void 0 : _a3.severity) || "WARNING").toUpperCase();
                const severityIcon = severity === "ERROR" || severity === "CRITICAL" ? "🔴" : severity === "WARNING" || severity === "HIGH" ? "🟠" : "🟡";
                const relativePath = finding.path || "N/A";
                const parts = relativePath.split(path.sep);
                const projectDir = parts[0] || "root";
                const findingLog = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${severityIcon} Finding ${index + 1}/${topFindings.length} [Project: ${projectDir}]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Rule ID     : ${finding.check_id || "N/A"}
Severity    : ${severity}
File        : ${relativePath}
Line        : ${((_b3 = finding.start) == null ? void 0 : _b3.line) || "N/A"}
Message     : ${((_c2 = finding.extra) == null ? void 0 : _c2.message) || finding.message || "N/A"}
${((_e = (_d2 = finding.extra) == null ? void 0 : _d2.metadata) == null ? void 0 : _e.source) ? `Source      : ${finding.extra.metadata.source}
` : ""}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
                event.sender.send(`scan-log:${scanId}`, {
                  log: findingLog,
                  progress: 90 + Math.floor((index + 1) / topFindings.length * 5)
                });
              });
              if (findings.length > 10) {
                event.sender.send(`scan-log:${scanId}`, {
                  log: `
... and ${findings.length - 10} more findings across all projects
`,
                  progress: 95
                });
              }
            } else {
              event.sender.send(`scan-log:${scanId}`, {
                log: `✅ No security issues detected in any project!
`,
                progress: 95
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
  📄 Files Scanned  : ${((_d = (_c = report.paths) == null ? void 0 : _c.scanned) == null ? void 0 : _d.length) || 0}
  ❌ Issues Found   : ${failedChecks}
  
Severity Breakdown:
  🔴 Critical/Error : ${criticalCount}
  🟠 High/Warning   : ${highCount}
  🟡 Medium/Info    : ${mediumCount}
  
Total Issues      : ${totalIssues}

Projects Analyzed:
${Array.from(projectFindings.entries()).map(([dir, issues]) => `  • ${dir}: ${issues.length} issue(s)`).join("\n") || "  • No projects with issues"}

Overall Status    : ${code === 0 ? "✅ SCAN COMPLETED" : "⚠️ SCAN COMPLETED WITH WARNINGS"}

Security Verdict  : ${totalIssues === 0 ? "✅ NO SECURITY ISSUES DETECTED - All projects are secure" : criticalCount > 0 ? "🚨 CRITICAL RISK - Urgent security remediation required" : totalIssues <= 5 ? "🟡 LOW RISK - Minor issues require attention" : totalIssues <= 15 ? "🟠 MEDIUM RISK - Security issues should be addressed" : "🔴 HIGH RISK - Immediate security review recommended"}

Recommendation    : ${totalIssues === 0 ? "All projects pass security analysis. Safe to proceed with release." : criticalCount > 0 ? "DO NOT RELEASE - Critical vulnerabilities must be fixed immediately." : totalIssues <= 5 ? "Review and fix minor issues before release." : totalIssues <= 15 ? "Address security issues before deploying to production." : "Mandatory security review required before release."}

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
