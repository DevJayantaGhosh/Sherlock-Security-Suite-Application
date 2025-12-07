// src/services/securityService.ts

declare global {
  interface Window {
    electronAPI: {
      runRepoScan: (args: {
        projectId: string;
        repoIndex: number;
        repoUrl: string;
        branch: string;
      }) => Promise<{ runId: string }>;

      onScanProgress: (
        cb: (p: ScanProgress) => void
      ) => () => void;

      llmQuery: (args: {
        sessionId: string;
        prompt: string;
      }) => Promise<{ streamId: string }>;

      onLLMStream: (
        cb: (msg: LLMStreamMessage) => void
      ) => () => void;
    };
  }
}

export type ScanProgress = {
  runId: string;
  repo: string;
  step: "verify-gpg" | "llm-scan";
  status: "running" | "success" | "failed" | "done";
  logs: string[];
};

export type LLMStreamMessage = {
  streamId: string;
  sessionId: string;
  chunk: string;
  done: boolean;
};

/* -------------------- IPC CALLS -------------------- */

export async function runRepoScan(
  projectId: string,
  repoIndex: number,
  repoUrl: string,
  branch: string
) {
  return window.electronAPI.runRepoScan({
    projectId,
    repoIndex,
    repoUrl,
    branch
  });
}

/* -------------------- REPO SCAN STREAM -------------------- */

export function onScanProgress(cb: (p: ScanProgress) => void) {
  return window.electronAPI.onScanProgress(cb);
}

/* -------------------- LLM QUERY -------------------- */

export async function llmQuery(
  sessionId: string,
  prompt: string
) {
  return window.electronAPI.llmQuery({
    sessionId,
    prompt
  });
}

/* -------------------- LLM STREAM SUBSCRIBE -------------------- */

export function onLLMStream(
  cb: (msg: LLMStreamMessage) => void
) {
  return window.electronAPI.onLLMStream(cb);
}
