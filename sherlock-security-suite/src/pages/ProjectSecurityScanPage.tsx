// src/pages/ProjectSecurityScanPage.tsx

import {
  Box,
  Button,
  Container,
  Dialog,
  DialogContent,
  Paper,
  Step,
  StepLabel,
  Stepper,
  Typography,
  Stack
} from "@mui/material";

import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

import { getProjects, updateStatus } from "../services/projectService";
import { useUserStore } from "../store/userStore";
import { useToast } from "../components/ToastProvider";

/* =====================================================
   🔮 FUTURE REAL SCAN HOOKS (IPC / BACKEND)
========================================================

export async function ipcRepoVulnerabilityScan(repoUrl:string){
   return window.electron.ipcRenderer.invoke("scan-repo",repoUrl);
}

export async function ipcVerifyCommitSignatures(repoUrl:string){
   return window.electron.ipcRenderer.invoke("verify-gpg",repoUrl);
}

export async function apiWriteBlockchainTx(payload){
   return fetch("/api/blockchain/security-approval",{...});
}

====================================================== */

type ScanStatus = "pending" | "running" | "success" | "failed";

interface RepoScanResult {
  repo: string;
  branch: string;
  gpg: string;

  signature: ScanStatus;
  vulnerabilities: ScanStatus;

  logs: string[];
}

/* =========  PIPELINE STEPS ========= */

const PIPELINE_STEPS = [
  "Verify Commits",
  "Dependency Audit",
  "LLM Vulnerability Scan"
];

export default function ProjectSecurityScanPage() {

  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const user = useUserStore(s => s.user);

  const project = getProjects().find(p => p.id === id);

  const [results, setResults] = useState<RepoScanResult[]>([]);
  const [activeStep, setActiveStep] = useState(0);

  const [logOpen, setLogOpen] = useState(false);
  const [logText, setLogText] = useState("");

  /* =================================================
      SECURITY ACCESS
  ================================================== */

  const isAuthorized =
    user?.role === "Admin" ||
    project?.securityHead === user?.id;

  useEffect(() => {

    if (!project) return;

    if (!isAuthorized) {
      toast("Unauthorized access", "error");
      navigate("/projects");
      return;
    }

    const scans: RepoScanResult[] =
      project.gitRepo?.map((repo, i) => ({
        repo,
        branch: project.gitBrances?.[i] || "main",
        gpg: project.gpgKey?.[i] || "",

        signature: "pending",
        vulnerabilities: "pending",

        logs: []
      })) ?? [];

    setResults(scans);

  }, [project]);

  if (!project || !isAuthorized) return null;

  /* =================================================
        PIPELINE EXECUTION (MOCKED)
  ================================================== */

  async function runPipeline() {

    for (let step = 0; step < PIPELINE_STEPS.length; step++) {

      setActiveStep(step);

      for (const scan of results) {

        scan.logs.push(
          `[${PIPELINE_STEPS[step]}] Running on ${scan.repo}`
        );

        updateRepo(scan.repo, {
          signature:
            step === 0 ? "running" : scan.signature,

          vulnerabilities:
            step > 0 ? "running" : scan.vulnerabilities
        });

        await fakeDelay(1200);

        updateRepo(scan.repo, {
          signature:
            step === 0 ? "success" : scan.signature,

          vulnerabilities:
            step > 0 ? "success" : scan.vulnerabilities
        });

        scan.logs.push(`[DONE] ${PIPELINE_STEPS[step]} completed ✅`);

      }
    }

    toast("Security scan completed ✅", "success");
  }

  /* ================================================= */

  function updateRepo(name: string, patch: Partial<RepoScanResult>) {
    setResults(prev =>
      prev.map(r =>
        r.repo === name ? { ...r, ...patch } : r
      )
    );
  }

  function showLogs(text: string) {
    setLogText(text);
    setLogOpen(true);
  }

  async function fakeDelay(ms: number) {
    return new Promise(res => setTimeout(res, ms));
  }

  /* =================================================
        FINAL BLOCKCHAIN APPROVAL
  ================================================== */

  function approveRelease() {

    updateStatus(
      project!.id,
      "Approved",
      user!.id,
      "Security scan approved (Blockchain TX simulated)"
    );

    toast("Security Approval recorded to blockchain ✅", "success");
    navigate("/projects");
  }

  function rejectRelease() {

    updateStatus(
      project!.id,
      "Rejected",
      user!.id,
      "Security scan failed (Blockchain TX simulated)"
    );

    toast("Security rejected ⚠️", "warning");
    navigate("/projects");
  }

  /* =================================================
            RENDER
  ================================================== */

  return (
    <Box sx={{ pt: 8 }}>
      <Container maxWidth="lg">

        {/* PROJECT HEADER */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h4" fontWeight={800}>
            Security Scan — {project.name}
          </Typography>

          <Typography color="text.secondary">
            Version: {project.version}
          </Typography>

          <Typography color="text.secondary">
            Director: {project.projectDirector || "—"}
          </Typography>

          <Typography color="text.secondary">
            Security Head: {project.securityHead || "—"}
          </Typography>

          <Typography color="text.secondary">
            Dependencies:
            {" "}
            {project.dependencies?.join(", ") || "--"}
          </Typography>
        </Paper>

        {/* PIPELINE */}
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {PIPELINE_STEPS.map(s => (
            <Step key={s}>
              <StepLabel>{s}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* REPO SCAN TABLE */}
        <Stack spacing={2}>

          {results.map((r) => (
            <Paper key={r.repo} sx={{ p: 2 }}>

              <Stack spacing={1}>

                <Typography fontWeight={700}>
                  {r.repo}
                </Typography>

                <Typography fontSize={13}>
                  Branch: {r.branch}
                </Typography>

                <Typography fontSize={13}>
                  GPG: {r.gpg || "—"}
                </Typography>


                <Stack direction="row" spacing={2}>
                  <StatusChip
                    label="Commit Verification"
                    status={r.signature}
                  />

                  <StatusChip
                    label="LLM Vuln Scan"
                    status={r.vulnerabilities}
                  />
                </Stack>

                <Button
                  size="small"
                  onClick={() => showLogs(r.logs.join("\n"))}
                  disabled={r.logs.length === 0}
                >
                  View Logs
                </Button>

              </Stack>

            </Paper>
          ))}

        </Stack>

        {/* ACTIONS */}
        <Stack direction="row" spacing={2} mt={4}>

          <Button
            fullWidth
            variant="contained"
            onClick={runPipeline}
            disabled={activeStep >= PIPELINE_STEPS.length}
          >
            Start Security Scan
          </Button>

          <Button
            fullWidth
            color="success"
            variant="contained"
            onClick={approveRelease}
          >
            Approve
          </Button>

          <Button
            fullWidth
            color="error"
            variant="contained"
            onClick={rejectRelease}
          >
            Reject
          </Button>

        </Stack>

      </Container>


      {/* LOG VIEWER */}
      <Dialog
        open={logOpen}
        onClose={() => setLogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogContent>
          <pre>{logText}</pre>
        </DialogContent>
      </Dialog>

    </Box>
  );
}

/* =================================================
      STATUS CHIPS
================================================== */

function StatusChip({
  label,
  status
}: {
  label: string;
  status: ScanStatus
}) {

  const colorMap = {
    pending: "default",
    running: "info",
    success: "success",
    failed: "error"
  } as const;

  return (
    <Box
      sx={{
        px: 1.5,
        py: 0.5,
        borderRadius: 1,
        bgcolor:
          colorMap[status] === "success"
            ? "rgba(76,175,80,0.15)"
            : colorMap[status] === "error"
              ? "rgba(244,67,54,0.15)"
              : colorMap[status] === "info"
                ? "rgba(33,150,243,0.15)"
                : "rgba(255,255,255,0.08)"
      }}
    >
      <Typography fontSize={12}>
        {label} — {status.toUpperCase()}
      </Typography>
    </Box>
  );
}
