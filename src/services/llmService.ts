/**
 * LLM Service — Direct browser-to-LLM API calls.
 *
 * Uses the OpenAI-compatible chat/completions endpoint with streaming.
 * Reads config from Zustand llmStore.
 */

import { useLLMStore } from "../store/llmStore";
import { SECURITY_SYSTEM_PROMPT, type LLMProviderConfig } from "../config/llmConfig";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Get current config snapshot from the store (non-hook access). */
function getConfig(): LLMProviderConfig {
  return useLLMStore.getState().config;
}

function isConfigured(): boolean {
  return useLLMStore.getState().isConfigured();
}

function buildHeaders(config: LLMProviderConfig): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.provider === "azure") {
    headers["api-key"] = config.apiKey;
  } else if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }
  return headers;
}

/**
 * Stream chat response token-by-token.
 */
export async function streamChat(
  messages: ChatMessage[],
  onChunk: (chunk: string) => void,
  onDone: (fullText: string) => void,
  onError: (error: string) => void,
  signal?: AbortSignal
): Promise<void> {
  if (!isConfigured()) {
    onError("LLM is not configured. Open ⚙️ AI Config and set your provider, API key, and model.");
    return;
  }

  const config = getConfig();
  const headers = buildHeaders(config);

  const fullMessages: ChatMessage[] =
    messages[0]?.role === "system"
      ? messages
      : [{ role: "system", content: SECURITY_SYSTEM_PROMPT }, ...messages];

  let fullText = "";

  try {
    const response = await fetch(`${config.baseURL}/chat/completions`, {
      method: "POST",
      headers,
      signal,
      body: JSON.stringify({
        model: config.model,
        messages: fullMessages,
        stream: true,
        temperature: 0.3,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      onError(`LLM API error (${response.status}): ${errText.slice(0, 500)}`);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      onError("No response stream available from LLM.");
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "data: [DONE]") continue;
        if (!trimmed.startsWith("data: ")) continue;

        try {
          const json = JSON.parse(trimmed.slice(6));
          const content = json.choices?.[0]?.delta?.content;
          if (content) {
            fullText += content;
            onChunk(content);
          }
        } catch {
          // Skip malformed chunks
        }
      }
    }

    onDone(fullText);
  } catch (err: any) {
    if (err.name === "AbortError") {
      onDone(fullText);
      return;
    }
    onError(`LLM connection failed: ${err.message}`);
  }
}

/**
 * Non-streaming single-shot query.
 */
export async function queryChat(messages: ChatMessage[]): Promise<string> {
  if (!isConfigured()) throw new Error("LLM is not configured.");

  const config = getConfig();
  const headers = buildHeaders(config);

  const fullMessages: ChatMessage[] =
    messages[0]?.role === "system"
      ? messages
      : [{ role: "system", content: SECURITY_SYSTEM_PROMPT }, ...messages];

  const response = await fetch(`${config.baseURL}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.model,
      messages: fullMessages,
      temperature: 0.3,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`LLM API error (${response.status}): ${errText.slice(0, 500)}`);
  }

  const json = await response.json();
  return json.choices?.[0]?.message?.content || "(No response)";
}

/**
 * Fetch available models from the provider's /models endpoint.
 */
export async function fetchModels(overrideConfig?: LLMProviderConfig): Promise<string[]> {
  const config = overrideConfig || getConfig();
  const headers = buildHeaders(config);

  try {
    const response = await fetch(`${config.baseURL}/models`, { headers });
    if (!response.ok) return [];

    const json = await response.json();
    return (json.data || [])
      .map((m: any) => m.id || m.model || "")
      .filter(Boolean)
      .sort();
  } catch {
    return [];
  }
}