/**
 * workflowAccess.ts — Centralized workflow navigation + access validation.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │                    PRODUCT STATUS FLOW                             │
 * │                                                                     │
 * │   Pending ──► Approved ──► Released ──► Signed                     │
 * │      │                                                              │
 * │      └──► Rejected (terminal — viewable by anyone)                 │
 * │                                                                     │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │                    WORKFLOW STEPS                                   │
 * │                                                                     │
 * │   Step 1: Security Scan        (Pending → Approved)                │
 * │   Step 2: Release               (Approved → Released)              │
 * │   Step 3: Cryptographic Signing (Released → Signed)                │
 * │   Step 4: Signature Verification (Signed = done)                   │
 * │                                                                     │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │                    ACCESS RULES                                     │
 * │                                                                     │
 * │   1. Rejected / step already done → anyone can VIEW (no warning)   │
 * │   2. Step not reached yet         → BLOCKED (no navigation)        │
 * │   3. Step in progress + wrong role → WARNING (view-only navigate)  │
 * │   4. Step in progress + right role → FULL ACCESS (navigate)        │
 * └─────────────────────────────────────────────────────────────────────┘
 */

import { Product } from "../models/Product";
import { AppUser } from "../models/User";
import { ACCESS_MESSAGES } from "../constants/accessMessages";
import {
  authorizeApprove,
  authorizeToSign,
  authorizeRelease,
} from "../services/productService";

/* ═══════════════════════════════════════════════════════════════════════
   WORKFLOW STEPS
   ═══════════════════════════════════════════════════════════════════════ */

export interface WorkflowStep {
  key: string;
  label: string;
  shortLabel: string;
  path: string;
}

export const WORKFLOW_STEPS: WorkflowStep[] = [
  { key: "security-scan",         label: "Security Scan",          shortLabel: "Scan",    path: "security-scan" },
  { key: "releases",              label: "Releases",               shortLabel: "Release", path: "releases" },
  { key: "cryptographic-signing", label: "Cryptographic Signing",  shortLabel: "Sign",    path: "cryptographic-signing" },
  { key: "signature-verify",      label: "Signature Verification", shortLabel: "Verify",  path: "signature-verify" },
];

/* ═══════════════════════════════════════════════════════════════════════
   ACCESS RESULT
   ═══════════════════════════════════════════════════════════════════════ */

export interface AccessResult {
  blocked: boolean;   // true = hard block, no navigation
  title: string;      // dialog title (empty = no dialog)
  message: string;    // dialog message
  navigate: boolean;  // true = navigate after dialog
}

const ALLOW: AccessResult = { blocked: false, title: "", message: "", navigate: true };

const BLOCK = (title: string, message: string): AccessResult => ({
  blocked: true, title, message, navigate: false,
});

const WARN = (title: string, message: string): AccessResult => ({
  blocked: false, title, message, navigate: true,
});

/* ═══════════════════════════════════════════════════════════════════════
   ACCESS CHECKS — One function per step
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * STEP 1 — SECURITY SCAN
 *
 * Step does: Pending → Approved
 * Already done when: Approved, Released, Signed
 * Rejected: viewable
 * In progress (Pending): only Security-Head can act, others get warning
 */
export function checkSecurityScanAccess(user: AppUser | null, product: Product): AccessResult {
  const { status } = product;

  // Already done or rejected → anyone can view
  if (status === "Approved" || status === "Released" || status === "Signed" || status === "Rejected") {
    return ALLOW;
  }

  // In progress (Pending) → check role
  if (!authorizeApprove(user, product)) {
    return WARN(ACCESS_MESSAGES.ROLE_RESTRICTED_TITLE, ACCESS_MESSAGES.SECURITY_HEAD_MSG);
  }

  return ALLOW;
}

/**
 * STEP 2 — RELEASE
 *
 * Step does: Approved → Released
 * Already done when: Released, Signed
 * Rejected: viewable
 * Not reached (Pending): blocked
 * In progress (Approved): only Release-Engineer can act, others get warning
 */
export function checkReleaseAccess(user: AppUser | null, product: Product): AccessResult {
  const { status } = product;

  // Already done or rejected → anyone can view
  if (status === "Released" || status === "Signed" || status === "Rejected") {
    return ALLOW;
  }

  // Not reached yet (Pending) → blocked
  if (status !== "Approved") {
    return BLOCK(ACCESS_MESSAGES.RELEASE_RESTRICTED_TITLE, ACCESS_MESSAGES.RELEASE_NEEDS_APPROVAL);
  }

  // In progress (Approved) → check role
  if (!authorizeRelease(user, product)) {
    return WARN(ACCESS_MESSAGES.ROLE_RESTRICTED_TITLE, ACCESS_MESSAGES.RELEASE_ENGINEER_RELEASE_MSG);
  }

  return ALLOW;
}

/**
 * STEP 3 — CRYPTOGRAPHIC SIGNING
 *
 * Step does: Released → Signed
 * Already done when: Signed
 * Rejected: viewable
 * Not reached (Pending, Approved): blocked
 * In progress (Released): only Release-Engineer can act, others get warning
 */
export function checkCryptoSignAccess(user: AppUser | null, product: Product): AccessResult {
  const { status } = product;

  // Already done or rejected → anyone can view
  if (status === "Signed" || status === "Rejected") {
    return ALLOW;
  }

  // Not reached yet (Pending, Approved) → blocked
  if (status !== "Released") {
    return BLOCK(ACCESS_MESSAGES.SIGNING_RESTRICTED_TITLE, ACCESS_MESSAGES.SIGNING_NEEDS_RELEASE);
  }

  // In progress (Released) → check role
  if (!authorizeToSign(user, product)) {
    return WARN(ACCESS_MESSAGES.ROLE_RESTRICTED_TITLE, ACCESS_MESSAGES.RELEASE_ENGINEER_SIGN_MSG);
  }

  return ALLOW;
}

/**
 * STEP 4 — SIGNATURE VERIFICATION
 *
 * Step does: verify Signed product
 * Available when: Signed
 * Rejected: viewable
 * Not reached (Pending, Approved, Released): blocked
 * No role restriction
 */
export function checkSignatureVerifyAccess(_user: AppUser | null, product: Product): AccessResult {
  const { status } = product;

  // Available or rejected → anyone can view
  if (status === "Signed" || status === "Rejected") {
    return ALLOW;
  }

  // Not reached yet → blocked
  return BLOCK(ACCESS_MESSAGES.VERIFY_RESTRICTED_TITLE, ACCESS_MESSAGES.VERIFY_NEEDS_SIGNING);
}

/* ═══════════════════════════════════════════════════════════════════════
   LOOKUP BY STEP KEY
   ═══════════════════════════════════════════════════════════════════════ */

export function checkStepAccess(stepKey: string, user: AppUser | null, product: Product): AccessResult {
  switch (stepKey) {
    case "security-scan":         return checkSecurityScanAccess(user, product);
    case "releases":              return checkReleaseAccess(user, product);
    case "cryptographic-signing": return checkCryptoSignAccess(user, product);
    case "signature-verify":      return checkSignatureVerifyAccess(user, product);
    default:                      return ALLOW;
  }
}