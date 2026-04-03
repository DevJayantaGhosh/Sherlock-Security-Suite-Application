// src/components/security/RepoScanAccordion.tsx
import { useState, useRef, useEffect } from "react";
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Box,
  Button,
  Stack,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Alert,
  IconButton,
  CircularProgress,
  Collapse,
  Paper
} from "@mui/material";

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import DownloadIcon from "@mui/icons-material/Download";
import CancelIcon from "@mui/icons-material/Cancel";
import CloseIcon from "@mui/icons-material/Close";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";

import { Product, RepoDetails, RepoScanResults, SignatureVerificationResult,SecretLeakDetectionResult ,VulnerabilityScanResult} from "../../models/Product";
import { useUserStore } from "../../store/userStore";
import { authorizeApprove } from "../../services/productService";
import { platform } from "../../platform";

type ScanStatus = "idle" | "running" | "success" | "failed";

export default function RepoScanAccordion({
  product,
  repoDetails,
  onRepoUpdate,
  disabled = false ,
  isQuickScan= false,
  githubToken="",
}: {
  product: Product;
  repoDetails: RepoDetails;
  onRepoUpdate: (updatedRepo: RepoDetails) => void;
  disabled :boolean;
  isQuickScan: boolean; 
  githubToken: string
}) {
  const user = useUserStore((s) => s.user);
  const isAuthorized = authorizeApprove(user, product);

  const shouldEnableButtons = isQuickScan || (isAuthorized && !disabled);

  const handleScanUpdate = (
    activity: keyof RepoScanResults, 
    data: any
  ) => {
    if (!onRepoUpdate) return;

    const currentScans = repoDetails.scans || {};
    const updatedRepo = {
      ...repoDetails,
      scans: {
        ...currentScans,
        [activity]: {
          ...(currentScans[activity] || {}),
          ...data
        }
      }
    };
    onRepoUpdate(updatedRepo);
  };

  return (
    <Stack spacing={2}>
      <GPGVerificationPanel
        repoDetails={repoDetails}
        isAuthorized={shouldEnableButtons}
        isQuickScan={isQuickScan}
        githubToken={githubToken}
        onScanComplete={(res) => handleScanUpdate('signatureVerification', res)}
      />
      <GitleaksPanel
        repoDetails={repoDetails}
        isAuthorized={shouldEnableButtons}
        isQuickScan={isQuickScan}
        githubToken={githubToken}
        onScanComplete={(res) => handleScanUpdate('secretLeakDetection', res)}
      />
      <VulnerabilityScanPanel
        repoDetails={repoDetails}
        isAuthorized={shouldEnableButtons}
        isQuickScan={isQuickScan}
        githubToken={githubToken}
        onScanComplete={(res) => handleScanUpdate('vulnerabilityScan', res)}
      />
    </Stack>
  );
}

/* ============================================================
   GPG VERIFICATION PANEL
============================================================ */
function GPGVerificationPanel({
  repoDetails,
  isAuthorized,
  isQuickScan, 
  githubToken,
  onScanComplete 
}: {
  repoDetails: RepoDetails;
  isAuthorized: boolean;
  isQuickScan: boolean;
  githubToken: string;
  onScanComplete: (result: SignatureVerificationResult) => void;
}) {
  const logEndRef = useRef<HTMLDivElement>(null);
  const scanIdRef = useRef<string | null>(null);
  const logCleanupRef = useRef<(() => void) | null>(null);
  const completeCleanupRef = useRef<(() => void) | null>(null);
  
  // Use a Ref to track accumulating logs safely during the callback
  const logsRef = useRef<string[]>([]);

  // 1. Load Persisted Data
  const savedScan = repoDetails.scans?.signatureVerification;

  // 2. Initialize State
  const [status, setStatus] = useState<ScanStatus>(savedScan?.status || "idle");
  const [logs, setLogs] = useState<string[]>(savedScan?.logs || []);
  const [progress, setProgress] = useState(savedScan?.status === 'success' ? 100 : 0);
  const [result, setResult] = useState(savedScan?.summary || null);
  const [showLogs, setShowLogs] = useState(() => {
    return (savedScan?.logs?.length || 0) > 0;
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Auto-scroll logs
  useEffect(() => {
    if (modalOpen && logs.length > 0) {
      setTimeout(() => {
        logEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
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

  // Run GPG verification
  async function runGPGVerification() {
    if (!isAuthorized) return;

    console.log("[GPG] Starting verification");

    const scanId = crypto.randomUUID();
    scanIdRef.current = scanId;

    // Reset local state and ref
    setLogs([]);
    logsRef.current = [];
    setProgress(0);
    setStatus("running");
    setResult(null);
    setShowLogs(true);
    setModalOpen(true);

    const logCleanup = platform.onScanLog(scanId, (data) => {
      setLogs((prev) => [...prev, data.log]);
      logsRef.current.push(data.log); // Keep ref in sync for the final save
      setProgress(data.progress || 0);
    });
    logCleanupRef.current = logCleanup;

    const completeCleanup = platform.onScanComplete(scanId, (data) => {
      console.log("[GPG] Complete", data);

      const newStatus = data.success ? "success" : "failed";
      setStatus(newStatus);
      setProgress(100);

      let newSummary = undefined;
      if (data.totalCommits !== undefined && data.goodSignatures !== undefined) {
        newSummary = {
          totalCommits: data.totalCommits,
          goodSignatures: data.goodSignatures,
        };
        setResult(newSummary);
      }

      // Use logsRef.current to ensure we save ALL logs, not stale state
      onScanComplete({
        status: newStatus,
        timestamp: new Date().toISOString(),
        logs: logsRef.current, 
        summary: newSummary
      });

      if (logCleanupRef.current) logCleanupRef.current();
      if (completeCleanupRef.current) completeCleanupRef.current();
      logCleanupRef.current = null;
      completeCleanupRef.current = null;
      scanIdRef.current = null;
    });
    completeCleanupRef.current = completeCleanup;

    try {
      const result = await platform.verifyGPG({
        repoUrl: repoDetails.repoUrl,
        branch: repoDetails.branch,
        isQuickScan: isQuickScan,
        githubToken: githubToken,
        scanId,
      });

      if (result?.cancelled) {
        setStatus("failed");
        setLogs((prev) => [...prev, "\n❌ Scan was cancelled\n"]);
        logsRef.current.push("\n❌ Scan was cancelled\n");
      }
    } catch (err: any) {
      console.error("[GPG] Error:", err);
      setStatus("failed");
      const errorMsg = `\n❌ Error: ${err.message}\n`;
      setLogs((prev) => [...prev, errorMsg]);
      logsRef.current.push(errorMsg);
    }
  }

  // Cancel scan
  async function cancelScan() {
    if (!scanIdRef.current) return;

    console.log("[GPG] Cancelling");
    setIsCancelling(true);
    const msg = "\n⏳ Cancelling scan...\n";
    setLogs((prev) => [...prev, msg]);
    logsRef.current.push(msg);

    try {
      const result = await platform.cancelScan({
        scanId: scanIdRef.current,
      });

      if (result.cancelled) {
        setStatus("failed");
        const cancelMsg = "✅ Scan cancelled successfully\n";
        setLogs((prev) => [...prev, cancelMsg]);
        logsRef.current.push(cancelMsg);
      } else {
        const warnMsg = "⚠️ No active scan found\n";
        setLogs((prev) => [...prev, warnMsg]);
        logsRef.current.push(warnMsg);
      }
    } catch (err: any) {
      console.error("[GPG] Cancel error:", err);
      const errMsg = `❌ Cancel error: ${err.message}\n`;
      setLogs((prev) => [...prev, errMsg]);
      logsRef.current.push(errMsg);
    } finally {
      if (logCleanupRef.current) logCleanupRef.current();
      if (completeCleanupRef.current) completeCleanupRef.current();
      logCleanupRef.current = null;
      completeCleanupRef.current = null;
      scanIdRef.current = null;

      setIsCancelling(false);
      setTimeout(() => setModalOpen(false), 800);
    }
  }

  // Download logs
  function downloadLogs() {
    const logText = logs.join("");
    const blob = new Blob([logText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gpg-verification-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const isRunning = status === "running";
  const canClose = !isRunning && !isCancelling;

  return (
    <>
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Stack width="100%" spacing={1}>
            <Typography textAlign="center" fontWeight={700} fontSize={18}>
              🛡️ GPG Signed Commits Verification 🛡️
            </Typography>
            <Typography
              textAlign="center"
              variant="body2"
              color="text.secondary"
            >
              {repoDetails.repoUrl} • {repoDetails.branch}
            </Typography>
          </Stack>
        </AccordionSummary>

        <AccordionDetails>
          <Stack spacing={3}>
            {/* Status Row */}
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography fontWeight={600}>Status:</Typography>

                {status === "idle" && (
                  <Typography variant="body2" color="text.secondary">
                    Ready to run
                  </Typography>
                )}

                {status === "running" && (
                  <>
                    <CircularProgress size={16} />
                    <Typography variant="body2" color="primary">
                      Running... {progress}%
                    </Typography>
                  </>
                )}

                {status === "success" && (
                  <>
                    <CheckCircleIcon color="success" fontSize="small" />
                    <Typography variant="body2" color="success.main">
                      Complete
                    </Typography>
                  </>
                )}

                {status === "failed" && (
                  <>
                    <ErrorIcon color="error" fontSize="small" />
                    <Typography variant="body2" color="error.main">
                      Failed
                    </Typography>
                  </>
                )}
              </Stack>

              <Stack direction="row" spacing={1}>
                {logs.length > 0 && (
                  <Button startIcon={<DownloadIcon />} onClick={downloadLogs}>
                    Download Logs
                  </Button>
                )}
                <Button
                  variant="contained"
                  startIcon={<PlayArrowIcon />}
                  disabled={!isAuthorized || isRunning}
                  onClick={runGPGVerification}
                >
                🔍 Run
                </Button>
              </Stack>
            </Stack>

            {/* Results Summary */}
            {result && (
              <Alert
                severity={
                  result.goodSignatures === result.totalCommits
                    ? "success"
                    : "warning"
                }
              >
                <Typography variant="body2">
                  <strong>Total Commits:</strong> {result.totalCommits} |{" "}
                  <strong>Good Signatures:</strong> {result.goodSignatures} |{" "}
                  <strong>Success Rate:</strong>{" "}
                  {result.totalCommits
                    ? Math.round(
                        (result.goodSignatures! / result.totalCommits) * 100
                      )
                    : 0}
                  %
                </Typography>
              </Alert>
            )}

            {/* Logs Section */}
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
                      "&::-webkit-scrollbar": {
                        width: "8px",
                      },
                      "&::-webkit-scrollbar-track": {
                        background: "#2d2d2d",
                      },
                      "&::-webkit-scrollbar-thumb": {
                        background: "#555",
                        borderRadius: "4px",
                      },
                      "&::-webkit-scrollbar-thumb:hover": {
                        background: "#777",
                      },
                    }}
                  >
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
        </AccordionDetails>
      </Accordion>

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
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6" fontWeight={600}>
             🛡️ GPG Signed Commits Verification 🛡️
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
                <Box flex={1}>
                  <LinearProgress variant="determinate" value={progress} />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {progress}%
                </Typography>
              </Stack>
            </Box>
          )}

          {isCancelling && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size={16} />
                <Typography variant="body2">
                  Cancelling scan and cleaning up processes...
                </Typography>
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
            "&::-webkit-scrollbar": {
              width: "8px",
            },
            "&::-webkit-scrollbar-track": {
              background: "#2d2d2d",
            },
            "&::-webkit-scrollbar-thumb": {
              background: "#555",
              borderRadius: "4px",
            },
            "&::-webkit-scrollbar-thumb:hover": {
              background: "#777",
            },
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
                <div ref={logEndRef} />
              </>
            ) : (
              <Typography color="text.secondary" textAlign="center" py={4}>
                {isRunning ? "Initializing scan..." : "No logs available"}
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
              startIcon={
                isCancelling ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <CancelIcon />
                )
              }
              disabled={isCancelling}
            >
              {isCancelling ? "Cancelling..." : "Cancel Scan"}
            </Button>
          )}

          {logs.length > 0 && (
            <Button startIcon={<DownloadIcon />} onClick={downloadLogs}>
              Download Logs
            </Button>
          )}

          {canClose && (
            <Button onClick={() => setModalOpen(false)} variant="outlined">
              Close
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}

/* ============================================================
   GITLEAKS PANEL
============================================================ */
function GitleaksPanel({
  repoDetails,
  isAuthorized,
  isQuickScan, 
  githubToken,
  onScanComplete
}: {
  repoDetails: RepoDetails;
  isAuthorized: boolean;
  isQuickScan: boolean;
  githubToken: string;
  onScanComplete?: (result: SecretLeakDetectionResult) => void;
}) {
  const logEndRef = useRef<HTMLDivElement>(null);
  const scanIdRef = useRef<string | null>(null);
  const logCleanupRef = useRef<(() => void) | null>(null);
  const completeCleanupRef = useRef<(() => void) | null>(null);

  //  1: Use a Ref to track logs safely for the callback closure
  const logsRef = useRef<string[]>([]);

  // 1. Load Persisted Data
  const savedScan = repoDetails.scans?.secretLeakDetection;

  // 2. Initialize State with Persisted Data
  const [status, setStatus] = useState<ScanStatus>(savedScan?.status || "idle");
  const [logs, setLogs] = useState<string[]>(savedScan?.logs || []);
  const [progress, setProgress] = useState(savedScan?.status === 'success' || savedScan?.status === 'failed' ? 100 : 0);
  const [result, setResult] = useState(savedScan?.summary || null);
  const [showLogs, setShowLogs] = useState(() => {
    return (savedScan?.logs?.length || 0) > 0;
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Auto-scroll logs
  useEffect(() => {
    if (modalOpen && logs.length > 0) {
      setTimeout(() => {
        logEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
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

  // Run Gitleaks scan
  async function runGitleaksScan() {
    if (!isAuthorized) return;

    console.log("[GITLEAKS] Starting scan");

    const scanId = crypto.randomUUID();
    scanIdRef.current = scanId;

    // Reset state
    setLogs([]);
    logsRef.current = [];
    setProgress(0);
    setStatus("running");
    setResult(null);
    setShowLogs(true);
    setModalOpen(true);

    const logCleanup = platform.onScanLog(scanId, (data) => {
      setLogs((prev) => [...prev, data.log]);
      logsRef.current.push(data.log); // Keep ref in sync
      setProgress(data.progress || 0);
    });
    logCleanupRef.current = logCleanup;

    const completeCleanup = platform.onScanComplete(scanId, (data) => {
      console.log("[GITLEAKS] Complete", data);

      const newStatus = data.success ? "success" : "failed";
      setStatus(newStatus);
      setProgress(100);

      let newSummary = undefined;
      if (data.findings !== undefined) {
        newSummary = {
          findings: data.findings,
        };
        setResult(newSummary);
      }

      //Bubble up result to parent for DB save
      if (onScanComplete) {
        onScanComplete({
          status: newStatus,
          timestamp: new Date().toISOString(),
          logs: logsRef.current, // Use Ref to ensure full logs are saved
          summary: newSummary
        });
      }

      if (logCleanupRef.current) logCleanupRef.current();
      if (completeCleanupRef.current) completeCleanupRef.current();
      logCleanupRef.current = null;
      completeCleanupRef.current = null;
      scanIdRef.current = null;
    });
    completeCleanupRef.current = completeCleanup;

    try {
      const result = await platform.runGitleaks({
        repoUrl: repoDetails.repoUrl,
        branch: repoDetails.branch,
        isQuickScan: isQuickScan,
        githubToken: githubToken,
        scanId,
      });

      if (result?.cancelled) {
        setStatus("failed");
        setLogs((prev) => [...prev, "\n❌ Scan was cancelled\n"]);
        logsRef.current.push("\n❌ Scan was cancelled\n");
      }
    } catch (err: any) {
      console.error("[GITLEAKS] Error:", err);
      setStatus("failed");
      const errMsg = `\n❌ Error: ${err.message}\n`;
      setLogs((prev) => [...prev, errMsg]);
      logsRef.current.push(errMsg);
    }
  }

  // Cancel scan
  async function cancelScan() {
    if (!scanIdRef.current) return;

    console.log("[GITLEAKS] Cancelling");
    setIsCancelling(true);
    const msg = "\n⏳ Cancelling scan...\n";
    setLogs((prev) => [...prev, msg]);
    logsRef.current.push(msg);

    try {
      const result = await platform.cancelScan({
        scanId: scanIdRef.current,
      });

      if (result.cancelled) {
        setStatus("failed");
        const cancelMsg = "✅ Scan cancelled successfully\n";
        setLogs((prev) => [...prev, cancelMsg]);
        logsRef.current.push(cancelMsg);
      } else {
        const warnMsg = "⚠️ No active scan found\n";
        setLogs((prev) => [...prev, warnMsg]);
        logsRef.current.push(warnMsg);
      }
    } catch (err: any) {
      console.error("[GITLEAKS] Cancel error:", err);
      const errMsg = `❌ Cancel error: ${err.message}\n`;
      setLogs((prev) => [...prev, errMsg]);
      logsRef.current.push(errMsg);
    } finally {
      if (logCleanupRef.current) logCleanupRef.current();
      if (completeCleanupRef.current) completeCleanupRef.current();
      logCleanupRef.current = null;
      completeCleanupRef.current = null;
      scanIdRef.current = null;

      setIsCancelling(false);
      setTimeout(() => setModalOpen(false), 800);
    }
  }

  // Download logs
  function downloadLogs() {
    const logText = logs.join("");
    const blob = new Blob([logText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gitleaks-scan-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const isRunning = status === "running";
  const canClose = !isRunning && !isCancelling;

  return (
    <>
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Stack width="100%" spacing={1}>
            <Typography textAlign="center" fontWeight={700} fontSize={18}>
              🔐 Secrets & Credentials Leakage Scan 🔐
            </Typography>
            <Typography
              textAlign="center"
              variant="body2"
              color="text.secondary"
            >
              {repoDetails.repoUrl} • {repoDetails.branch}
            </Typography>
          </Stack>
        </AccordionSummary>

        <AccordionDetails>
          <Stack spacing={3}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography fontWeight={600}>Status:</Typography>

                {status === "idle" && (
                  <Typography variant="body2" color="text.secondary">
                    Ready to run
                  </Typography>
                )}

                {status === "running" && (
                  <>
                    <CircularProgress size={16} />
                    <Typography variant="body2" color="primary">
                      Running... {progress}%
                    </Typography>
                  </>
                )}

                {status === "success" && (
                  <>
                    <CheckCircleIcon color="success" fontSize="small" />
                    <Typography variant="body2" color="success.main">
                      Complete
                    </Typography>
                  </>
                )}

                {status === "failed" && (
                  <>
                    <ErrorIcon color="error" fontSize="small" />
                    <Typography variant="body2" color="error.main">
                      Failed
                    </Typography>
                  </>
                )}
              </Stack>

              <Stack direction="row" spacing={1}>
                {logs.length > 0 && (
                  <Button startIcon={<DownloadIcon />} onClick={downloadLogs}>
                    Download Logs
                  </Button>
                )}
                <Button
                  variant="contained"
                  startIcon={<PlayArrowIcon />}
                  disabled={!isAuthorized || isRunning}
                  onClick={runGitleaksScan}
                >
                🔍 Run
                </Button>
              </Stack>
            </Stack>

            {result && (
              <Alert severity={(result.findings ?? 0) > 0 ? "error" : "success"}>
                <Typography variant="body2">
                  {(result.findings ?? 0) > 0 ? (
                    <>
                      <strong>⚠️ {result.findings} potential secrets found</strong>
                    </>
                  ) : (
                    <>
                      <strong>✅ No secrets detected</strong>
                    </>
                  )}
                </Typography>
              </Alert>
            )}

            {/* Logs Section */}
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
                      "&::-webkit-scrollbar": {
                        width: "8px",
                      },
                      "&::-webkit-scrollbar-track": {
                        background: "#2d2d2d",
                      },
                      "&::-webkit-scrollbar-thumb": {
                        background: "#555",
                        borderRadius: "4px",
                      },
                      "&::-webkit-scrollbar-thumb:hover": {
                        background: "#777",
                      },
                    }}
                  >
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
        </AccordionDetails>
      </Accordion>

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
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6" fontWeight={600}>
              🔐 Secrets & Credentials Leakage Scan 🔐
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
                <Box flex={1}>
                  <LinearProgress variant="determinate" value={progress} />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {progress}%
                </Typography>
              </Stack>
            </Box>
          )}

          {isCancelling && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size={16} />
                <Typography variant="body2">
                  Cancelling scan and cleaning up processes...
                </Typography>
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
            "&::-webkit-scrollbar": {
              width: "8px",
            },
            "&::-webkit-scrollbar-track": {
              background: "#2d2d2d",
            },
            "&::-webkit-scrollbar-thumb": {
              background: "#555",
              borderRadius: "4px",
            },
            "&::-webkit-scrollbar-thumb:hover": {
              background: "#777",
            },
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
                <div ref={logEndRef} />
              </>
            ) : (
              <Typography color="text.secondary" textAlign="center" py={4}>
                {isRunning ? "Initializing scan..." : "No logs available"}
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
              startIcon={
                isCancelling ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <CancelIcon />
                )
              }
              disabled={isCancelling}
            >
              {isCancelling ? "Cancelling..." : "Cancel Scan"}
            </Button>
          )}

          {logs.length > 0 && (
            <Button startIcon={<DownloadIcon />} onClick={downloadLogs}>
              Download Logs
            </Button>
          )}

          {canClose && (
            <Button onClick={() => setModalOpen(false)} variant="outlined">
              Close
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}

/* ============================================================
   VULNERABILITY  SCAN PANEL
============================================================ */
function VulnerabilityScanPanel({
  repoDetails,
  isAuthorized,
  isQuickScan, 
  githubToken,
  onScanComplete 
}: {
  repoDetails: RepoDetails;
  isAuthorized: boolean;
  isQuickScan: boolean;
  githubToken: string;
  onScanComplete?: (result: VulnerabilityScanResult) => void;
}) {
  const logEndRef = useRef<HTMLDivElement>(null);
  const scanIdRef = useRef<string | null>(null);
  const logCleanupRef = useRef<(() => void) | null>(null);
  const completeCleanupRef = useRef<(() => void) | null>(null);

  //  Use a Ref to track logs safely for the callback closure
  const logsRef = useRef<string[]>([]);

  //  1. Load Persisted Data safely
  const savedScan = repoDetails.scans?.vulnerabilityScan;

  //  2. Initialize State
  const [status, setStatus] = useState<ScanStatus>(savedScan?.status || "idle");
  const [logs, setLogs] = useState<string[]>(savedScan?.logs || []);
  const [progress, setProgress] = useState(savedScan?.status === 'success' || savedScan?.status === 'failed' ? 100 : 0);
  const [result, setResult] = useState(savedScan?.summary || null);
  const [showLogs, setShowLogs] = useState(() => {
    return (savedScan?.logs?.length || 0) > 0;
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);


  // Auto-scroll logs
  useEffect(() => {
    if (modalOpen && logs.length > 0) {
      setTimeout(() => {
        logEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
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

  // Run vulnerability scan
  async function runVulnerabilityScan() {
    if (!isAuthorized) return;

    console.log("[VULN-SCAN] Starting scan");

    const scanId = crypto.randomUUID();
    scanIdRef.current = scanId;

    // Reset state
    setLogs([]);
    logsRef.current = [];
    setProgress(0);
    setStatus("running");
    setResult(null);
    setShowLogs(true);
    setModalOpen(true);

    const logCleanup = platform.onScanLog(scanId, (data) => {
      setLogs((prev) => [...prev, data.log]);
      logsRef.current.push(data.log); // Keep ref in sync
      setProgress(data.progress || 0);
    });
    logCleanupRef.current = logCleanup;

    const completeCleanup = platform.onScanComplete(scanId, (data) => {
      console.log("[VULN-SCAN] Complete", data);

      const newStatus = data.success ? "success" : "failed";
      setStatus(newStatus);
      setProgress(100);

      let newSummary = undefined;
      if (data.vulnerabilities !== undefined) {
        newSummary = {
          vulnerabilities: data.vulnerabilities,
          critical: data.critical || 0,
          high: data.high || 0,
          medium: data.medium || 0,
          low: data.low || 0,
        };
        setResult(newSummary);
      }

      // Bubble up result to parent for DB save with correct logs
      if (onScanComplete) {
        onScanComplete({
          status: newStatus,
          timestamp: new Date().toISOString(),
          logs: logsRef.current, 
          summary: newSummary
        });
      }

      if (logCleanupRef.current) logCleanupRef.current();
      if (completeCleanupRef.current) completeCleanupRef.current();
      logCleanupRef.current = null;
      completeCleanupRef.current = null;
      scanIdRef.current = null;
    });
    completeCleanupRef.current = completeCleanup;

    try {
      const result = await platform.runVulnScan({
        repoUrl: repoDetails.repoUrl,
        branch: repoDetails.branch,
        isQuickScan: isQuickScan,
        githubToken : githubToken,
        scanId,
      });

      if (result?.cancelled) {
        setStatus("failed");
        setLogs((prev) => [...prev, "\n❌ Scan was cancelled\n"]);
        logsRef.current.push("\n❌ Scan was cancelled\n");
      }
    } catch (err: any) {
      console.error("[VULN-SCAN] Error:", err);
      setStatus("failed");
      const errMsg = `\n❌ Error: ${err.message}\n`;
      setLogs((prev) => [...prev, errMsg]);
      logsRef.current.push(errMsg);
    }
  }

  // Cancel scan
  async function cancelScan() {
    if (!scanIdRef.current) return;

    console.log("[VULN-SCAN] Cancelling");
    setIsCancelling(true);
    const msg = "\n⏳ Cancelling scan...\n";
    setLogs((prev) => [...prev, msg]);
    logsRef.current.push(msg);

    try {
      const result = await platform.cancelScan({
        scanId: scanIdRef.current,
      });

      if (result.cancelled) {
        setStatus("failed");
        const cancelMsg = "✅ Scan cancelled successfully\n";
        setLogs((prev) => [...prev, cancelMsg]);
        logsRef.current.push(cancelMsg);
      } else {
        const warnMsg = "⚠️ No active scan found\n";
        setLogs((prev) => [...prev, warnMsg]);
        logsRef.current.push(warnMsg);
      }
    } catch (err: any) {
      console.error("[VULN-SCAN] Cancel error:", err);
      const errMsg = `❌ Cancel error: ${err.message}\n`;
      setLogs((prev) => [...prev, errMsg]);
      logsRef.current.push(errMsg);
    } finally {
      if (logCleanupRef.current) logCleanupRef.current();
      if (completeCleanupRef.current) completeCleanupRef.current();
      logCleanupRef.current = null;
      completeCleanupRef.current = null;
      scanIdRef.current = null;

      setIsCancelling(false);
      setTimeout(() => setModalOpen(false), 800);
    }
  }

  // Download logs
  function downloadLogs() {
    const logText = logs.join("");
    const blob = new Blob([logText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vulnerability-scan-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const isRunning = status === "running";
  const canClose = !isRunning && !isCancelling;

  return (
    <>
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Stack width="100%" spacing={1}>
            <Typography textAlign="center" fontWeight={700} fontSize={18}>
              🚨 SBOM & Vulnerability Scan 🚨
            </Typography>
            <Typography
              textAlign="center"
              variant="body2"
              color="text.secondary"
            >
              {repoDetails.repoUrl} • {repoDetails.branch}
            </Typography>
          </Stack>
        </AccordionSummary>

        <AccordionDetails>
          <Stack spacing={3}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography fontWeight={600}>Status:</Typography>

                {status === "idle" && (
                  <Typography variant="body2" color="text.secondary">
                    Ready to run
                  </Typography>
                )}

                {status === "running" && (
                  <>
                    <CircularProgress size={16} />
                    <Typography variant="body2" color="primary">
                      Running... {progress}%
                    </Typography>
                  </>
                )}

                {status === "success" && (
                  <>
                    <CheckCircleIcon color="success" fontSize="small" />
                    <Typography variant="body2" color="success.main">
                      Complete
                    </Typography>
                  </>
                )}

                {status === "failed" && (
                  <>
                    <ErrorIcon color="error" fontSize="small" />
                    <Typography variant="body2" color="error.main">
                      Failed
                    </Typography>
                  </>
                )}
              </Stack>

              <Stack direction="row" spacing={1}>
                {logs.length > 0 && (
                  <Button startIcon={<DownloadIcon />} onClick={downloadLogs}>
                    Download Logs
                  </Button>
                )}
                <Button
                  variant="contained"
                  startIcon={<PlayArrowIcon />}
                  disabled={!isAuthorized || isRunning}
                  onClick={runVulnerabilityScan}
                >
                🔍 Run
                </Button>
              </Stack>
            </Stack>

            {result && (
              <Alert severity={result.vulnerabilities! > 0 ? "warning" : "success"}>
                <Typography variant="body2">
                  {result.vulnerabilities! > 0 ? (
                    <>
                      <strong>⚠️ {result.vulnerabilities} vulnerabilities found</strong>
                    </>
                  ) : (
                    <>
                      <strong>✅ No vulnerabilities detected</strong>
                    </>
                  )}
                </Typography>
              </Alert>
            )}

            {/* Logs Section */}
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
                      "&::-webkit-scrollbar": {
                        width: "8px",
                      },
                      "&::-webkit-scrollbar-track": {
                        background: "#2d2d2d",
                      },
                      "&::-webkit-scrollbar-thumb": {
                        background: "#555",
                        borderRadius: "4px",
                      },
                      "&::-webkit-scrollbar-thumb:hover": {
                        background: "#777",
                      },
                    }}
                  >
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
        </AccordionDetails>
      </Accordion>

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
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6" fontWeight={600}>
              🚨 SBOM & Vulnerability Scan 🚨
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
                <Box flex={1}>
                  <LinearProgress variant="determinate" value={progress} />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {progress}%
                </Typography>
              </Stack>
            </Box>
          )}

          {isCancelling && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size={16} />
                <Typography variant="body2">
                  Cancelling scan and cleaning up processes...
                </Typography>
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
            "&::-webkit-scrollbar": {
              width: "8px",
            },
            "&::-webkit-scrollbar-track": {
              background: "#2d2d2d",
            },
            "&::-webkit-scrollbar-thumb": {
              background: "#555",
              borderRadius: "4px",
            },
            "&::-webkit-scrollbar-thumb:hover": {
              background: "#777",
            },
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
                <div ref={logEndRef} />
              </>
            ) : (
              <Typography color="text.secondary" textAlign="center" py={4}>
                {isRunning ? "Initializing scan..." : "No logs available"}
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
              startIcon={
                isCancelling ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <CancelIcon />
                )
              }
              disabled={isCancelling}
            >
              {isCancelling ? "Cancelling..." : "Cancel Scan"}
            </Button>
          )}

          {logs.length > 0 && (
            <Button startIcon={<DownloadIcon />} onClick={downloadLogs}>
              Download Logs
            </Button>
          )}

          {canClose && (
            <Button onClick={() => setModalOpen(false)} variant="outlined">
              Close
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}



