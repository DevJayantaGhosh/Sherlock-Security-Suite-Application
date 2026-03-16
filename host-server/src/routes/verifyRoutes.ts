/**
 * Signature verification endpoint (string I/O).
 *
 * POST /api/verify/signature — verify a digital signature against a repository
 */

import { Router, Request, Response } from "express";
import { spawn } from "child_process";
import { v4 as uuid } from "uuid";

import { emitLog, emitComplete, sseEvents } from "../services/sseManager.js";
import * as proc from "../services/processManager.js";
import { validateTool } from "../services/toolPaths.js";
import { getRepoPath, cloneRepositoryByTag } from "../services/gitClone.js";

export const verifyRouter = Router();

/** Payload: { repoUrl, branch, version, publicKeyPath, signaturePath, isQuickScan, localRepoLocation, githubToken, scanId } */

verifyRouter.post("/signature", (req: Request, res: Response) => {
  const {
    repoUrl,
    branch,
    version,
    publicKeyPath,
    signaturePath,
    isQuickScan,
    localRepoLocation,
    githubToken,
    scanId: clientScanId,
  } = req.body;
  const scanId = clientScanId || uuid();

  runVerification({
    repoUrl, branch, version, publicKeyPath, signaturePath,
    isQuickScan, localRepoLocation, githubToken, scanId,
  });

  res.json({ scanId, started: true });
});

async function runVerification(params: {
  repoUrl: string;
  branch: string;
  version: string;
  publicKeyPath: string;
  signaturePath: string;
  isQuickScan: boolean;
  localRepoLocation: string;
  githubToken: string;
  scanId: string;
}): Promise<void> {
  const {
    repoUrl, branch, version, publicKeyPath, signaturePath,
    isQuickScan, localRepoLocation, githubToken, scanId,
  } = params;

  const verifierPath = validateTool("SoftwareVerifier");
  if (!verifierPath) {
    emitLog(scanId, `\n❌ TOOL ERROR: SoftwareVerifier not found!\n`, 0);
    emitComplete(scanId, { success: false, verified: false, error: "SoftwareVerifier tool not found" });
    return;
  }

  emitLog(scanId,
    `\n${"═".repeat(70)}\n🔍 DIGITAL SIGNATURE VERIFICATION\n${"═".repeat(70)}\n\n`,
    30
  );

  emitLog(scanId,
    `🔹 Repository  : ${repoUrl || localRepoLocation || "N/A"}\n` +
    `🔹 Release Tag : ${version || "N/A"}\n` +
    `🔹 Branch      : ${branch || "N/A"}\n` +
    `🔹 Public Key  : (provided inline)\n` +
    `🔹 Signature   : (provided inline)\n` +
    `🔹 Content Path: (server-managed)\n\n`,
    40
  );

  let repoPath: string | null = null;

  if (localRepoLocation) {
    repoPath = localRepoLocation;
  } else if (version) {
    repoPath = await cloneRepositoryByTag(repoUrl, version, isQuickScan, githubToken, scanId);
  } else {
    repoPath = await getRepoPath(repoUrl, branch, isQuickScan, githubToken, scanId);
  }

  if (!repoPath) {
    emitComplete(scanId, { success: false, verified: false, error: "Repository preparation failed" });
    return;
  }

  const args: string[] = [
    "verify",
    "-c", repoPath,
    "--publickeystring", publicKeyPath,
    "--signaturestring", signaturePath,
  ];

  emitLog(scanId, `⏳ Running SoftwareVerifier...\n\n`, 55);

  return new Promise((resolve) => {
    const child = spawn(verifierPath, args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    proc.register(scanId, child);
    let cancelled = false;

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (d) => {
      if (cancelled) return;
      stdout += d.toString();
    });

    child.stderr?.on("data", (d) => {
      if (cancelled) return;
      stderr += d.toString();
      emitLog(scanId, d.toString(), 75);
    });

    child.on("close", (code) => {
      proc.unregister(scanId);
      if (cancelled) return;

      let verified = false;
      let verifyResult: any = null;

      if (code === 0) {
        // Try parsing stdout (tool may output text or JSON)
        try {
          verifyResult = JSON.parse(stdout.trim());
          verified = verifyResult.verified === true;
        } catch {
          // Non-JSON output — check for keyword
          verified = stdout.toLowerCase().includes("verified") &&
                     !stdout.toLowerCase().includes("not verified") &&
                     !stdout.toLowerCase().includes("failed");
        }
      }

      const fullOutput = stdout + stderr;

      const summary = `
╔══════════════════════════════════════════════════════════════════════╗
                     🔍 DIGITAL SIGNATURE VERIFICATION REPORT                            
╚══════════════════════════════════════════════════════════════════════╝

Repository     : ${repoUrl || localRepoLocation || "N/A"}
Release Tag    : ${version || "N/A"}
Status            : ${verified ? "✅ SIGNATURE VALID" : "❌ SIGNATURE INVALID"}
Exit Code        : ${code}
Output Size    : ${Buffer.byteLength(fullOutput, "utf8")} bytes

${verified ? "🔓 Signature matches public key and content!" : "🔒 Signature verification failed!"}

${"═".repeat(80)}
`;

      emitLog(scanId, summary, 100);
      emitComplete(scanId, {
        success: code === 0,
        verified,
        ...(verifyResult ? { details: verifyResult } : {}),
      });
      resolve();
    });

    child.on("error", (err) => {
      proc.unregister(scanId);
      emitComplete(scanId, { success: false, verified: false, error: err.message });
      resolve();
    });

    sseEvents.once(`cancel:${scanId}`, () => {
      cancelled = true;
      proc.killProcess(child, scanId);
      emitLog(scanId, "\n⚠️ VERIFICATION CANCELLED BY USER\n", 0);
      resolve();
    });
  });
}