/**
 * Security scan endpoints.
 *
 * POST /api/scan/verify-gpg      — GPG commit signature verification
 * POST /api/scan/secrets         — Secrets & credential detection (gitleaks)
 * POST /api/scan/vulnerability   — SBOM & vulnerability scan
 * POST /api/scan/cancel          — Cancel a running scan
 */

import { Router, Request, Response } from "express";
import { spawn } from "child_process";
import fsSync from "fs";
import fs from "fs/promises";
import path from "path";
import { v4 as uuid } from "uuid";

import { emitLog, emitComplete, emitCancel, sseEvents } from "../services/sseManager.js";
import * as proc from "../services/processManager.js";
import { validateTool } from "../services/toolPaths.js";
import { getRepoPath } from "../services/gitClone.js";

export const scanRouter = Router();

/* ================================================================
   GPG Signature Verification
   Payload: { repoUrl, branch, isQuickScan, githubToken, scanId }
================================================================ */

scanRouter.post("/verify-gpg", (req: Request, res: Response) => {
  const { repoUrl, branch, isQuickScan, githubToken } = req.body;
  const scanId = req.body.scanId || uuid();

  runGpgVerification({ repoUrl, branch, isQuickScan, githubToken, scanId });

  res.json({ scanId, started: true });
});

async function runGpgVerification(params: {
  repoUrl: string; branch: string; isQuickScan: boolean; githubToken: string; scanId: string;
}) {
  const { repoUrl, branch, isQuickScan, githubToken, scanId } = params;

  emitLog(scanId, `\n${"═".repeat(60)}\n🛡️ GPG SIGNED COMMITS VERIFICATION\n${"═".repeat(60)}\n\n`, 2);
  emitLog(scanId, `🔹 Repository : ${repoUrl || "N/A"}\n🔹 Branch     : ${branch || "N/A"}\n\n`, 3);
  emitLog(scanId, `⏳ Preparing repository...\n\n`, 4);

  const repoPath = await getRepoPath(repoUrl, branch, isQuickScan, githubToken, scanId);
  if (!repoPath) {
    emitComplete(scanId, { success: false, error: "Repository preparation failed" });
    return;
  }

  emitLog(scanId, `\n${"═".repeat(60)}\n🛡️ GPG SIGNATURE VERIFICATION\n${"═".repeat(60)}\n\n`, 52);
  emitLog(scanId, `🔍 Analyzing ALL commit signatures on branch: ${branch}...\n\n`, 55);

  const child = spawn(
    "git",
    ["log", "--show-signature", "--pretty=format:%H|%an|%aI|%s", branch],
    {
      cwd: repoPath,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  if (process.platform !== "win32") child.unref();
  proc.register(scanId, child);

  let buffer = "";
  let stderrBuf = "";
  let cancelled = false;

  child.stdout?.on("data", (c) => { if (!cancelled) buffer += c.toString(); });
  child.stderr?.on("data", (c) => { if (!cancelled) stderrBuf += c.toString(); });

  child.on("close", (code) => {
    proc.unregister(scanId);
    if (cancelled) return;

    const fullOutput = buffer + "\n" + stderrBuf;
    const lines = fullOutput.split("\n");
    let commitCount = 0;
    let goodSignatures = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.includes("|")) {
        commitCount++;
        const [sha, author, date, subject] = line.split("|");

        // Look backwards from current line to find signature info
        let isGoodSig = false;
        let signatureBlock = "";

        for (let j = Math.max(0, i - 20); j < i; j++) {
          signatureBlock += lines[j] + "\n";
        }

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

        if (signatureBlock.includes("Verified") && !isGoodSig) {
          isGoodSig = true;
          goodSignatures++;
        }

        const log = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 Commit ${commitCount}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SHA     : ${sha?.substring(0, 8) || "N/A"}
Author  : ${author || "N/A"}
Date    : ${date || "N/A"}
Message : ${subject || "N/A"}

GPG     : ${isGoodSig ? "✅ GOOD SIGNATURE" : "❌ MISSING/INVALID"}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
        emitLog(scanId, log, 55 + Math.min((commitCount / Math.max(commitCount, 1)) * 35, 35));
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

    emitLog(scanId, summary, 100);
    emitComplete(scanId, { success: code === 0, totalCommits: commitCount, goodSignatures });
  });

  child.on("error", (err) => {
    proc.unregister(scanId);
    emitComplete(scanId, { success: false, error: err.message });
  });

  sseEvents.once(`cancel:${scanId}`, () => {
    cancelled = true;
    proc.killProcess(child, scanId);
  });
}

/* ================================================================
   Gitleaks — Secrets & Credentials Detection
   Payload: { repoUrl, branch, isQuickScan, githubToken, scanId }
================================================================ */

scanRouter.post("/secrets", (req: Request, res: Response) => {
  const { repoUrl, branch, isQuickScan, githubToken } = req.body;
  const scanId = req.body.scanId || uuid();

  runGitleaksScan({ repoUrl, branch, isQuickScan, githubToken, scanId });

  res.json({ scanId, started: true });
});

async function runGitleaksScan(params: {
  repoUrl: string; branch: string; isQuickScan: boolean; githubToken: string; scanId: string;
}) {
  const { repoUrl, branch, isQuickScan, githubToken, scanId } = params;

  emitLog(scanId, `\n${"═".repeat(60)}\n🔐 SECRETS & CREDENTIALS LEAKAGE SCAN\n${"═".repeat(60)}\n\n`, 2);
  emitLog(scanId, `🔹 Repository : ${repoUrl || "N/A"}\n🔹 Branch     : ${branch || "N/A"}\n\n`, 3);

  const gitleaksPath = validateTool("gitleaks");
  if (!gitleaksPath) {
    emitComplete(scanId, { success: false, error: "gitleaks not found" });
    return;
  }

  emitLog(scanId, `⏳ Preparing repository...\n\n`, 4);

  const repoPath = await getRepoPath(repoUrl, branch, isQuickScan, githubToken, scanId);
  if (!repoPath) {
    emitComplete(scanId, { success: false, error: "Repository preparation failed" });
    return;
  }

  const reportPath = path.join(repoPath, "gitleaks-report.json");

  emitLog(scanId, `\n${"═".repeat(60)}\n🔐 SECRETS & CREDENTIALS DETECTION\n${"═".repeat(60)}\n\n`, 52);
  emitLog(scanId, `🔹 Repository : ${repoUrl || "N/A"}\n🔹 Branch     : ${branch || "N/A"}\n\n`, 53);
  emitLog(scanId, `🔍 Scanning for hardcoded secrets and credentials...\n\n`, 55);

  const spawnOpts: any = {
    cwd: repoPath,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NO_COLOR: "1" },
    windowsHide: true,
  };
  if (process.platform !== "win32") spawnOpts.detached = true;

  const child = spawn(
    gitleaksPath,
    ["detect", "--source", repoPath, "--report-path", reportPath, "--verbose"],
    spawnOpts
  );
  if (process.platform !== "win32") child.unref();
  proc.register(scanId, child);
  let cancelled = false;

  child.stdout?.on("data", (d) => { if (!cancelled) emitLog(scanId, d.toString(), 70); });
  child.stderr?.on("data", (d) => { if (!cancelled) emitLog(scanId, d.toString(), 85); });

  child.on("close", async () => {
    proc.unregister(scanId);
    if (cancelled) return;

    let findings = 0;
    if (fsSync.existsSync(reportPath)) {
      try {
        const report = JSON.parse(await fs.readFile(reportPath, "utf-8"));
        findings = report.length || 0;

        // Format and send detailed findings as logs (matching Electron)
        if (findings > 0) {
          emitLog(scanId, `\n🔍 DETAILED FINDINGS:\n${"═".repeat(79)}\n\n`, 90);

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
            emitLog(scanId, secretLog, 90 + Math.floor((index / findings) * 5));
          });
        }
      } catch { /* ignore */ }
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

    emitLog(scanId, summary, 100);
    emitComplete(scanId, { success: true, findings });
  });

  child.on("error", (err) => {
    proc.unregister(scanId);
    emitComplete(scanId, { success: false, error: err.message });
  });

  sseEvents.once(`cancel:${scanId}`, () => {
    cancelled = true;
    proc.killProcess(child, scanId);
  });
}

/* ================================================================
   Vulnerability Scan — SBOM & Vulnerability Scan
   Payload: { repoUrl, branch, isQuickScan, githubToken, scanId }
================================================================ */

scanRouter.post("/vulnerability", (req: Request, res: Response) => {
  const { repoUrl, branch, isQuickScan, githubToken } = req.body;
  const scanId = req.body.scanId || uuid();

  runVulnerabilityScan({ repoUrl, branch, isQuickScan, githubToken, scanId });

  res.json({ scanId, started: true });
});

/* Helper: Format SBOM (Software Bill of Materials) */
function formatSbomReport(results: any): string {
  if (!results.Results || results.Results.length === 0) return "";

  let report = "\n📦 SOFTWARE BILL OF MATERIALS (SBOM)\n";
  report += "════════════════════════════════════════════════════════════\n";

  let totalPkgs = 0;

  results.Results.forEach((target: any) => {
    const pkgs = target.Packages;
    if (pkgs && pkgs.length > 0) {
      report += `\n📂 Target: ${target.Target}\n`;
      report += `   Type:   ${target.Type || "N/A"}    Packages: ${pkgs.length}\n`;
      report += "   ────────────────────────────────────────────────────────\n";

      pkgs.forEach((pkg: any) => {
        report += `   📦 ${pkg.Name}  v${pkg.Version || "N/A"}`;
        if (pkg.Licenses && pkg.Licenses.length > 0) {
          report += `  [${pkg.Licenses.join(", ")}]`;
        }
        report += "\n";
      });

      totalPkgs += pkgs.length;
    }
  });

  if (totalPkgs === 0) {
    report += "\n   No packages detected.\n";
  } else {
    report += `\n   ── Total Packages: ${totalPkgs} ──\n`;
  }

  return report;
}

/* Helper: Format Vulnerability Scan Results */
function formatVulnReport(results: any): string {
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

async function runVulnerabilityScan(params: {
  repoUrl: string; branch: string; isQuickScan: boolean; githubToken: string; scanId: string;
}) {
  const { repoUrl, branch, isQuickScan, githubToken, scanId } = params;

  emitLog(scanId, `\n${"═".repeat(60)}\n🚨 SBOM & Vulnerability Scan 🚨\n${"═".repeat(60)}\n\n`, 2);
  emitLog(scanId, `🔹 Repository : ${repoUrl || "N/A"}\n🔹 Branch     : ${branch || "N/A"}\n\n`, 3);

  const vulnScanPath = validateTool("trivy");
  if (!vulnScanPath) {
    emitComplete(scanId, { success: false, error: "Vulnerability scanner not found" });
    return;
  }

  emitLog(scanId, `⏳ Preparing repository...\n\n`, 4);

  const repoPath = await getRepoPath(repoUrl, branch, isQuickScan, githubToken, scanId);
  if (!repoPath) {
    emitComplete(scanId, { success: false, error: "Repository preparation failed" });
    return;
  }

  emitLog(scanId, `\n${"═".repeat(60)}\n🚨 SBOM & Vulnerability Scan 🚨\n${"═".repeat(60)}\n\n`, 52);
  emitLog(scanId, `🔍 Analyzing dependencies and security vulnerabilities...\n📦 Building Software Bill of Materials (SBOM)...\n\n`, 55);

  const child = spawn(
    vulnScanPath,
    ["fs", "--scanners", "vuln,secret,misconfig", "--list-all-pkgs", "--skip-version-check", "--format", "json", repoPath],
    {
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    }
  );
  if (process.platform !== "win32") child.unref();
  proc.register(scanId, child);

  let jsonBuffer = "";
  let cancelled = false;

  child.stdout?.on("data", (c) => {
    if (cancelled) return;
    jsonBuffer += c.toString();
    emitLog(scanId, "🔍 Analyzing dependencies and vulnerabilities...\n", 70);
  });

  child.stderr?.on("data", (d) => {
    if (cancelled) return;
    const msg = d.toString();
    // Filter out noisy warnings (matching Electron)
    if (!msg.includes("Update") && !msg.includes("deprecated")) {
      emitLog(scanId, msg, 85);
    }
  });

  child.on("close", (code) => {
    proc.unregister(scanId);
    if (cancelled) return;

    if (code === 0) {
      try {
        const results = JSON.parse(jsonBuffer);
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

        // SBOM report
        const sbomReport = formatSbomReport(results);
        emitLog(scanId, sbomReport, 90);

        // detailed vulnerability report
        const detailedReport = formatVulnReport(results);
        emitLog(scanId, detailedReport, 95);

        const summary = `

╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║                 🚨  SBOM & VULNERABILITY SCAN SUMMARY  🚨                    ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝

Vulnerabilities : ${vulns}
Critical        : ${critical}
High            : ${high}
Medium          : ${medium}
Low             : ${low}
Status          : ${vulns > 0 ? "🚨 VULNERABILITIES DETECTED" : "✅ NO VULNERABILITIES"}
Risk Level      : ${critical > 0 ? "CRITICAL" : high > 0 ? "HIGH" : medium > 0 ? "MEDIUM" : low > 0 ? "LOW" : "NONE"}

${"═".repeat(79)}
`;

        emitLog(scanId, summary, 100);
        emitComplete(scanId, { success: true, vulnerabilities: vulns, critical, high, medium, low });
      } catch {
        emitComplete(scanId, { success: false, error: "Failed to parse vulnerability scan results" });
      }
    } else {
      emitComplete(scanId, { success: false, error: `Vulnerability scanner exited with code ${code}` });
    }
  });

  child.on("error", (err) => {
    proc.unregister(scanId);
    emitComplete(scanId, { success: false, error: err.message });
  });

  sseEvents.once(`cancel:${scanId}`, () => {
    cancelled = true;
    proc.killProcess(child, scanId);
  });
}

/* ================================================================
   Cancel
================================================================ */

scanRouter.post("/cancel", (req: Request, res: Response) => {
  const { scanId } = req.body;
  if (!scanId) {
    res.status(400).json({ cancelled: false, error: "scanId is required" });
    return;
  }
  emitCancel(scanId);
  const cancelled = proc.cancel(scanId);
  res.json({ cancelled });
});