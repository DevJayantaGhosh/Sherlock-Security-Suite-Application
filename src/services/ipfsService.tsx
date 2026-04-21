// IPFS Service — Kubo (IPFS Desktop) Backend
//
// Requires a running Kubo node (local or remote):
//   VITE_IPFS_RPC_URL      e.g. http://127.0.0.1:5001  (local)
//   VITE_IPFS_GATEWAY_URL  e.g. http://127.0.0.1:8080  (local)
//   or point to a remote Kubo node on the network

// ─── Read env ────────────────────────────────────────────
const VITE_IPFS_RPC_URL =
  import.meta.env.VITE_IPFS_RPC_URL || "http://127.0.0.1:5001";
const VITE_IPFS_GATEWAY_URL =
  import.meta.env.VITE_IPFS_GATEWAY_URL || "http://127.0.0.1:8080";

console.log(`[IPFS] IPFS  -> Kubo (${VITE_IPFS_RPC_URL})`);

// ─── Types ───────────────────────────────────────────────
export interface IPFSUploadResult {
  id: string;
  cid: string;
  ipfsUrl: string;
  gatewayUrl: string;
  publicUrl: string;
  fileName: string;
  size: number;
}

// ─── Internal helpers ────────────────────────────────────
function gatewayUrl(cid: string): string {
  return `${VITE_IPFS_GATEWAY_URL}/ipfs/${cid}`;
}

function publicGatewayUrl(cid: string): string {
  return `https://ipfs.io/ipfs/${cid}`;
}

// ═════════════════════════════════════════════════════════
//  UPLOAD
// ═════════════════════════════════════════════════════════

async function kuboUpload(file: File): Promise<{ cid: string; size: number }> {
  const form = new FormData();
  form.append("file", file, file.name);

  const res = await fetch(`${VITE_IPFS_RPC_URL}/api/v0/add?pin=true`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Kubo upload failed (${res.status}): ${body || res.statusText}`);
  }
  const d = await res.json();
  return { cid: d.Hash, size: parseInt(d.Size, 10) || file.size };
}

/** Upload a File to the Kubo IPFS node. */
export async function uploadFileToIPFS(
  file: File,
  metadata?: { name?: string; product?: string; type?: string },
): Promise<IPFSUploadResult> {
  const displayName = metadata?.name ?? file.name;
  console.log(
    `[IPFS] Uploading "${displayName}" (${(file.size / 1024).toFixed(1)} KB) via Kubo…`,
  );

  const { cid, size } = await kuboUpload(file);

  console.log(`[IPFS]  Pinned — CID: ${cid}`);

  return {
    id: cid,
    cid,
    ipfsUrl: `ipfs://${cid}`,
    gatewayUrl: gatewayUrl(cid),
    publicUrl: publicGatewayUrl(cid),
    fileName: displayName,
    size,
  };
}

/** Upload raw bytes or a text string. */
export async function uploadBytesToIPFS(
  content: Uint8Array | string,
  fileName: string,
  metadata?: { product?: string; type?: string },
): Promise<IPFSUploadResult> {
  let blob: Blob;
  if (typeof content === "string") {
    blob = new Blob([content], { type: "text/plain" });
  } else {
    const buf = new ArrayBuffer(content.byteLength);
    new Uint8Array(buf).set(content);
    blob = new Blob([buf], { type: "application/octet-stream" });
  }
  return uploadFileToIPFS(new File([blob], fileName), {
    name: fileName,
    ...metadata,
  });
}

// ═════════════════════════════════════════════════════════
//  RETRIEVE
// ═════════════════════════════════════════════════════════

/** Gateway URL for a CID (or ipfs:// URI). */
export function getGatewayUrl(cidOrUrl: string): string {
  return gatewayUrl(cidOrUrl.replace(/^ipfs:\/\//, ""));
}

/** Public URL for a CID (or ipfs:// URI). */
export function getPublicUrl(cidOrUrl: string): string {
  return publicGatewayUrl(cidOrUrl.replace(/^ipfs:\/\//, ""));
}

/** Fetch text content from IPFS. */
export async function fetchFromIPFS(cid: string): Promise<string> {
  const res = await fetch(getGatewayUrl(cid));
  if (!res.ok) throw new Error(`IPFS fetch failed (${res.status})`);
  return res.text();
}

/** Fetch raw bytes from IPFS. */
export async function fetchBytesFromIPFS(cid: string): Promise<ArrayBuffer> {
  const res = await fetch(getGatewayUrl(cid));
  if (!res.ok) throw new Error(`IPFS fetch failed (${res.status})`);
  return res.arrayBuffer();
}

// ═════════════════════════════════════════════════════════
//  CONNECTION TEST
// ═════════════════════════════════════════════════════════

export async function testConnection(): Promise<{
  ok: boolean;
  message: string;
  peerId?: string;
}> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 5000);

  try {
    const res = await fetch(`${VITE_IPFS_RPC_URL}/api/v0/id`, {
      method: "POST",
      signal: ac.signal,
    });
    clearTimeout(t);
    if (!res.ok)
      return { ok: false, message: `Kubo node HTTP ${res.status}` };
    const d = await res.json();
    return {
      ok: true,
      message: `Connected to ${d.AgentVersion ?? "Kubo"} at ${VITE_IPFS_RPC_URL}`,
      peerId: d.ID,
    };
  } catch (err: unknown) {
    clearTimeout(t);
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      message: `Cannot reach Kubo at ${VITE_IPFS_RPC_URL}. Is IPFS Desktop running? (${msg})`,
    };
  }
}

// ═════════════════════════════════════════════════════════
//  PIN MANAGEMENT
// ═════════════════════════════════════════════════════════

/** Pin an existing CID on the Kubo node. */
export async function pinCid(cid: string): Promise<void> {
  const c = cid.replace(/^ipfs:\/\//, "");

  const res = await fetch(
    `${VITE_IPFS_RPC_URL}/api/v0/pin/add?arg=${encodeURIComponent(c)}`,
    { method: "POST" },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Kubo pin failed (${res.status}): ${body || res.statusText}`);
  }
}

/** List pinned CIDs. */
export async function listPins(): Promise<string[]> {
  const res = await fetch(`${VITE_IPFS_RPC_URL}/api/v0/pin/ls?type=recursive`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Kubo list pins failed (${res.status})`);
  const d = await res.json();
  return Object.keys(d.Keys || {});
}

// ═════════════════════════════════════════════════════════
//  INFO
// ═════════════════════════════════════════════════════════

/** Current backend info for UI display. */
export function getBackendInfo(): {
  mode: "kubo";
  label: string;
  endpoint: string;
} {
  return { mode: "kubo", label: "Kubo (IPFS Desktop)", endpoint: VITE_IPFS_RPC_URL };
}