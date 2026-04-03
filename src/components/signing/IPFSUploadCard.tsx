/**
 * IPFSUploadCard — Uploads signature & public-key files to IPFS via Pinata,
 * then persists the resulting CIDs on the Product record.
 *
 */
import { useState, useCallback } from "react";
import {
  Button, Paper, Stack, Typography, TextField,
  IconButton, Chip, Tooltip, CircularProgress, Alert,
} from "@mui/material";
import { motion, Variants } from "framer-motion";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import FingerprintIcon from "@mui/icons-material/Fingerprint";
import StorageIcon from "@mui/icons-material/Storage";

import { Product } from "../../models/Product";
import { updateProduct } from "../../services/productService";
import { uploadFileToIPFS, getGatewayUrl, IPFSUploadResult } from "../../services/ipfsService";
import { useToast } from "../ToastProvider";

/* ────────────────────────────────────────────────────────────
 *  Props
 * ──────────────────────────────────────────────────────────── */
interface IPFSUploadCardProps {
  variants: Variants;
  product: Product;
  disabled: boolean;
  toolTip: string;
  borderColor?: string;
  onUploadComplete?: () => void;          // callback after DB save
}

/* ────────────────────────────────────────────────────────────
 *  Helpers
 * ──────────────────────────────────────────────────────────── */
function openFilePicker(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.display = "none";
    input.onchange = () => {
      const file = input.files?.[0] ?? null;
      resolve(file);
    };
    input.oncancel = () => resolve(null);
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  });
}

/* ════════════════════════════════════════════════════════════
 *  Component
 * ════════════════════════════════════════════════════════════ */
export default function IPFSUploadCard({
  variants,
  product,
  disabled,
  toolTip,
  borderColor = "#00e5ff",
  onUploadComplete,
}: IPFSUploadCardProps) {
  const toast = useToast();

  /* ── Public Key state ── */
  const [pkFile, setPkFile] = useState<File | null>(null);
  const [pkCid, setPkCid] = useState(product.publicKeyFilePath || "");
  const [pkUploading, setPkUploading] = useState(false);

  /* ── Signature state ── */
  const [sigFile, setSigFile] = useState<File | null>(null);
  const [sigCid, setSigCid] = useState(product.signatureFilePath || "");
  const [sigUploading, setSigUploading] = useState(false);

  const [err, setErr] = useState<string | null>(null);

  /* ── File selection ── */
  const selectPK = useCallback(async () => {
    if (disabled) { toast(toolTip || "View-only", "warning"); return; }
    const f = await openFilePicker(".pub,.pem,.key,.txt,.asc");
    if (f) { setPkFile(f); toast(`Selected: ${f.name}`, "success"); }
  }, [disabled, toolTip, toast]);

  const selectSig = useCallback(async () => {
    if (disabled) { toast(toolTip || "View-only", "warning"); return; }
    const f = await openFilePicker(".sig,.gpg,.asc,.txt,.bin");
    if (f) { setSigFile(f); toast(`Selected: ${f.name}`, "success"); }
  }, [disabled, toolTip, toast]);

  /* ── Upload to Pinata + save CID to DB ── */
  const uploadAndSave = useCallback(async (
    file: File,
    type: "publickey" | "signature",
    setUploading: (v: boolean) => void,
    setCid: (v: string) => void,
  ) => {
    if (disabled) { toast(toolTip || "View-only", "warning"); return; }
    setUploading(true); setErr(null);
    try {
      const result: IPFSUploadResult = await uploadFileToIPFS(file, {
        name: file.name,
        product: product.name,
        type,
      });

      const ipfsUrl = result.ipfsUrl;        // ipfs://bafy…
      setCid(ipfsUrl);

      // Build update with BOTH fields — use latest local state for the other field
      const updatedProduct: Product = {
        ...product,
        publicKeyFilePath: type === "publickey" ? ipfsUrl : (pkCid || product.publicKeyFilePath || ""),
        signatureFilePath: type === "signature" ? ipfsUrl : (sigCid || product.signatureFilePath || ""),
      };

      const { error } = await updateProduct(updatedProduct);
      if (error) {
        toast(`IPFS OK but DB save failed: ${error.message}`, "warning");
      } else {
        toast(`${type === "publickey" ? "Public key" : "Signature"} uploaded → ${result.cid.slice(0, 12)}…`, "success");
      }

      if (onUploadComplete) onUploadComplete();
    } catch (e: any) {
      const msg = e.message || "Upload failed";
      setErr(msg);
      toast(msg, "error");
    } finally {
      setUploading(false);
    }
  }, [disabled, toolTip, toast, product, pkCid, sigCid, onUploadComplete]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast("Copied to clipboard", "success");
  };

  /* ══════════ RENDER ══════════ */
  const bothDone = !!pkCid && !!sigCid;

  return (
    <motion.div variants={variants}>
      <Paper sx={{ p: 3, borderLeft: `4px solid ${borderColor}`, borderRadius: 1, mb: 3 }}>
        <Typography variant="h6" fontWeight={700} gutterBottom display="flex" alignItems="center" gap={1}>
          <StorageIcon sx={{ color: borderColor, fontSize: 24 }} />
          IPFS Artifact Upload
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          Upload the signing artifacts (public key &amp; signature) to IPFS via Pinata for immutable storage.
          These CIDs will be inscribed on the blockchain in the next step.
        </Typography>

        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}

        {bothDone && (
          <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 2 }}>
            Both artifacts uploaded to IPFS. Proceed to Blockchain Inscription.
          </Alert>
        )}

        {/* ── Public Key Section ── */}
        <Paper sx={{ p: 2.5, mb: 3, bgcolor: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 2 }}>
          <Stack direction="row" spacing={0.5} alignItems="center" mb={1.5}>
            <VpnKeyIcon sx={{ fontSize: 18, color: borderColor }} />
            <Typography variant="subtitle1" fontWeight={700}>Public Key</Typography>
            {pkCid && <Chip label="Uploaded" color="success" size="small" sx={{ ml: 1 }} />}
          </Stack>

          {pkCid ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: ".82rem", flex: 1, wordBreak: "break-all" }}>
                {pkCid}
              </Typography>
              <IconButton size="small" onClick={() => copyToClipboard(pkCid)}><ContentCopyIcon sx={{ fontSize: 16 }} /></IconButton>
              <IconButton size="small" href={getGatewayUrl(pkCid)} target="_blank"><OpenInNewIcon sx={{ fontSize: 16 }} /></IconButton>
            </Stack>
          ) : (
            <Stack direction="row" spacing={2} alignItems="center">
              <TextField
                size="small"
                fullWidth
                label="Select public key file"
                value={pkFile?.name || ""}
                InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <Tooltip title={disabled ? toolTip : ""}><span>
                      <IconButton onClick={selectPK} disabled={disabled || pkUploading} size="small"><FolderOpenIcon /></IconButton>
                    </span></Tooltip>
                  ),
                }}
                disabled={disabled || pkUploading}
              />
              <Tooltip title={disabled ? toolTip : ""}><span>
                <Button
                  variant="outlined"
                  onClick={() => pkFile && uploadAndSave(pkFile, "publickey", setPkUploading, setPkCid)}
                  disabled={!pkFile || pkUploading || disabled}
                  startIcon={pkUploading ? <CircularProgress size={16} color="inherit" /> : <CloudUploadIcon />}
                  sx={{ minWidth: 160, borderColor: borderColor, color: borderColor }}
                >
                  {pkUploading ? "Uploading…" : "Upload to IPFS"}
                </Button>
              </span></Tooltip>
            </Stack>
          )}
        </Paper>

        {/* ── Signature Section ── */}
        <Paper sx={{ p: 2.5, mb: 1, bgcolor: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 2 }}>
          <Stack direction="row" spacing={0.5} alignItems="center" mb={1.5}>
            <FingerprintIcon sx={{ fontSize: 18, color: borderColor }} />
            <Typography variant="subtitle1" fontWeight={700}>Signature File</Typography>
            {sigCid && <Chip label="Uploaded" color="success" size="small" sx={{ ml: 1 }} />}
          </Stack>

          {sigCid ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: ".82rem", flex: 1, wordBreak: "break-all" }}>
                {sigCid}
              </Typography>
              <IconButton size="small" onClick={() => copyToClipboard(sigCid)}><ContentCopyIcon sx={{ fontSize: 16 }} /></IconButton>
              <IconButton size="small" href={getGatewayUrl(sigCid)} target="_blank"><OpenInNewIcon sx={{ fontSize: 16 }} /></IconButton>
            </Stack>
          ) : (
            <Stack direction="row" spacing={2} alignItems="center">
              <TextField
                size="small"
                fullWidth
                label="Select signature file"
                value={sigFile?.name || ""}
                InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <Tooltip title={disabled ? toolTip : ""}><span>
                      <IconButton onClick={selectSig} disabled={disabled || sigUploading} size="small"><FolderOpenIcon /></IconButton>
                    </span></Tooltip>
                  ),
                }}
                disabled={disabled || sigUploading}
              />
              <Tooltip title={disabled ? toolTip : ""}><span>
                <Button
                  variant="outlined"
                  onClick={() => sigFile && uploadAndSave(sigFile, "signature", setSigUploading, setSigCid)}
                  disabled={!sigFile || sigUploading || disabled}
                  startIcon={sigUploading ? <CircularProgress size={16} color="inherit" /> : <CloudUploadIcon />}
                  sx={{ minWidth: 160, borderColor: borderColor, color: borderColor }}
                >
                  {sigUploading ? "Uploading…" : "Upload to IPFS"}
                </Button>
              </span></Tooltip>
            </Stack>
          )}
        </Paper>
      </Paper>
    </motion.div>
  );
}