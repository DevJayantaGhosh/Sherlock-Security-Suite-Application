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
  savedPublicKeyPath?: string;
  savedSignaturePath?: string;
}

export default function ProductSignatureVerificationCard({
  repoDetailsList,
  productName,
  productVersion,
  githubToken,
  borderColor = "#4caf50",
  savedPublicKeyPath,
  savedSignaturePath
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

    const completeCleanup = platform.onScanComplete(scanId, (completeData) => {
      const newStatus = completeData.success ? "success" : "failed";
      setStatus(newStatus);
      setVerificationStatus(completeData.success ? "valid" : "invalid");
      setProgress(100);
      cleanupListeners();
    });
    completeCleanupRef.current = completeCleanup;

    // Sequential verification
    for (let i = 0; i < repoDetailsList.length; i++) {
      if (!scanIdRef.current) break; // Cancelled

      const success = await verifySingleRepo(i);
      if (success) setVerifiedCount(prev => prev + 1);

      if (i < repoDetailsList.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
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
          <Typography variant="h6" fontWeight={500} mb={2.5} sx={{ color: borderColor, fontFamily: 'monospace' }}>
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
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                      Repository
                    </Typography>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.85rem', color: borderColor, fontWeight: 600 }}>
                      {repo.repoUrl}
                    </Typography>
                  </Box>
                  <Chip label={repo.branch} size="small" sx={{ fontFamily: 'monospace' }} />
                  <Chip label={repo.releaseTag || productVersion} size="small" sx={{ fontFamily: 'monospace', bgcolor: `${borderColor}20`, color: borderColor }} />
                  {index === currentRepoIndex && isRunning && <CircularProgress size={20} />}
                </Stack>
              </Paper>
            ))}
          </Stack>
        </Paper>

        {/* Saved Files Section */}
        {(savedPublicKeyPath || savedSignaturePath) && (
          <Paper sx={{ p: 3, mb: 3, bgcolor: `${borderColor}08`, border: `2px solid ${borderColor}30`, borderRadius: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} mb={2} sx={{ color: borderColor }}>
              📎 Saved Product Files
            </Typography>
            <Stack spacing={1.5}>
              {savedPublicKeyPath && (
                <Box sx={{ p: 2, bgcolor: 'rgba(33, 150, 243, 0.08)', borderRadius: 1, border: '1px solid rgba(33, 150, 243, 0.2)', cursor: 'pointer' }}
                  onClick={async () => {
                    try {
                      await platform.openFilePath(savedPublicKeyPath);
                    } catch (error) {
                      toast.error("Failed to open file");
                    }
                  }}>
                  <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: '#2196f3', fontFamily: 'monospace' }}>
                    <VpnKeyIcon sx={{ fontSize: 18 }} /> 🔓 {savedPublicKeyPath}
                  </Typography>
                </Box>
              )}
              {savedSignaturePath && (
                <Box sx={{ p: 2, bgcolor: `${borderColor}08`, borderRadius: 1, border: `1px solid ${borderColor}20`, cursor: 'pointer' }}
                  onClick={async () => {
                    try {
                      await platform.openFilePath(savedSignaturePath);
                    } catch (error) {
                      toast.error("Failed to open file");
                    }
                  }}>
                  <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: borderColor, fontFamily: 'monospace' }}>
                    <CheckCircleIcon sx={{ fontSize: 18 }} /> ✅ {savedSignaturePath}
                  </Typography>
                </Box>
              )}
            </Stack>
          </Paper>
        )}

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
              label="Public Key File (.pub)"
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

          {/* Hide/Show Logs - EXACTLY like SignatureVerificationCard */}
          {logs.length > 0 && !isRunning && (
            <Box>
              <Button
                onClick={() => setShowLogs(!showLogs)}
                endIcon={showLogs ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                variant="outlined"
                size="small"
                fullWidth
              >
                {showLogs ? "Hide Logs" : "Show Logs"} ({logs.length} lines)
              </Button>
              <Collapse in={showLogs}>
                <Paper sx={{
                  mt: 2, maxHeight: "400px", overflow: "auto",
                  bgcolor: "#1a1a1a", border: "1px solid #333", p: 2,
                  fontFamily: "monospace", fontSize: 12, color: "#e0e0e0"
                }}>
                  {logs.map((log, i) => (
                    <Typography key={i} component="pre" sx={{ m: 0, fontSize: 12 }}>
                      {log}
                    </Typography>
                  ))}
                </Paper>
              </Collapse>
            </Box>
          )}
        </Stack>
      </Paper>

      {/* Modal - EXACTLY like SignatureVerificationCard */}
      <Dialog open={modalOpen} onClose={() => canClose && setModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ bgcolor: "#2d2d2d", borderBottom: "1px solid #404040" }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" fontWeight={700}>
              <VpnKeyIcon sx={{ mr: 1, fontSize: 24, color: borderColor }} /> Product Signature Verification
            </Typography>
            {canClose && <IconButton onClick={() => setModalOpen(false)}><CloseIcon /></IconButton>}
          </Stack>
          {isRunning && (
            <Box sx={{ mt: 2 }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Box flex={1}><LinearProgress variant="determinate" value={progress} /></Box>
                <Typography variant="body2">{progress}%</Typography>
              </Stack>
            </Box>
          )}
        </DialogTitle>
        <DialogContent sx={{ height: "60vh", p: 3, bgcolor: "#1a1a1a", overflow: "auto" }}>
          <Box sx={{ fontFamily: "monospace", fontSize: 12, lineHeight: 1.5, color: "#e0e0e0", whiteSpace: "pre-wrap" }}>
            {logs.map((log, i) => (
              <Typography key={i} component="pre" sx={{ m: 0, fontSize: 12 }}>
                {log}
              </Typography>
            ))}
            <div ref={logEndRef} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, bgcolor: "#2d2d2d" }}>
          {isRunning && (
            <Button onClick={cancelScan} color="error" variant="contained" 
              startIcon={isCancelling ? <CircularProgress size={16} color="inherit" /> : <CancelIcon />}>
              {isCancelling ? "Cancelling..." : "Cancel Verification"}
            </Button>
          )}
          {logs.length > 0 && <Button startIcon={<DownloadIcon />} onClick={downloadLogs}>Download Logs</Button>}
          {canClose && <Button onClick={() => setModalOpen(false)}>Close</Button>}
        </DialogActions>
      </Dialog>
    </>
  );
}
