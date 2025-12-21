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
  ipcMain.handle("scan:codeql", async (event, { repoUrl, branch, scanId, languages = "javascript-typescript" }) => {
    debugLog(`[CODEQL] Starting SAST analysis for ${repoUrl} with languages: ${languages}`);
    const codeqlPath = validateTool("codeql");
    if (!codeqlPath) {
      event.sender.send(`scan-log:${scanId}`, {
        log: `
❌ CodeQL tool not found
   Expected: ${toolPath("codeql")}
   Download from: https://github.com/github/codeql-cli-binaries/releases

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
    const dbPath = path.join(repoPath, "codeql-db");
    const sarifPath = path.join(repoPath, "codeql-results.sarif");
    let cancelled = false;
    return new Promise((resolve) => {
      var _a, _b;
      event.sender.send(`scan-log:${scanId}`, {
        log: `
${"═".repeat(60)}
🔬 CODEQL SAST ANALYSIS
${"═".repeat(60)}

`,
        progress: 52
      });
      event.sender.send(`scan-log:${scanId}`, {
        log: `📊 Step 1/2: Creating CodeQL database...
🔧 Languages: ${languages}

`,
        progress: 55
      });
      const createDb = spawn(
        codeqlPath,
        ["database", "create", dbPath, `--language=${languages}`, "--source-root", repoPath],
        {
          detached: true,
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true
        }
      );
      createDb.unref();
      activeProcesses.set(scanId, createDb);
      (_a = createDb.stdout) == null ? void 0 : _a.on("data", (data) => {
        if (cancelled) return;
        event.sender.send(`scan-log:${scanId}`, {
          log: data.toString(),
          progress: 60
        });
      });
      (_b = createDb.stderr) == null ? void 0 : _b.on("data", (data) => {
        if (cancelled) return;
        event.sender.send(`scan-log:${scanId}`, {
          log: data.toString(),
          progress: 65
        });
      });
      createDb.on("close", (code) => {
        var _a2, _b2;
        activeProcesses.delete(scanId);
        if (cancelled) {
          resolve({ success: false, cancelled: true });
          return;
        }
        if (code !== 0) {
          event.sender.send(`scan-log:${scanId}`, {
            log: `
❌ Database creation failed with exit code ${code}
`,
            progress: 0
          });
          event.sender.send(`scan-complete:${scanId}`, {
            success: false,
            error: `Database creation failed with code ${code}`
          });
          resolve({ success: false, error: `Database creation failed with code ${code}` });
          return;
        }
        event.sender.send(`scan-log:${scanId}`, {
          log: "\n✅ Database created successfully!\n\n🔬 Step 2/2: Running CodeQL analysis...\n🧪 Detecting security patterns and vulnerabilities...\n\n",
          progress: 70
        });
        const analyze = spawn(
          codeqlPath,
          [
            "database",
            "analyze",
            dbPath,
            "--format=sarif-latest",
            "--output",
            sarifPath
          ],
          {
            detached: true,
            stdio: ["ignore", "pipe", "pipe"],
            windowsHide: true
          }
        );
        analyze.unref();
        activeProcesses.set(scanId, analyze);
        (_a2 = analyze.stdout) == null ? void 0 : _a2.on("data", (data) => {
          if (cancelled) return;
          event.sender.send(`scan-log:${scanId}`, {
            log: data.toString(),
            progress: 80
          });
        });
        (_b2 = analyze.stderr) == null ? void 0 : _b2.on("data", (data) => {
          if (cancelled) return;
          event.sender.send(`scan-log:${scanId}`, {
            log: data.toString(),
            progress: 90
          });
        });
        analyze.on("close", async (analyzeCode) => {
          var _a3, _b3, _c;
          activeProcesses.delete(scanId);
          if (cancelled) {
            resolve({ success: false, cancelled: true });
            return;
          }
          let issues = 0;
          if (fsSync.existsSync(sarifPath)) {
            try {
              const sarif = JSON.parse(await fs.readFile(sarifPath, "utf-8"));
              issues = ((_c = (_b3 = (_a3 = sarif.runs) == null ? void 0 : _a3[0]) == null ? void 0 : _b3.results) == null ? void 0 : _c.length) || 0;
            } catch {
            }
          }
          const summary = `

╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║     📊  STATIC APPLICATION SECURITY TESTING (SAST) ANALYSIS SUMMARY  📊      ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝

Analysis Status : ${analyzeCode === 0 ? "✅ COMPLETE" : "❌ FAILED"}
Issues Found    : ${issues}
Languages       : ${languages}
SARIF Report    : ${sarifPath}

${"═".repeat(79)}
`;
          event.sender.send(`scan-log:${scanId}`, {
            log: summary,
            progress: 100
          });
          event.sender.send(`scan-complete:${scanId}`, {
            success: analyzeCode === 0,
            issues
          });
          resolve({ success: analyzeCode === 0, issues });
        });
        analyze.on("error", (err) => {
          activeProcesses.delete(scanId);
          event.sender.send(`scan-complete:${scanId}`, {
            success: false,
            error: err.message
          });
          resolve({ success: false, error: err.message });
        });
      });
      createDb.on("error", (err) => {
        activeProcesses.delete(scanId);
        event.sender.send(`scan-complete:${scanId}`, {
          success: false,
          error: err.message
        });
        resolve({ success: false, error: err.message });
      });
      ipcMain.once(`scan:cancel-${scanId}`, () => {
        cancelled = true;
        debugLog(`Cancelling CodeQL scan: ${scanId}`);
        const activeChild = activeProcesses.get(scanId);
        if (activeChild) {
          killProcess(activeChild, scanId);
          activeProcesses.delete(scanId);
        }
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
