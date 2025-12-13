export type ScanProgress = {
  repo: string;
  step: string;
  status: "running" | "success" | "failed" | "done";
  logs: string[];
};


export type LLMStreamChunk = {
  sessionId: string;
  chunk: string;
  done: boolean;
};

export async function llmQuery(sessionId: string, prompt: string) {
  return fetch("/api/llm", {
    method: "POST",
    body: JSON.stringify({ sessionId, prompt }),
    headers: { "Content-Type": "application/json" },
  });
}

export function onLLMStream(cb: (d: LLMStreamChunk) => void) {
  const es = new EventSource("/api/llm/stream");
  es.onmessage = e => cb(JSON.parse(e.data));
  return () => es.close();
}
