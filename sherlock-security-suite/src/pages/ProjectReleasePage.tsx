import {
  Box,
  Button,
  Container,
  Step,
  StepLabel,
  Stepper,
  Typography,
  Stack,
  Paper,
  Dialog,
  DialogContent,
  Tooltip
} from "@mui/material";

import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { useUserStore } from "../store/userStore";
import { authorizeApprove, getProjects } from "../services/projectService";

import {
  PIPELINE_STEPS,
  startRelease,
  getReleases,
  runStep,
  retryStep,
  ReleaseRun,
  PipelineStep
} from "../services/projectReleaseService";

export default function ProjectReleasePage() {

  const { id } = useParams();
  const user = useUserStore(s => s.user);

  const project = getProjects().find(p => p.id === id);

  const [runs, setRuns] = useState<ReleaseRun[]>([]);
  const [active, setActive] = useState<ReleaseRun | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [logText, setLogText] = useState<string>("");

  useEffect(() => {
    setRuns(getReleases(id!));
  }, [id]);

  function beginRelease() {
    const r = startRelease(id!);
    setActive(r);
    setRuns(getReleases(id!));
  }

  function execute(step: PipelineStep) {
    if (!active) return;

    runStep(active.id, step, user?.id || "system");

    setRuns([...getReleases(id!)]);
    setActive({ ...active });
  }

  function retry(step: PipelineStep) {
    if (!active) return;

    retryStep(active.id, step, user?.id || "system");
    setRuns([...getReleases(id!)]);
    setActive({ ...active });
  }

  function showLogs(text: string) {
    setLogText(text);
    setLogOpen(true);
  }

  if (!project) return null;
  const isAuthorized = authorizeApprove(user, project);
  const tooltip = isAuthorized
    ? ""
    : "You can view this page, but cannot perform any release activities";

  return (
    <Box sx={{ pt: 10 }}>
      <Container maxWidth="lg">

        {/* HEADER */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h4" fontWeight={800}>
            {project.name}
          </Typography>
          <Typography color="text.secondary">
            Director: {project.projectDirector || "—"}
          </Typography>
        </Paper>

        {/* START RELEASE */}
        {!active && (
          <Tooltip title={tooltip}>
            <span>
              <Button fullWidth variant="contained" disabled={!isAuthorized} onClick={beginRelease}>
                Start New Release
              </Button>
            </span>
          </Tooltip>

        )}

        {/* PIPELINE */}
        {active && (
          <>
            <Stepper sx={{ my: 4 }}>
              {PIPELINE_STEPS.map(s => {
                const step = active.steps.find(x => x.step === s)!

                return (
                  <Step key={s} completed={step.status === "success"}>
                    <StepLabel error={step.status === "failed"}>
                      {s}
                    </StepLabel>
                  </Step>
                )
              })}
            </Stepper>

            {/* ACTIONS */}
            <Stack spacing={2}>
              {active.steps.map(s => (
                <Paper key={s.step} sx={{ p: 2 }}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography>
                      {s.step} — {s.status.toUpperCase()}
                    </Typography>

                    <Stack direction="row" spacing={1}>
                      {s.logs.length > 0 && (
                        <Button
                          size="small"
                          onClick={() => showLogs(s.logs.join("\n"))}
                        >
                          View Logs
                        </Button>
                      )}

                      {s.status !== "success" && (
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => execute(s.step)}
                        >
                          Run
                        </Button>
                      )}

                      {s.status === "failed" && (
                        <Button
                          size="small"
                          color="warning"
                          onClick={() => retry(s.step)}
                        >
                          Retry
                        </Button>
                      )}
                    </Stack>

                  </Stack>
                </Paper>
              ))}
            </Stack>
          </>
        )}

        {/* HISTORY */}
        <Box mt={5}>
          <Typography variant="h6">
            Previous Releases
          </Typography>

          {runs.map(r => (
            <Paper key={r.id} sx={{ p: 2, my: 1 }}>
              <Typography>
                Release: {r.id.slice(0, 8)}
              </Typography>
              <Typography fontSize={13}>
                Created: {new Date(r.createdAt).toLocaleString()}
              </Typography>
            </Paper>
          ))}
        </Box>

      </Container>

      {/* LOG VIEW MODAL */}
      <Dialog open={logOpen} onClose={() => setLogOpen(false)} maxWidth="md" fullWidth>
        <DialogContent>
          <pre>{logText}</pre>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
