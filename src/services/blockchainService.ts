/**
 * Blockchain Service — ProductRegistry Smart Contract Interactions
 *
 * Uses ethers.js with a server-side wallet (private key from .env)
 * to interact with the ProductRegistry contract on Hedera Testnet.
 *
 * Follows the same { data, error } pattern as userService.ts.
 * Components call useToast() to display errors from the returned ApiError.
 */

import { ethers } from "ethers";
import {
  CONTRACT_ADDRESS,
  HEDERA_RPC_URL,
  SERVICE_PRIVATE_KEY,
  PRODUCT_REGISTRY_ABI,
  ContractStage,
  getHashScanTxUrl,
} from "../config/blockchainConfig";
import { Product } from "../models/Product";
import { ApiError } from "../config/ApiError";

// ── Types ───────────────────────────────────────────────

export interface ProductSnapshot {
  productId: string;
  name: string;
  version: string;
  isOpenSource: boolean;
  description: string;
  productDirector: string;
  securityHead: string;
  releaseEngineers: string;
  reposJson: string;
  dependencies: string;
  status: string;
  remark: string;
  stage: number;
  signatureFileIPFS: string;
  publicKeyFileIPFS: string;
  createdBy: string;
  timestamp: bigint;
  recordedBy: string;
}

export interface InscriptionResult {
  txHash: string;
  hashScanUrl: string;
  walletAddress: string;
  blockNumber: number;
  gasUsed: string;
}

// ── Error Helper ────────────────────────────────────────

function extractRevertReason(error: any): string | null {
  // 1. Try to decode raw revert data FIRST (most reliable)
  //    0x08c379a2 = Error(string) selector
  const rawData = error?.data || error?.error?.data || error?.info?.error?.data;
  if (typeof rawData === "string" && rawData.length > 10) {
    if (rawData.startsWith("0x08c379a2")) {
      try {
        const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
          ["string"],
          "0x" + rawData.slice(10),
        );
        if (decoded[0]) return decoded[0];
      } catch { /* ignore */ }
    }
    // Custom error — show first 40 chars of hex data so user sees something useful
    if (rawData.startsWith("0x") && rawData.length > 10) {
      return `Custom contract error (data: ${rawData.slice(0, 42)}${rawData.length > 42 ? "…" : ""})`;
    }
  }

  // 2. ethers v6: error.revert?.args (decoded custom error)
  if (error?.revert?.name) {
    const args = error.revert.args?.length ? `: ${error.revert.args.join(", ")}` : "";
    return `${error.revert.name}${args}`;
  }

  // 3. ethers v6: error.reason (but filter out ethers' internal boilerplate)
  if (error?.reason && typeof error.reason === "string") {
    const r = error.reason;
    // Skip generic/internal ethers reasons
    if (r !== "unknown" && !r.startsWith("could not") && !r.startsWith("missing") && r.length > 2) {
      return r;
    }
  }

  // 4. ethers v6: error.shortMessage (human-readable summary)
  if (error?.shortMessage && typeof error.shortMessage === "string") {
    return error.shortMessage;
  }

  // 5. Nested JSON-RPC error messages
  const nested =
    error?.info?.error?.data?.message ||
    error?.info?.error?.message ||
    error?.error?.data?.message ||
    error?.error?.message;
  if (nested && typeof nested === "string" && nested.length > 5) {
    return nested;
  }

  // 6. Parse from stringified message with regex patterns
  const msg = error?.message || "";

  // Pattern: reason="Some reason here"
  const reasonQuote = msg.match(/reason="([^"]+)"/);
  if (reasonQuote) return reasonQuote[1];

  // Pattern: reverted with reason string 'Some reason'
  const revertedWith = msg.match(/reverted with reason string '([^']+)'/);
  if (revertedWith) return revertedWith[1];

  // Pattern: execution reverted: "Some reason" (but NOT followed by (action=...))
  const execReverted = msg.match(/execution reverted:\s*"([^"]+)"/i);
  if (execReverted) return execReverted[1].trim();

  return null;
}

function createBlockchainError(error: unknown, defaultMessage: string): ApiError {
  if (error instanceof Error) {
    const msg = error.message || defaultMessage;

    if (msg.includes("insufficient funds")) {
      return { message: "Insufficient HBAR balance in service wallet. Please fund the account." };
    }

    if (msg.includes("execution reverted") || msg.includes("CALL_EXCEPTION") || msg.includes("revert")) {
      const reason = extractRevertReason(error);
      return { message: reason ? `Contract error: ${reason}` : `Contract error: Transaction reverted — ${msg.length > 300 ? msg.substring(0, 300) + "…" : msg}` };
    }

    if (msg.includes("ECONNREFUSED") || msg.includes("network") || msg.includes("timeout")) {
      return { message: "Unable to connect to Hedera Testnet. Check your internet connection." };
    }
    if (msg.includes("VITE_SERVICE_PRIVATE_KEY")) {
      return { message: "Service wallet not configured. Set VITE_SERVICE_PRIVATE_KEY in .env" };
    }
    if (msg.includes("VITE_CONTRACT_ADDRESS")) {
      return { message: "Contract address not configured. Set VITE_CONTRACT_ADDRESS in .env" };
    }

    return { message: msg.length > 300 ? msg.substring(0, 300) + "…" : msg };
  }

  // Handle non-Error objects (ethers sometimes throws plain objects)
  if (typeof error === "object" && error !== null) {
    const reason = extractRevertReason(error);
    if (reason) return { message: `Contract error: ${reason}` };
  }

  return { message: defaultMessage };
}

// ── Singleton Instances ─────────────────────────────────

let _provider: ethers.JsonRpcProvider | null = null;
let _wallet: ethers.Wallet | null = null;
let _contract: ethers.Contract | null = null;
let _readOnlyContract: ethers.Contract | null = null;

function getProvider(): ethers.JsonRpcProvider {
  if (!_provider) {
    const rpcUrl = HEDERA_RPC_URL || "https://testnet.hashio.io/api";
    _provider = new ethers.JsonRpcProvider(rpcUrl);
  }
  return _provider;
}

function getWallet(): ethers.Wallet {
  if (!_wallet) {
    if (!SERVICE_PRIVATE_KEY) {
      throw new Error("VITE_SERVICE_PRIVATE_KEY not configured in .env");
    }
    _wallet = new ethers.Wallet(SERVICE_PRIVATE_KEY, getProvider());
  }
  return _wallet;
}

function getContract(): ethers.Contract {
  if (!_contract) {
    if (!CONTRACT_ADDRESS) {
      throw new Error("VITE_CONTRACT_ADDRESS not configured in .env");
    }
    _contract = new ethers.Contract(CONTRACT_ADDRESS, PRODUCT_REGISTRY_ABI, getWallet());
  }
  return _contract;
}

function getReadOnlyContract(): ethers.Contract {
  if (!_readOnlyContract) {
    if (!CONTRACT_ADDRESS) {
      throw new Error("VITE_CONTRACT_ADDRESS not configured in .env");
    }
    _readOnlyContract = new ethers.Contract(CONTRACT_ADDRESS, PRODUCT_REGISTRY_ABI, getProvider());
  }
  return _readOnlyContract;
}

// ── Connect Wallet ──────────────────────────────────────

/**
 * "Connects" the service wallet — loads private key from .env,
 * derives address, verifies RPC connectivity.
 */
export async function connectServiceWallet(): Promise<{ data: string; error: ApiError | null }> {
  try {
    const wallet = getWallet();
    const address = await wallet.getAddress();

    // Verify RPC connectivity
    const provider = getProvider();
    const network = await provider.getNetwork();
    console.log(`[Blockchain] Connected to ${network.name} (chainId: ${network.chainId})`);
    console.log(`[Blockchain] Service wallet: ${address}`);

    return { data: address, error: null };
  } catch (error) {
    return { data: "", error: createBlockchainError(error, "Failed to connect service wallet") };
  }
}

// ── Build Snapshot ──────────────────────────────────────

/**
 * Build a ProductSnapshot struct from the Product model.
 */
/**
 * Strip scan logs from repos to keep blockchain payload small.
 * Only stores: repoUrl, branch, and scan summaries (no logs[]).
 */
function trimReposForChain(repos: Product["repos"]): string {
  if (!repos || repos.length === 0) return "[]";

  const trimmed = repos.map((r) => ({
    repoUrl: r.repoUrl,
    branch: r.branch,
    scans: r.scans
      ? {
          signatureVerification: r.scans.signatureVerification
            ? { status: r.scans.signatureVerification.status, summary: r.scans.signatureVerification.summary }
            : undefined,
          secretLeakDetection: r.scans.secretLeakDetection
            ? { status: r.scans.secretLeakDetection.status, summary: r.scans.secretLeakDetection.summary }
            : undefined,
          vulnerabilityScan: r.scans.vulnerabilityScan
            ? { status: r.scans.vulnerabilityScan.status, summary: r.scans.vulnerabilityScan.summary }
            : undefined,
        }
      : undefined,
  }));

  return JSON.stringify(trimmed);
}

export function buildProductSnapshot(
  product: Product,
  stage: ContractStage,
  status: string,
  createdBy: string,
  remark?: string,
  signatureFileIPFS?: string,
  publicKeyFileIPFS?: string,
): ProductSnapshot {
  return {
    productId: product.id,
    name: product.name,
    version: product.version,
    isOpenSource: product.isOpenSource ?? false,
    description: (product.description || "").slice(0, 300),
    productDirector: product.productDirector || "",
    securityHead: product.securityHead || "",
    releaseEngineers: Array.isArray(product.releaseEngineers)
      ? product.releaseEngineers.join(",")
      : "",
    reposJson: trimReposForChain(product.repos),
    dependencies: Array.isArray(product.dependencies)
      ? product.dependencies.join(",")
      : "",
    status,
    remark: (remark || "").slice(0, 500),
    stage,
    signatureFileIPFS: signatureFileIPFS || "",
    publicKeyFileIPFS: publicKeyFileIPFS || "",
    createdBy,
    timestamp: BigInt(0), // Set by contract
    recordedBy: ethers.ZeroAddress, // Set by contract
  };
}

// ── Inscribe on Ledger ──────────────────────────────────

/**
 * Record a ProductSnapshot on the blockchain.
 * Calls contract.recordProduct(snapshot) and waits for the receipt.
 */
export async function inscribeOnLedger(
  snapshot: ProductSnapshot,
): Promise<{ data: InscriptionResult; error: ApiError | null }> {
  try {
    const contract = getContract();
    const readContract = getReadOnlyContract();
    const wallet = getWallet();
    const walletAddress = await wallet.getAddress();

    console.log(
      `[Blockchain] Inscribing product "${snapshot.name}" (stage=${snapshot.stage}, status=${snapshot.status})`,
    );

    // ── Pre-flight validation ──────────────────────────
    // Hedera JSON-RPC relay does NOT return Solidity revert reasons,
    // so we read on-chain state and validate locally to give clear errors.
    try {
      const currentCount = Number(await readContract.getSnapshotCount(snapshot.productId));
      console.log(`[Blockchain] Pre-flight: snapshotCount for "${snapshot.productId}" = ${currentCount}`);

      // R9: Max 3 snapshots
      if (currentCount >= 3) {
        return {
          data: {} as InscriptionResult,
          error: { message: "This product already has all 3 blockchain records (SCAN → RELEASE → SIGN). No further inscriptions allowed." },
        };
      }

      // R11: If first snapshot was Rejected, block everything
      if (currentCount > 0) {
        try {
          const firstSnap = await readContract.getSnapshot(snapshot.productId, 0);
          if (firstSnap.status === "Rejected") {
            return {
              data: {} as InscriptionResult,
              error: { message: "This product was previously rejected at the SCAN stage. No further blockchain inscriptions are allowed." },
            };
          }
        } catch { /* ignore read error, let the contract enforce */ }
      }

      // R5: Stage ordering — count 0→SCAN, 1→RELEASE, 2→SIGN
      const expectedStage = currentCount; // 0=SCAN, 1=RELEASE, 2=SIGN
      const stageNames = ["SCAN", "RELEASE", "SIGN"];
      if (snapshot.stage !== expectedStage) {
        const expected = stageNames[expectedStage] || `stage ${expectedStage}`;
        const actual = stageNames[snapshot.stage] || `stage ${snapshot.stage}`;
        return {
          data: {} as InscriptionResult,
          error: {
            message: `Stage mismatch: This product has ${currentCount} record(s) on-chain, so the next inscription must be ${expected} (stage ${expectedStage}), but you are trying to inscribe ${actual} (stage ${snapshot.stage}).`,
          },
        };
      }

      // R8: Status must match stage
      const validStatuses: Record<number, string[]> = {
        0: ["Approved", "Rejected"],
        1: ["Released"],
        2: ["Signed"],
      };
      const allowed = validStatuses[snapshot.stage];
      if (allowed && !allowed.includes(snapshot.status)) {
        return {
          data: {} as InscriptionResult,
          error: {
            message: `Invalid status "${snapshot.status}" for ${stageNames[snapshot.stage]} stage. Allowed: ${allowed.join(", ")}.`,
          },
        };
      }

      // R6/R7: IPFS file rules
      if (snapshot.stage === 2) {
        if (!snapshot.signatureFileIPFS || !snapshot.publicKeyFileIPFS) {
          return {
            data: {} as InscriptionResult,
            error: { message: "SIGN stage requires both signatureFileIPFS and publicKeyFileIPFS." },
          };
        }
      } else {
        if (snapshot.signatureFileIPFS || snapshot.publicKeyFileIPFS) {
          return {
            data: {} as InscriptionResult,
            error: { message: `${stageNames[snapshot.stage]} stage must NOT include IPFS signing artifacts.` },
          };
        }
      }

      // R10: Check if wallet is a service account
      try {
        const isService = await readContract.serviceAccounts(walletAddress);
        if (!isService) {
          return {
            data: {} as InscriptionResult,
            error: { message: `Wallet ${walletAddress.slice(0, 10)}… is not registered as a service account on the contract. Ask the contract owner to call addServiceAccount().` },
          };
        }
      } catch { /* ignore — let the contract enforce */ }

      // R1-R4: Required fields
      if (!snapshot.productId) return { data: {} as InscriptionResult, error: { message: "productId is required for blockchain inscription." } };
      if (!snapshot.name) return { data: {} as InscriptionResult, error: { message: "Product name is required for blockchain inscription." } };
      if (!snapshot.version) return { data: {} as InscriptionResult, error: { message: "Product version is required for blockchain inscription." } };
      if (!snapshot.reposJson || snapshot.reposJson === "[]") return { data: {} as InscriptionResult, error: { message: "At least one repository is required for blockchain inscription." } };

      console.log("[Blockchain] Pre-flight validation passed ✓");
    } catch (prefErr) {
      // If pre-flight reads fail (network issue), log and proceed — let the tx itself fail
      console.warn("[Blockchain] Pre-flight validation skipped (read error):", prefErr);
    }

    // ── Build tuple & send transaction ─────────────────
    const snapshotTuple = [
      snapshot.productId,
      snapshot.name,
      snapshot.version,
      snapshot.isOpenSource,
      snapshot.description,
      snapshot.productDirector,
      snapshot.securityHead,
      snapshot.releaseEngineers,
      snapshot.reposJson,
      snapshot.dependencies,
      snapshot.status,
      snapshot.remark,
      snapshot.stage,
      snapshot.signatureFileIPFS,
      snapshot.publicKeyFileIPFS,
      snapshot.createdBy,
      snapshot.timestamp,
      snapshot.recordedBy,
    ];

    // Send transaction
    const tx = await contract.recordProduct(snapshotTuple, {
      gasLimit: 3000000,
    });

    console.log(`[Blockchain] Transaction sent: ${tx.hash}`);

    // Wait for confirmation
    const receipt = await tx.wait();

    console.log(`[Blockchain] Transaction confirmed in block ${receipt.blockNumber}`);

    return {
      data: {
        txHash: receipt.hash,
        hashScanUrl: getHashScanTxUrl(receipt.hash),
        walletAddress,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      },
      error: null,
    };
  } catch (error: any) {
    console.error("[Blockchain] inscribeOnLedger failed:", error);
    console.error("[Blockchain] error.reason:", error?.reason);
    console.error("[Blockchain] error.revert:", error?.revert);
    console.error("[Blockchain] error.info:", error?.info);
    console.error("[Blockchain] error.data:", error?.data);
    return {
      data: {} as InscriptionResult,
      error: createBlockchainError(error, "Failed to inscribe product on blockchain"),
    };
  }
}

// ── Read Operations ─────────────────────────────────────

/**
 * Get all snapshots for a product from the blockchain.
 */
export async function getProductSnapshots(
  productId: string,
): Promise<{ data: ProductSnapshot[]; error: ApiError | null }> {
  try {
    const contract = getReadOnlyContract();
    const rawSnapshots = await contract.getAllSnapshotsByProductId(productId);

    const snapshots: ProductSnapshot[] = rawSnapshots.map((s: any) => ({
      productId: s.productId,
      name: s.name,
      version: s.version,
      isOpenSource: s.isOpenSource,
      description: s.description,
      productDirector: s.productDirector,
      securityHead: s.securityHead,
      releaseEngineers: s.releaseEngineers,
      reposJson: s.reposJson,
      dependencies: s.dependencies,
      status: s.status,
      remark: s.remark,
      stage: Number(s.stage),
      signatureFileIPFS: s.signatureFileIPFS,
      publicKeyFileIPFS: s.publicKeyFileIPFS,
      createdBy: s.createdBy,
      timestamp: s.timestamp,
      recordedBy: s.recordedBy,
    }));

    return { data: snapshots, error: null };
  } catch (error) {
    return { data: [], error: createBlockchainError(error, "Failed to fetch product snapshots from blockchain") };
  }
}

/**
 * Get snapshot count for a product.
 */
export async function getSnapshotCount(
  productId: string,
): Promise<{ data: number; error: ApiError | null }> {
  try {
    const contract = getReadOnlyContract();
    const count = await contract.getSnapshotCount(productId);
    return { data: Number(count), error: null };
  } catch (error) {
    return { data: 0, error: createBlockchainError(error, "Failed to get snapshot count") };
  }
}

/**
 * Get a single snapshot by product ID and index.
 */
export async function getSnapshot(
  productId: string,
  index: number,
): Promise<{ data: ProductSnapshot | null; error: ApiError | null }> {
  try {
    const contract = getReadOnlyContract();
    const s = await contract.getSnapshot(productId, index);
    return {
      data: {
        productId: s.productId,
        name: s.name,
        version: s.version,
        isOpenSource: s.isOpenSource,
        description: s.description,
        productDirector: s.productDirector,
        securityHead: s.securityHead,
        releaseEngineers: s.releaseEngineers,
        reposJson: s.reposJson,
        dependencies: s.dependencies,
        status: s.status,
        remark: s.remark,
        stage: Number(s.stage),
        signatureFileIPFS: s.signatureFileIPFS,
        publicKeyFileIPFS: s.publicKeyFileIPFS,
        createdBy: s.createdBy,
        timestamp: s.timestamp,
        recordedBy: s.recordedBy,
      },
      error: null,
    };
  } catch (error) {
    return { data: null, error: createBlockchainError(error, "Failed to get snapshot") };
  }
}

// ── Service Account Management ──────────────────────────

export interface ServiceAccount {
  address: string;
  isActive: boolean;
  txHash?: string;      // hash of the add/toggle transaction (stored client-side)
  hashScanUrl?: string; // HashScan link for the tx
}

/**
 * Get all service accounts from the on-chain array (getAllServiceAccounts),
 * then check each address's active status via the serviceAccounts mapping.
 * No event scanning needed — avoids Hedera's 7-day block range limit.
 */
export async function getServiceAccounts(): Promise<{
  data: ServiceAccount[];
  error: ApiError | null;
}> {
  try {
    const contract = getReadOnlyContract();

    // Read the on-chain enumerable list
    const addresses: string[] = await contract.getAllServiceAccounts();

    // Check active status for each
    const accounts: ServiceAccount[] = [];
    for (const addr of addresses) {
      try {
        const isActive: boolean = await contract.serviceAccounts(addr);
        accounts.push({
          address: ethers.getAddress(addr), // checksum format
          isActive,
        });
      } catch {
        accounts.push({
          address: ethers.getAddress(addr),
          isActive: false,
        });
      }
    }

    return { data: accounts, error: null };
  } catch (error) {
    return {
      data: [],
      error: createBlockchainError(error, "Failed to fetch service accounts"),
    };
  }
}

/**
 * Check if a specific address is a service account.
 */
export async function checkServiceAccount(
  address: string
): Promise<{ data: boolean; error: ApiError | null }> {
  try {
    const contract = getReadOnlyContract();
    const isActive = await contract.serviceAccounts(address);
    return { data: isActive, error: null };
  } catch (error) {
    return {
      data: false,
      error: createBlockchainError(error, "Failed to check service account status"),
    };
  }
}

/**
 * Add a new service account (enable an address). Only contract owner can call.
 */
export async function addServiceAccountOnChain(
  address: string
): Promise<{ data: { txHash: string; hashScanUrl: string } | null; error: ApiError | null }> {
  try {
    if (!ethers.isAddress(address)) {
      return { data: null, error: { message: "Invalid Ethereum/Hedera address" } };
    }

    const contract = getContract();
    const tx = await contract.addServiceAccount(address, { gasLimit: 300000 });
    console.log(`[Blockchain] addServiceAccount tx sent: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`[Blockchain] addServiceAccount confirmed in block ${receipt.blockNumber}`);

    return {
      data: {
        txHash: receipt.hash,
        hashScanUrl: getHashScanTxUrl(receipt.hash),
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: createBlockchainError(error, "Failed to add service account"),
    };
  }
}

/**
 * Disable a service account (removeServiceAccount sets mapping to false).
 * Only contract owner can call.
 */
export async function disableServiceAccountOnChain(
  address: string
): Promise<{ data: { txHash: string; hashScanUrl: string } | null; error: ApiError | null }> {
  try {
    if (!ethers.isAddress(address)) {
      return { data: null, error: { message: "Invalid Ethereum/Hedera address" } };
    }

    const contract = getContract();
    const tx = await contract.removeServiceAccount(address, { gasLimit: 300000 });
    console.log(`[Blockchain] removeServiceAccount tx sent: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`[Blockchain] removeServiceAccount confirmed in block ${receipt.blockNumber}`);

    return {
      data: {
        txHash: receipt.hash,
        hashScanUrl: getHashScanTxUrl(receipt.hash),
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: createBlockchainError(error, "Failed to disable service account"),
    };
  }
}

/**
 * Enable a previously disabled service account (re-add it).
 * Only contract owner can call.
 */
export async function enableServiceAccountOnChain(
  address: string
): Promise<{ data: { txHash: string; hashScanUrl: string } | null; error: ApiError | null }> {
  // addServiceAccount can be called again to re-enable
  return addServiceAccountOnChain(address);
}

// ── Utility ─────────────────────────────────────────────

/**
 * Format a blockchain timestamp (bigint seconds) to a human-readable string.
 */
export function formatBlockchainTimestamp(timestamp: bigint): string {
  if (!timestamp || timestamp === BigInt(0)) return "—";
  const date = new Date(Number(timestamp) * 1000);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
}

/**
 * Shorten an Ethereum address for display.
 */
export function shortenAddress(address: string): string {
  if (!address || address.length < 10) return address || "—";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Map stage number to stage name.
 */
export function getStageName(stage: number): string {
  switch (stage) {
    case 0:
      return "SCAN";
    case 1:
      return "RELEASE";
    case 2:
      return "SIGN";
    default:
      return `UNKNOWN(${stage})`;
  }
}
