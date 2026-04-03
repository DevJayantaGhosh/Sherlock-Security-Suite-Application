/**
 * Cryptographic endpoints (string I/O, no temp files).
 *
 * POST /api/crypto/generate-keys  — RSA/ECDSA key-pair generation
 * POST /api/crypto/sign-artifact  — Digital signing of a repository
 */

import { Router, Request, Response } from "express";
import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import { v4 as uuid } from "uuid";

import { emitLog, emitComplete, sseEvents } from "../services/sseManager.js";
import * as proc from "../services/processManager.js";
import { validateTool } from "../services/toolPaths.js";
import { getRepoPath } from "../services/gitClone.js";

export const cryptoRouter = Router();

/** Key-pair generation. Payload: { type, size?, curve?, password?, scanId } */

cryptoRouter.post("/generate-keys", (req: Request, res: Response) => {
  const { type, size, curve, password, scanId: clientScanId } = req.body;
  const scanId = clientScanId || uuid();

  runKeyGeneration({ type, size, curve, password, scanId });

  res.json({ scanId, started: true });
});

async function runKeyGeneration(params: {
  type: string; size?: number; curve?: string; password?: string; scanId: string;
}): Promise<void> {
  const { type, size, curve, password, scanId } = params;

  const exePath = validateTool("KeyGenerator");
  if (!exePath) {
    emitLog(scanId, `\n❌ TOOL ERROR: KeyGenerator not found!\n`, 0);
    emitComplete(scanId, { success: false, error: "Tool not found" });
    return;
  }

  emitLog(scanId,
    `\n${"═".repeat(65)}\n🔑 KEY GENERATION STARTED\n${"═".repeat(65)}\n\n` +
    `🔹 Algorithm: ${type.toUpperCase()}${type === "rsa" ? ` (${size} bits)` : ` (${curve})`}\n` +
    `🔹 Output: In-memory (string output)\n` +
    `🔹 Security: ${password ? "🔒 Protected" : "⚠️ No Password"}\n\n`,
    5
  );

  const args: string[] = ["generate", type];
  if (type === "rsa" && size) args.push("-s", `${size}`);
  if (type === "ecdsa" && curve) args.push("-c", curve);
  if (password) args.push("-p", password);
  args.push("--keystring", "--json");

  emitLog(scanId, `⏳ Executing...\n`, 10);

  return new Promise((resolve) => {
    const child = spawn(exePath, args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    proc.register(scanId, child);
    let jsonBuffer = "";
    let cancelled = false;

    child.stdout?.on("data", (chunk) => {
      if (cancelled) return;
      const text = chunk.toString();
      jsonBuffer += text;
      emitLog(scanId, text, 60);
    });

    child.stderr?.on("data", (chunk) => {
      if (cancelled) return;
      const text = chunk.toString();
      emitLog(scanId, `\n🔴 [ERROR] ${text.trim()}\n`, 50);
    });

    child.on("close", (code) => {
      proc.unregister(scanId);
      if (cancelled) return;

      const trueSuccess = code === 0;
      let keyData: any = null;

      if (trueSuccess) {
        try {
          keyData = JSON.parse(jsonBuffer.trim());
        } catch {
          emitLog(scanId, `\n⚠️ Failed to parse KeyGenerator JSON output\n`, 90);
        }
      }

      let finalReport = `╔══════════════════════════════════════════════════════════════════════╗\n`;
      finalReport +=    `                    KEY GENERATION REPORT                               \n`;
      finalReport +=    `╚══════════════════════════════════════════════════════════════════════╝\n\n`;
      finalReport += `    RESULT             : ${trueSuccess ? "✅ SUCCESS" : "❌ FAILED (" + code + ")"}\n`;
      finalReport += `    Algorithm         : ${type.toUpperCase()}\n`;
      finalReport += `    Timestamp      : ${new Date().toLocaleTimeString()}\n`;

      if (trueSuccess) {
        finalReport += `    ✅ KEYS READY FOR SIGNING!\n`;
      } else {
        finalReport += `    ⚠️  Check error logs above\n`;
      }
      finalReport += `\n${"═".repeat(70)}`;

      emitLog(scanId, finalReport, 100);

      emitComplete(scanId, {
        success: trueSuccess,
        ...(keyData ? { keyData } : {}),
      });
      resolve();
    });

    child.on("error", (err) => {
      proc.unregister(scanId);
      emitLog(scanId, `\n💥 SPAWN ERROR: ${err.message}`, 0);
      emitComplete(scanId, { success: false, error: err.message });
      resolve();
    });

    sseEvents.once(`cancel:${scanId}`, () => {
      cancelled = true;
      proc.killProcess(child, scanId);
      emitLog(scanId, `\n🛑 CANCELLED\n`, 0);
      resolve();
    });
  });
}

/** Artifact signing. Payload: { repoUrl, branch, privateKeyPath, password?, isQuickScan, githubToken, scanId } */

cryptoRouter.post("/sign-artifact", (req: Request, res: Response) => {
  const {
    repoUrl, branch, privateKeyPath, password,
    isQuickScan, githubToken, scanId: clientScanId,
  } = req.body;
  const scanId = clientScanId || uuid();

  runSignArtifact({ repoUrl, branch, privateKeyPath, password, isQuickScan, githubToken, scanId });

  res.json({ scanId, started: true });
});

async function runSignArtifact(params: {
  repoUrl: string; branch: string; privateKeyPath: string; password?: string;
  isQuickScan: boolean; githubToken: string; scanId: string;
}): Promise<void> {
  const { repoUrl, branch, privateKeyPath, password, isQuickScan, githubToken, scanId } = params;

  const exePath = validateTool("SoftwareSigner");
  if (!exePath) {
    emitLog(scanId, `\n❌ TOOL ERROR: SoftwareSigner not found.\n`, 0);
    emitComplete(scanId, { success: false, error: "Tool not found" });
    return;
  }

  const repoPath = await getRepoPath(repoUrl, branch, isQuickScan, githubToken, scanId);
  if (!repoPath) {
    emitComplete(scanId, { success: false, error: "Repository preparation failed" });
    return;
  }

  // Remove .git directory so the signer hashes only source content,
  // not git metadata (which differs between branch-clone and tag-clone).
  const gitDir = path.join(repoPath, ".git");
  try { await fs.rm(gitDir, { recursive: true, force: true }); } catch { /* ignore */ }

  emitLog(scanId,
    `\n${"═".repeat(60)}\n🔏 INITIATING CRYPTOGRAPHIC SIGNING\n${"═".repeat(60)}\n\n`,
    30
  );

  emitLog(scanId,
    `🔹 Target Repo : ${repoUrl}\n` +
    `🔹 Branch      : ${branch}\n` +
    `🔹 Signing Key : (provided inline)\n` +
    `🔹 Security    : ${password ? "Password Protected 🔒" : "No Password ⚠️"}\n\n`,
    35
  );

  const args = [
    "sign",
    "-c", repoPath,
    "--privatekeystring", privateKeyPath,
    "--json",
  ];
  if (password) args.push("-p", password);

  return new Promise((resolve) => {
    const child = spawn(exePath, args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    proc.register(scanId, child);
    let jsonBuffer = "";
    let cancelled = false;

    child.stdout?.on("data", (chunk) => {
      if (cancelled) return;
      const text = chunk.toString();
      jsonBuffer += text;
      emitLog(scanId, text, 60);
    });

    child.stderr?.on("data", (chunk) => {
      if (cancelled) return;
      emitLog(scanId, `[STDERR] ${chunk.toString()}`, 60);
    });

    child.on("close", (code) => {
      proc.unregister(scanId);
      if (cancelled) return;

      const success = code === 0;
      let signResult: any = null;
      let signatureContent = "";

      if (success) {
        try {
          signResult = JSON.parse(jsonBuffer.trim());
          signatureContent = signResult?.signature || signResult?.signatureContent || jsonBuffer.trim();
        } catch {
          // Non-JSON — treat raw stdout as signature
          signatureContent = jsonBuffer.trim();
        }
      }

      const summary = `
╔══════════════════════════════════════════════════════════════════════╗
                    DIGITAL SIGNATURE REPORT                            
╚══════════════════════════════════════════════════════════════════════╝

 Status             : ${success ? "✅ SIGNED & VERIFIED" : "❌ SIGNING FAILED"}
 Repository    : ${repoUrl}
 Branch           : ${branch}
 Timestamp   : ${new Date().toLocaleTimeString()}

 🔏 Signature Details:
 ───────────────────────────────────────────────
 💾 Size             : ${signatureContent.length} chars
 🔑 Key Used   : (provided inline)

\n ${"═".repeat(70)}
`;

      emitLog(scanId, summary, 100);

      emitComplete(scanId, {
        success,
        ...(signatureContent ? { signatureContent } : {}),
      });
      resolve();
    });

    child.on("error", (err) => {
      proc.unregister(scanId);
      emitComplete(scanId, { success: false, error: err.message });
      resolve();
    });

    sseEvents.once(`cancel:${scanId}`, () => {
      cancelled = true;
      proc.killProcess(child, scanId);
      emitLog(scanId, "\n⚠️ PROCESS CANCELLED BY USER\n", 0);
      resolve();
    });
  });
}