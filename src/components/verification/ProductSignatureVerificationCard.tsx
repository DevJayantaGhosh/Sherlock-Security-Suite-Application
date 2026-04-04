// src/components/cryptosigning/ProductSignatureVerificationCard.tsx
import { useState, useRef, useEffect } from "react";
import {
  Box, Paper, Stack, Typography, TextField, Button,
  IconButton, InputAdornment, LinearProgress, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Chip, Alert, Collapse
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import CancelIcon from "@mui/icons-material/Cancel";
import DownloadIcon from "@mui/icons-material/Download";
import CloseIcon from "@mui/icons-material/Close";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";

import { toast } from "react-hot-toast";
import { platform } from "../../platform";
import CopyLogButton from "../CopyLogButton";

type ScanStatus = "idle" | "running" | "success" | "failed" | "valid" | "invalid";

interface ProductRepoDetails {
  repoUrl: string;
  branch: string;
  releaseTag?: string;
  isLocal: false;
}

interface ProductSignatureVerificationCardProps {
  repoDetailsList: ProductRepoDetails[];
  productName: string;
  productVersion: string;
  githubToken: string;
  borderColor?: string;
}

export default function ProductSignatureVerificationCard({
  repoDetailsList,
  productName,
  productVersion,
  githubToken,
  borderColor = "#4caf50",

}: ProductSignatureVerificationCardProps) {
  const [publicKeyPath, setPublicKeyPath] = useState("");
  const [signaturePath, setSignaturePath] = useState("");
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<"idle" | "valid" | "invalid">("idle");
  const [currentRepoIndex, setCurrentRepoIndex] = useState(0);
  const [verifiedCount, setVerifiedCount] = useState(0);

  const scanIdRef = useRef<string | null>(null);
  const logCleanupRef = useRef<(() => void) | null>(null);
  const completeCleanupRef = useRef<(() => void) | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const logsRef = useRef<string[]>([]);

  // Auto-scroll logs
  useEffect(() => {
    if (modalOpen && logs.length > 0 && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, modalOpen]);

  // Cleanup
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
      if (path) {
        setPublicKeyPath(path);
        toast.success("Public key selected");
      }
    } catch (e) {
      toast.error("Failed to select public key file");
    }
  };

  const handleSelectSignature = async () => {
    try {
      const path = await platform.selectFile();
      if (path) {
        setSignaturePath(path);
        toast.success("Signature file selected");
      }
    } catch (e) {
      toast.error("Failed to select signature file");
    }
  };

  const verifySingleRepo = async (repoIndex: number) => {
    const repoDetails = repoDetailsList[repoIndex];
    const scanId = crypto.randomUUID();
    scanIdRef.current = scanId;

    setLogs(prev => [...prev,
      `\n${"═".repeat(80)}`,
      `🔹 REPO ${repoIndex + 1}/${repoDetailsList.length}: ${repoDetails.repoUrl}`,
      `   Branch: ${repoDetails.branch}`,
      `   Version: ${repoDetails.releaseTag}`,
      `   Scan ID: ${scanId.slice(0, 8)}...`,
      `${"═".repeat(80)}\n`
    ]);
    logsRef.current.push(...[
      `\n${"═".repeat(80)}`,
      `🔹 REPO ${repoIndex + 1}/${repoDetailsList.length}: ${repoDetails.repoUrl}`,
      `   Branch: ${repoDetails.branch}`,
      `   Version: ${repoDetails.releaseTag}`,
      `   Scan ID: ${scanId.slice(0, 8)}...`,
      `${"═".repeat(80)}\n`
    ]);

    setCurrentRepoIndex(repoIndex);

    const logCleanup = platform.onScanLog(scanId, (data) => {
      setLogs(prev => [...prev, data.log]);
      logsRef.current.push(data.log);
      setProgress(data.progress || 0);
    });
    logCleanupRef.current = logCleanup;

    try {
      const result = await platform.verifySignature({
        repoUrl: repoDetails.repoUrl,
        branch: repoDetails.branch,
        version: repoDetails.releaseTag || productVersion,
        isQuickScan: false,
        localRepoLocation: "",
        githubToken: githubToken || "",
        publicKeyPath,
        signaturePath,
        scanId
      });

      logCleanupRef.current = null;
      return result.success ?? false;
    } catch (err: any) {
      if (err.message !== "cancelled") {
        const errorMsg = `\n❌ Error: ${err.message}\n`;
        setLogs(prev => [...prev, errorMsg]);
        logsRef.current.push(errorMsg);
      }
      logCleanupRef.current = null;
      return false;
    }
  };

  const runSequentialVerification = async () => {
    if (!publicKeyPath || !signaturePath) {
      toast.error("Please select both public key and signature files");
      return;
    }

    const scanId = crypto.randomUUID();
    scanIdRef.current = scanId;

    setLogs([`Signature Verification STARTED: ${productName}`,
      `${repoDetailsList.length} repositories - ${productVersion}`,
      `${"═".repeat(80)}\n`]);
    logsRef.current = [...[
      `Signature Verification STARTED: ${productName}`,
      `${repoDetailsList.length} repositories - ${productVersion}`,
      `${"═".repeat(80)}\n`
    ]];

    setStatus("running");
    setProgress(0);
    setShowLogs(false);
    setModalOpen(true);
    setVerificationStatus("idle");
    setCurrentRepoIndex(0);
    setVerifiedCount(0);

    // Sequential verification
    let successCount = 0;
    let wasCancelled = false;

    for (let i = 0; i < repoDetailsList.length; i++) {
      if (!scanIdRef.current) { wasCancelled = true; break; } // Cancelled

      const success = await verifySingleRepo(i);
      if (success) {
        successCount++;
        setVerifiedCount(prev => prev + 1);
      }

    }

    // ── Finalize after all repos are processed ──
    if (!wasCancelled) {
      const allVerified = successCount === repoDetailsList.length;
      setStatus(allVerified ? "success" : "failed");
      setVerificationStatus(allVerified ? "valid" : "invalid");
      setProgress(100);

      const summaryMsg = `\n${"═".repeat(80)}\n` +
        `📊 VERIFICATION COMPLETE: ${successCount}/${repoDetailsList.length} repositories verified\n` +
        `${allVerified ? "✅ ALL SIGNATURES VALID" : "❌ SOME SIGNATURES FAILED"}\n` +
        `${"═".repeat(80)}\n`;
      setLogs(prev => [...prev, summaryMsg]);
      logsRef.current.push(summaryMsg);

      cleanupListeners();
    }
  };

  const cancelScan = async () => {
    if (!scanIdRef.current) return;
    setIsCancelling(true);
    const msg = "\n⏳ Cancelling verification...\n";
    setLogs(prev => [...prev, msg]);
    logsRef.current.push(msg);

    try {
      await platform.cancelScan({ scanId: scanIdRef.current! });
      setStatus("failed");
      setVerificationStatus("invalid");
    } finally {
      cleanupListeners();
      setIsCancelling(false);
      setTimeout(() => setModalOpen(false), 800);
    }
  };

  const cleanupListeners = () => {
    if (logCleanupRef.current) {
      logCleanupRef.current();
      logCleanupRef.current = null;
    }
    if (completeCleanupRef.current) {
      completeCleanupRef.current();
      completeCleanupRef.current = null;
    }
    scanIdRef.current = null;
  };

  const downloadLogs = () => {
    const logText = logs.join("\n");
    const blob = new Blob([logText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `product-${productName}-verification-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isRunning = status === "running";
  const canClose = !isRunning && !isCancelling;

  return (
    <>
      <Paper sx={{ p: 3, borderLeft: `4px solid ${borderColor}`, borderRadius: 1 }}>
        <Typography variant="h6" fontWeight={700} gutterBottom display="flex" alignItems="center" gap={1}>
          <VpnKeyIcon sx={{ color: borderColor, fontSize: 24 }} /> Product Signature Verification
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          Verify all {repoDetailsList.length} repositories for <strong>{productName} v{productVersion}</strong>
        </Typography>

        {/* Repositories List */}
        <Paper sx={{ p: 3, mb: 3, borderRadius: 2, bgcolor: 'rgba(255,255,255, 0.02)', border: '1px solid rgba(255,255,255, 0.08)' }}>
          <Typography variant="h6" fontWeight={500} mb={2.5} sx={{ color: borderColor, fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace" }}>
            📂 Verification Targets ({repoDetailsList.length})
          </Typography>
          <Stack spacing={1.5}>
            {repoDetailsList.map((repo, index) => (
              <Paper key={index} sx={{ 
                p: 2, borderRadius: 1, 
                bgcolor: index === currentRepoIndex && isRunning ? `${borderColor}08` : 'transparent',
                border: index === currentRepoIndex && isRunning ? `2px solid ${borderColor}30` : '1px solid rgba(255,255,255, 0.05)',
                transition: 'all 0.3s ease'
              }}>
                <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                  <Box sx={{ 
                    width: 40, height: 40, borderRadius: 1, 
                    bgcolor: index === currentRepoIndex && isRunning ? `${borderColor}20` : 'rgba(255,255,255, 0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: index === currentRepoIndex && isRunning ? `2px solid ${borderColor}` : '1px solid transparent'
                  }}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ 
                      color: index === currentRepoIndex && isRunning ? borderColor : 'text.secondary', 
                      fontSize: '1rem' 
                    }}>
                      {index + 1}
                    </Typography>
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 200 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace" }}>
                      Repository
                    </Typography>
                    <Typography variant="body2" sx={{ fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace", fontSize: '0.85rem', color: borderColor, fontWeight: 600 }}>
                      {repo.repoUrl}
                    </Typography>
                  </Box>
                  <Chip label={repo.branch} size="small" sx={{ fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace" }} />
                  <Chip label={repo.releaseTag || productVersion} size="small" sx={{ fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace", bgcolor: `${borderColor}20`, color: borderColor }} />
                  {index === currentRepoIndex && isRunning && <CircularProgress size={20} />}
                </Stack>
              </Paper>
            ))}
          </Stack>
        </Paper>


        {/* Status Alert */}
        {verificationStatus !== "idle" && !isRunning && (
          <Alert
            severity={verificationStatus === "valid" ? "success" : "warning"}
            sx={{ mb: 3 }}
            icon={verificationStatus === "valid" ? <CheckCircleIcon /> : <ErrorIcon />}
          >
            <Typography variant="body2" fontWeight={600}>
              {verificationStatus === "valid"
                ? `✅ All ${repoDetailsList.length} signatures verified successfully!`
                : `⚠️ ${verifiedCount}/${repoDetailsList.length} signatures verified`
              }
            </Typography>
          </Alert>
        )}

        {/* File Selection & Button */}
        <Stack spacing={3}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField
              fullWidth={!publicKeyPath}
              label="Public Key File (.pem)"
              value={publicKeyPath}
              disabled={isRunning}
              InputProps={{
                readOnly: true,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={handleSelectPublicKey} disabled={isRunning} size="small">
                      <FolderOpenIcon />
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
            <TextField
              fullWidth={!signaturePath}
              label="Signature File (.sig)"
              value={signaturePath}
              disabled={isRunning}
              InputProps={{
                readOnly: true,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={handleSelectSignature} disabled={isRunning} size="small">
                      <FolderOpenIcon />
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
          </Stack>

          <Button
            variant="contained"
            size="large"
            onClick={runSequentialVerification}
            disabled={!publicKeyPath || !signaturePath || isRunning}
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
            {isRunning 
              ? `Verifying... (${verifiedCount}/${repoDetailsList.length})` 
              : `Verify All (${repoDetailsList.length})`
            }
          </Button>

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
              <VpnKeyIcon sx={{ mr: 1, fontSize: 24, color: borderColor }} /> Product Signature Verification
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
