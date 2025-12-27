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
  Paper,
  Chip,
} from "@mui/material";

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import DownloadIcon from "@mui/icons-material/Download";
import CancelIcon from "@mui/icons-material/Cancel";
import CloseIcon from "@mui/icons-material/Close";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import SecurityIcon from "@mui/icons-material/Security";
import InfoIcon from "@mui/icons-material/Info";

import { Product , RepoDetails} from "../../models/Product";
import { useUserStore } from "../../store/userStore";
import { authorizeApprove } from "../../services/productService";

type ScanStatus = "idle" | "running" | "success" | "failed";

export default function RepoScanAccordion({
  product,
  repoDetails
}: {
  product: Product;
  repoDetails:RepoDetails
}) {
  const user = useUserStore((s) => s.user);
  const isAuthorized = authorizeApprove(user, product);

  return (
    <Stack spacing={2}>
      <GPGVerificationPanel
        product={product}
        repoDetails={repoDetails}
        isAuthorized={isAuthorized}
      />
      <GitleaksPanel
        product={product}
        repoDetails={repoDetails}
        isAuthorized={isAuthorized}
      />
      <TrivyPanel
        product={product}
        repoDetails={repoDetails}
        isAuthorized={isAuthorized}
      />
      <OpenGrepPanel 
        product={product}
        repoDetails={repoDetails}
        isAuthorized={isAuthorized}
      />
    </Stack>
  );
}

/* ============================================================
   GPG VERIFICATION PANEL
============================================================ */
function GPGVerificationPanel({
  product,
  repoDetails,
  isAuthorized,
}: {
  product: Product;
  repoDetails:RepoDetails;
  isAuthorized: boolean;
}) {
  const logEndRef = useRef<HTMLDivElement>(null);
  const scanIdRef = useRef<string | null>(null);
  const logCleanupRef = useRef<(() => void) | null>(null);
  const completeCleanupRef = useRef<(() => void) | null>(null);

  const [status, setStatus] = useState<ScanStatus>("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{
    totalCommits?: number;
    goodSignatures?: number;
  } | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

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
        window.electronAPI.cancelScan({ scanId: scanIdRef.current });
      }
    };
  }, []);

  // Run GPG verification
  async function runGPGVerification() {
    if (!isAuthorized) return;

    console.log("[GPG] Starting verification");

    const scanId = crypto.randomUUID();
    scanIdRef.current = scanId;

    setLogs([]);
    setProgress(0);
    setStatus("running");
    setResult(null);
    setShowLogs(false);
    setModalOpen(true);

    const logCleanup = window.electronAPI.onScanLog(scanId, (data) => {
      setLogs((prev) => [...prev, data.log]);
      setProgress(data.progress || 0);
    });
    logCleanupRef.current = logCleanup;

    const completeCleanup = window.electronAPI.onScanComplete(scanId, (data) => {
      console.log("[GPG] Complete", data);

      setStatus(data.success ? "success" : "failed");
      setProgress(100);

      if (data.totalCommits !== undefined) {
        setResult({
          totalCommits: data.totalCommits,
          goodSignatures: data.goodSignatures,
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
      const result = await window.electronAPI.verifyGPG({
        repoUrl: repoDetails.repoUrl,
        branch: repoDetails.branch,
        scanId,
      });

      if (result?.cancelled) {
        setStatus("failed");
        setLogs((prev) => [...prev, "\n❌ Scan was cancelled\n"]);
      }
    } catch (err: any) {
      console.error("[GPG] Error:", err);
      setStatus("failed");
      setLogs((prev) => [...prev, `\n❌ Error: ${err.message}\n`]);
    }
  }

  // Cancel scan
  async function cancelScan() {
    if (!scanIdRef.current) return;

    console.log("[GPG] Cancelling");
    setIsCancelling(true);
    setLogs((prev) => [...prev, "\n⏳ Cancelling scan...\n"]);

    try {
      const result = await window.electronAPI.cancelScan({
        scanId: scanIdRef.current,
      });

      if (result.cancelled) {
        setStatus("failed");
        setLogs((prev) => [...prev, "✅ Scan cancelled successfully\n"]);
      } else {
        setLogs((prev) => [...prev, "⚠️ No active scan found\n"]);
      }
    } catch (err: any) {
      console.error("[GPG] Cancel error:", err);
      setLogs((prev) => [...prev, `❌ Cancel error: ${err.message}\n`]);
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
  product,
  repoDetails,
  isAuthorized,
}: {
  product: Product;
  repoDetails:RepoDetails;
  isAuthorized: boolean;
}) {
  const logEndRef = useRef<HTMLDivElement>(null);
  const scanIdRef = useRef<string | null>(null);
  const logCleanupRef = useRef<(() => void) | null>(null);
  const completeCleanupRef = useRef<(() => void) | null>(null);

  const [status, setStatus] = useState<ScanStatus>("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{
    findings?: number;
  } | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

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
        window.electronAPI.cancelScan({ scanId: scanIdRef.current });
      }
    };
  }, []);

  // Run Gitleaks scan
  async function runGitleaksScan() {
    if (!isAuthorized) return;

    console.log("[GITLEAKS] Starting scan");

    const scanId = crypto.randomUUID();
    scanIdRef.current = scanId;

    setLogs([]);
    setProgress(0);
    setStatus("running");
    setResult(null);
    setShowLogs(false);
    setModalOpen(true);

    const logCleanup = window.electronAPI.onScanLog(scanId, (data) => {
      setLogs((prev) => [...prev, data.log]);
      setProgress(data.progress || 0);
    });
    logCleanupRef.current = logCleanup;

    const completeCleanup = window.electronAPI.onScanComplete(scanId, (data) => {
      console.log("[GITLEAKS] Complete", data);

      setStatus(data.success ? "success" : "failed");
      setProgress(100);

      if (data.findings !== undefined) {
        setResult({
          findings: data.findings,
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
      const result = await window.electronAPI.runGitleaks({
        repoUrl:repoDetails.repoUrl,
        branch:repoDetails.branch,
        scanId,
      });

      if (result?.cancelled) {
        setStatus("failed");
        setLogs((prev) => [...prev, "\n❌ Scan was cancelled\n"]);
      }
    } catch (err: any) {
      console.error("[GITLEAKS] Error:", err);
      setStatus("failed");
      setLogs((prev) => [...prev, `\n❌ Error: ${err.message}\n`]);
    }
  }

  // Cancel scan
  async function cancelScan() {
    if (!scanIdRef.current) return;

    console.log("[GITLEAKS] Cancelling");
    setIsCancelling(true);
    setLogs((prev) => [...prev, "\n⏳ Cancelling scan...\n"]);

    try {
      const result = await window.electronAPI.cancelScan({
        scanId: scanIdRef.current,
      });

      if (result.cancelled) {
        setStatus("failed");
        setLogs((prev) => [...prev, "✅ Scan cancelled successfully\n"]);
      } else {
        setLogs((prev) => [...prev, "⚠️ No active scan found\n"]);
      }
    } catch (err: any) {
      console.error("[GITLEAKS] Cancel error:", err);
      setLogs((prev) => [...prev, `❌ Cancel error: ${err.message}\n`]);
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
              <Alert severity={result.findings! > 0 ? "error" : "success"}>
                <Typography variant="body2">
                  {result.findings! > 0 ? (
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
   TRIVY PANEL
============================================================ */
function TrivyPanel({
  product,
  repoDetails,
  isAuthorized,
}: {
  product: Product;
  repoDetails:RepoDetails
  isAuthorized: boolean;
}) {
  const logEndRef = useRef<HTMLDivElement>(null);
  const scanIdRef = useRef<string | null>(null);
  const logCleanupRef = useRef<(() => void) | null>(null);
  const completeCleanupRef = useRef<(() => void) | null>(null);

  const [status, setStatus] = useState<ScanStatus>("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{
    vulnerabilities?: number;
  } | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

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
        window.electronAPI.cancelScan({ scanId: scanIdRef.current });
      }
    };
  }, []);

  // Run Trivy scan
  async function runTrivyScan() {
    if (!isAuthorized) return;

    console.log("[TRIVY] Starting scan");

    const scanId = crypto.randomUUID();
    scanIdRef.current = scanId;

    setLogs([]);
    setProgress(0);
    setStatus("running");
    setResult(null);
    setShowLogs(false);
    setModalOpen(true);

    const logCleanup = window.electronAPI.onScanLog(scanId, (data) => {
      setLogs((prev) => [...prev, data.log]);
      setProgress(data.progress || 0);
    });
    logCleanupRef.current = logCleanup;

    const completeCleanup = window.electronAPI.onScanComplete(scanId, (data) => {
      console.log("[TRIVY] Complete", data);

      setStatus(data.success ? "success" : "failed");
      setProgress(100);

      if (data.vulnerabilities !== undefined) {
        setResult({
          vulnerabilities: data.vulnerabilities,
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
      const result = await window.electronAPI.runTrivy({
        repoUrl:repoDetails.repoUrl,
        branch:repoDetails.branch,
        scanId,
      });

      if (result?.cancelled) {
        setStatus("failed");
        setLogs((prev) => [...prev, "\n❌ Scan was cancelled\n"]);
      }
    } catch (err: any) {
      console.error("[TRIVY] Error:", err);
      setStatus("failed");
      setLogs((prev) => [...prev, `\n❌ Error: ${err.message}\n`]);
    }
  }

  // Cancel scan
  async function cancelScan() {
    if (!scanIdRef.current) return;

    console.log("[TRIVY] Cancelling");
    setIsCancelling(true);
    setLogs((prev) => [...prev, "\n⏳ Cancelling scan...\n"]);

    try {
      const result = await window.electronAPI.cancelScan({
        scanId: scanIdRef.current,
      });

      if (result.cancelled) {
        setStatus("failed");
        setLogs((prev) => [...prev, "✅ Scan cancelled successfully\n"]);
      } else {
        setLogs((prev) => [...prev, "⚠️ No active scan found\n"]);
      }
    } catch (err: any) {
      console.error("[TRIVY] Cancel error:", err);
      setLogs((prev) => [...prev, `❌ Cancel error: ${err.message}\n`]);
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
    a.download = `trivy-scan-${Date.now()}.log`;
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
                  onClick={runTrivyScan}
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
   OPENGREP PANEL - Multi-Language SAST
============================================================ */
function OpenGrepPanel({
  product,
  repoDetails,
  isAuthorized,
}: {
  product: Product;
  repoDetails: RepoDetails;
  isAuthorized: boolean;
}) {
  const logEndRef = useRef<HTMLDivElement>(null);
  const scanIdRef = useRef<string | null>(null);
  const logCleanupRef = useRef<(() => void) | null>(null);
  const completeCleanupRef = useRef<(() => void) | null>(null);

  const [status, setStatus] = useState<ScanStatus>("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{
    totalIssues?: number;
    passedChecks?: number;
    failedChecks?: number;
  } | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

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
        window.electronAPI.cancelScan({ scanId: scanIdRef.current });
      }
    };
  }, []);

  // Run OpenGrep scan
  async function runOpenGrepScan() {
    if (!isAuthorized) return;

    console.log("[OPENGREP] Starting scan");

    const scanId = crypto.randomUUID();
    scanIdRef.current = scanId;

    setLogs([]);
    setProgress(0);
    setStatus("running");
    setResult(null);
    setShowLogs(false);
    setModalOpen(true);

    const logCleanup = window.electronAPI.onScanLog(scanId, (data) => {
      setLogs((prev) => [...prev, data.log]);
      setProgress(data.progress || 0);
    });
    logCleanupRef.current = logCleanup;

    const completeCleanup = window.electronAPI.onScanComplete(scanId, (data) => {
      console.log("[OPENGREP] Complete", data);

      setStatus(data.success ? "success" : "failed");
      setProgress(100);

      if (data.totalIssues !== undefined) {
        setResult({
          totalIssues: data.totalIssues,
          passedChecks: data.passedChecks,
          failedChecks: data.failedChecks,
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
      const result = await window.electronAPI.runOpenGrep({
        repoUrl: repoDetails.repoUrl,
        branch: repoDetails.branch,
        scanId,
        componentConfigs: repoDetails.componentConfigs,
      });

      if (result?.cancelled) {
        setStatus("failed");
        setLogs((prev) => [...prev, "\n❌ Scan was cancelled\n"]);
      }
    } catch (err: any) {
      console.error("[OPENGREP] Error:", err);
      setStatus("failed");
      setLogs((prev) => [...prev, `\n❌ Error: ${err.message}\n`]);
    }
  }

  // Cancel scan
  async function cancelScan() {
    if (!scanIdRef.current) return;

    console.log("[OPENGREP] Cancelling");
    setIsCancelling(true);
    setLogs((prev) => [...prev, "\n⏳ Cancelling scan...\n"]);

    try {
      const result = await window.electronAPI.cancelScan({
        scanId: scanIdRef.current,
      });

      if (result.cancelled) {
        setStatus("failed");
        setLogs((prev) => [...prev, "✅ Scan cancelled successfully\n"]);
      } else {
        setLogs((prev) => [...prev, "⚠️ No active scan found\n"]);
      }
    } catch (err: any) {
      console.error("[OPENGREP] Cancel error:", err);
      setLogs((prev) => [...prev, `❌ Cancel error: ${err.message}\n`]);
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
    a.download = `opengrep-sast-scan-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const isRunning = status === "running";
  const canClose = !isRunning && !isCancelling;

  // Calculate risk percentage for visual indicator
  const getRiskPercentage = () => {
    if (!result?.totalIssues) return 0;
    if (result.totalIssues <= 5) return 25;
    if (result.totalIssues <= 15) return 50;
    if (result.totalIssues <= 30) return 75;
    return 100;
  };

  return (
    <>
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Stack width="100%" spacing={1}>
            <Typography textAlign="center" fontWeight={700} fontSize={18}>
              🔬 Static Application Security Testing (SAST) 🔬
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
                    Ready to scan
                  </Typography>
                )}

                {status === "running" && (
                  <>
                    <CircularProgress size={16} />
                    <Typography variant="body2" color="primary">
                      Analyzing... {progress}%
                    </Typography>
                  </>
                )}

                {status === "success" && (
                  <>
                    <CheckCircleIcon color="success" fontSize="small" />
                    <Typography variant="body2" color="success.main">
                      Scan Complete
                    </Typography>
                  </>
                )}

                {status === "failed" && (
                  <>
                    <ErrorIcon color="error" fontSize="small" />
                    <Typography variant="body2" color="error.main">
                      Scan Failed
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
                  onClick={runOpenGrepScan}
                >
                  🔍 Run
                </Button>
              </Stack>
            </Stack>

            {/* Results Summary */}
            {result && (
              <Box>
                <Alert 
                  severity={
                    result.totalIssues === 0 ? "success" : 
                    result.totalIssues! <= 5 ? "info" :
                    result.totalIssues! <= 15 ? "warning" : 
                    "error"
                  } 
                  sx={{ mb: 2 }}
                >
                  <Stack spacing={1}>
                    <Typography variant="body2" fontWeight={600}>
                      {result.totalIssues === 0 ? (
                        "✅ No security issues detected - Code is secure!"
                      ) : result.totalIssues! <= 5 ? (
                        `🟡 ${result.totalIssues} security issue(s) found - Low Risk`
                      ) : result.totalIssues! <= 15 ? (
                        `🟠 ${result.totalIssues} security issues found - Medium Risk`
                      ) : (
                        `🔴 ${result.totalIssues} security issues found - High Risk`
                      )}
                    </Typography>
                    {result.totalIssues! > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        {result.failedChecks} failed checks out of {(result.passedChecks || 0) + (result.failedChecks || 0)} total checks
                      </Typography>
                    )}
                  </Stack>
                </Alert>

                {/* Statistics Cards */}
                <Paper 
                  sx={{ 
                    p: 3, 
                    bgcolor: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    mb: 2
                  }}
                >
                  <Stack 
                    direction={{ xs: 'column', md: 'row' }} 
                    spacing={2}
                  >
                    {/* Passed Checks */}
                    <Box flex={1}>
                      <Stack 
                        alignItems="center" 
                        spacing={1}
                        sx={{
                          p: 3,
                          bgcolor: "rgba(76, 175, 80, 0.1)",
                          borderRadius: 2,
                          border: "2px solid rgba(76, 175, 80, 0.3)",
                          transition: "all 0.3s",
                          "&:hover": {
                            bgcolor: "rgba(76, 175, 80, 0.15)",
                            transform: "translateY(-2px)",
                          }
                        }}
                      >
                        <CheckCircleIcon sx={{ fontSize: 48, color: "success.main" }} />
                        <Typography variant="h3" fontWeight={700} color="success.main">
                          {result.passedChecks || 0}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" fontWeight={600}>
                          Passed Checks
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Security rules passed
                        </Typography>
                      </Stack>
                    </Box>

                    {/* Failed Checks */}
                    <Box flex={1}>
                      <Stack 
                        alignItems="center" 
                        spacing={1}
                        sx={{
                          p: 3,
                          bgcolor: result.totalIssues! > 0 ? "rgba(244, 67, 54, 0.1)" : "rgba(76, 175, 80, 0.1)",
                          borderRadius: 2,
                          border: result.totalIssues! > 0 ? "2px solid rgba(244, 67, 54, 0.3)" : "2px solid rgba(76, 175, 80, 0.3)",
                          transition: "all 0.3s",
                          "&:hover": {
                            bgcolor: result.totalIssues! > 0 ? "rgba(244, 67, 54, 0.15)" : "rgba(76, 175, 80, 0.15)",
                            transform: "translateY(-2px)",
                          }
                        }}
                      >
                        <ErrorIcon 
                          sx={{ 
                            fontSize: 48, 
                            color: result.totalIssues! > 0 ? "error.main" : "success.main" 
                          }} 
                        />
                        <Typography 
                          variant="h3" 
                          fontWeight={700} 
                          color={result.totalIssues! > 0 ? "error.main" : "success.main"}
                        >
                          {result.failedChecks || 0}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" fontWeight={600}>
                          Failed Checks
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Security rules violated
                        </Typography>
                      </Stack>
                    </Box>

                    {/* Total Issues */}
                    <Box flex={1}>
                      <Stack 
                        alignItems="center" 
                        spacing={1}
                        sx={{
                          p: 3,
                          bgcolor: "rgba(33, 150, 243, 0.1)",
                          borderRadius: 2,
                          border: "2px solid rgba(33, 150, 243, 0.3)",
                          transition: "all 0.3s",
                          "&:hover": {
                            bgcolor: "rgba(33, 150, 243, 0.15)",
                            transform: "translateY(-2px)",
                          }
                        }}
                      >
                        <SecurityIcon sx={{ fontSize: 48, color: "info.main" }} />
                        <Typography variant="h3" fontWeight={700} color="info.main">
                          {result.totalIssues || 0}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" fontWeight={600}>
                          Total Issues
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Vulnerabilities detected
                        </Typography>
                      </Stack>
                    </Box>
                  </Stack>

                  {/* Risk Level Indicator */}
                  <Box sx={{ mt: 3 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                      <Typography variant="body2" fontWeight={600}>
                        Security Risk Level
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {result.totalIssues === 0 ? "Excellent" : 
                         result.totalIssues! <= 5 ? "Good" :
                         result.totalIssues! <= 15 ? "Fair" : "Poor"}
                      </Typography>
                    </Stack>
                    
                    <Stack direction="row" spacing={1}>
                      <Box
                        flex={1}
                        sx={{
                          height: 40,
                          bgcolor: result.totalIssues === 0 ? "success.main" : "rgba(255,255,255,0.05)",
                          borderRadius: 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: result.totalIssues === 0 ? "2px solid" : "1px solid rgba(255,255,255,0.1)",
                          borderColor: result.totalIssues === 0 ? "success.main" : "transparent",
                          transition: "all 0.3s",
                          "&:hover": {
                            bgcolor: result.totalIssues === 0 ? "success.dark" : "rgba(255,255,255,0.08)",
                          }
                        }}
                      >
                        <Typography variant="caption" fontWeight={700} sx={{ textTransform: "uppercase" }}>
                          ✅ Clean
                        </Typography>
                      </Box>
                      <Box
                        flex={1}
                        sx={{
                          height: 40,
                          bgcolor: result.totalIssues! > 0 && result.totalIssues! <= 5 ? "info.main" : "rgba(255,255,255,0.05)",
                          borderRadius: 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: result.totalIssues! > 0 && result.totalIssues! <= 5 ? "2px solid" : "1px solid rgba(255,255,255,0.1)",
                          borderColor: result.totalIssues! > 0 && result.totalIssues! <= 5 ? "info.main" : "transparent",
                          transition: "all 0.3s",
                          "&:hover": {
                            bgcolor: result.totalIssues! > 0 && result.totalIssues! <= 5 ? "info.dark" : "rgba(255,255,255,0.08)",
                          }
                        }}
                      >
                        <Typography variant="caption" fontWeight={700} sx={{ textTransform: "uppercase" }}>
                          🟡 Low
                        </Typography>
                      </Box>
                      <Box
                        flex={1}
                        sx={{
                          height: 40,
                          bgcolor: result.totalIssues! > 5 && result.totalIssues! <= 15 ? "warning.main" : "rgba(255,255,255,0.05)",
                          borderRadius: 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: result.totalIssues! > 5 && result.totalIssues! <= 15 ? "2px solid" : "1px solid rgba(255,255,255,0.1)",
                          borderColor: result.totalIssues! > 5 && result.totalIssues! <= 15 ? "warning.main" : "transparent",
                          transition: "all 0.3s",
                          "&:hover": {
                            bgcolor: result.totalIssues! > 5 && result.totalIssues! <= 15 ? "warning.dark" : "rgba(255,255,255,0.08)",
                          }
                        }}
                      >
                        <Typography variant="caption" fontWeight={700} sx={{ textTransform: "uppercase" }}>
                          🟠 Medium
                        </Typography>
                      </Box>
                      <Box
                        flex={1}
                        sx={{
                          height: 40,
                          bgcolor: result.totalIssues! > 15 ? "error.main" : "rgba(255,255,255,0.05)",
                          borderRadius: 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: result.totalIssues! > 15 ? "2px solid" : "1px solid rgba(255,255,255,0.1)",
                          borderColor: result.totalIssues! > 15 ? "error.main" : "transparent",
                          transition: "all 0.3s",
                          "&:hover": {
                            bgcolor: result.totalIssues! > 15 ? "error.dark" : "rgba(255,255,255,0.08)",
                          }
                        }}
                      >
                        <Typography variant="caption" fontWeight={700} sx={{ textTransform: "uppercase" }}>
                          🔴 High
                        </Typography>
                      </Box>
                    </Stack>

                    {/* Risk Percentage Bar */}
                    <Box sx={{ mt: 2 }}>
                      <Stack direction="row" justifyContent="space-between" mb={0.5}>
                        <Typography variant="caption" color="text.secondary">
                          Risk Score
                        </Typography>
                        <Typography variant="caption" fontWeight={600}>
                          {getRiskPercentage()}%
                        </Typography>
                      </Stack>
                      <Box
                        sx={{
                          width: "100%",
                          height: 8,
                          bgcolor: "rgba(255,255,255,0.1)",
                          borderRadius: 4,
                          overflow: "hidden",
                        }}
                      >
                        <Box
                          sx={{
                            width: `${getRiskPercentage()}%`,
                            height: "100%",
                            bgcolor: result.totalIssues === 0 ? "success.main" :
                                     result.totalIssues! <= 5 ? "info.main" :
                                     result.totalIssues! <= 15 ? "warning.main" : "error.main",
                            transition: "width 0.5s ease-in-out",
                          }}
                        />
                      </Box>
                    </Box>
                  </Box>

                  {/* Recommendation */}
                  <Box sx={{ mt: 3, p: 2, bgcolor: "rgba(255,255,255,0.03)", borderRadius: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="flex-start">
                      <InfoIcon sx={{ fontSize: 20, color: "info.main", mt: 0.2 }} />
                      <Box>
                        <Typography variant="body2" fontWeight={600} mb={0.5}>
                          Recommendation
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {result.totalIssues === 0 
                            ? "All code passes security analysis. Safe to proceed with release and deployment."
                            : result.totalIssues! <= 5 
                            ? "Review and fix minor security issues before release. Low priority remediation."
                            : result.totalIssues! <= 15 
                            ? "Address security issues before deploying to production. Medium priority."
                            : "DO NOT RELEASE - Critical security vulnerabilities detected. Immediate remediation required."}
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>
                </Paper>
              </Box>
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
                  sx={{ mb: showLogs ? 2 : 0 }}
                >
                  {showLogs ? "Hide Detailed Logs" : "Show Detailed Logs"}
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
              🔬 Static Application Security Testing (SAST) 🔬
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
                <Typography variant="body2" color="text.secondary" fontWeight={600}>
                  {progress}%
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Scanning for security issues across all projects and languages...
              </Typography>
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
                {isRunning ? "Initializing OpenGrep scanner..." : "No logs available"}
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


