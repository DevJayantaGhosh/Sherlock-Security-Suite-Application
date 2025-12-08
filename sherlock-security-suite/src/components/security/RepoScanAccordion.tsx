import { useEffect, useRef, useState } from "react";
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Box,
  Button,
  IconButton,
  Paper,
  Stack,
  Stepper,
  Step,
  StepLabel,
  TextField,
  Typography,
  Divider,
  Collapse,
  CircularProgress,
} from "@mui/material";

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ReplayIcon from "@mui/icons-material/Replay";
import DownloadIcon from "@mui/icons-material/Download";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";

import {
  runRepoScan,
  onScanProgress,
  ScanProgress,
} from "../../services/securityService";
import { color } from "framer-motion";
import { orange } from "@mui/material/colors";

/* ------------------------------------------------------- */
/* Types */
/* ------------------------------------------------------- */

type StepStatus = "idle" | "running" | "success" | "failed" | "done";

/* ------------------------------------------------------- */
/* Pipeline Steps */
/* ------------------------------------------------------- */

export const ALL_STEPS = [
  { id: "verify-gpg", label: "GPG Signature Verification" },
  { id: "sbom-trivy", label: "SBOM Scan – Trivy" },
  { id: "sbom-grype", label: "SBOM Scan – Grype" },
  { id: "sast-semgrep", label: "SAST – Semgrep" },
  { id: "binary-verify", label: "Binary Integrity Check" },
];

/* ------------------------------------------------------- */
/* Step Icon */
/* ------------------------------------------------------- */

function StepIcon({
  state,
  idx,
}: {
  state: StepStatus;
  idx: number;
}) {
  if (state === "running") return <CircularProgress size={18} />;
  if (state === "success" || state === "done")
    return <CheckCircleIcon color="success" fontSize="small" />;
  if (state === "failed")
    return <CancelIcon color="error" fontSize="small" />;

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

/* ------------------------------------------------------- */
/* Main Component */
/* ------------------------------------------------------- */

export default function RepoScanAccordion({
  projectId,
  repoIndex,
  repoUrl,
  branch = "main",
  gpg,
}: {
  projectId: string;
  repoIndex: number;
  repoUrl: string;
  branch?: string;
  gpg?: string;
}) {
  const tailRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [statuses, setStatuses] = useState<Record<string, StepStatus>>(
    ALL_STEPS.reduce(
      (acc, s) => ({ ...acc, [s.id]: "idle" }),
      {} as Record<string, StepStatus>
    )
  );

  const [logs, setLogs] = useState<Record<string, string[]>>({});
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>(
    ALL_STEPS.reduce(
      (acc, s) => ({ ...acc, [s.id]: true }),
      {} as Record<string, boolean>
    )
  );

  const [running, setRunning] = useState(false);

  /* ------------------------------------------------------- */
  /* Subscribe to pipeline stream */
  /* ------------------------------------------------------- */

  useEffect(() => {
    const handler = (p: ScanProgress) => {
      if (p.repo !== repoUrl) return;

      if (!p.step) return;


      // Append logs with deduplication
      setLogs((prev) => {
        const existing = prev[p.step] || [];
        const incoming = p.logs || [];

        const deduped = incoming.filter(
          (line) => line && line !== existing[existing.length - 1]
        );

        return {
          ...prev,
          [p.step]: [...existing, ...deduped],
        };
      });


      // Update status
      setStatuses((prev) => ({
        ...prev,
        [p.step]:
          p.status === "running"
            ? "running"
            : p.status === "failed"
              ? "failed"
              : "success",
      }));

      if (p.step === "summary" && p.status === "done") {
        setRunning(false);
      }
    };

    onScanProgress(handler);

    return () => {
      // IPC cleanup is handled internally — no unsafe unsub calls
    };
  }, [repoUrl]);

  /* ------------------------------------------------------- */
  /* Auto-scroll terminals */
  /* ------------------------------------------------------- */

  useEffect(() => {
    ALL_STEPS.forEach((s) => {
      tailRefs.current[s.id]?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    });
  }, [logs]);

  /* ------------------------------------------------------- */
  /* Run entire pipeline */
  /* ------------------------------------------------------- */

  async function onRun() {
    setRunning(true);

    setLogs({});
    setStatuses(
      ALL_STEPS.reduce(
        (acc, s) => ({ ...acc, [s.id]: "idle" }),
        {} as Record<string, StepStatus>
      )
    );

    await runRepoScan(projectId, repoIndex, repoUrl, branch);
  }

  /* ------------------------------------------------------- */
  /* Retry from step */
  /* ------------------------------------------------------- */

  async function retryStep(stepId: string) {
    if (statuses[stepId] !== "failed") return;

    setRunning(true);

    // wipe logs ONLY for that step
    setLogs((prev) => ({ ...prev, [stepId]: [] }));

    setStatuses((prev) => ({
      ...prev,
      [stepId]: "idle",
    }));

    // re-run full pipeline
    await runRepoScan(projectId, repoIndex, repoUrl, branch);
  }

  /* ------------------------------------------------------- */
  /* Download logs */
  /* ------------------------------------------------------- */

  function downloadStep(stepId: string) {
    const data = logs[stepId] || [];

    const blob = new Blob([data.join("\n")], {
      type: "text/plain",
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${repoUrl.replace(/[^\w.-]/g, "_")}-${stepId}.log`;
    link.click();
  }

  /* ------------------------------------------------------- */
  /* UI */
  /* ------------------------------------------------------- */

  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack width="100%" spacing={1}>

          {/* Center Title */}
          <Typography
            textAlign="center"
            fontWeight={700}
            fontSize={18}
          >
            Security Scanning of Repository
          </Typography>

          {/* Repo + Branch Row */}
          <Stack
            direction="row"
            justifyContent="center"
            spacing={3}
            flexWrap="wrap"
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="caption">Repository:</Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {repoUrl}
              </Typography>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="caption">Branch:</Typography>
              <Typography variant="caption" color="text.secondary">
                {branch}
              </Typography>
            </Stack>
          </Stack>

          {/* Stepper */}
          <Box sx={{ mt: 1 }}>
            <Stepper alternativeLabel activeStep={-1}>
              {ALL_STEPS.map((s, idx) => (
                <Step key={s.id}>
                  <StepLabel icon={<StepIcon state={statuses[s.id]} idx={idx} />}>
                    {s.label}
                  </StepLabel>
                </Step>
              ))}
            </Stepper>
          </Box>

        </Stack>
      </AccordionSummary>


      <AccordionDetails>
        <Stack spacing={2}>
          {/* Pipeline Run */}
          <Stack direction="row" justifyContent="flex-end">
            <Button
              startIcon={<PlayArrowIcon />}
              variant="contained"
              onClick={onRun}
              disabled={running}
            >
              Run Full Pipeline
            </Button>
          </Stack>

          <Divider />

          {/* Steps */}
          {ALL_STEPS.map((s) => (
            <Box key={s.id}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Typography fontWeight={600}>{s.label}</Typography>

                <Stack direction="row" spacing={1}>
                  {statuses[s.id] === "failed" && (
                    <Button
                      size="small"
                      startIcon={<ReplayIcon />}
                      sx={{
                        color: "#f97316",
                        borderColor: "#f97316",
                        "&:hover": {
                          backgroundColor: "rgba(249, 115, 22, 0.08)",
                          borderColor: "#fb923c",
                        },
                      }}
                      onClick={() => retryStep(s.id)}
                    >
                      Retry
                    </Button>
                  )}

                  <Button size="small"
                    endIcon={<DownloadIcon />}
                    onClick={() => downloadStep(s.id)}>
                    Download Logs
                  </Button>

                  <IconButton
                    onClick={() =>
                      setExpandedSteps((prev) => ({
                        ...prev,
                        [s.id]: !prev[s.id],
                      }))
                    }
                  >
                    {expandedSteps[s.id] ? (
                      <KeyboardArrowUpIcon />
                    ) : (
                      <KeyboardArrowDownIcon />
                    )}
                  </IconButton>
                </Stack>
              </Stack>

              {/* Terminal */}
              <Collapse in={expandedSteps[s.id]}>
                <Paper
                  sx={{
                    p: 1,
                    mt: 1,
                    maxHeight: 200,
                    overflow: "auto",
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: 12,
                    backgroundColor: "#05070d",
                    color: "#d1d5db",
                  }}
                >
                  {(logs[s.id] || []).map((line, i) => (
                    <Typography
                      key={i}
                      sx={{
                        whiteSpace: "pre-wrap",
                        fontSize: 12,
                      }}
                    >
                      {line}
                    </Typography>
                  ))}
                  <div ref={(el) => (tailRefs.current[s.id] = el)} />
                </Paper>
              </Collapse>

              <Divider sx={{ my: 1 }} />
            </Box>
          ))}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}
