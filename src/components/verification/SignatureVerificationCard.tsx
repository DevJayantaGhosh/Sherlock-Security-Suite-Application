// src/components/verification/SignatureVerificationCard.tsx
import { useState, useRef, useEffect } from "react";
import {
  Box, Paper, Stack, Typography, TextField, Button,
  IconButton, InputAdornment, LinearProgress, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Chip, Alert, Collapse
} from "@mui/material";
import { toast } from "react-hot-toast";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import CancelIcon from "@mui/icons-material/Cancel";
import DownloadIcon from "@mui/icons-material/Download";
import CloseIcon from "@mui/icons-material/Close";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";

import { platform } from "../../platform";
import CopyLogButton from "../CopyLogButton";
import AnalyzeLogButton from "../AnalyzeLogButton";
import { TagBasedRepoDetails } from "../repoconfig/TagBasedRepoConfig";

type ScanStatus = "idle" | "running" | "success" | "failed" | "valid" | "invalid";

interface SignatureVerificationCardProps {
  repoDetails: TagBasedRepoDetails;
  githubToken: string;
  disabled?: boolean;
  borderColor?: string;
}

export default function SignatureVerificationCard({
  repoDetails,
  githubToken,
  disabled = false,
  borderColor = "#4caf50"
}: SignatureVerificationCardProps) {
  const isElectron = platform.isElectron;

  // In Electron: holds file paths. In Web: holds pasted content strings.
  const [publicKeyPath, setPublicKeyPath] = useState("");
  const [signaturePath, setSignaturePath] = useState("");

  const [status, setStatus] = useState<ScanStatus>("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<"idle" | "valid" | "invalid">("idle");

  const scanIdRef = useRef<string | null>(null);
  const logCleanupRef = useRef<(() => void) | null>(null);
  const completeCleanupRef = useRef<(() => void) | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const logsRef = useRef<string[]>([]);

  const repoType = repoDetails.isLocal ? "Local" : (githubToken ? "Private GitHub" : "Public GitHub");
  const version = repoDetails.isLocal ? "HEAD" : (repoDetails.releaseTag || "latest");

  useEffect(() => {
    if (modalOpen && logs.length > 0 && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, modalOpen]);

  useEffect(() => {
    return () => {
      if (logCleanupRef.current) logCleanupRef.current();
      if (completeCleanupRef.current) completeCleanupRef.current();
      if (scanIdRef.current) {
        platform.cancelScan({ scanId: scanIdRef.current });
      }
    };
  }, []);

  const handleSelectPublicKey = async () => {
    try {
      const path = await platform.selectFile();
      if (path) { setPublicKeyPath(path); toast.success("Public key selected"); }
    } catch { toast.error("Failed to select public key file"); }
  };

  const handleSelectSignature = async () => {
    try {
      const path = await platform.selectFile();
      if (path) { setSignaturePath(path); toast.success("Signature file selected"); }
    } catch { toast.error("Failed to select signature file"); }
  };

  const runVerification = async () => {
    if (!publicKeyPath || !signaturePath) {
      toast.error("Please provide both public key and signature");
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
    setVerificationStatus("idle");

    const logCleanup = platform.onScanLog(scanId, (data) => {
      setLogs(prev => [...prev, data.log]);
      logsRef.current.push(data.log);
      setProgress(data.progress || 0);
    });
    logCleanupRef.current = logCleanup;

    const completeCleanup = platform.onScanComplete(scanId, (completeData) => {
      const newStatus = completeData.success ? "success" : "failed";
      setStatus(newStatus);
      setVerificationStatus(completeData.success ? "valid" : "invalid");
      setProgress(100);
      cleanupListeners();
    });
    completeCleanupRef.current = completeCleanup;

    try {
      // publicKeyPath / signaturePath: file paths (Electron) or raw content (web)
      const result = await platform.verifySignature({
        repoUrl: repoDetails.repoUrl,
        branch: "main",
        version,
        isQuickScan: repoDetails.isLocal,
        localRepoLocation: repoDetails.isLocal ? repoDetails.repoUrl : "",
        githubToken: githubToken || "",
        publicKeyPath,
        signaturePath,
        scanId
      });

      if (result.success) {
        toast.success(`✅ Signature verified successfully for ${version}!`);
      } else {
        toast.error("❌ Signature verification failed");
      }
    } catch (err: any) {
      if (err.message !== "cancelled") {
        const errorMsg = `\n❌ Error: ${err.message}\n`;
        setLogs(prev => [...prev, errorMsg]);
        logsRef.current.push(errorMsg);
        setVerificationStatus("invalid");
      }
    }
  };

  const cancelScan = async () => {
    if (!scanIdRef.current) return;
    setIsCancelling(true);
    const msg = "\n⏳ Cancelling verification...\n";
    setLogs(prev => [...prev, msg]);
    logsRef.current.push(msg);
    try {
      await platform.cancelScan({ scanId: scanIdRef.current });
      setStatus("failed");
      setVerificationStatus("invalid");
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
    a.download = `signature-verification-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isRunning = status === "running";
  const canClose = !isRunning && !isCancelling;
  const isButtonDisabled = !publicKeyPath || !signaturePath || isRunning || disabled;

  return (
    <>
      <Paper sx={{ p: 3, mt: 4, borderLeft: `4px solid ${borderColor}`, borderRadius: 1 }}>
        <Typography variant="h6" fontWeight={700} gutterBottom display="flex" alignItems="center" gap={1}>
          <VpnKeyIcon sx={{ color: borderColor, fontSize: 24 }} /> Signature Verification
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          Verify cryptographic signatures against <strong>{repoDetails.releaseTag ? `release tag ${repoDetails.releaseTag}` : "local repository"}</strong>.
          {!isElectron && " Paste the public key and signature content below."}
        </Typography>

        <Stack spacing={3}>
          {/* Repository Info */}
          <Paper sx={{ p: 3, mb: 3, borderRadius: 2, bgcolor: "rgba(255,255,255, 0.02)", border: "1px solid rgba(255,255,255, 0.08)" }}>
            <Typography variant="h6" fontWeight={500} mb={2.5} sx={{ color: borderColor, fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace" }}>
              📂 Verification Target (1)
            </Typography>
            <Paper sx={{ p: 2, borderRadius: 1, border: `2px solid ${borderColor}30`, bgcolor: `${borderColor}08` }}>
              <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                <Box sx={{ width: 40, height: 40, borderRadius: 1, bgcolor: `${borderColor}20`, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${borderColor}` }}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ color: borderColor, fontSize: "1rem" }}>1</Typography>
                </Box>
                <Box sx={{ flex: 1, minWidth: 200 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace" }}>
                    Repository{repoDetails.isLocal ? " Path" : ""}
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace", fontSize: "0.85rem", color: borderColor, fontWeight: 600 }}>
                    {repoDetails.repoUrl}
                  </Typography>
                </Box>
                {repoDetails.releaseTag && (
                  <Chip label={repoDetails.releaseTag} size="small" sx={{ fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace", bgcolor: `${borderColor}20`, color: borderColor }} />
                )}
                <Chip label={repoType.split(" ")[0]} size="small" sx={{ fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace" }} />
              </Stack>
            </Paper>
          </Paper>

          {/* Status Alert */}
          {verificationStatus !== "idle" && !isRunning && (
            <Alert
              severity={verificationStatus === "valid" ? "success" : "error"}
              sx={{ mb: 3 }}
              icon={verificationStatus === "valid" ? <CheckCircleIcon /> : <ErrorIcon />}
            >
              <Typography variant="body2" fontWeight={600}>
                {verificationStatus === "valid"
                  ? `✅ Signature verified successfully for ${version}!`
                  : "❌ Signature verification failed"}
              </Typography>
            </Alert>
          )}

          {/* Public Key & Signature inputs */}
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            {isElectron ? (
              <TextField
                fullWidth={!publicKeyPath}
                label="Public Key File (.pub)"
                value={publicKeyPath}
                disabled={disabled || isRunning}
                InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={handleSelectPublicKey} disabled={disabled || isRunning} size="small">
                        <FolderOpenIcon />
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
            ) : (
              <TextField
                fullWidth
                label="Public Key (PEM content)"
                placeholder={"-----BEGIN PUBLIC KEY-----\nPaste public key here...\n-----END PUBLIC KEY-----"}
                value={publicKeyPath}
                onChange={(e) => setPublicKeyPath(e.target.value)}
                multiline
                minRows={4}
                maxRows={8}
                disabled={disabled || isRunning}
                InputProps={{ sx: { fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace", fontSize: 12 } }}
              />
            )}

            {isElectron ? (
              <TextField
                fullWidth={!signaturePath}
                label="Signature File (.sig)"
                value={signaturePath}
                disabled={disabled || isRunning}
                InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={handleSelectSignature} disabled={disabled || isRunning} size="small">
                        <FolderOpenIcon />
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
            ) : (
              <TextField
                fullWidth
                label="Signature (base64 / hex content)"
                placeholder="Paste signature content here..."
                value={signaturePath}
                onChange={(e) => setSignaturePath(e.target.value)}
                multiline
                minRows={4}
                maxRows={8}
                disabled={disabled || isRunning}
                InputProps={{ sx: { fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace", fontSize: 12 } }}
              />
            )}
          </Stack>

          {/* Verify Button */}
          <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
            <Button
              variant="contained"
              size="large"
              onClick={runVerification}
              disabled={isButtonDisabled}
              sx={{
                bgcolor: borderColor,
                color: "white",
                fontWeight: "bold",
                boxShadow: `0 4px 14px 0 ${borderColor}40`,
                "&:hover": { bgcolor: `${borderColor}CC` },
                minWidth: 280
              }}
              startIcon={isRunning ? <CircularProgress size={20} color="inherit" /> : <PlayArrowIcon />}
            >
              {isRunning ? `Verifying... (${version})` : `Verify Signature (${version})`}
            </Button>
          </Box>

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
              <VpnKeyIcon sx={{ mr: 1, fontSize: 24, color: borderColor }} /> Signature Verification
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
                <Typography variant="body2">Cancelling verification and cleaning up processes...</Typography>
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
                {isRunning ? "Initializing verification..." : "No logs available"}
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
              {isCancelling ? "Cancelling..." : "Cancel Verification"}
            </Button>
          )}
          {logs.length > 0 && <Button startIcon={<DownloadIcon />} onClick={downloadLogs}>Download Logs</Button>}
          {canClose && <Button onClick={() => setModalOpen(false)} variant="outlined">Close</Button>}
        </DialogActions>
      </Dialog>
    </>
  );
}