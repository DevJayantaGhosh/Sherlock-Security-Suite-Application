// src/platform/types.ts
// Platform abstraction types — aligned with electron/electron-env.d.ts

/* ── Scan Payloads ─────────────────────────────────────────── */

export interface ScanPayload {
  repoUrl: string;
  branch: string;
  isQuickScan: boolean;
  githubToken: string;
  scanId: string;
}

export interface GenerateKeysPayload {
  type: "rsa" | "ecdsa";
  size?: number;
  curve?: string;
  password?: string;
  /** Required in Electron (local folder), ignored in web mode */
  outputDir?: string;
  scanId: string;
}

export interface SignArtifactPayload {
  repoUrl: string;
  branch: string;
  version: string;
  privateKeyPath: string;
  password?: string;
  isQuickScan: boolean;
  localRepoLocation: string;
  githubToken: string;
  scanId: string;
}

export interface CreateReleasePayload {
  repoUrl: string;
  branch: string;
  version: string;
  /** Optional: passed by Quick Release flow. Product flow falls back to GITHUB_PAT env. */
  githubToken?: string;
  scanId: string;
}

export interface VerifySignaturePayload {
  repoUrl: string;
  branch: string;
  version: string;
  publicKeyPath: string;
  signaturePath: string;
  isQuickScan: boolean;
  localRepoLocation: string;
  githubToken: string;
  scanId: string;
}

export interface CancelPayload {
  scanId: string;
}

/* ── Return Types ──────────────────────────────────────────── */

export interface GPGResult {
  success: boolean;
  cancelled?: boolean;
  error?: string;
  totalCommits?: number;
  goodSignatures?: number;
}

export interface GitleaksResult {
  success: boolean;
  cancelled?: boolean;
  error?: string;
  findings?: number;
}

export interface VulnScanResult {
  success: boolean;
  cancelled?: boolean;
  error?: string;
  vulnerabilities?: number;
}

export interface GenericResult {
  success: boolean;
  error?: string;
}

export interface VerifyResult {
  success: boolean;
  verified: boolean;
  error?: string;
}

/* ── Streaming Callbacks ───────────────────────────────────── */

export interface ScanLogData {
  log: string;
  progress: number;
}

export interface ScanCompleteData {
  success: boolean;
  totalCommits?: number;
  goodSignatures?: number;
  findings?: number;
  vulnerabilities?: number;
  critical?: number;
  high?: number;
  medium?: number;
  low?: number;
  error?: string;
  /** Returned by key-generation (host-server) */
  keyData?: { publicKey: string; privateKey: string };
  /** Returned by sign-artifact (host-server) */
  signatureContent?: string;
  /** Returned by verify-signature (host-server) */
  verified?: boolean;
}

/* ── Unified Platform Bridge ───────────────────────────────── */

/**
 * Both Electron IPC and Host-Server (SSE/REST) implementations
 * conform to this interface. UI components call only this shape.
 */
export interface PlatformBridge {
  // Security scans
  verifyGPG(payload: ScanPayload): Promise<GPGResult>;
  runGitleaks(payload: ScanPayload): Promise<GitleaksResult>;
  runVulnScan(payload: ScanPayload): Promise<VulnScanResult>;

  // File dialogs
  selectFolder(): Promise<string | null>;
  selectFile(): Promise<string | null>;
  openFilePath(filePath: string): Promise<void>;

  // Crypto operations
  generateKeys(payload: GenerateKeysPayload): Promise<GenericResult>;
  signArtifact(payload: SignArtifactPayload): Promise<GenericResult>;

  // GitHub release
  createGitHubRelease(payload: CreateReleasePayload): Promise<GenericResult>;

  // Signature verification
  verifySignature(payload: VerifySignaturePayload): Promise<VerifyResult>;

  // Cancel
  cancelScan(payload: CancelPayload): Promise<{ cancelled: boolean }>;

  // Real-time log/completion listeners — return cleanup functions
  onScanLog(scanId: string, callback: (data: ScanLogData) => void): () => void;
  onScanComplete(scanId: string, callback: (data: ScanCompleteData) => void): () => void;

  /** true when running inside Electron, false in browser */
  readonly isElectron: boolean;
}