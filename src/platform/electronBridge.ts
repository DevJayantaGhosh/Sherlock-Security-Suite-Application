// src/platform/electronBridge.ts
// Thin wrapper around window.electronAPI exposed by preload.ts
// No changes to electron/main.ts or electron/preload.ts required.

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

export const electronBridge: PlatformBridge = {
  isElectron: true,

  // ── Security Scans ──────────────────────────────────────
  verifyGPG(payload: ScanPayload): Promise<GPGResult> {
    return window.electronAPI.verifyGPG(payload);
  },

  runGitleaks(payload: ScanPayload): Promise<GitleaksResult> {
    return window.electronAPI.runGitleaks(payload);
  },

  runTrivy(payload: ScanPayload): Promise<TrivyResult> {
    return window.electronAPI.runTrivy(payload);
  },

  // ── File Dialogs ────────────────────────────────────────
  selectFolder(): Promise<string | null> {
    return window.electronAPI.selectFolder();
  },

  selectFile(): Promise<string | null> {
    return window.electronAPI.selectFile();
  },

  openFilePath(filePath: string): Promise<void> {
    return window.electronAPI.openFilePath(filePath);
  },

  // ── Crypto Operations ───────────────────────────────────
  generateKeys(payload: GenerateKeysPayload): Promise<GenericResult> {
    return window.electronAPI.generateKeys({
      ...payload,
      outputDir: payload.outputDir as string,
    });
  },

  signArtifact(payload: SignArtifactPayload): Promise<GenericResult> {
    return window.electronAPI.signArtifact(payload);
  },

  // ── GitHub Release ──────────────────────────────────────
  createGitHubRelease(payload: CreateReleasePayload): Promise<GenericResult> {
    return window.electronAPI.createGitHubRelease(payload);
  },

  // ── Signature Verification ──────────────────────────────
  verifySignature(payload: VerifySignaturePayload): Promise<VerifyResult> {
    return window.electronAPI.verifySignature(payload);
  },

  // ── Cancel ──────────────────────────────────────────────
  cancelScan(payload: CancelPayload): Promise<{ cancelled: boolean }> {
    return window.electronAPI.cancelScan(payload);
  },

  // ── Streaming Listeners ─────────────────────────────────
  onScanLog(scanId: string, callback: (data: ScanLogData) => void): () => void {
    return window.electronAPI.onScanLog(scanId, callback);
  },

  onScanComplete(scanId: string, callback: (data: ScanCompleteData) => void): () => void {
    return window.electronAPI.onScanComplete(scanId, callback);
  },
};