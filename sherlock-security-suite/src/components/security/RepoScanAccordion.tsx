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
} from "@mui/material";

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import DownloadIcon from "@mui/icons-material/Download";
import CancelIcon from "@mui/icons-material/Cancel";
import CloseIcon from "@mui/icons-material/Close";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";

import { Project } from "../../models/Project";
import { useUserStore } from "../../store/userStore";
import { authorizeApprove } from "../../services/projectService";

type ScanStatus = "idle" | "running" | "success" | "failed";

export default function RepoScanAccordion({
  project,
  repoUrl,
  branch = "main",
}: {
  project: Project;
  repoUrl: string;
  branch?: string;
}) {
  const user = useUserStore((s) => s.user);
  const isAuthorized = authorizeApprove(user, project);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Refs for cleanup
  const scanIdRef = useRef<string | null>(null);
  const logCleanupRef = useRef<(() => void) | null>(null);
  const completeCleanupRef = useRef<(() => void) | null>(null);

  // State
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{
    totalCommits?: number;
    goodSignatures?: number;
  } | null>(null);

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
      // Cleanup listeners
      if (logCleanupRef.current) logCleanupRef.current();
      if (completeCleanupRef.current) completeCleanupRef.current();

      // Cancel active scan
      if (scanIdRef.current) {
        window.electronAPI.cancelScan({ scanId: scanIdRef.current });
      }
    };
  }, []);

  // Run GPG verification
  async function runGPGVerification() {
    if (!isAuthorized) return;

    console.log("[RUN] Starting GPG verification");

    const scanId = crypto.randomUUID();
    scanIdRef.current = scanId;

    // Reset state
    setLogs([]);
    setProgress(0);
    setStatus("running");
    setResult(null);
    setModalOpen(true);

    // Subscribe to logs
    const logCleanup = window.electronAPI.onScanLog(scanId, (data) => {
      setLogs((prev) => [...prev, data.log]);
      setProgress(data.progress || 0);
    });
    logCleanupRef.current = logCleanup;

    // Subscribe to completion
    const completeCleanup = window.electronAPI.onScanComplete(scanId, (data) => {
      console.log("[COMPLETE] Scan complete", data);

      setStatus(data.success ? "success" : "failed");
      setProgress(100);

      if (data.totalCommits !== undefined) {
        setResult({
          totalCommits: data.totalCommits,
          goodSignatures: data.goodSignatures,
        });
      }

      // Cleanup listeners
      if (logCleanupRef.current) logCleanupRef.current();
      if (completeCleanupRef.current) completeCleanupRef.current();
      logCleanupRef.current = null;
      completeCleanupRef.current = null;
      scanIdRef.current = null;
    });
    completeCleanupRef.current = completeCleanup;

    // Call Electron API
    try {
      const result = await window.electronAPI.verifyGPG({
        repoUrl,
        branch,
        scanId,
      });

      if (result?.cancelled) {
        setStatus("failed");
        setLogs((prev) => [...prev, "\n❌ Scan was cancelled\n"]);
      }
    } catch (err: any) {
      console.error("[RUN] Error:", err);
      setStatus("failed");
      setLogs((prev) => [...prev, `\n❌ Error: ${err.message}\n`]);
    }
  }

  // Cancel scan
  async function cancelScan() {
    if (!scanIdRef.current) return;

    console.log("[CANCEL] Cancelling scan");
    setIsCancelling(true);
    setLogs((prev) => [...prev, "\n⏳ Cancelling scan...\n"]);

    try {
      const result = await window.electronAPI.cancelScan({
        scanId: scanIdRef.current,
      });

      console.log("[CANCEL] Result:", result);

      if (result.cancelled) {
        setStatus("failed");
        setLogs((prev) => [...prev, "✅ Scan cancelled successfully\n"]);
      } else {
        setLogs((prev) => [...prev, "⚠️ No active scan found\n"]);
      }
    } catch (err: any) {
      console.error("[CANCEL] Error:", err);
      setLogs((prev) => [...prev, `❌ Cancel error: ${err.message}\n`]);
    } finally {
      // Cleanup listeners
      if (logCleanupRef.current) logCleanupRef.current();
      if (completeCleanupRef.current) completeCleanupRef.current();
      logCleanupRef.current = null;
      completeCleanupRef.current = null;
      scanIdRef.current = null;

      setIsCancelling(false);

      // Close modal after cancel
      setTimeout(() => {
        setModalOpen(false);
      }, 800);
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
      {/* Accordion */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Stack width="100%" spacing={1}>
            <Typography textAlign="center" fontWeight={700} fontSize={18}>
              GPG Signature Verification
            </Typography>
            <Typography
              textAlign="center"
              variant="body2"
              color="text.secondary"
            >
              {repoUrl} • {branch}
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

              {/* Action Buttons */}
              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  startIcon={<PlayArrowIcon />}
                  disabled={!isAuthorized || isRunning}
                  onClick={runGPGVerification}
                >
                  Run Verification
                </Button>

                {logs.length > 0 && (
                  <Button startIcon={<DownloadIcon />} onClick={downloadLogs}>
                    Download Logs
                  </Button>
                )}
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
      >
        {/* Header */}
        <DialogTitle>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6" fontWeight={600}>
              GPG Signature Verification
            </Typography>

            {canClose && (
              <IconButton onClick={() => setModalOpen(false)} size="small">
                <CloseIcon />
              </IconButton>
            )}
          </Stack>

          {/* Progress Bar */}
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

          {/* Cancelling Alert */}
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

        {/* Logs Content */}
        <DialogContent
          sx={{
            height: "70vh",
            backgroundColor: "#0a0a0a",
            overflow: "auto",
            p: 3,
          }}
        >
          <Box
            sx={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 13,
              color: "#107b10ff",
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

        {/* Footer Actions */}
        <DialogActions sx={{ p: 2 }}>
          {/* Cancel Button */}
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

          {/* Download Button */}
          {logs.length > 0 && (
            <Button startIcon={<DownloadIcon />} onClick={downloadLogs}>
              Download Logs
            </Button>
          )}

          {/* Close Button */}
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
