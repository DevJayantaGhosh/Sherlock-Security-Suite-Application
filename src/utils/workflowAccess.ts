/**
 * workflowAccess.ts — Centralized workflow navigation + access validation.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │                    PRODUCT STATUS FLOW                             │
 * │                                                                     │
 * │   Pending ──► Approved ──► Signed ──► Released                     │
 * │      │                                                              │
 * │      └──► Rejected (terminal — viewable by anyone)                 │
 * │                                                                     │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │                    WORKFLOW STEPS                                   │
 * │                                                                     │
 * │   Step 1: Security Scan        (Pending → Approved)                │
 * │   Step 2: Cryptographic Signing (Approved → Signed)                │
 * │   Step 3: Release               (Signed → Released)                │
 * │   Step 4: Signature Verification (Released = done)                 │
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
  { key: "cryptographic-signing", label: "Cryptographic Signing",  shortLabel: "Sign",    path: "cryptographic-signing" },
  { key: "releases",              label: "Releases",               shortLabel: "Release", path: "releases" },
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
 * SECURITY SCAN
 *
 * Step does: Pending → Approved
 * Already done when: Approved, Signed, Released
 * Rejected: viewable
 * In progress (Pending): only Security-Head can act, others get warning
 */
export function checkSecurityScanAccess(user: AppUser | null, product: Product): AccessResult {
  const { status } = product;

  // Already done or rejected → anyone can view
  if (status === "Approved" || status === "Signed" || status === "Released" || status === "Rejected") {
    return ALLOW;
  }

  // In progress (Pending) → check role
  if (!authorizeApprove(user, product)) {
    return WARN(ACCESS_MESSAGES.ROLE_RESTRICTED_TITLE, ACCESS_MESSAGES.SECURITY_HEAD_MSG);
  }

  return ALLOW;
}

/**
 * CRYPTOGRAPHIC SIGNING
 *
 * Step does: Approved → Signed
 * Already done when: Signed, Released
 * Rejected: viewable
 * Not reached (Pending): blocked
 * In progress (Approved): only Release-Engineer can act, others get warning
 */
export function checkCryptoSignAccess(user: AppUser | null, product: Product): AccessResult {
  const { status } = product;

  // Already done or rejected → anyone can view
  if (status === "Signed" || status === "Released" || status === "Rejected") {
    return ALLOW;
  }

  // Not reached yet (Pending) → blocked
  if (status !== "Approved") {
    return BLOCK(ACCESS_MESSAGES.SIGNING_RESTRICTED_TITLE, ACCESS_MESSAGES.SIGNING_NEEDS_APPROVAL);
  }

  // In progress (Approved) → check role
  if (!authorizeToSign(user, product)) {
    return WARN(ACCESS_MESSAGES.ROLE_RESTRICTED_TITLE, ACCESS_MESSAGES.RELEASE_ENGINEER_SIGN_MSG);
  }

  return ALLOW;
}

/**
 * RELEASE
 *
 * Step does: Signed → Released
 * Already done when: Released
 * Rejected: viewable
 * Not reached (Pending, Approved): blocked
 * In progress (Signed): only Release-Engineer can act, others get warning
 */
export function checkReleaseAccess(user: AppUser | null, product: Product): AccessResult {
  const { status } = product;

  // Already done or rejected → anyone can view
  if (status === "Released" || status === "Rejected") {
    return ALLOW;
  }

  // Not reached yet (Pending, Approved) → blocked
  if (status !== "Signed") {
    return BLOCK(ACCESS_MESSAGES.RELEASE_RESTRICTED_TITLE, ACCESS_MESSAGES.RELEASE_NEEDS_SIGNING);
  }

  // In progress (Signed) → check role
  if (!authorizeRelease(user, product)) {
    return WARN(ACCESS_MESSAGES.ROLE_RESTRICTED_TITLE, ACCESS_MESSAGES.RELEASE_ENGINEER_RELEASE_MSG);
  }

  return ALLOW;
}

/**
 * SIGNATURE VERIFICATION
 *
 * Step does: verify Released product
 * Available when: Released
 * Rejected: viewable
 * Not reached (Pending, Approved, Signed): blocked
 * No role restriction
 */
export function checkSignatureVerifyAccess(_user: AppUser | null, product: Product): AccessResult {
  const { status } = product;

  // Available or rejected → anyone can view
  if (status === "Released" || status === "Rejected") {
    return ALLOW;
  }

  // Not reached yet → blocked
  return BLOCK(ACCESS_MESSAGES.VERIFY_RESTRICTED_TITLE, ACCESS_MESSAGES.VERIFY_NEEDS_RELEASE);
}

/* ═══════════════════════════════════════════════════════════════════════
   LOOKUP BY STEP KEY
   ═══════════════════════════════════════════════════════════════════════ */

export function checkStepAccess(stepKey: string, user: AppUser | null, product: Product): AccessResult {
  switch (stepKey) {
    case "security-scan":         return checkSecurityScanAccess(user, product);
    case "cryptographic-signing": return checkCryptoSignAccess(user, product);
    case "releases":              return checkReleaseAccess(user, product);
    case "signature-verify":      return checkSignatureVerifyAccess(user, product);
    default:                      return ALLOW;
  }
}