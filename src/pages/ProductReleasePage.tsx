import { useEffect, useState, useRef, useCallback } from "react";
import {
  Box, Button, Container, Paper, Stack,
  Typography, Chip, TextField, MenuItem,
  IconButton, Collapse,
  CircularProgress, Tooltip,
  InputAdornment, LinearProgress, Dialog, DialogTitle, DialogContent
} from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";
import { motion, Variants } from "framer-motion";
import ProductHeader from '../components/ProductHeader';
import { getProducts } from "../services/productService";
import { Product } from "../models/Product";
import { useUserStore } from "../store/userStore";

import GitHubIcon from "@mui/icons-material/GitHub";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import TerminalIcon from "@mui/icons-material/Terminal";
import CancelIcon from "@mui/icons-material/Cancel";
import DownloadIcon from "@mui/icons-material/Download";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.1 }
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] }
  },
};

const getLogStyle = (text: string) => {
  if (text.includes("❌") || text.includes("Error") || text.includes("FAILED")) 
    return { color: "#ff5252", fontWeight: "bold" };
  if (text.includes("✅") || text.includes("SUCCESS") || text.includes("CREATED")) 
    return { color: "#69f0ae", fontWeight: "bold" };
  if (text.includes("🔴") || text.includes("⚠️")) 
    return { color: "#ffd740" };
  if (text.includes("🔹") || text.includes("RELEASE")) 
    return { color: "#7b5cff", fontWeight: "bold" };
  if (text.includes("═")) return { color: "rgb(38, 194, 191)" };
  return { color: "#e0e0e0" };
};

interface LogTerminalProps {
  logs: string[];
  isVisible: boolean;
  isRunning: boolean;
  onCancel: () => void;
  title: string;
  color: string;
}

const LogTerminal = ({ logs, isVisible, isRunning, onCancel, title, color }: LogTerminalProps) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      container.scrollTop = container.scrollHeight - container.clientHeight;
    }
  }, [logs, isVisible]);

  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([logs.join("\n")], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `${title.replace(/\s+/g, "_")}_Log.txt`;
    document.body.appendChild(element);
    element.click();
    setTimeout(() => document.body.removeChild(element), 100);
  };

  return (
    <Collapse in={isVisible}>
      <Box sx={{ mt: 3, borderTop: `1px solid rgba(255,255,255,0.1)`, pt: 2 }}>
        <Paper sx={{
          bgcolor: "#0a0a0a",
          border: "1px solid #333",
          overflow: "hidden",
          boxShadow: "inset 0 0 20px rgba(0,0,0,0.8)",
        }}>
          <Box sx={{ px: 2, py: 1, borderBottom: "1px solid #333", display: "flex", justifyContent: "space-between", alignItems: "center", bgcolor: "#151515" }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <TerminalIcon sx={{ color, fontSize: 18 }} />
              <Typography variant="caption" color="text.secondary" fontFamily="monospace" fontWeight={700}>
                {title}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1}>
              {logs.length > 0 && (
                <Tooltip title="Download Logs">
                  <IconButton size="small" onClick={handleDownload} sx={{ color: "text.secondary", "&:hover": { color: "white" } }}>
                    <DownloadIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              {isRunning && (
                <Button size="small" color="error" startIcon={<CancelIcon />} onClick={onCancel} sx={{ textTransform: 'none', fontSize: 12 }}>
                  Abort
                </Button>
              )}
            </Stack>
          </Box>
          <Box
            ref={scrollContainerRef}
            sx={{
              p: 2,
              maxHeight: 300,
              height: 300,
              overflowY: "auto",
              fontFamily: "'Consolas', 'Monaco', monospace",
              fontSize: 13,
              bgcolor: "#0a0a0a",
              scrollbarWidth: "thin",
              "&::-webkit-scrollbar": { width: "6px" },
              "&::-webkit-scrollbar-track": { background: "#1a1a1a" },
              "&::-webkit-scrollbar-thumb": { background: "#444", borderRadius: "3px" }
            }}
          >
            {logs.length === 0 && (
              <Typography color="text.secondary" textAlign="center" mt={8} variant="caption" sx={{ opacity: 0.5 }}>
                _ Waiting for GitHub release process...
              </Typography>
            )}
            {logs.map((log, i) => (
              <Typography key={i} component="div" sx={{ m: 0, whiteSpace: "pre-wrap", lineHeight: 1.6, ...getLogStyle(log) }}>
                {log}
              </Typography>
            ))}
          </Box>
        </Paper>
      </Box>
    </Collapse>
  );
};

export default function ProductReleasePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [isReleaseRunning, setIsReleaseRunning] = useState(false);
  const [releaseLogs, setReleaseLogs] = useState<string[]>([]);
  const [currentRepoIndex, setCurrentRepoIndex] = useState(0);
  const [selectedRepoForSingle, setSelectedRepoForSingle] = useState(0);
  const [completedReposCount, setCompletedReposCount] = useState(0);
  const [releaseModalOpen, setReleaseModalOpen] = useState(false);

  const currentScanId = useRef<string | null>(null);
  const isReleaseCancelled = useRef(false);

  useEffect(() => {
    if (!id) return;
    const p = getProducts().find((x) => x.id === id);
    if (!p) {
      navigate("/products");
      return;
    }
    setProduct(p);
  }, [id, navigate]);

  const handleCancel = async () => {
    isReleaseCancelled.current = true;
    if (currentScanId.current && window.electronAPI?.cancelScan) {
      setReleaseLogs(prev => [...prev, "\n⏳ Requesting cancellation..."]);
      try {
        await window.electronAPI.cancelScan({ scanId: currentScanId.current });
      } catch (e) {
        console.error("Cancel failed:", e);
      }
    }
    setIsReleaseRunning(false);
  };

  const handleRepoClick = (index: number) => {
    setSelectedRepoForSingle(index);
    setCurrentRepoIndex(index);
  };

  const releaseSingleRepo = useCallback(async (repoIndex: number = selectedRepoForSingle) => {
    if (!product || !window.electronAPI) return false;

    const repo = product.repos[repoIndex];
    const scanId = crypto.randomUUID();
    currentScanId.current = scanId;

    setReleaseLogs(prev => [...prev,
      `\n${"═".repeat(80)}`,
      `🔹 SINGLE REPO ${repoIndex + 1}/${product.repos.length}: ${repo.repoUrl}`,
      `   Version: v${product.version}`,
      `   Branch: ${repo.branch}`,
      `${"═".repeat(80)}\n`
    ]);

    setIsReleaseRunning(true);
    setCurrentRepoIndex(repoIndex);
    setSelectedRepoForSingle(repoIndex);

    const cleanup = window.electronAPI.onScanLog(scanId, (data) => {
      setReleaseLogs((prev) => [...prev, data.log]);
    });

    try {
      await window.electronAPI.createGitHubRelease({
        repoUrl: repo.repoUrl,
        branch: repo.branch,
        version: product.version,
        scanId
      });
      setCompletedReposCount(prev => prev + 1);
      return true;
    } catch (e: any) {
      setReleaseLogs(prev => [...prev, `\n❌ Frontend Error: ${e.message}`]);
      return false;
    } finally {
      currentScanId.current = null;
      if (cleanup) cleanup();
      setIsReleaseRunning(false);
    }
  }, [product, selectedRepoForSingle]);

  const runSequentialRelease = useCallback(async () => {
    if (!product || !window.electronAPI) return;

    // ✅ ONLY BATCH BUTTON OPENS MODAL
    setReleaseModalOpen(true);
    isReleaseCancelled.current = false;
    setCurrentRepoIndex(0);
    setCompletedReposCount(0);
    setReleaseLogs([]);
    setSelectedRepoForSingle(0);

    setReleaseLogs([`🚀 Sequential GitHub Release STARTED: ${product.name}`,
      `v${product.version} - ${product.repos.length} repositories`,
      `${"═".repeat(80)}\n`]);

    for (let i = 0; i < product.repos.length; i++) {
      if (isReleaseCancelled.current) {
        setReleaseLogs(prev => [...prev, "\n⚠️ Release process cancelled by user"]);
        break;
      }

      setCurrentRepoIndex(i);
      await releaseSingleRepo(i);

      if (i < product.repos.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    setIsReleaseRunning(false);
  }, [product, releaseSingleRepo]);

  if (!product) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "50vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ pt: 10, pb: 8, minHeight: "100vh", bgcolor: "background.default" }}>
      <Container maxWidth="lg">
        <motion.div variants={containerVariants} initial="hidden" animate="visible">
          <motion.div variants={itemVariants}>
            <ProductHeader product={product} pageType="release" />
          </motion.div>

          <Stack spacing={4}>
            <motion.div variants={itemVariants}>
              <Paper sx={{ p: 3, borderLeft: "4px solid #7b5cff", borderRadius: 1 }}>
                <Typography variant="h6" fontWeight={700} gutterBottom display="flex" alignItems="center" gap={1}>
                  <RocketLaunchIcon sx={{ color: "#7b5cff", fontSize: 24 }} /> GitHub Releases
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={3}>
                  Create release tags v{product.version} across all repositories
                </Typography>

                <Paper sx={{
                  p: 3,
                  mb: 3,
                  borderRadius: 2,
                  bgcolor: 'rgba(255,255,255, 0.02)',
                  border: '1px solid rgba(255,255,255, 0.08)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
                }}>
                  <Typography variant="h6" fontWeight={500} mb={2.5} color="#7b5cff" sx={{ fontFamily: 'monospace' }}>
                    📂 Repositories ({product.repos.length})
                  </Typography>

                  <Stack spacing={1.5}>
                    {product.repos.map((repo, index) => (
                      <Paper
                        key={index}
                        elevation={index === currentRepoIndex ? 4 : 1}
                        onClick={() => handleRepoClick(index)}
                        sx={{
                          p: 1.5,
                          borderRadius: 1,
                          bgcolor: index === currentRepoIndex ? 'rgba(123, 92, 255, 0.12)' : 'transparent',
                          border: index === currentRepoIndex ? '2px solid #7b5cff' : '1px solid rgba(255,255,255, 0.05)',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            bgcolor: 'rgba(123, 92, 255, 0.08)',
                            boxShadow: index === currentRepoIndex ? '0 8px 25px rgba(123, 92, 255, 0.3)' : '0 4px 12px rgba(0,0,0,0.15)'
                          }
                        }}
                      >
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Box sx={{
                            width: 36, height: 36,
                            borderRadius: 1,
                            bgcolor: index === currentRepoIndex ? 'rgba(123, 92, 255, 0.2)' : 'rgba(255,255,255, 0.08)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: index === currentRepoIndex ? '2px solid #7b5cff' : '1px solid transparent'
                          }}>
                            <Typography variant="subtitle2" fontWeight={700} color={index === currentRepoIndex ? '#7b5cff' : 'text.secondary'} sx={{ fontSize: '0.875rem' }}>
                              {index + 1}
                            </Typography>
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="caption" color="text.secondary" fontSize={11} mb={0.25} sx={{ fontFamily: 'monospace' }}>
                              Repository
                            </Typography>
                            <Typography variant="body2" sx={{
                              fontFamily: 'monospace',
                              fontSize: '0.8rem',
                              color: index === currentRepoIndex ? '#7b5cff' : 'white',
                              fontWeight: index === currentRepoIndex ? 600 : 400,
                              wordBreak: 'break-all',
                              lineHeight: 1.2
                            }}>
                              {repo.repoUrl}
                            </Typography>
                          </Box>
                          <Chip
                            label={repo.branch}
                            size="small"
                            sx={{
                              height: 28,
                              fontFamily: 'monospace',
                              fontSize: '0.7rem',
                              bgcolor: index === currentRepoIndex ? 'rgba(123, 92, 255, 0.2)' : 'rgba(255,255,255, 0.08)',
                              color: index === currentRepoIndex ? '#7b5cff' : 'text.primary',
                              border: index === currentRepoIndex ? '1px solid rgba(123, 92, 255, 0.3)' : 'none',
                              '& .MuiChip-label': { py: 0.25 }
                            }}
                          />
                          <Chip
                            label={`v${product.version}`}
                            size="small"
                            color="success"
                            sx={{ height: 28, fontSize: '0.7rem', fontFamily: 'monospace' }}
                          />
                          {index === currentRepoIndex && isReleaseRunning && (
                            <CircularProgress size={20} sx={{ color: "#7b5cff" }} />
                          )}
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                </Paper>

                {isReleaseRunning && (
                  <Paper sx={{ p: 2, bgcolor: "rgba(123, 92, 255, 0.1)", border: "1px solid rgba(123, 92, 255, 0.3)" }}>
                    <Typography variant="body2" fontWeight={600} color="#7b5cff">
                      Processing: {currentRepoIndex + 1} / {product.repos.length}
                      ({completedReposCount} completed)
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={(completedReposCount / product.repos.length) * 100}
                      sx={{ 
                        mt: 1, 
                        height: 6,
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: '#7b5cff'
                        }
                      }}
                    />
                  </Paper>
                )}

                <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
                  <Button
                    variant="outlined"
                    size="large"
                    onClick={() => releaseSingleRepo()}
                    disabled={isReleaseRunning}
                    sx={{
                      borderColor: "#7b5cff",
                      color: "#7b5cff",
                      fontWeight: "bold",
                      "&:hover": { 
                        borderColor: "#7b5cff", 
                        bgcolor: "rgba(123, 92, 255, 0.1)",
                        boxShadow: "0 4px 14px rgba(123, 92, 255, 0.3)"
                      },
                      minWidth: 220
                    }}
                    startIcon={<PlayArrowIcon />}
                  >
                    Release Repo #{selectedRepoForSingle + 1}
                  </Button>

                  <Button
                    variant="contained"
                    size="large"
                    onClick={runSequentialRelease}
                    disabled={isReleaseRunning}
                    sx={{
                      bgcolor: "#7b5cff",
                      color: "white",
                      fontWeight: "bold",
                      boxShadow: "0 4px 14px 0 rgba(123, 92, 255, 0.4)",
                      "&:hover": { 
                        bgcolor: "#7b5cff",
                        boxShadow: "0 6px 20px 0 rgba(123, 92, 255, 0.5)"
                      },
                      minWidth: 300
                    }}
                    startIcon={isReleaseRunning ? <CircularProgress size={20} sx={{ color: "white" }} /> : <RocketLaunchIcon />}
                  >
                    {isReleaseRunning
                      ? `Batch Release... (${completedReposCount}/${product.repos.length})`
                      : `Release All ${product.repos.length} Repos v${product.version}`
                    }
                  </Button>
                </Stack>

                <LogTerminal
                  logs={releaseLogs}
                  isVisible={releaseLogs.length > 0 || isReleaseRunning}
                  isRunning={isReleaseRunning}
                  onCancel={handleCancel}
                  title="GITHUB RELEASE OUTPUT"
                  color="#7b5cff"
                />
              </Paper>
            </motion.div>
          </Stack>
        </motion.div>
      </Container>

      <Dialog
        open={releaseModalOpen}
        onClose={() => {
          if (!isReleaseRunning) setReleaseModalOpen(false);
        }}
        maxWidth={false}
        fullWidth
        PaperProps={{
          sx: {
            height: '90vh',
            borderRadius: 0,
            maxHeight: '90vh',
            bgcolor: '#0a0a0a'
          }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" fontWeight={700} color="#7b5cff">
              🚀 GitHub Release Terminal - {product?.name}
            </Typography>
            <IconButton onClick={() => setReleaseModalOpen(false)} disabled={isReleaseRunning}>
              <CancelIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ p: 0, height: '100%' }}>
          <LogTerminal
            logs={releaseLogs}
            isVisible={true}
            isRunning={isReleaseRunning}
            onCancel={handleCancel}
            title="BATCH RELEASE PROCESS"
            color="#7b5cff"
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
}
