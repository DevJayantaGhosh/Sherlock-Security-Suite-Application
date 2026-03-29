// IPFS Service — Switchable Backend
//
// Set VITE_IPFS_BACKEND to choose the storage backend:
//
//   "kubo"   (default) — Kubo RPC node, local or remote
//       VITE_IPFS_RPC_URL      e.g. http://127.0.0.1:5001  (local)
//       VITE_IPFS_GATEWAY_URL  e.g. http://127.0.0.1:8080  (local)
//       or point to a remote Kubo node on the network
//
//   "pinata" — Pinata Cloud API, no local node needed
//       VITE_PINATA_JWT            your Pinata JWT token
//       VITE_PINATA_GATEWAY_URL    e.g. https://gateway.pinata.cloud

// ─── Read env ────────────────────────────────────────────
const BACKEND: "kubo" | "pinata" =
  (import.meta.env.VITE_IPFS_BACKEND as string)?.toLowerCase() === "pinata"
    ? "pinata"
    : "kubo";

// Kubo
const VITE_IPFS_RPC_URL =
  import.meta.env.VITE_IPFS_RPC_URL || "http://127.0.0.1:5001";
const VITE_IPFS_GATEWAY_URL =
  import.meta.env.VITE_IPFS_GATEWAY_URL || "http://127.0.0.1:8080";

// Pinata
const VITE_PINATA_JWT = import.meta.env.VITE_PINATA_JWT || "";
const PINATA_API_URL = "https://api.pinata.cloud";
const VITE_PINATA_GATEWAY_URL =
  import.meta.env.VITE_PINATA_GATEWAY_URL || "https://gateway.pinata.cloud";

console.log(
  `[IPFS] IPFS  -> ${ BACKEND === "pinata" ? `Pinata (${VITE_PINATA_GATEWAY_URL})` : `Kubo (${VITE_IPFS_RPC_URL})`}`,
);

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
  return BACKEND === "pinata"
    ? `${VITE_PINATA_GATEWAY_URL}/ipfs/${cid}`
    : `${VITE_IPFS_GATEWAY_URL}/ipfs/${cid}`;
}

function publicGatewayUrl(cid: string): string {
  return BACKEND === "pinata"
    ? `${VITE_PINATA_GATEWAY_URL}/ipfs/${cid}`
    : `https://ipfs.io/ipfs/${cid}`;
}

function pinataHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${VITE_PINATA_JWT}` };
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

async function pinataUpload(
  file: File,
  displayName: string,
): Promise<{ cid: string; size: number }> {
  const form = new FormData();
  form.append("file", file, file.name);
  form.append("pinataMetadata", JSON.stringify({ name: displayName }));

  const res = await fetch(`${PINATA_API_URL}/pinning/pinFileToIPFS`, {
    method: "POST",
    headers: pinataHeaders(),
    body: form,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Pinata upload failed (${res.status}): ${body || res.statusText}`);
  }
  const d = await res.json();
  return { cid: d.IpfsHash, size: d.PinSize || file.size };
}

/** Upload a File to the configured IPFS backend. */
export async function uploadFileToIPFS(
  file: File,
  metadata?: { name?: string; product?: string; type?: string },
): Promise<IPFSUploadResult> {
  const displayName = metadata?.name ?? file.name;
  console.log(
    `[IPFS] Uploading "${displayName}" (${(file.size / 1024).toFixed(1)} KB) via ${BACKEND}…`,
  );

  const { cid, size } =
    BACKEND === "pinata"
      ? await pinataUpload(file, displayName)
      : await kuboUpload(file);

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
    if (BACKEND === "pinata") {
      const res = await fetch(`${PINATA_API_URL}/data/testAuthentication`, {
        headers: pinataHeaders(),
        signal: ac.signal,
      });
      clearTimeout(t);
      if (!res.ok)
        return { ok: false, message: `Pinata auth failed (${res.status})` };
      return {
        ok: true,
        message: `Connected to Pinata Cloud (${VITE_PINATA_GATEWAY_URL})`,
      };
    }

    // Kubo
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
      message:
        BACKEND === "pinata"
          ? `Cannot reach Pinata (${msg})`
          : `Cannot reach Kubo at ${VITE_IPFS_RPC_URL}. Is IPFS Desktop running? (${msg})`,
    };
  }
}

// ═════════════════════════════════════════════════════════
//  PIN MANAGEMENT
// ═════════════════════════════════════════════════════════

/** Pin an existing CID on the backend. */
export async function pinCid(cid: string): Promise<void> {
  const c = cid.replace(/^ipfs:\/\//, "");

  if (BACKEND === "pinata") {
    const res = await fetch(`${PINATA_API_URL}/pinning/pinByHash`, {
      method: "POST",
      headers: { ...pinataHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ hashToPin: c }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Pinata pin failed (${res.status}): ${body || res.statusText}`);
    }
    return;
  }

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
  if (BACKEND === "pinata") {
    const res = await fetch(
      `${PINATA_API_URL}/data/pinList?status=pinned&pageLimit=100`,
      { headers: pinataHeaders() },
    );
    if (!res.ok) throw new Error(`Pinata list failed (${res.status})`);
    const d = await res.json();
    return (d.rows || []).map((r: { ipfs_pin_hash: string }) => r.ipfs_pin_hash);
  }

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
  mode: "kubo" | "pinata";
  label: string;
  endpoint: string;
} {
  return BACKEND === "pinata"
    ? { mode: "pinata", label: "Pinata Cloud", endpoint: VITE_PINATA_GATEWAY_URL }
    : { mode: "kubo", label: "Kubo (IPFS Desktop)", endpoint: VITE_IPFS_RPC_URL };
}