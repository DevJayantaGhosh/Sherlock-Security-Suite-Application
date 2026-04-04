/**
 * Cryptographic endpoints (string I/O, no temp files).
 *
 * POST /api/crypto/generate-keys  — RSA/ECDSA key-pair generation
 * POST /api/crypto/sign-artifact  — Digital signing of a repository
 */

import { Router, Request, Response } from "express";
import { spawn } from "child_process";
import { v4 as uuid } from "uuid";

import { emitLog, emitComplete, sseEvents } from "../services/sseManager.js";
import * as proc from "../services/processManager.js";
import { validateTool } from "../services/toolPaths.js";
import { getRepoPath, cloneRepositoryByTag } from "../services/gitClone.js";

/** log heading separator constant  */
const SEPARATOR_WIDTH = 80;


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
    `\n${"═".repeat(SEPARATOR_WIDTH)}\n🔑 KEY GENERATION STARTED\n${"═".repeat(SEPARATOR_WIDTH)}\n\n` +
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

      const finalReport = `
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║                    🔑  KEY GENERATION REPORT  🔑                             ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝

RESULT             : ${trueSuccess ? "✅ SUCCESS" : "❌ FAILED (" + code + ")"}
Algorithm          : ${type.toUpperCase()}
Timestamp          : ${new Date().toLocaleTimeString()}
${trueSuccess ? "✅ KEYS READY FOR SIGNING!" : "⚠️  Check error logs above"}

${"═".repeat(SEPARATOR_WIDTH)}
`;

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

/** Artifact signing. Payload: { repoUrl, branch, version, privateKeyPath, password?, isQuickScan, githubToken, localRepoLocation, scanId } */

cryptoRouter.post("/sign-artifact", (req: Request, res: Response) => {
  const {
    repoUrl, branch, version, privateKeyPath, password,
    isQuickScan, githubToken, localRepoLocation, scanId: clientScanId,
  } = req.body;
  const scanId = clientScanId || uuid();

  runSignArtifact({ repoUrl, branch, version, privateKeyPath, password, isQuickScan, githubToken, localRepoLocation, scanId });

  res.json({ scanId, started: true });
});

async function runSignArtifact(params: {
  repoUrl: string; branch: string; version: string; privateKeyPath: string; password?: string;
  isQuickScan: boolean; githubToken: string; localRepoLocation?: string; scanId: string;
}): Promise<void> {
  const { repoUrl, branch, version, privateKeyPath, password, isQuickScan, githubToken, localRepoLocation, scanId } = params;

  const exePath = validateTool("SoftwareSigner");
  if (!exePath) {
    emitLog(scanId, `\n❌ TOOL ERROR: SoftwareSigner not found.\n`, 0);
    emitComplete(scanId, { success: false, error: "Tool not found" });
    return;
  }

  // Use local repo path when provided, otherwise clone from remote
  let repoPath: string | null = null;
  if (localRepoLocation) {
    emitLog(scanId, `📂 Using local repository: ${localRepoLocation}\n`, 15);
    repoPath = localRepoLocation;
  } else if (version) {
    repoPath = await cloneRepositoryByTag(repoUrl, version, isQuickScan, githubToken, scanId);
  } else {
    repoPath = await getRepoPath(repoUrl, branch, isQuickScan, githubToken, scanId);
  }
  if (!repoPath) {
    emitComplete(scanId, { success: false, error: "Repository preparation failed" });
    return;
  }

  emitLog(scanId,
    `\n${"═".repeat(SEPARATOR_WIDTH)}\n🔏 INITIATING CRYPTOGRAPHIC SIGNING\n${"═".repeat(SEPARATOR_WIDTH)}\n\n`,
    30
  );

  emitLog(scanId,
    `🔹 Target Repo : ${localRepoLocation || repoUrl}\n` +
    `🔹 Branch      : ${localRepoLocation ? "(local)" : branch}\n` +
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
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║                   ✍️  DIGITAL SIGNATURE REPORT  ✍️                           ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝

 Status        : ${success ? "✅ SIGNING SUCCESS" : "❌ SIGNING FAILED"}
 Repository    : ${localRepoLocation || repoUrl}
 Branch        : ${localRepoLocation ? "(local)" : branch}
 Timestamp     : ${new Date().toLocaleTimeString()}

 🔏 Signature Details:
 ───────────────────────────────────────────────
 💾 Size       : ${signatureContent.length} chars
 🔑 Key Used   : (provided inline)

${"═".repeat(SEPARATOR_WIDTH)}
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