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
  Tooltip,
  Chip,
} from "@mui/material";

import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useUserStore } from "../store/userStore";
import { authorizeRelease, getProducts } from "../services/productService";  // ✅ Changed

import {
  PIPELINE_STEPS,
  startRelease,
  getReleases,
  runStep,
  retryStep,
  ReleaseRun,
  PipelineStep,
} from "../services/productReleaseService";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";

export default function ProductReleasePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useUserStore((s) => s.user);

  const product = getProducts().find((p) => p.id === id);

  const [runs, setRuns] = useState<ReleaseRun[]>([]);
  const [active, setActive] = useState<ReleaseRun | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [logText, setLogText] = useState<string>("");

  useEffect(() => {
    if (id) {
      setRuns(getReleases(id));
    }
  }, [id]);

  function beginRelease() {
    if (!id) return;
    const r = startRelease(id);
    setActive(r);
    setRuns(getReleases(id));
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

  if (!product) {
    return (
      <Box sx={{ pt: 10 }}>
        <Container maxWidth="lg">
          <Typography variant="h5" color="error">
            Product not found
          </Typography>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate("/products")}
            sx={{ mt: 2 }}
          >
            Back to Products
          </Button>
        </Container>
      </Box>
    );
  }

  const isAuthorized = authorizeRelease(user, product);  // ✅ Changed
  const tooltip = isAuthorized
    ? ""
    : "You can view this page, but cannot perform any release activities. Only assigned Release Engineers or Admins can execute releases.";

  return (
    <Box sx={{ pt: 10, pb: 6, minHeight: "100vh" }}>
      <Container maxWidth="lg">
        {/* BACK BUTTON */}
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/products")}
          sx={{ mb: 3 }}
        >
          Back to Products
        </Button>

        {/* HEADER */}
        <Paper
          sx={{
            p: 3,
            mb: 3,
            background: "linear-gradient(140deg,#0c1023,#090c1c,#060712)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Box>
              <Typography variant="h4" fontWeight={800}>
                {product.name} <Chip label={`v${product.version}`} size="small" sx={{ ml: 1 }} />
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                Director: {product.productDirector || "—"} | Security: {product.securityHead || "—"}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {product.description}
              </Typography>
            </Box>

            <Chip
              label={product.status}
              color={
                product.status === "Approved"
                  ? "success"
                  : product.status === "Released"
                  ? "primary"
                  : "warning"
              }
              sx={{ fontWeight: 700 }}
            />
          </Box>
        </Paper>

        {/* AUTHORIZATION WARNING */}
        {!isAuthorized && (
          <Paper
            sx={{
              p: 2,
              mb: 3,
              bgcolor: "rgba(255,193,7,0.1)",
              border: "1px solid rgba(255,193,7,0.3)",
            }}
          >
            <Typography color="warning.main" fontWeight={600}>
              ⚠️ View-Only Mode
            </Typography>
            <Typography variant="body2" color="text.secondary">
              You can view this release workflow but cannot execute any steps. Only assigned
              Release Engineers or Admins can perform release operations.
            </Typography>
          </Paper>
        )}

        {/* START RELEASE */}
        {!active && (
          <Tooltip title={tooltip} arrow>
            <span>
              <Button
                fullWidth
                variant="contained"
                disabled={!isAuthorized}
                onClick={beginRelease}
                startIcon={<RocketLaunchIcon />}
                sx={{
                  py: 2,
                  fontSize: 16,
                  fontWeight: 700,
                  background: isAuthorized
                    ? "linear-gradient(135deg,#7b5cff,#5ce1e6)"
                    : undefined,
                  "&:hover": isAuthorized
                    ? {
                        background: "linear-gradient(135deg,#6a4de0,#4bc0c5)",
                      }
                    : undefined,
                }}
              >
                Start New Release
              </Button>
            </span>
          </Tooltip>
        )}

        {/* PIPELINE */}
        {active && (
          <>
            <Paper
              sx={{
                p: 3,
                my: 4,
                background: "rgba(123,92,255,0.05)",
                border: "1px solid rgba(123,92,255,0.2)",
              }}
            >
              <Typography variant="h6" fontWeight={700} mb={3}>
                Release Pipeline Progress
              </Typography>

              <Stepper>
                {PIPELINE_STEPS.map((s) => {
                  const step = active.steps.find((x) => x.step === s)!;

                  return (
                    <Step key={s} completed={step.status === "success"}>
                      <StepLabel
                        error={step.status === "failed"}
                        sx={{
                          "& .MuiStepLabel-label": {
                            fontWeight: step.status === "running" ? 700 : 400,
                          },
                        }}
                      >
                        {s}
                      </StepLabel>
                    </Step>
                  );
                })}
              </Stepper>
            </Paper>

            {/* ACTIONS */}
            <Typography variant="h6" fontWeight={700} mb={2}>
              Pipeline Steps
            </Typography>

            <Stack spacing={2}>
              {active.steps.map((s:any) => (
                <Paper
                  key={s.step}
                  sx={{
                    p: 2,
                    border:
                      s.status === "running"
                        ? "2px solid #7b5cff"
                        : s.status === "failed"
                        ? "1px solid #ff6b6b"
                        : "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography fontWeight={700}>
                        {s.step}{" "}
                        <Chip
                          label={s.status.toUpperCase()}
                          size="small"
                          color={
                            s.status === "success"
                              ? "success"
                              : s.status === "failed"
                              ? "error"
                              : s.status === "running"
                              ? "primary"
                              : "default"
                          }
                          sx={{ ml: 1 }}
                        />
                      </Typography>
                      {s.executedBy && (
                        <Typography variant="caption" color="text.secondary">
                          Executed by: {s.executedBy} at{" "}
                          {s.executedAt ? new Date(s.executedAt).toLocaleString() : "—"}
                        </Typography>
                      )}
                    </Box>

                    <Stack direction="row" spacing={1}>
                      {s.logs.length > 0 && (
                        <Button size="small" onClick={() => showLogs(s.logs.join("\n"))}>
                          View Logs
                        </Button>
                      )}

                      {s.status !== "success" && (
                        <Tooltip
                          title={!isAuthorized ? "You don't have permission" : ""}
                          arrow
                        >
                          <span>
                            <Button
                              size="small"
                              variant="contained"
                              disabled={!isAuthorized || s.status === "running"}
                              onClick={() => execute(s.step)}
                              sx={{
                                background: "linear-gradient(135deg,#7b5cff,#5ce1e6)",
                              }}
                            >
                              {s.status === "running" ? "Running..." : "Run"}
                            </Button>
                          </span>
                        </Tooltip>
                      )}

                      {s.status === "failed" && (
                        <Tooltip
                          title={!isAuthorized ? "You don't have permission" : ""}
                          arrow
                        >
                          <span>
                            <Button
                              size="small"
                              color="warning"
                              variant="outlined"
                              disabled={!isAuthorized}
                              onClick={() => retry(s.step)}
                            >
                              Retry
                            </Button>
                          </span>
                        </Tooltip>
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
          <Typography variant="h6" fontWeight={700} mb={2}>
            Release History
          </Typography>

          {runs.length === 0 && (
            <Paper sx={{ p: 3, textAlign: "center" }}>
              <Typography color="text.secondary">No releases yet</Typography>
            </Paper>
          )}

          <Stack spacing={1}>
            {runs.map((r) => (
              <Paper
                key={r.id}
                sx={{
                  p: 2,
                  border: r.id === active?.id ? "2px solid #7b5cff" : undefined,
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography fontWeight={600}>Release: {r.id.slice(0, 8)}</Typography>
                    <Typography fontSize={13} color="text.secondary">
                      Created: {new Date(r.createdAt).toLocaleString()}
                    </Typography>
                  </Box>

                  {r.id === active?.id && (
                    <Chip label="Active" color="primary" size="small" />
                  )}
                </Stack>
              </Paper>
            ))}
          </Stack>
        </Box>
      </Container>

      {/* LOG VIEW MODAL */}
      <Dialog open={logOpen} onClose={() => setLogOpen(false)} maxWidth="md" fullWidth>
        <DialogContent>
          <Typography variant="h6" fontWeight={700} mb={2}>
            Step Logs
          </Typography>
          <Paper
            sx={{
              p: 2,
              bgcolor: "#0c1023",
              border: "1px solid rgba(255,255,255,0.1)",
              maxHeight: 400,
              overflow: "auto",
            }}
          >
            <pre style={{ margin: 0, fontFamily: "monospace", fontSize: 12 }}>
              {logText || "No logs available"}
            </pre>
          </Paper>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
