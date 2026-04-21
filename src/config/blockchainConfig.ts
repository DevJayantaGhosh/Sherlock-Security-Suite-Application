/**
 * Blockchain Configuration — Hedera Testnet
 * Used by blockchainService.ts to interact with the ProductRegistry contract.
 */

import ProductRegistryABI from "./ProductRegistryABI.json";

// ── Contract ────────────────────────────────────────────
export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS as string;
export const HEDERA_RPC_URL = import.meta.env.VITE_HEDERA_RPC_URL as string;
export const SERVICE_PRIVATE_KEY = import.meta.env.VITE_SERVICE_ACCOUNT_PRIVATE_KEY as string;

// ── ABI ─────────────────────────────────────────────────
export const PRODUCT_REGISTRY_ABI = ProductRegistryABI;

// ── Hedera Testnet Chain Info ───────────────────────────
export const HEDERA_TESTNET = {
  chainId: 296,
  chainIdHex: "0x128",
  name: "Hedera Testnet",
  explorerUrl: "https://hashscan.io/testnet",
  rpcUrl: HEDERA_RPC_URL || "https://testnet.hashio.io/api",
};

// ── Step Enum (mirrors Solidity) ───────────────────────
export enum ContractStep {
  SCAN = 0,
  RELEASE = 1,
  SIGN = 2,
}

// ── Step Display Config ────────────────────────────────
export const STEP_CONFIG = {
  SCAN: {
    contractStep: ContractStep.SCAN,
    icon: "🔶",
    title: "Scan Provenance — Blockchain Inscription",
    color: "#ff9800",
    approveButton: "Inscribe Approval on Ledger",
    rejectButton: "Inscribe Rejection on Ledger",
    reportField: "securityScanReportPath" as const,
  },
  RELEASE: {
    contractStep: ContractStep.RELEASE,
    icon: "🟣",
    title: "Release Provenance — Blockchain Inscription",
    color: "#7b5cff",
    approveButton: "Inscribe Release on Ledger",
    rejectButton: "",
    reportField: "releaseReportPath" as const,
  },
  SIGN: {
    contractStep: ContractStep.SIGN,
    icon: "🔷",
    title: "Signing Provenance — Blockchain Inscription",
    color: "#00e5ff",
    approveButton: "Inscribe Signing on Ledger",
    rejectButton: "",
    reportField: "signingReportPath" as const,
  },
} as const;

// ── Helper ──────────────────────────────────────────────
export function getHashScanTxUrl(txHash: string): string {
  return `${HEDERA_TESTNET.explorerUrl}/transaction/${txHash}`;
}

export function getHashScanAccountUrl(address: string): string {
  return `${HEDERA_TESTNET.explorerUrl}/account/${address}`;
}