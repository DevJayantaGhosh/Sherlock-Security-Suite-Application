/**
 * GitHub release endpoint — Octokit-based.
 *
 * POST /api/release/create — create a tagged release via GitHub REST API (Octokit)
 */

import { Router, Request, Response } from "express";
import https from "node:https";
import { Octokit } from "@octokit/rest";
import { v4 as uuid } from "uuid";

import { emitLog, emitComplete, emitCancel, sseEvents } from "../services/sseManager.js";

/** log heading separator constant  */
const SEPARATOR_WIDTH = 80;



export const releaseRouter = Router();

/** Payload: { repoUrl, branch, version, githubToken?, scanId } */

releaseRouter.post("/create", (req: Request, res: Response) => {
  const { repoUrl, branch, version, githubToken, scanId: clientScanId } = req.body;
  const scanId = clientScanId || uuid();

  // Fire-and-forget — logs streamed via SSE
  runCreateRelease({ repoUrl, branch, version, githubToken, scanId });

  res.json({ scanId, started: true });
});

/* ------------------------------------------------------------------ */

async function runCreateRelease(params: {
  repoUrl: string;
  branch: string;
  version: string;
  githubToken?: string;
  scanId: string;
}): Promise<void> {
  const { repoUrl, branch, version, githubToken, scanId } = params;

  /* ── 0. Token — prefer payload token (Quick Release), fallback to env (Product flow) */
  const token = githubToken || process.env.GITHUB_PAT;
  if (!token) {
    emitLog(scanId, `\n❌ GITHUB TOKEN MISSING\nProvide a token in the UI or set GITHUB_PAT environment variable\n`, 0);
    emitComplete(scanId, { success: false, error: "GitHub token not provided and GITHUB_PAT not configured on server" });
    return;
  }

  /* ── 1. Parse owner / repo ────────────────────────────────── */
  const repoMatch = repoUrl.match(/github\.com[\/:]([^\/]+)\/([^\/\.]+)/);
  if (!repoMatch) {
    emitLog(scanId, `\n❌ Invalid GitHub URL: ${repoUrl}\n`, 0);
    emitComplete(scanId, { success: false, error: "Invalid GitHub repository URL" });
    return;
  }

  const [, owner, repo] = repoMatch;
  const releaseTag = `${version}`; // version is tag in 1.0.0 format

  /* ── 2. Header logs ───────────────────────────────────────── */
  emitLog(
    scanId,
    `\n${"═".repeat(SEPARATOR_WIDTH)}\n🚀 GITHUB RELEASE CREATION\n${"═".repeat(SEPARATOR_WIDTH)}\n\n`,
    10
  );

  emitLog(
    scanId,
    `🔹 Repository  : ${repoUrl}\n🔹 Owner/Repo   : ${owner}/${repo}\n🔹 Branch       : ${branch}\n🔹 Version      : ${version}\n🔹 Release Tag  : ${releaseTag}\n🔹 Release URL  : https://github.com/${owner}/${repo}/releases/tag/${releaseTag}\n\n`,
    20
  );

  // Corporate network SSL fix: use a permissive HTTPS agent
  const sslAgent = new https.Agent({ rejectUnauthorized: false });
  const octokit = new Octokit({ auth: token, request: { agent: sslAgent } });

  // Cancellation support
  let cancelled = false;
  const cancelHandler = () => { cancelled = true; };
  sseEvents.once(`cancel:${scanId}`, cancelHandler);

  try {
    /* ── 3. Check if tag already exists ───────────────────── */
    if (cancelled) { emitComplete(scanId, { success: false, cancelled: true }); return; }
    emitLog(scanId, `🔍 Checking if tag ${releaseTag} exists...\n`, 30);

    try {
      await octokit.rest.git.getRef({ owner, repo, ref: `tags/${releaseTag}` });
      emitLog(scanId, `⚠️  Tag ${releaseTag} already exists, will update...\n`, 40);
    } catch (e: any) {
      if (e.status !== 404) throw e;
      emitLog(scanId, `✅ Tag ${releaseTag} does not exist, creating new...\n`, 40);
    }

    /* ── 4. Get branch SHA ────────────────────────────────── */
    if (cancelled) { emitComplete(scanId, { success: false, cancelled: true }); return; }
    emitLog(scanId, `🔍 Fetching ${branch} branch SHA...\n`, 50);
    const { data: branchRef } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`,
    });
    const branchSha = branchRef.object.sha;

    /* ── 5. Create tag ref ────────────────────────────────── */
    if (cancelled) { emitComplete(scanId, { success: false, cancelled: true }); return; }
    emitLog(scanId, `🏷️  Creating tag ${releaseTag} on ${branchSha.slice(0, 7)}...\n`, 60);

    try {
      await octokit.rest.git.createRef({
        owner,
        repo,
        ref: `refs/tags/${releaseTag}`,
        sha: branchSha,
      });
    } catch (tagErr: any) {
      // Tag may already exist — only fail if it's not a 422 "already exists"
      if (tagErr.status !== 422) throw tagErr;
      emitLog(scanId, `ℹ️  Tag already exists, continuing with release...\n`, 65);
    }

    /* ── 6. Create the release ────────────────────────────── */
    if (cancelled) { emitComplete(scanId, { success: false, cancelled: true }); return; }
    emitLog(scanId, `📦 Creating release ${releaseTag}...\n`, 80);

    const { data: release } = await octokit.rest.repos.createRelease({
      owner,
      repo,
      tag_name: releaseTag,
      target_commitish: branch,
      name: `Release ${version}`,
      body: `# Release ${version}\n\n**Created from ${branch} branch**\n\n- Tag: \`${releaseTag}\`\n- Commit: \`${branchSha.slice(0, 7)}\``,
      prerelease:
        version.includes("-") || version.includes("rc") || version.includes("beta"),
      draft: false,
    });

    /* ── 7. Success summary ───────────────────────────────── */
    const summary = `
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║                    🚀  GITHUB RELEASE CREATED  🚀                            ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝

Repository     : ${owner}/${repo}
Branch         : ${branch}
Tag            : ${releaseTag}
Status         : ✅ SUCCESS
Release ID     : ${release.id}
Release URL    : ${release.html_url}

📎 Direct Link : ${release.html_url}

${"═".repeat(SEPARATOR_WIDTH)}
`;

    emitLog(scanId, summary, 100);
    sseEvents.removeListener(`cancel:${scanId}`, cancelHandler);
    emitComplete(scanId, {
      success: true,
      release: { id: release.id, url: release.html_url, tag: releaseTag },
    });
  } catch (error: any) {
    sseEvents.removeListener(`cancel:${scanId}`, cancelHandler);
    const errorMsg =
      error.status === 422
        ? "Release/tag already exists with different content"
        : error.message || "Unknown error";

    emitLog(
      scanId,
      `\n❌ Release creation failed:\n${errorMsg}\n\nHTTP ${error.status || "N/A"}\n`,
      0
    );
    emitComplete(scanId, { success: false, error: errorMsg });
  }
}