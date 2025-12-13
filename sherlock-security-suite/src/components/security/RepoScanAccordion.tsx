// src/components/security/RepoScanAccordion.tsx
import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Box,
  Button,
  Stack,
  Stepper,
  Step,
  StepLabel,
  Typography,
  Divider,
  Collapse,
  CircularProgress,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Snackbar,
  Alert,
} from "@mui/material";

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ReplayIcon from "@mui/icons-material/Replay";
import DownloadIcon from "@mui/icons-material/Download";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import ErrorIcon from "@mui/icons-material/Error";
import VisibilityIcon from "@mui/icons-material/Visibility";

import { Project } from "../../models/Project";
import { useUserStore } from "../../store/userStore";
import { authorizeApprove } from "../../services/projectService";

type StepStatus = "idle" | "running" | "success" | "failed";

export const ALL_STEPS = [
  { id: "verify-gpg", label: "GPG Signature Verification" },
  { id: "gitleaks", label: "Secrets Scan – Gitleaks" },
  { id: "sbom-trivy", label: "SBOM Scan – Trivy" },
  { id: "sast-codeql", label: "SAST – CodeQL" },
];

function StepIcon({ state, idx }: { state: StepStatus; idx: number }) {
  if (state === "running") return <CircularProgress size={18} />;
  if (state === "success") return <CheckCircleIcon color="success" fontSize="small" />;
  if (state === "failed") return <ErrorIcon color="error" fontSize="small" />;

  return (
    <Box
      sx={{
        width: 22,
        height: 22,
        borderRadius: "50%",
        border: "1px solid #7c3aed",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        color: "#7c3aed",
      }}
    >
      {idx + 1}
    </Box>
  );
}

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
  const location = useLocation();

  // Refs
  const scanIdsRef = useRef<Record<string, string>>({});
  const cleanupFunctionsRef = useRef<Record<string, (() => void)[]>>({});
  const isMountedRef = useRef(true);
  
  // State
  const [statuses, setStatuses] = useState<Record<string, StepStatus>>(
    Object.fromEntries(ALL_STEPS.map((s) => [s.id, "idle"]))
  );
  const [logs, setLogs] = useState<Record<string, string[]>>({});
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    Object.fromEntries(ALL_STEPS.map((s) => [s.id, true]))
  );
  
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<string | null>(null);
  const [showCancelToast, setShowCancelToast] = useState(false);

  // ✅ Non-blocking cleanup
  const cleanupAllScans = useCallback(() => {
    console.log("[CLEANUP] Starting cleanup");
    
    isMountedRef.current = false;
    
    // Show brief notification if there are active scans
    const hasActiveScans = Object.values(statuses).some(s => s === "running");
    if (hasActiveScans) {
      setShowCancelToast(true);
      setTimeout(() => setShowCancelToast(false), 500);
    }
    
    // Cancel all scans (fire and forget - non-blocking)
    Object.entries(scanIdsRef.current).forEach(([stepId, scanId]) => {
      console.log(`[CLEANUP] Cancelling ${stepId}: ${scanId}`);
      window.electronAPI.cancelScan({ scanId }); // Returns immediately
    });

    // Cleanup listeners
    Object.entries(cleanupFunctionsRef.current).forEach(([stepId, cleanups]) => {
      cleanups.forEach((cleanup) => {
        try {
          cleanup();
        } catch (err) {
          console.error(`[CLEANUP] Error cleaning ${stepId}:`, err);
        }
      });
    });

    // Clear refs
    cleanupFunctionsRef.current = {};
    scanIdsRef.current = {};
    
    console.log("[CLEANUP] Cleanup complete");
  }, [statuses]);

  // Cleanup on unmount
  useEffect(() => {
    console.log(`[MOUNT] RepoScanAccordion mounted for ${repoUrl}`);
    isMountedRef.current = true;
    
    return () => {
      console.log(`[UNMOUNT] RepoScanAccordion unmounting for ${repoUrl}`);
      cleanupAllScans();
    };
  }, [repoUrl, cleanupAllScans]);

  // Cleanup on route change
  useEffect(() => {
    console.log(`[ROUTE] Current route: ${location.pathname}`);
    
    return () => {
      console.log(`[ROUTE] Leaving route: ${location.pathname}`);
      cleanupAllScans();
    };
  }, [location.pathname, cleanupAllScans]);

  // Cancel individual step
  const cancelStep = useCallback(async (stepId: string) => {
    const scanId = scanIdsRef.current[stepId];
    if (!scanId) {
      console.log(`[CANCEL] No scanId for ${stepId}`);
      return;
    }

    console.log(`[CANCEL] Cancelling step: ${stepId} (${scanId})`);
    
    // Update UI immediately
    if (isMountedRef.current) {
      setStatuses((prev) => ({ ...prev, [stepId]: "failed" }));
      setLogs((prev) => ({
        ...prev,
        [stepId]: [...(prev[stepId] || []), "\n❌ Cancelled by user\n"],
      }));
    }
    
    // Cancel scan (non-blocking)
    await window.electronAPI.cancelScan({ scanId });
    
    // Cleanup
    cleanupFunctionsRef.current[stepId]?.forEach((cleanup) => cleanup());
    delete cleanupFunctionsRef.current[stepId];
    delete scanIdsRef.current[stepId];
  }, []);

  // Run step
  const runStep = useCallback(async (stepId: string, showModal: boolean = false) => {
    if (!isAuthorized || !isMountedRef.current) {
      console.log(`[RUN] Blocked - authorized: ${isAuthorized}, mounted: ${isMountedRef.current}`);
      return;
    }

    console.log(`[RUN] Starting ${stepId}, showModal: ${showModal}`);

    // Cancel previous scan if running
    if (statuses[stepId] === "running") {
      await cancelStep(stepId);
      // Small delay to allow cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const scanId = crypto.randomUUID();
    scanIdsRef.current[stepId] = scanId;

    console.log(`[RUN] Scan ID for ${stepId}: ${scanId}`);

    setLogs((prev) => ({ ...prev, [stepId]: [] }));
    setProgress((prev) => ({ ...prev, [stepId]: 0 }));
    setStatuses((prev) => ({ ...prev, [stepId]: "running" }));

    if (showModal) {
      setModalStep(stepId);
      setModalOpen(true);
    }

    // Subscribe to logs
    const logCleanup = window.electronAPI.onScanLog(scanId, (data) => {
      if (!isMountedRef.current) {
        console.log(`[LOG] Ignoring log for ${scanId} - unmounted`);
        return;
      }
      
      setLogs((prev) => ({
        ...prev,
        [stepId]: [...(prev[stepId] || []), data.log],
      }));
      setProgress((prev) => ({ 
        ...prev, 
        [stepId]: data.progress || 0 
      }));
    });

    // Subscribe to completion
    const completeCleanup = window.electronAPI.onScanComplete(scanId, (data) => {
      if (!isMountedRef.current) {
        console.log(`[COMPLETE] Ignoring complete for ${scanId} - unmounted`);
        return;
      }
      
      console.log(`[COMPLETE] Scan complete for ${stepId}:`, data);
      
      setStatuses((prev) => ({
        ...prev,
        [stepId]: data.success ? "success" : "failed",
      }));
      setProgress((prev) => ({ ...prev, [stepId]: 100 }));

      // Cleanup after delay
      setTimeout(() => {
        logCleanup();
        completeCleanup();
        delete cleanupFunctionsRef.current[stepId];
        delete scanIdsRef.current[stepId];
      }, 100);
    });

    // Store cleanup functions
    cleanupFunctionsRef.current[stepId] = [logCleanup, completeCleanup];

    // Run scan
    try {
      let result;
      switch (stepId) {
        case "verify-gpg":
          result = await window.electronAPI.verifyGPG({ repoUrl, branch, scanId });
          break;
        case "gitleaks":
          result = await window.electronAPI.runGitleaks({ repoUrl, branch, scanId });
          break;
        case "sbom-trivy":
          result = await window.electronAPI.runTrivy({ repoUrl, branch, scanId });
          break;
        case "sast-codeql":
          result = await window.electronAPI.runCodeQL({ repoUrl, branch, scanId });
          break;
      }

      console.log(`[RUN] Scan result for ${stepId}:`, result);

      if (result?.cancelled && isMountedRef.current) {
        setStatuses((prev) => ({ ...prev, [stepId]: "failed" }));
        setLogs((prev) => ({
          ...prev,
          [stepId]: [...(prev[stepId] || []), "\n❌ Scan was cancelled\n"],
        }));
      }
    } catch (err: any) {
      console.error(`[RUN] Scan ${stepId} failed:`, err);
      
      if (isMountedRef.current) {
        setStatuses((prev) => ({ ...prev, [stepId]: "failed" }));
        setLogs((prev) => ({
          ...prev,
          [stepId]: [...(prev[stepId] || []), `\n❌ Error: ${err.message}\n`],
        }));
      }
    }
  }, [isAuthorized, statuses, repoUrl, branch, cancelStep]);

  // Download logs
  function downloadStep(stepId: string) {
    const logText = (logs[stepId] || []).join("");
    const blob = new Blob([logText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${stepId}-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const currentModalStep = modalStep ? ALL_STEPS.find(s => s.id === modalStep) : null;

  return (
    <>
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Stack width="100%" spacing={1}>
            <Typography textAlign="center" fontWeight={700} fontSize={18}>
              Security Scanning of Repository
            </Typography>

            <Stepper alternativeLabel activeStep={-1}>
              {ALL_STEPS.map((s, i) => (
                <Step key={s.id}>
                  <StepLabel icon={<StepIcon state={statuses[s.id]} idx={i} />}>
                    {s.label}
                  </StepLabel>
                </Step>
              ))}
            </Stepper>
          </Stack>
        </AccordionSummary>

        <AccordionDetails>
          <Stack spacing={2}>
            {ALL_STEPS.map((s) => (
              <Box key={s.id}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography fontWeight={600}>{s.label}</Typography>
                    {statuses[s.id] === "running" && (
                      <Typography variant="caption" color="primary">
                        {progress[s.id] || 0}%
                      </Typography>
                    )}
                    {statuses[s.id] === "success" && (
                      <Typography variant="caption" color="success.main">
                        Complete
                      </Typography>
                    )}
                    {statuses[s.id] === "failed" && (
                      <Typography variant="caption" color="error.main">
                        Failed
                      </Typography>
                    )}
                  </Stack>

                  <Stack direction="row" spacing={1}>
                    {/* Run Button */}
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<PlayArrowIcon />}
                      disabled={!isAuthorized || statuses[s.id] === "running"}
                      onClick={() => runStep(s.id, false)}
                    >
                      Run
                    </Button>

                    {/* View in Modal Button */}
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => {
                        if (statuses[s.id] === "running") {
                          setModalStep(s.id);
                          setModalOpen(true);
                        } else {
                          runStep(s.id, true);
                        }
                      }}
                      disabled={!isAuthorized}
                      title="View in modal"
                    >
                      <VisibilityIcon fontSize="small" />
                    </IconButton>

                    {/* Cancel Button */}
                    {statuses[s.id] === "running" && (
                      <Button
                        size="small"
                        color="error"
                        startIcon={<CancelIcon />}
                        onClick={() => cancelStep(s.id)}
                      >
                        Cancel
                      </Button>
                    )}

                    {/* Retry Button */}
                    {statuses[s.id] === "failed" && (
                      <Button
                        size="small"
                        startIcon={<ReplayIcon />}
                        onClick={() => runStep(s.id, false)}
                      >
                        Retry
                      </Button>
                    )}

                    {/* Download Logs */}
                    <Button
                      size="small"
                      startIcon={<DownloadIcon />}
                      onClick={() => downloadStep(s.id)}
                      disabled={!logs[s.id]?.length}
                    >
                      Logs
                    </Button>

                    {/* Expand/Collapse */}
                    <IconButton
                      size="small"
                      onClick={() =>
                        setExpanded((p) => ({ ...p, [s.id]: !p[s.id] }))
                      }
                    >
                      {expanded[s.id] ? (
                        <KeyboardArrowUpIcon />
                      ) : (
                        <KeyboardArrowDownIcon />
                      )}
                    </IconButton>
                  </Stack>
                </Stack>

                {/* Progress Bar */}
                {statuses[s.id] === "running" && (
                  <LinearProgress
                    variant="determinate"
                    value={progress[s.id] || 0}
                    sx={{ mt: 1 }}
                  />
                )}

                {/* Inline Logs */}
                <Collapse in={expanded[s.id]}>
                  <Paper
                    sx={{
                      p: 2,
                      mt: 1,
                      maxHeight: 300,
                      overflow: "auto",
                      fontFamily: "JetBrains Mono, monospace",
                      fontSize: 12,
                      backgroundColor: "#0a0a0a",
                      color: "#00ff00",
                      border: "1px solid #333",
                    }}
                  >
                    {logs[s.id]?.length > 0 ? (
                      logs[s.id].map((log, i) => (
                        <Typography
                          key={i}
                          component="pre"
                          sx={{
                            margin: 0,
                            fontFamily: "inherit",
                            fontSize: "inherit",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                          }}
                        >
                          {log}
                        </Typography>
                      ))
                    ) : (
                      <Typography color="text.secondary" fontStyle="italic">
                        No logs yet. Click "Run" to start the scan.
                      </Typography>
                    )}
                  </Paper>
                </Collapse>

                <Divider sx={{ my: 1 }} />
              </Box>
            ))}
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Modal for Full Screen Logs */}
      <Dialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          {currentModalStep?.label || "Scan Logs"}
          {modalStep && statuses[modalStep] === "running" && (
            <LinearProgress
              variant="determinate"
              value={progress[modalStep] || 0}
              sx={{ mt: 1 }}
            />
          )}
        </DialogTitle>

        <DialogContent sx={{ height: "60vh", backgroundColor: "#0a0a0a", overflow: "auto" }}>
          <Box
            sx={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 13,
              color: "#00ff00",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {modalStep && logs[modalStep]?.length > 0 ? (
              logs[modalStep].map((log, i) => (
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
              ))
            ) : (
              <Typography color="text.secondary">No logs available</Typography>
            )}
          </Box>
        </DialogContent>

        <DialogActions>
          {modalStep && statuses[modalStep] === "running" && (
            <Button
              onClick={() => {
                if (modalStep) cancelStep(modalStep);
                setModalOpen(false);
              }}
              color="error"
              startIcon={<CancelIcon />}
            >
              Cancel & Close
            </Button>
          )}
          <Button onClick={() => setModalOpen(false)}>Close</Button>
          {modalStep && (
            <Button
              startIcon={<DownloadIcon />}
              onClick={() => modalStep && downloadStep(modalStep)}
            >
              Download
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Cancel Toast - Brief notification */}
      <Snackbar
        open={showCancelToast}
        autoHideDuration={500}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        sx={{ pointerEvents: "none" }}
      >
        <Alert severity="info" sx={{ pointerEvents: "auto" }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <CircularProgress size={16} />
            <Typography variant="body2">Stopping scans...</Typography>
          </Stack>
        </Alert>
      </Snackbar>
    </>
  );
}
