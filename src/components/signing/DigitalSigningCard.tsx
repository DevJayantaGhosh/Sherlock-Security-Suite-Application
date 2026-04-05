// src/components/signing/DigitalSigningCard.tsx
import { useState, useRef, useEffect } from "react";
import {
  Box, Paper, Stack, Typography, TextField, Button,
  IconButton, InputAdornment, LinearProgress, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Chip, Collapse, Tooltip, Alert
} from "@mui/material";
import { toast } from "react-hot-toast";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import CancelIcon from "@mui/icons-material/Cancel";
import DownloadIcon from "@mui/icons-material/Download";
import CloseIcon from "@mui/icons-material/Close";
import FingerprintIcon from "@mui/icons-material/Fingerprint";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

import { platform } from "../../platform";
import CopyLogButton from "../CopyLogButton";
import AnalyzeLogButton from "../AnalyzeLogButton";
import { RepoDetails } from "../../models/Product";
import { TagBasedRepoDetails } from "../repoconfig/TagBasedRepoConfig";

type ScanStatus = "idle" | "running" | "success" | "failed";

interface DigitalSigningCardProps {
  repoDetails: RepoDetails | TagBasedRepoDetails;
  version: string;
  isQuickScan: boolean;
  githubToken: string;
  disabled: boolean;
  toolTip: string;
  borderColor?: string;
  onFileSelect: () => Promise<string | null>;
}

export default function DigitalSigningCard({
  repoDetails,
  version,
  isQuickScan,
  githubToken,
  disabled = false,
  toolTip = "",
  borderColor = "#00e5ff",
  onFileSelect
}: DigitalSigningCardProps) {
  const isElectron = platform.isElectron;

  const [privateKeyPath, setPrivateKeyPath] = useState("");
  const [signPassword, setSignPassword] = useState("");
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  // Web mode: hold returned signature content for display
  const [signatureContent, setSignatureContent] = useState("");

  const scanIdRef = useRef<string | null>(null);
  const logCleanupRef = useRef<(() => void) | null>(null);
  const completeCleanupRef = useRef<(() => void) | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const logsRef = useRef<string[]>([]);

  // Determine if this is a VerificationRepoDetails (has isLocal field)
  const isTagBasedDetails = "isLocal" in repoDetails;
  const isLocal = isTagBasedDetails ? (repoDetails as TagBasedRepoDetails).isLocal : false;
  const localRepoLocation = isLocal ? repoDetails.repoUrl : "";
  // For TagBasedRepoDetails, use releaseTag as version if not provided externally
  const effectiveVersion = version || (isTagBasedDetails ? (repoDetails as TagBasedRepoDetails).releaseTag || "" : "");
  // Branch: VerificationRepoDetails doesn't have branch, use "main" as fallback
  const branch = "branch" in repoDetails ? (repoDetails as RepoDetails).branch : "main";

  const repoType = isLocal
    ? "Local"
    : repoDetails.repoUrl.includes("github.com")
      ? githubToken ? "Private GitHub" : "Public GitHub"
      : "Local";

  // Auto-scroll logs in modal
  useEffect(() => {
    if (modalOpen && logs.length > 0 && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, modalOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (logCleanupRef.current) logCleanupRef.current();
      if (completeCleanupRef.current) completeCleanupRef.current();
      if (scanIdRef.current) {
        platform.cancelScan({ scanId: scanIdRef.current });
      }
    };
  }, []);

  const handleSelectKeyFile = async () => {
    try {
      const path = await onFileSelect();
      if (path) {
        setPrivateKeyPath(path);
        toast.success("Private key selected");
      }
    } catch (e) {
      toast.error("Failed to select key file");
    }
  };

  const runSigning = async () => {
    if (!repoDetails || !privateKeyPath) {
      toast.error("Please provide private key");
      return;
    }

    const scanId = crypto.randomUUID();
    scanIdRef.current = scanId;

    setLogs([]);
    logsRef.current = [];
    setStatus("running");
    setProgress(0);
    setShowLogs(false);
    setModalOpen(true);
    setSignatureContent("");

    const logCleanup = platform.onScanLog(scanId, (data) => {
      setLogs(prev => [...prev, data.log]);
      logsRef.current.push(data.log);
      setProgress(data.progress || 0);
    });
    logCleanupRef.current = logCleanup;

    const completeCleanup = platform.onScanComplete(scanId, (data) => {
      const newStatus = data.success ? "success" : "failed";
      setStatus(newStatus);
      setProgress(100);

      // Web mode: capture returned signature content
      if (!isElectron && data.signatureContent) {
        setSignatureContent(data.signatureContent);
      }

      cleanupListeners();
    });
    completeCleanupRef.current = completeCleanup;

    try {
      // privateKeyPath holds file path (Electron) or raw PEM content (web)
      await platform.signArtifact({
        repoUrl: repoDetails.repoUrl,
        branch,
        version: effectiveVersion,
        privateKeyPath,
        password: signPassword || undefined,
        isQuickScan,
        localRepoLocation,
        githubToken: githubToken || "",
        scanId
      });
      toast.success("✅ Repository signed successfully!");
    } catch (err: any) {
      if (err.message !== "cancelled") {
        const errorMsg = `\n❌ Error: ${err.message}\n`;
        setLogs(prev => [...prev, errorMsg]);
        logsRef.current.push(errorMsg);
      }
    }
  };

  const cancelScan = async () => {
    if (!scanIdRef.current) return;
    setIsCancelling(true);
    const msg = "\n⏳ Cancelling signing process...\n";
    setLogs(prev => [...prev, msg]);
    logsRef.current.push(msg);

    try {
      await platform.cancelScan({ scanId: scanIdRef.current });
      setStatus("failed");
    } finally {
      cleanupListeners();
      setIsCancelling(false);
      setTimeout(() => setModalOpen(false), 800);
    }
  };

  const cleanupListeners = () => {
    if (logCleanupRef.current) { logCleanupRef.current(); logCleanupRef.current = null; }
    if (completeCleanupRef.current) { completeCleanupRef.current(); completeCleanupRef.current = null; }
    scanIdRef.current = null;
  };

  const downloadLogs = () => {
    const logText = logs.join("\n");
    const blob = new Blob([logText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `digital-signing-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`${label} copied to clipboard`);
    }).catch(() => {
      toast.error(`Failed to copy ${label}`);
    });
  };

  const isRunning = status === "running";
  const canClose = !isRunning && !isCancelling;
  const isButtonDisabled = !privateKeyPath || isRunning || disabled;

  return (
    <>
      <Paper sx={{ p: 3, mt: 4, borderLeft: `4px solid ${borderColor}`, borderRadius: 1 }}>
        <Typography variant="h6" fontWeight={700} gutterBottom display="flex" alignItems="center" gap={1}>
          <FingerprintIcon sx={{ color: borderColor, fontSize: 24 }} /> Digital Signing
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          Process repository and apply cryptographic signature.
          {!isElectron && " Paste your private key PEM content below."}
        </Typography>

        <Stack spacing={3}>
          {/* Repository Info */}
          <Paper sx={{ p: 3, mb: 3, borderRadius: 2, bgcolor: "rgba(255,255,255, 0.02)", border: "1px solid rgba(255,255,255, 0.08)" }}>
            <Typography variant="h6" fontWeight={500} mb={2.5} sx={{ color: borderColor, fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace" }}>
              📂 Repository (1)
            </Typography>
            <Paper sx={{ p: 2, borderRadius: 1, border: `2px solid ${borderColor}30`, bgcolor: `${borderColor}08` }}>
              <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                <Box sx={{ width: 40, height: 40, borderRadius: 1, bgcolor: `${borderColor}20`, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${borderColor}` }}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ color: borderColor, fontSize: "1rem" }}>1</Typography>
                </Box>
                <Box sx={{ flex: 1, minWidth: 200 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace" }}>
                    Repository{repoDetails.repoUrl.includes("github.com") ? "" : " Path"}
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace", fontSize: "0.85rem", color: borderColor, fontWeight: 600 }}>
                    {repoDetails.repoUrl}
                  </Typography>
                </Box>
                <Chip label={effectiveVersion || branch} size="small" sx={{ fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace", bgcolor: `${borderColor}20`, color: borderColor }} />
                <Chip label={repoType.split(" ")[0]} size="small" sx={{ fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace" }} />
              </Stack>
            </Paper>
          </Paper>

          {/* Private Key input — Electron: file picker, Web: textarea */}
          <Stack spacing={2}>
            {isElectron ? (
              <TextField
                fullWidth
                label="Private Key File (.pem)"
                value={privateKeyPath}
                disabled={disabled || isRunning}
                InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={handleSelectKeyFile} disabled={disabled || isRunning} size="small">
                        <FolderOpenIcon />
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
            ) : (
              <TextField
                fullWidth
                label="Private Key (PEM content)"
                placeholder="-----BEGIN PRIVATE KEY-----&#10;Paste your private key here...&#10;-----END PRIVATE KEY-----"
                value={privateKeyPath}
                onChange={(e) => setPrivateKeyPath(e.target.value)}
                disabled={disabled || isRunning}
                InputProps={{ sx: { fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace", fontSize: 12 } }}
              />
            )}
            <TextField
              fullWidth
              type="password"
              label="Key Password (if encrypted)"
              value={signPassword}
              onChange={(e) => setSignPassword(e.target.value)}
              disabled={disabled || isRunning}
            />
          </Stack>

          {/* Sign Artifact Button */}
          <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
            <Tooltip
              title={isButtonDisabled ? toolTip : ""}
              arrow
              placement="top"
              disableHoverListener={!isButtonDisabled}
            >
              <span>
                <Button
                  variant="contained"
                  size="large"
                  onClick={runSigning}
                  disabled={isButtonDisabled}
                  sx={{
                    bgcolor: borderColor,
                    color: "black",
                    fontWeight: "bold",
                    boxShadow: `0 4px 14px 0 ${borderColor}40`,
                    "&:hover": { bgcolor: `${borderColor}CC` },
                    minWidth: 350
                  }}
                  startIcon={isRunning ? <CircularProgress size={20} color="inherit" /> : <PlayArrowIcon />}
                >
                  {isRunning ? `Signing... (${repoType})` : "Sign Artifact"}
                </Button>
              </span>
            </Tooltip>
          </Box>

          {/* Web mode: display returned signature */}
          {!isElectron && signatureContent && (
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
                <Typography variant="subtitle2" fontWeight={600}>📝 Signature</Typography>
                <Button
                  size="small"
                  startIcon={<ContentCopyIcon />}
                  onClick={() => copyToClipboard(signatureContent, "Signature")}
                >
                  Copy
                </Button>
              </Stack>
              <TextField
                fullWidth
                multiline
                minRows={4}
                maxRows={8}
                value={signatureContent}
                InputProps={{ readOnly: true, sx: { fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace", fontSize: 12 } }}
              />
            </Box>
          )}

          {/* Hide/Show Logs */}
          {logs.length > 0 && !isRunning && (
            <Box>
              <Button
                onClick={() => setShowLogs(!showLogs)}
                endIcon={showLogs ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                variant="outlined"
                size="small"
                fullWidth
              >
                {showLogs ? "Hide Logs" : "Show Logs"}
              </Button>

              <Collapse in={showLogs}>
                <Paper
                  elevation={0}
                  sx={{
                    mt: 2,
                    maxHeight: "400px",
                    overflow: "auto",
                    backgroundColor: "#1a1a1a",
                    border: "1px solid #333",
                    p: 2,
                    position: "relative",
                    "&::-webkit-scrollbar": { width: "8px" },
                    "&::-webkit-scrollbar-track": { background: "#2d2d2d" },
                    "&::-webkit-scrollbar-thumb": { background: "#555", borderRadius: "4px" },
                    "&::-webkit-scrollbar-thumb:hover": { background: "#777" },
                  }}
                >
                  <CopyLogButton text={logs} />
                  <AnalyzeLogButton text={logs} />
                  <Box
                    sx={{
                      fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace",
                      fontSize: 12,
                      lineHeight: 1.6,
                      color: "#e0e0e0",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {logs.map((log, i) => (
                      <Typography
                        key={i}
                        component="pre"
                        sx={{
                          margin: 0,
                          fontFamily: "inherit",
                          fontSize: "inherit",
                          lineHeight: "inherit",
                          color: "inherit",
                        }}
                      >
                        {log}
                      </Typography>
                    ))}
                  </Box>
                </Paper>
              </Collapse>
            </Box>
          )}
        </Stack>
      </Paper>

      {/* Modal */}
      <Dialog
        open={modalOpen}
        onClose={() => canClose && setModalOpen(false)}
        maxWidth="md"
        fullWidth
        disableEscapeKeyDown={!canClose}
        PaperProps={{
          sx: {
            backgroundColor: "#1e1e1e",
            backgroundImage: "none",
          },
        }}
      >
        <DialogTitle sx={{ backgroundColor: "#2d2d2d", borderBottom: "1px solid #404040" }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" fontWeight={600}>
              <FingerprintIcon sx={{ mr: 1, fontSize: 24, color: borderColor }} /> Digital Signing
            </Typography>
            {canClose && (
              <IconButton onClick={() => setModalOpen(false)} size="small">
                <CloseIcon />
              </IconButton>
            )}
          </Stack>
          {isRunning && (
            <Box sx={{ mt: 2 }}>
              <Stack direction="row" spacing={2} alignItems="center" mb={1}>
                <Box flex={1}><LinearProgress variant="determinate" value={progress} /></Box>
                <Typography variant="body2" color="text.secondary">{progress}%</Typography>
              </Stack>
            </Box>
          )}
          {isCancelling && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size={16} />
                <Typography variant="body2">Cancelling scan and cleaning up processes...</Typography>
              </Stack>
            </Alert>
          )}
        </DialogTitle>
        <DialogContent
          sx={{
            height: "60vh",
            mt: 2,
            backgroundColor: "#1a1a1a",
            overflow: "auto",
            p: 3,
            "&::-webkit-scrollbar": { width: "8px" },
            "&::-webkit-scrollbar-track": { background: "#2d2d2d" },
            "&::-webkit-scrollbar-thumb": { background: "#555", borderRadius: "4px" },
            "&::-webkit-scrollbar-thumb:hover": { background: "#777" },
          }}
        >
          <Box
            sx={{
              fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace",
              fontSize: 13,
              lineHeight: 1.6,
              color: "#e0e0e0",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              mt: 2,
            }}
          >
            {logs.length > 0 ? (
              <>
                {logs.map((log, i) => (
                  <Typography
                    key={i}
                    component="pre"
                    sx={{ margin: 0, fontFamily: "inherit", fontSize: "inherit", lineHeight: "inherit", color: "inherit" }}
                  >
                    {log}
                  </Typography>
                ))}
                <div ref={logEndRef} />
              </>
            ) : (
              <Typography color="text.secondary" textAlign="center" py={4}>
                {isRunning ? "Initializing signing..." : "No logs available"}
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, backgroundColor: "#2d2d2d", borderTop: "1px solid #404040" }}>
          {isRunning && (
            <Button
              onClick={cancelScan}
              color="error"
              variant="contained"
              startIcon={isCancelling ? <CircularProgress size={16} color="inherit" /> : <CancelIcon />}
              disabled={isCancelling}
            >
              {isCancelling ? "Cancelling..." : "Cancel Scan"}
            </Button>
          )}
          {logs.length > 0 && <Button startIcon={<DownloadIcon />} onClick={downloadLogs}>Download Logs</Button>}
          {canClose && <Button onClick={() => setModalOpen(false)} variant="outlined">Close</Button>}
        </DialogActions>
      </Dialog>
    </>
  );
}