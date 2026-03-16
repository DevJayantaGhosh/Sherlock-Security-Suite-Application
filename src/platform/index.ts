// src/platform/index.ts
// Auto-detects Electron vs Browser and exports the appropriate bridge.

import type { PlatformBridge } from "./types";
import isElectron from "is-electron";
import { electronBridge } from "./electronBridge";
import { hostServerBridge } from "./hostServerBridge";

/**
 * Lazily resolved singleton.
 * Both bridges are lightweight (no heavy deps), so static imports are fine.
 */
let _bridge: PlatformBridge | null = null;

export function getPlatformBridge(): PlatformBridge {
  if (_bridge) return _bridge;

  _bridge = isElectron() ? electronBridge : hostServerBridge;

  return _bridge;
}

/**
 * Convenience shorthand — most components just need `import { platform } from "…/platform"`.
 * This is a getter-based proxy so the bridge is resolved on first access.
 */
export const platform: PlatformBridge = new Proxy({} as PlatformBridge, {
  get(_target, prop) {
    const bridge = getPlatformBridge();
    const value = (bridge as any)[prop];
    if (typeof value === "function") {
      return value.bind(bridge);
    }
    return value;
  },
});

// Re-export all types for convenience
export type {
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