// src/components/ipfs/IPFSLogViewer.tsx
// Reusable IPFS Log Viewer — click CID chip → full modal popup with logs
// Same style as RepoScanAccordion's IPFS Content Viewer Dialog

import { useState } from "react";
import {
  Box, Stack, Typography, Chip, CircularProgress, Tooltip,
  IconButton, Button, Dialog, DialogTitle, DialogContent, DialogActions,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DownloadIcon from "@mui/icons-material/Download";
import CloseIcon from "@mui/icons-material/Close";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { fetchFromIPFS, getGatewayUrl } from "../../services/ipfsService";

export interface IPFSLogViewerProps {
  /** The IPFS CID to fetch logs from */
  cid: string;
  /** Label to display (e.g. "GPG Verification", "Gitleaks") */
  label: string;
}

/**
 * Reusable IPFS Log Viewer — Chip + Modal Dialog
 * Click the chip → opens a full-screen dialog showing logs fetched from IPFS
 */
export default function IPFSLogViewer({ cid, label }: IPFSLogViewerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!cid) return null;

  const shortCid = cid.length > 16 ? `${cid.slice(0, 8)}…${cid.slice(-6)}` : cid;

  const handleOpen = async () => {
    setDialogOpen(true);
    if (content) return; // Already fetched
    setLoading(true);
    setError(null);
    try {
      const raw = await fetchFromIPFS(cid);
      setContent(raw);
    } catch (err: any) {
      setError(err.message || "Failed to fetch from IPFS");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(content);
  };

  const downloadLog = () => {
    if (!content) return;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${label.replace(/\s+/g, "_")}_log_${cid.slice(0, 8)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Tooltip title={`View ${label} logs from IPFS`}>
        <Chip
          icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
          label={`IPFS: ${shortCid}`}
          size="small"
          color="success"
          variant="outlined"
          onClick={handleOpen}
          onDelete={() => window.open(getGatewayUrl(cid), "_blank")}
          deleteIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
          sx={{ fontFamily: "'Fira Code', monospace", fontSize: "0.7rem", cursor: "pointer", mb: 0.5, mr: 0.5 }}
        />
      </Tooltip>

      {/* ── Full Modal Dialog — same style as RepoScanAccordion ── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ backgroundColor: "#2d2d2d", borderBottom: "1px solid #404040" }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" fontWeight={600}>📄 IPFS Log — {label}</Typography>
            <IconButton onClick={() => setDialogOpen(false)} size="small"><CloseIcon /></IconButton>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "'Fira Code', monospace" }}>
            CID: {cid}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: "#1a1a1a", p: 2, maxHeight: "60vh", overflow: "auto",
          "&::-webkit-scrollbar": { width: "8px" },
          "&::-webkit-scrollbar-track": { background: "#2d2d2d" },
          "&::-webkit-scrollbar-thumb": { background: "#555", borderRadius: "4px" },
          "&::-webkit-scrollbar-thumb:hover": { background: "#777" },
        }}>
          {loading ? (
            <Stack alignItems="center" py={4}>
              <CircularProgress size={24} sx={{ color: "#7b5cff" }} />
              <Typography variant="body2" sx={{ mt: 1, color: "text.secondary" }}>Fetching from IPFS…</Typography>
            </Stack>
          ) : error ? (
            <Typography color="error" variant="body2">{error}</Typography>
          ) : (
            <Box sx={{
              fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace",
              fontSize: 12, lineHeight: 1.6, color: "#e0e0e0",
              whiteSpace: "pre-wrap", wordBreak: "break-word",
              mt:1
            }}>
              {content}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ backgroundColor: "#2d2d2d" }}>
          <Button onClick={copyToClipboard} startIcon={<ContentCopyIcon />} size="small">Copy</Button>
          <Button onClick={downloadLog} startIcon={<DownloadIcon />} size="small">Download Log</Button>
          <Button onClick={() => window.open(getGatewayUrl(cid), "_blank")} startIcon={<OpenInNewIcon />} size="small">Open in Gateway</Button>
          <Button onClick={() => setDialogOpen(false)} variant="outlined" size="small">Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
