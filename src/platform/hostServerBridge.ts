// src/platform/hostServerBridge.ts
// Web-portal bridge: REST calls + SSE for real-time logs/completion.
// Used when the app runs in a browser against the host-server.

import type {
  PlatformBridge,
  ScanPayload,
  GenerateKeysPayload,
  SignArtifactPayload,
  CreateReleasePayload,
  VerifySignaturePayload,
  CancelPayload,
  ScanLogData,
  ScanCompleteData,
  GPGResult,
  GitleaksResult,
  TrivyResult,
  GenericResult,
  VerifyResult,
} from "./types";

/**
 * Base URL of the host-server.
 * In development: http://localhost:4000
 * In production: same origin or configured via env var.
 */
const HOST_SERVER_URL =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_HOST_SERVER_URL) ||
  "http://localhost:4821";

/* ── Helpers ──────────────────────────────────────────────── */

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${HOST_SERVER_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Host-server error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Subscribe to an SSE stream for a given scanId and channel type.
 * Returns a cleanup function that closes the EventSource.
 */
function subscribeSSE(
  scanId: string,
  channel: "log" | "complete",
  callback: (data: any) => void
): () => void {
  const url = `${HOST_SERVER_URL}/api/sse/stream/${scanId}/${channel}`;
  const es = new EventSource(url);

  es.onmessage = (event) => {
    try {
      const parsed = JSON.parse(event.data);
      callback(parsed);
    } catch {
      // non-JSON heartbeat — ignore
    }
  };

  es.onerror = () => {
    // Connection closed by server or network issue — silently close
    es.close();
  };

  return () => es.close();
}

/* ── Bridge Implementation ────────────────────────────────── */

export const hostServerBridge: PlatformBridge = {
  isElectron: false,

  // ── Security Scans ──────────────────────────────────────
  verifyGPG(payload: ScanPayload): Promise<GPGResult> {
    return post<GPGResult>("/api/scan/verify-gpg", payload);
  },

  runGitleaks(payload: ScanPayload): Promise<GitleaksResult> {
    return post<GitleaksResult>("/api/scan/secrets", payload);
  },

  runTrivy(payload: ScanPayload): Promise<TrivyResult> {
    return post<TrivyResult>("/api/scan/vulnerability", payload);
  },

  // ── File Dialogs (not available in web mode) ────────────
  async selectFolder(): Promise<string | null> {
    // Web mode: no native file dialog. UI should use <input> or show a text field.
    return null;
  },

  async selectFile(): Promise<string | null> {
    // Web mode: no native file dialog. UI should use <input type="file">.
    return null;
  },

  async openFilePath(_filePath: string): Promise<void> {
    // Web mode: cannot open arbitrary local paths. No-op.
  },

  // ── Crypto Operations ───────────────────────────────────
  generateKeys(payload: GenerateKeysPayload): Promise<GenericResult> {
    return post<GenericResult>("/api/crypto/generate-keys", payload);
  },

  signArtifact(payload: SignArtifactPayload): Promise<GenericResult> {
    return post<GenericResult>("/api/crypto/sign-artifact", payload);
  },

  // ── GitHub Release ──────────────────────────────────────
  createGitHubRelease(payload: CreateReleasePayload): Promise<GenericResult> {
    return post<GenericResult>("/api/release/create", payload);
  },

  // ── Signature Verification ──────────────────────────────
  verifySignature(payload: VerifySignaturePayload): Promise<VerifyResult> {
    return post<VerifyResult>("/api/verify/signature", payload);
  },

  // ── Cancel ──────────────────────────────────────────────
  cancelScan(payload: CancelPayload): Promise<{ cancelled: boolean }> {
    return post<{ cancelled: boolean }>("/api/scan/cancel", payload);
  },

  // ── Streaming Listeners via SSE ─────────────────────────
  onScanLog(scanId: string, callback: (data: ScanLogData) => void): () => void {
    return subscribeSSE(scanId, "log", callback);
  },

  onScanComplete(scanId: string, callback: (data: ScanCompleteData) => void): () => void {
    return subscribeSSE(scanId, "complete", callback);
  },
};