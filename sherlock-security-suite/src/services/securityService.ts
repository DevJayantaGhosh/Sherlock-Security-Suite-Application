// src/services/securityService.ts
export type ScanProgress = {
  runId: string;
  repo: string;
  step: string;
  status: "running" | "success" | "failed" | "done";
  logs: string[];
};

export async function runRepoScan(projectId: string, repoIndex: number, repoUrl: string, branch: string) {
  // returns { runId }
  return await window.electronAPI.runRepoScan({ projectId, repoIndex, repoUrl });
}

/**
 * Subscribe to progress updates.
 * callback receives ScanProgress.
 * returns unsubscribe function.
 */
export function onScanProgress(cb: (p: ScanProgress) => void) {
  return window.electronAPI.onScanProgress(cb);
}

/**
 * Ask the LLM to analyze something — returns { streamId } and emits 'llm:stream' events.
 */
export async function llmQuery(sessionId: string, prompt: string) {
  return await window.electronAPI.llmQuery({ sessionId, prompt });
}

/**
 * Subscribe to LLM stream chunks. `cb` receives { streamId, sessionId, chunk, done }.
 */
export function onLLMStream(cb: (msg: { streamId: string; sessionId: string; chunk: string; done: boolean }) => void) {
  return window.electronAPI.onLLMStream(cb);
}
