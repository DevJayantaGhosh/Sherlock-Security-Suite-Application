// src/pages/ProjectSecurityScanPage.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Step,
  StepLabel,
  Stepper,
  Typography,
  Stack,
  Chip,
  Divider,
  LinearProgress,
  IconButton,
} from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";
import { getProjects, updateStatus } from "../services/projectService";
import { useUserStore } from "../store/userStore";
import { useToast } from "../components/ToastProvider";
import { motion } from "framer-motion";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ReplayIcon from "@mui/icons-material/Replay";
import ArticleIcon from "@mui/icons-material/Article";
import CloseIcon from "@mui/icons-material/Close";

/**
 * Security Scan Page
 *
 * - per-repo pipeline:
 *   1) Verify GPG signatures (simulate commit scan; report total/signed/unsigned)
 *   2) LLM vulnerability scan (stubbed; show how to integrate with LLM)
 *   3) Dependency audit (simulate CVE findings)
 *
 * - runtime logs streamed during each step
 * - approve/reject with confirmation
 *
 * NOTE: Where real integrations are needed (git access, signature verification,
 * LLM, dependency scanner, blockchain tx) there are commented placeholders.
 */

type ScanStatus = "idle" | "running" | "success" | "failed";

type PipelineStep =
  | "Verify GPG Signatures"
  | "LLM Vulnerability Scan"
  | "Dependency Audit";

const PIPELINE_STEPS: PipelineStep[] = [
  "Verify GPG Signatures",
  "LLM Vulnerability Scan",
  "Dependency Audit",
];

interface RepoScanStep {
  step: PipelineStep;
  status: ScanStatus;
  logs: string[];
}

interface RepoScan {
  repo: string;
  branch: string;
  gpg: string;
  dependencyCount: number;
  steps: RepoScanStep[];

  // results:
  commitsTotal?: number;
  commitsSigned?: number;
  commitsUnsigned?: number;
  llmSummary?: string;
  dependencyIssues?: { pkg: string; severity: "low" | "medium" | "high" }[];
}

export default function ProjectSecurityScanPage(): JSX.Element | null {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const user = useUserStore((s) => s.user);
  const project = getProjects().find((p) => p.id === id);

  // state
  const [scans, setScans] = useState<RepoScan[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const [logText, setLogText] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmDesc, setConfirmDesc] = useState("");

  // keep refs to running intervals so we can cleanup
  const intervals = useRef<Record<string, number | null>>({});

  const isAuthorized =
    user?.role === "Admin" || project?.securityHead === user?.id;

  useEffect(() => {
    if (!project) return;
    if (!isAuthorized) {
      toast("Unauthorized access", "error");
      navigate("/projects");
      return;
    }

    const initial: RepoScan[] =
      (project.gitRepo ?? []).map((repo, idx) => ({
        repo,
        branch: (project.gitBrances ?? [])[idx] ?? "main",
        gpg: (project.gpgKey ?? [])[idx] ?? "",
        dependencyCount: project.dependencies?.length ?? 0,
        steps: PIPELINE_STEPS.map((s) => ({
          step: s,
          status: "idle",
          logs: [],
        })),
      })) ?? [];

    setScans(initial);

    // cleanup on unmount
    return () => {
      Object.values(intervals.current).forEach((t) => {
        if (t) clearInterval(t);
      });
      intervals.current = {};
    };
  }, [project]);

  if (!project || !isAuthorized) return null;

  // Utility: append log to a repo-step
  function appendLog(repoUrl: string, step: PipelineStep, line: string) {
    setScans((prev) =>
      prev.map((r) =>
        r.repo === repoUrl
          ? {
              ...r,
              steps: r.steps.map((s) =>
                s.step === step ? { ...s, logs: [...s.logs, line] } : s
              ),
            }
          : r
      )
    );
  }

  // Update step state + optionally logs
  function updateStepState(
    repoUrl: string,
    step: PipelineStep,
    patch: Partial<RepoScanStep>
  ) {
    setScans((prev) =>
      prev.map((r) =>
        r.repo === repoUrl
          ? {
              ...r,
              steps: r.steps.map((s) => (s.step === step ? { ...s, ...patch } : s)),
            }
          : r
      )
    );
  }

  // Update repo-level results
  function updateRepoResult(repoUrl: string, patch: Partial<RepoScan>) {
    setScans((prev) => prev.map((r) => (r.repo === repoUrl ? { ...r, ...patch } : r)));
  }

  // Simulated: verify GPG signatures by "scanning commits"
  async function performGpgVerify(repo: RepoScan) {
    const step: PipelineStep = "Verify GPG Signatures";
    updateStepState(repo.repo, step, { status: "running", logs: [] });

    // Simulate streaming log lines (e.g., checking commits)
    const totalCommits = 10 + Math.floor(Math.random() * 10);
    let signed = 0;

    appendLog(repo.repo, step, `Starting signature verification for ${repo.repo}...`);
    await delay(400);

    // stream each commit check
    for (let i = 1; i <= totalCommits; i++) {
      // random sign pass
      const isSigned = Math.random() > 0.22; // ≈78% signed
      appendLog(repo.repo, step, `Checking commit #${i}... ${isSigned ? "SIGNED" : "UNSIGNED"}`);
      if (isSigned) signed++;
      await delay(180 + Math.random() * 200);
    }

    // finalize
    const unsigned = totalCommits - signed;
    updateRepoResult(repo.repo, {
      commitsTotal: totalCommits,
      commitsSigned: signed,
      commitsUnsigned: unsigned,
    });

    appendLog(repo.repo, step, `Done — ${signed}/${totalCommits} signed, ${unsigned} unsigned.`);
    updateStepState(repo.repo, step, { status: unsigned === 0 ? "success" : "failed" });

    // if unsigned > 0 mark failed (security decision)
    return unsigned === 0;
  }

  // Simulated: LLM vulnerability scan
  async function performLlmVulnScan(repo: RepoScan) {
    const step: PipelineStep = "LLM Vulnerability Scan";
    updateStepState(repo.repo, step, { status: "running", logs: [] });
    appendLog(repo.repo, step, `Preparing vulnerability scan via LLM for ${repo.repo}...`);
    await delay(600);

    // -------------------------
    // PLACEHOLDER: real LLM integration
    // -------------------------
    // Example (commented): send repo meta / short diff to an LLM service for analysis
    //
    // const resp = await fetch("https://your-llm-host/api/v1/analyze", {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json", Authorization: `Bearer ${LLM_KEY}` },
    //   body: JSON.stringify({ repo: repo.repo, branch: repo.branch, prompt: "...analysis prompt..." })
    // });
    // const data = await resp.json();
    // const summary = data.summary;
    //
    // -------------------------
    // For now simulate
    const issuesDetected = Math.random() > 0.6 ? Math.floor(Math.random() * 4) : 0;
    const summary =
      issuesDetected === 0
        ? "No obvious critical issues found by LLM scan."
        : `${issuesDetected} potential issues (suggest manual review).`;

    appendLog(repo.repo, step, `LLM scan complete: ${summary}`);
    updateRepoResult(repo.repo, { llmSummary: summary });
    updateStepState(repo.repo, step, { status: issuesDetected === 0 ? "success" : "failed" });

    return issuesDetected === 0;
  }

  // Simulated dependency audit
  async function performDependencyAudit(repo: RepoScan) {
    const step: PipelineStep = "Dependency Audit";
    updateStepState(repo.repo, step, { status: "running", logs: [] });
    appendLog(repo.repo, step, `Starting dependency audit for ${repo.repo}...`);
    await delay(500);

    // simulate scanning project's dependencies
    const depCount = repo.dependencyCount ?? 0;
    const issues: RepoScan["dependencyIssues"] = [];

    for (let i = 0; i < Math.min(depCount, 6); i++) {
      // random chance of issue
      if (Math.random() > 0.72) {
        const pkg = `package-${i + 1}`;
        const severity = Math.random() > 0.7 ? "high" : Math.random() > 0.5 ? "medium" : "low";
        issues.push({ pkg, severity: severity as any });
        appendLog(repo.repo, step, `Found ${severity.toUpperCase()} issue in ${pkg}`);
      } else {
        appendLog(repo.repo, step, `Checked package-${i + 1}: ok`);
      }
      await delay(150 + Math.random() * 200);
    }

    updateRepoResult(repo.repo, { dependencyIssues: issues });
    appendLog(repo.repo, step, `Dependency audit finished — ${issues.length} issues found.`);
    updateStepState(repo.repo, step, { status: issues.length === 0 ? "success" : "failed" });

    return issues.length === 0;
  }

  // Run single pipeline step by step for a repo (safe: does not block other repos)
  async function runFullPipeline(repo: RepoScan) {
    // sequentially run steps but allow re-run of single steps via UI too.
    // We'll run all three for convenience
    try {
      const ok1 = await performGpgVerify(repo);
      // if GPG failed we still can continue (but keep status)
      const ok2 = await performLlmVulnScan(repo);
      const ok3 = await performDependencyAudit(repo);

      appendLog(repo.repo, "Dependency Audit", "Pipeline finished.");
      toast(`Scan finished for ${repo.repo}`, "info");
      return ok1 && ok2 && ok3;
    } catch (err) {
      appendLog(repo.repo, "Dependency Audit", "Pipeline aborted with error.");
      updateStepState(repo.repo, "Dependency Audit", { status: "failed" });
      return false;
    }
  }

  // Run a specific step on-demand (Run button on UI)
  async function runStep(repo: RepoScan, step: PipelineStep) {
    if (step === "Verify GPG Signatures") await performGpgVerify(repo);
    else if (step === "LLM Vulnerability Scan") await performLlmVulnScan(repo);
    else if (step === "Dependency Audit") await performDependencyAudit(repo);
  }

  function retryStep(repo: RepoScan, step: PipelineStep) {
    // simply rerun step
    runStep(repo, step);
  }

  // Confirm dialog wrapper
  function openConfirm(title: string, desc: string, action: () => void) {
    setConfirmTitle(title);
    setConfirmDesc(desc);
    setConfirmAction(() => action);
    setConfirmOpen(true);
  }

  function handleApprove() {
    openConfirm(
      "Approve project",
      "Approving will mark this project as Approved (a blockchain TX is simulated). Continue?",
      () => {
        updateStatus(project!.id, "Approved", user!.id, "Security scan approved");
        toast("Approved (simulated) ✅", "success");
        navigate("/projects");
      }
    );
  }

  function handleReject() {
    openConfirm(
      "Reject project",
      "Rejecting will mark this project as Rejected. Continue?",
      () => {
        updateStatus(project!.id, "Rejected", user!.id, "Security scan rejected");
        toast("Rejected (simulated) ⚠️", "warning");
        navigate("/projects");
      }
    );
  }

  // show logs modal
  function showLogs(text: string) {
    setLogText(text);
    setLogOpen(true);
  }

  return (
    <Box sx={{ pt: 10 }}>
      <Container maxWidth="lg">

        {/* Header / Project summary (matches Release page style) */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
              <Box>
                <Typography variant="h4" fontWeight={800}>
                  Security Scan — {project.name}
                </Typography>
                {project.description && (
                  <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                    {project.description}
                  </Typography>
                )}
                <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                  <Typography color="text.secondary">Director: {project.projectDirector || "—"}</Typography>
                  <Typography color="text.secondary">Security Head: {project.securityHead || "—"}</Typography>
                  <Typography color="text.secondary">Release Engineers: {(project.releaseEngineers || []).length}</Typography>
                </Stack>
              </Box>

              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Chip label={`Dependencies: ${project.dependencies?.length || 0}`} color="info" />
                <Button variant="outlined" onClick={() => runFullPipeline(scans[0])} startIcon={<PlayArrowIcon />}>
                  Run full (first repo)
                </Button>
              </Stack>
            </Stack>
          </Paper>
        </motion.div>

        {/* Repos grid / pipeline per repo */}
        <Stack spacing={3}>
          {scans.map((repo) => (
            <Paper key={repo.repo} sx={{ p: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                <Box sx={{ flex: 1 }}>
                  <Typography fontWeight={800}>{repo.repo}</Typography>
                  <Typography fontSize={13} color="text.secondary">Branch: {repo.branch}</Typography>
                  <Typography fontSize={13} color="text.secondary">GPG: {repo.gpg || "—"}</Typography>

                  <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                    <Chip label={`Commits: ${repo.commitsTotal ?? "—"}`} size="small" />
                    <Chip label={`Signed: ${repo.commitsSigned ?? "—"}`} size="small" color="success" />
                    <Chip label={`Unsigned: ${repo.commitsUnsigned ?? "—"}`} size="small" color={(repo.commitsUnsigned ?? 0) > 0 ? "error" : "default"} />
                    <Chip label={`Deps: ${repo.dependencyCount}`} size="small" />
                  </Stack>
                </Box>

                <Stack spacing={1} sx={{ minWidth: 280 }}>
                  <Typography fontSize={13} color="text.secondary">Pipeline</Typography>

                  <Stepper activeStep={repo.steps.findIndex(s => s.status === "running") >= 0 ? repo.steps.findIndex(s => s.status === "running") : repo.steps.findIndex(s => s.status === "failed") >= 0 ? repo.steps.findIndex(s => s.status === "failed") : repo.steps.findIndex(s => s.status === "success" ) + 1} alternativeLabel>
                    {repo.steps.map(s => (
                      <Step key={s.step} completed={s.status === "success"}>
                        <StepLabel error={s.status === "failed"}>{s.step}</StepLabel>
                      </Step>
                    ))}
                  </Stepper>

                  <Stack spacing={1} mt={1}>
                    {repo.steps.map((s) => (
                      <Paper key={s.step} sx={{ p: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <Box>
                          <Typography variant="subtitle2">{s.step}</Typography>
                          <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{s.status.toUpperCase()}</Typography>
                        </Box>

                        <Stack direction="row" spacing={1} alignItems="center">
                          {s.logs.length > 0 && (
                            <Button size="small" onClick={() => showLogs(s.logs.join("\n"))} startIcon={<ArticleIcon />}>View Logs</Button>
                          )}

                          {s.status !== "success" && (
                            <Button size="small" variant="contained" onClick={() => runStep(repo, s.step)} startIcon={<PlayArrowIcon />}>
                              Run
                            </Button>
                          )}

                          {s.status === "failed" && (
                            <Button size="small" color="warning" onClick={() => retryStep(repo, s.step)} startIcon={<ReplayIcon />}>
                              Retry
                            </Button>
                          )}
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                </Stack>
              </Stack>

              {/* optional live progress / summary */}
              <Divider sx={{ my: 1 }} />
              <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                <Box sx={{ width: "70%" }}>
                  <LinearProgress variant="indeterminate" sx={{ opacity: repo.steps.some(s => s.status === "running") ? 1 : 0 }} />
                </Box>

                <Box>
                  <Button size="small" onClick={() => runFullPipeline(repo)} variant="outlined">Run All</Button>
                </Box>
              </Stack>
            </Paper>
          ))}
        </Stack>

        {/* Dependency Audit summary (separate section) */}
        <Paper sx={{ p: 2, mt: 3 }}>
          <Typography variant="h6">Dependency Audit Summary</Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            This section consolidates dependency issues discovered across repositories. Click individual repo steps to inspect per-repo findings and logs.
          </Typography>

          <Stack spacing={1} sx={{ mt: 2 }}>
            {scans.map(s => (
              <Box key={s.repo} sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography>{s.repo}</Typography>
                <Typography sx={{ color: s.dependencyIssues && s.dependencyIssues.length > 0 ? "error.main" : "success.main" }}>
                  {s.dependencyIssues && s.dependencyIssues.length > 0 ? `${s.dependencyIssues.length} issue(s)` : "No issues"}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Paper>

        {/* Approve / Reject */}
        <Stack direction="row" spacing={2} mt={3}>
          <Button fullWidth variant="contained" color="success" onClick={() => openConfirmAction("Approve project", "Are you sure you want to APPROVE this project? This will mark status Approved.", handleApprove)}>
            Approve
          </Button>

          <Button fullWidth variant="contained" color="error" onClick={() => openConfirmAction("Reject project", "Are you sure you want to REJECT this project? This will mark status Rejected.", handleReject)}>
            Reject
          </Button>
        </Stack>

      </Container>

      {/* LOG modal */}
      <Dialog open={logOpen} onClose={() => setLogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Logs
          <IconButton onClick={() => setLogOpen(false)} sx={{ position: "absolute", right: 8, top: 8 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box component="pre" sx={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{logText}</Box>
        </DialogContent>
      </Dialog>

      {/* CONFIRM modal */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>{confirmTitle}</DialogTitle>
        <DialogContent>
          <Typography>{confirmDesc}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button onClick={() => { if (confirmAction) confirmAction(); setConfirmOpen(false); }} variant="contained">Confirm</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );

  // helper to open confirm with action
  function openConfirmAction(title: string, desc: string, action: () => void) {
    setConfirmTitle(title);
    setConfirmDesc(desc);
    setConfirmAction(() => action);
    setConfirmOpen(true);
  }

  // small util
  function delay(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }
}
