/**
 * GitHub release endpoint.
 *
 * POST /api/release/create — create a tagged release via gh CLI or GitHub API
 */

import { Router, Request, Response } from "express";
import { spawn } from "child_process";
import { v4 as uuid } from "uuid";

import { emitLog, emitComplete, sseEvents } from "../services/sseManager.js";
import * as proc from "../services/processManager.js";

export const releaseRouter = Router();

/** Payload: { repoUrl, branch, version, scanId } */

releaseRouter.post("/create", (req: Request, res: Response) => {
  const { repoUrl, branch, version, scanId: clientScanId } = req.body;
  const scanId = clientScanId || uuid();

  runCreateRelease({ repoUrl, branch, version, scanId });

  res.json({ scanId, started: true });
});

async function runCreateRelease(params: {
  repoUrl: string;
  branch: string;
  version: string;
  scanId: string;
}): Promise<void> {
  const { repoUrl, branch, version, scanId } = params;

  const token = process.env.GITHUB_PAT;
  if (!token) {
    emitComplete(scanId, { success: false, error: "GITHUB_PAT not configured on server" });
    return;
  }

  // Extract owner/repo from URL
  const match = repoUrl.match(/github\.com[/:](.+?)\/(.+?)(?:\.git)?$/);
  if (!match) {
    emitComplete(scanId, { success: false, error: "Invalid GitHub repository URL" });
    return;
  }
  const [, owner, repo] = match;
  const tagName = version.startsWith("v") ? version : `v${version}`;

  emitLog(scanId, `\n📦 Creating GitHub release ${tagName} for ${owner}/${repo}...\n`, 10);

  // Use gh CLI if available, otherwise fall back to curl
  const useGhCli = await checkGhCli();

  if (useGhCli) {
    return createReleaseWithGh({ owner, repo, tagName, branch, token, scanId });
  }
  return createReleaseWithCurl({ owner, repo, tagName, branch, token, scanId });
}

function checkGhCli(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn("gh", ["--version"], { stdio: "ignore", windowsHide: true });
    child.on("close", (code) => resolve(code === 0));
    child.on("error", () => resolve(false));
  });
}

async function createReleaseWithGh(params: {
  owner: string;
  repo: string;
  tagName: string;
  branch: string;
  token: string;
  scanId: string;
}): Promise<void> {
  const { owner, repo, tagName, branch, token, scanId } = params;

  return new Promise((resolve) => {
    const child = spawn(
      "gh",
      [
        "release",
        "create",
        tagName,
        "--repo",
        `${owner}/${repo}`,
        "--target",
        branch,
        "--title",
        `Release ${tagName}`,
        "--notes",
        `Automated release ${tagName}`,
      ],
      {
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, GH_TOKEN: token },
        windowsHide: true,
      }
    );
    proc.register(scanId, child);

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (d) => {
      stdout += d.toString();
      emitLog(scanId, d.toString(), 70);
    });
    child.stderr?.on("data", (d) => {
      stderr += d.toString();
      emitLog(scanId, d.toString(), 70);
    });

    child.on("close", (code) => {
      proc.unregister(scanId);
      if (code === 0) {
        emitLog(scanId, `\n✅ Release ${tagName} created successfully\n`, 100);
        emitComplete(scanId, { success: true });
      } else {
        emitComplete(scanId, {
          success: false,
          error: stderr || `gh release create exited ${code}`,
        });
      }
      resolve();
    });

    child.on("error", (err) => {
      proc.unregister(scanId);
      emitComplete(scanId, { success: false, error: err.message });
      resolve();
    });

    sseEvents.once(`cancel:${scanId}`, () => {
      proc.killProcess(child, scanId);
    });
  });
}

async function createReleaseWithCurl(params: {
  owner: string;
  repo: string;
  tagName: string;
  branch: string;
  token: string;
  scanId: string;
}): Promise<void> {
  const { owner, repo, tagName, branch, token, scanId } = params;

  const body = JSON.stringify({
    tag_name: tagName,
    target_commitish: branch,
    name: `Release ${tagName}`,
    body: `Automated release ${tagName}`,
    draft: false,
    prerelease: false,
  });

  const curlArgs = [
    "-s",
    "-X",
    "POST",
    `https://api.github.com/repos/${owner}/${repo}/releases`,
    "-H",
    `Authorization: token ${token}`,
    "-H",
    "Accept: application/vnd.github+json",
    "-H",
    "Content-Type: application/json",
    "-d",
    body,
  ];

  return new Promise((resolve) => {
    const child = spawn("curl", curlArgs, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    proc.register(scanId, child);

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr?.on("data", (d) => {
      stderr += d.toString();
      emitLog(scanId, d.toString(), 70);
    });

    child.on("close", (code) => {
      proc.unregister(scanId);
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          if (result.html_url) {
            emitLog(scanId, `\n✅ Release created: ${result.html_url}\n`, 100);
            emitComplete(scanId, { success: true });
          } else {
            emitComplete(scanId, {
              success: false,
              error: result.message || "Unknown GitHub API error",
            });
          }
        } catch {
          emitComplete(scanId, { success: false, error: "Failed to parse GitHub response" });
        }
      } else {
        emitComplete(scanId, {
          success: false,
          error: stderr || `curl exited ${code}`,
        });
      }
      resolve();
    });

    child.on("error", (err) => {
      proc.unregister(scanId);
      emitComplete(scanId, { success: false, error: err.message });
      resolve();
    });

    sseEvents.once(`cancel:${scanId}`, () => {
      proc.killProcess(child, scanId);
    });
  });
}