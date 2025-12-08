export type ScanProgress = {
  repo: string;
  step: string;
  status: "running" | "success" | "failed" | "done";
  logs: string[];
};

export function runRepoScan(
  projectId: string,
  repoIndex: number,
  repoUrl: string,
  branch: string
) {
  return window.electronAPI.runRepoScan({
    projectId,
    repoIndex,
    repoUrl,
    branch,
  });
}

export function onScanProgress(cb: (p: ScanProgress) => void): () => void {
  return window.electronAPI.onScanProgress(cb);
}

// ----- LLM -----

export type LLMStreamChunk = {
  sessionId: string;
  chunk: string;
  done: boolean;
};

export function llmQuery(sessionId: string, prompt: string) {
  return window.electronAPI.llmQuery({ sessionId, prompt });
}

export function onLLMStream(
  cb: (d: LLMStreamChunk) => void
): () => void {
  return window.electronAPI.onLLMStream(cb);
}
