import { useState, useRef, useEffect } from "react";
import {
  Box,
  Paper,
  Stack,
  Typography,
  Button,
  Tooltip,
  CircularProgress,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Collapse,
  IconButton,
} from "@mui/material";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import CancelIcon from "@mui/icons-material/Cancel";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";

import { Product } from "../../models/Product";
import { platform } from "../../platform";
import { updateProduct } from "../../services/productService";

type ReleaseStatus = "idle" | "running" | "success" | "failed";

interface RepoReleaseStatus {
  repoUrl: string;
  branch: string;
  status: "pending" | "running" | "success" | "failed";
}

interface ProductReleaseCardProps {
  product: Product;
  borderColor?: string;
  disabled?: boolean;
  tooltipTitle?: string;
  tooltipSingleTitle?: string;
  tooltipBatchTitle?: string;
  onReleaseComplete?: () => void;
}

export default function ProductReleaseCard({
  product,
  borderColor = "#7b5cff",
  disabled = false,
  tooltipTitle = "",
  onReleaseComplete,
}: ProductReleaseCardProps) {
  const [status, setStatus] = useState<ReleaseStatus>("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [repoStatuses, setRepoStatuses] = useState<RepoReleaseStatus[]>([]);

  const scanIdRef = useRef<string | null>(null);
  const logCleanupRef = useRef<(() => void) | null>(null);
  const completeCleanupRef = useRef<(() => void) | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const logsRef = useRef<string[]>([]);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (modalOpen && logs.length > 0 && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, modalOpen]);

  useEffect(() => {
    return () => {
      if (logCleanupRef.current) logCleanupRef.current();
      if (completeCleanupRef.current) completeCleanupRef.current();
      if (scanIdRef.current) {
        platform.cancelScan({ scanId: scanIdRef.current });
      }
    };
  }, []);

  const cleanupListeners = () => {
    if (logCleanupRef.current) { logCleanupRef.current(); logCleanupRef.current = null; }
    if (completeCleanupRef.current) { completeCleanupRef.current(); completeCleanupRef.current = null; }
  };

  /** Release a single repo — returns true on success */
  const releaseOneRepo = (
    repoUrl: string,
    branch: string,
    version: string,
    repoIndex: number,
    totalRepos: number,
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      cleanupListeners();

      const scanId = crypto.randomUUID();
      scanIdRef.current = scanId;

      const header =
        totalRepos > 1
          ? `\n${"━".repeat(60)}\n📦 Repository ${repoIndex + 1} / ${totalRepos}\n   ${repoUrl}  (${branch})\n${"━".repeat(60)}\n`
          : "";

      if (header) {
        setLogs((prev) => [...prev, header]);
        logsRef.current.push(header);
      }

      // Update per-repo status → running
      setRepoStatuses((prev) =>
        prev.map((r, i) => (i === repoIndex ? { ...r, status: "running" } : r))
      );

      const logCleanup = platform.onScanLog(scanId, (data) => {
        setLogs((prev) => [...prev, data.log]);
        logsRef.current.push(data.log);
        // Scale progress across repos
        const repoShare = 100 / totalRepos;
        const base = repoIndex * repoShare;
        setProgress(Math.round(base + (data.progress || 0) * (repoShare / 100)));
      });
      logCleanupRef.current = logCleanup;

      const completeCleanup = platform.onScanComplete(scanId, (data) => {
        cleanupListeners();
        if (data.success) {
          setRepoStatuses((prev) =>
            prev.map((r, i) => (i === repoIndex ? { ...r, status: "success" } : r))
          );
          const msg = `\n✅ Release created for ${repoUrl}\n`;
          setLogs((prev) => [...prev, msg]);
          logsRef.current.push(msg);
          resolve(true);
        } else {
          setRepoStatuses((prev) =>
            prev.map((r, i) => (i === repoIndex ? { ...r, status: "failed" } : r))
          );
          const msg = `\n❌ Release failed for ${repoUrl}: ${data.error || "Unknown"}\n`;
          setLogs((prev) => [...prev, msg]);
          logsRef.current.push(msg);
          resolve(false);
        }
      });
      completeCleanupRef.current = completeCleanup;

      platform
        .createGitHubRelease({ repoUrl, branch, version, scanId })
        .catch((err: any) => {
          if (err.message !== "cancelled") {
            const errorMsg = `\n❌ Error: ${err.message}\n`;
            setLogs((prev) => [...prev, errorMsg]);
            logsRef.current.push(errorMsg);
            setRepoStatuses((prev) =>
              prev.map((r, i) => (i === repoIndex ? { ...r, status: "failed" } : r))
            );
            cleanupListeners();
            resolve(false);
          }
        });
    });
  };

  const handlePrepareRelease = async () => {
    if (!product.repos || product.repos.length === 0) {
      toast.error("No repositories configured for this product");
      return;
    }

    cancelledRef.current = false;
    const repos = product.repos;
    const totalRepos = repos.length;

    // Init per-repo statuses
    setRepoStatuses(
      repos.map((r) => ({ repoUrl: r.repoUrl, branch: r.branch, status: "pending" as const }))
    );

    const initLogs = [
      `🚀 GitHub Release STARTED`,
      `Product: ${product.name}`,
      `Version: ${product.version}`,
      `Repositories: ${totalRepos}`,
      ...repos.map((r, i) => `  ${i + 1}. ${r.repoUrl} (${r.branch})`),
      `${"=".repeat(60)}\n`,
    ];

    setLogs(initLogs);
    logsRef.current = [...initLogs];
    setStatus("running");
    setProgress(0);
    setShowLogs(false);
    setModalOpen(true);
    setIsCancelling(false);

    let allSuccess = true;
    let anySuccess = false;

    for (let i = 0; i < totalRepos; i++) {
      if (cancelledRef.current) break;

      const repo = repos[i];
      const ok = await releaseOneRepo(repo.repoUrl, repo.branch, product.version, i, totalRepos);

      if (ok) anySuccess = true;
      else allSuccess = false;
    }

    // Final status
    if (cancelledRef.current) {
      setStatus("failed");
    } else if (allSuccess) {
      setStatus("success");
      setProgress(100);
      const doneMsg = `\n✅ All ${totalRepos} release(s) created successfully!\n`;
      setLogs((prev) => [...prev, doneMsg]);
      logsRef.current.push(doneMsg);

      try {
        await updateProduct({ ...product, status: "Released" });
        toast.success("Product status updated to Released");
      } catch {
        toast.error("Release created but failed to update product status");
      }
    } else {
      setStatus(anySuccess ? "failed" : "failed");
      const msg = anySuccess
        ? `\n⚠️ Some releases failed. Check logs above.\n`
        : `\n❌ All releases failed.\n`;
      setLogs((prev) => [...prev, msg]);
      logsRef.current.push(msg);
      toast.error(anySuccess ? "Some releases failed" : "Release failed");
    }

    onReleaseComplete?.();
    cleanupListeners();
  };

  const cancelRelease = async () => {
    if (!scanIdRef.current) return;
    cancelledRef.current = true;
    setIsCancelling(true);
    const msg = "\n⏳ Cancelling release...\n";
    setLogs((prev) => [...prev, msg]);
    logsRef.current.push(msg);

    try {
      await platform.cancelScan({ scanId: scanIdRef.current });
      setStatus("failed");
      const cancelMsg = "\n🛑 Release cancelled by user.\n";
      setLogs((prev) => [...prev, cancelMsg]);
      logsRef.current.push(cancelMsg);
    } catch {
      toast.error("Failed to cancel release");
    } finally {
      setIsCancelling(false);
      cleanupListeners();
    }
  };

  const isRunning = status === "running";
  const isCompleted = status === "success" || status === "failed";
  const isAlreadyReleased = product.status === "Released";
  const repoCount = product.repos?.length || 0;

  const statusChip = () => {
    switch (status) {
      case "running": return <Chip label="In Progress" color="info" size="small" />;
      case "success": return <Chip label="Released" color="success" size="small" />;
      case "failed": return <Chip label="Failed" color="error" size="small" />;
      default: return null;
    }
  };

  const repoStatusIcon = (s: string) => {
    switch (s) {
      case "success": return "✅";
      case "failed": return "❌";
      case "running": return "🔄";
      default: return "⏳";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <Paper sx={{ p: 3, mt: 4, mb: 4, borderLeft: `4px solid ${borderColor}`, borderRadius: 1 }}>
        <Typography variant="h6" fontWeight={700} gutterBottom display="flex" alignItems="center" gap={1}>
          <RocketLaunchIcon sx={{ color: borderColor, fontSize: 24 }} /> GitHub Release
          {statusChip()}
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          Create GitHub releases for all repositories in this product.
        </Typography>

        <Stack spacing={3}>
          {/* Repository Info — styled like DigitalSigningCard */}
          {product.repos && product.repos.length > 0 && (
            <Paper sx={{ p: 3, mb: 3, borderRadius: 2, bgcolor: "rgba(255,255,255, 0.02)", border: "1px solid rgba(255,255,255, 0.08)" }}>
              <Typography variant="h6" fontWeight={500} mb={1} sx={{ color: borderColor, fontFamily: "monospace" }}>
                📂 {repoCount === 1 ? "Repository" : "Repositories"} ({repoCount})
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={2} sx={{ fontFamily: "monospace", fontSize: "0.85rem" }}>
                Version (Release Tag): <strong style={{ color: borderColor }}>{product.version || "N/A"}</strong>
              </Typography>
              <Stack spacing={1.5}>
                {product.repos.map((repo, idx) => {
                  const rs = repoStatuses[idx];
                  const repoType = repo.repoUrl.includes("github.com") ? "Public" : "Local";
                  return (
                    <Paper key={idx} sx={{ p: 2, borderRadius: 1, border: `2px solid ${borderColor}30`, bgcolor: `${borderColor}08` }}>
                      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                        <Box sx={{ width: 40, height: 40, borderRadius: 1, bgcolor: `${borderColor}20`, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${borderColor}` }}>
                          <Typography variant="subtitle2" fontWeight={700} sx={{ color: borderColor, fontSize: "1rem" }}>{idx + 1}</Typography>
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 200 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
                            Repository
                          </Typography>
                          <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: "0.85rem", color: borderColor, fontWeight: 600 }}>
                            {repo.repoUrl}
                          </Typography>
                        </Box>
                        <Chip label={repo.branch} size="small" sx={{ fontFamily: "monospace", bgcolor: `${borderColor}20`, color: borderColor }} />
                        <Chip label={repoType} size="small" sx={{ fontFamily: "monospace" }} />
                        {rs && rs.status !== "pending" && (
                          <Typography sx={{ fontSize: 18 }}>{repoStatusIcon(rs.status)}</Typography>
                        )}
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>
            </Paper>
          )}

          {/* Inline logs (when modal closed) */}
          {logs.length > 0 && !modalOpen && (
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
                  mt: 2, maxHeight: 400, overflow: "auto",
                  bgcolor: "#1a1a1a", border: "1px solid #333", p: 2,
                  fontFamily: "monospace", fontSize: 12, color: "#e0e0e0"
                }}>
                  {logs.map((line, i) => (
                    <Typography key={i} component="pre" sx={{ m: 0, fontSize: 12 }}>
                      {line}
                    </Typography>
                  ))}
                </Paper>
              </Collapse>
            </Box>
          )}

          {/* Prepare Release Button — centered like DigitalSigningCard */}
          <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
            <Tooltip
              title={isAlreadyReleased ? "Product already released" : tooltipTitle}
              arrow
              placement="top"
              disableHoverListener={!disabled && !isAlreadyReleased}
            >
              <span>
                <Button
                  variant="contained"
                  size="large"
                  disabled={disabled || isRunning || isAlreadyReleased}
                  onClick={handlePrepareRelease}
                  sx={{
                    bgcolor: borderColor,
                    color: "black",
                    fontWeight: "bold",
                    boxShadow: `0 4px 14px 0 ${borderColor}40`,
                    "&:hover": { bgcolor: `${borderColor}CC` },
                    minWidth: 350,
                  }}
                  startIcon={isRunning ? <CircularProgress size={20} color="inherit" /> : <RocketLaunchIcon />}
                >
                  {isRunning
                    ? `Creating Release${repoCount > 1 ? "s" : ""}...`
                    : isAlreadyReleased
                      ? "Already Released"
                      : status === "success"
                        ? "Release Complete"
                        : `Prepare Release${repoCount > 1 ? ` (${repoCount} repos)` : ""}`}
                </Button>
              </span>
            </Tooltip>
          </Box>
        </Stack>
      </Paper>

      <Dialog open={modalOpen} onClose={() => !isRunning && setModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ bgcolor: "#2d2d2d", borderBottom: "1px solid #404040" }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" fontWeight={700} display="flex" alignItems="center" gap={1}>
              <RocketLaunchIcon sx={{ color: borderColor, fontSize: 24 }} /> GitHub Release — {product.name} v{product.version}
            </Typography>
            {!isRunning && (
              <IconButton onClick={() => setModalOpen(false)}><CloseIcon /></IconButton>
            )}
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
        <DialogContent sx={{ height: "60vh", p: 3, pt: 3, bgcolor: "#1a1a1a" }}>
          {/* Per-repo progress chips */}
          {repoCount > 1 && repoStatuses.length > 0 && (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
              {repoStatuses.map((rs, idx) => {
                const chipColor =
                  rs.status === "success" ? "success" :
                  rs.status === "failed" ? "error" :
                  rs.status === "running" ? "info" : "default";
                const repoName = rs.repoUrl.split("/").pop() || `Repo ${idx + 1}`;
                return (
                  <Chip
                    key={idx}
                    label={`${repoName} (${rs.branch})`}
                    size="small"
                    color={chipColor as any}
                    variant={rs.status === "pending" ? "outlined" : "filled"}
                  />
                );
              })}
            </Box>
          )}

          <Box sx={{ fontFamily: "monospace", fontSize: 12, lineHeight: 1.5, color: "#e0e0e0", whiteSpace: "pre-wrap", mt: 1 }}>
            {logs.map((line, i) => (
              <Typography key={i} component="pre" sx={{ m: 0, fontSize: 12 }}>
                {line}
              </Typography>
            ))}
            <div ref={logEndRef} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, bgcolor: "#2d2d2d" }}>
          {isRunning && (
            <Button onClick={cancelRelease} color="error" variant="contained"
              startIcon={isCancelling ? <CircularProgress size={16} color="inherit" /> : <CancelIcon />}
              disabled={isCancelling}>
              {isCancelling ? "Cancelling..." : "Cancel"}
            </Button>
          )}
          {isCompleted && <Button variant="contained" onClick={() => setModalOpen(false)}>Close</Button>}
        </DialogActions>
      </Dialog>
    </motion.div>
  );
}