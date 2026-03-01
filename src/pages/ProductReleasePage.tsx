import { useEffect, useState, useRef, useCallback } from "react";
import {
  Box, Button, Container, Paper, Stack,
  Typography, Chip,
  IconButton, Collapse,
  CircularProgress, Tooltip,
  LinearProgress
} from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { motion, Variants } from "framer-motion";
import ProductHeader from '../components/ProductHeader';
import { getProductById, updateProduct } from "../services/productService"; // ✅ FIXED: Use getProductById
import { Product } from "../models/Product";
import { useUserStore } from "../store/userStore";

import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import TerminalIcon from "@mui/icons-material/Terminal";
import CancelIcon from "@mui/icons-material/Cancel";
import DownloadIcon from "@mui/icons-material/Download";


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
    return { color: "#ff5252", fontWeight: "50" };
  if (text.includes("✅") || text.includes("SUCCESS") || text.includes("CREATED"))
    return { color: "#69f0ae", fontWeight: "50" };
  if (text.includes("🔴") || text.includes("⚠️"))
    return { color: "#ffd740" };
  if (text.includes("🔹") || text.includes("RELEASE"))
    return { color: "#7b5cff", fontWeight: "50" };
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
    const file = new Blob([logs.join("\\n")], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `${title.replace(/\\s+/g, "_")}_Log.txt`;
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
  const [loading, setLoading] = useState(true); //  Loading state

  // PERFECT STATE MANAGEMENT
  const [isReleaseRunning, setIsReleaseRunning] = useState(false);
  const [releaseMode, setReleaseMode] = useState<'none' | 'single' | 'batch'>('none');
  const [releaseLogs, setReleaseLogs] = useState<string[]>([]);
  const [currentRepoIndex, setCurrentRepoIndex] = useState(0);
  const [singleCompletedCount, setSingleCompletedCount] = useState(0);
  const [batchCompletedCount, setBatchCompletedCount] = useState(0);

  const currentScanId = useRef<string | null>(null);
  const isReleaseCancelled = useRef(false);

  // Load product using getProductById 
  const loadProduct = useCallback(async () => {
    if (!id) {
      toast.error("Invalid product ID", { id: "invalid-product-id" });
      navigate("/products");
      return;
    }

    setLoading(true);
    console.log("[RELEASE PAGE] Loading product:", id);

    try {
      const result = await getProductById(id);
      if (result.error || !result.data) {
        toast.error(`Product not found: ${result.error?.message || "Unknown error"}`, { 
          id: "product-load-error" 
        });
        navigate("/products");
        return;
      }

      setProduct(result.data);
    } catch (error) {
      console.error("[RELEASE PAGE] Failed to load product:", error);
      toast.error("Failed to load product", { id: "product-load-failed" });
      navigate("/products");
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  // Load on mount + scroll to top
  useEffect(() => {
    loadProduct();
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [loadProduct]);

  // RESET COUNTERS ON NEW PRODUCT
  useEffect(() => {
    if (product) {
      setSingleCompletedCount(0);
      setBatchCompletedCount(0);
      setReleaseMode('none');
      setIsReleaseRunning(false);
    }
  }, [product?.id]);

  const handleCancel = async () => {
    isReleaseCancelled.current = true;
    if (currentScanId.current && window.electronAPI?.cancelScan) {
      setReleaseLogs(prev => [...prev, "\\n⏳ Requesting cancellation..."]);
      try {
        await window.electronAPI.cancelScan({ scanId: currentScanId.current });
      } catch (e) {
        console.error("Cancel failed:", e);
      }
    }
    setIsReleaseRunning(false);
    setReleaseMode('none');
    setCurrentRepoIndex(0);
  };



interface ReleaseResult {
  success: boolean;
  error?: string;
}

// SINGLE REPO - 1/1 PROGRESS
const releaseSingleRepo = useCallback(async (repoIndex: number): Promise<boolean> => {
  if (!product || !window.electronAPI || isReleaseRunning || releaseMode !== 'none') {
    return false;
  }

  setReleaseMode('single');
  const repo = product.repos[repoIndex];
  const scanId = crypto.randomUUID();
  currentScanId.current = scanId;

  setReleaseLogs(prev => [...prev,
    `${"═".repeat(80)}`,
    `🔹 SINGLE REPO 1/1: ${repo.repoUrl}`,
    `   Version: ${product.version}`,
    `   Branch: ${repo.branch}`,
    `${"═".repeat(80)}`
  ]);

  setIsReleaseRunning(true);
  setCurrentRepoIndex(repoIndex);

  const cleanup = window.electronAPI.onScanLog(scanId, (data) => {
    setReleaseLogs((prev) => [...prev, data.log]);
  });

  try {
    // Capture result with exact backend type
    const result: ReleaseResult = await window.electronAPI.createGitHubRelease({
      repoUrl: repo.repoUrl,
      branch: repo.branch,
      version: product.version,
      scanId
    });

    //  Only proceed if backend confirms success
    if (!result.success) {
      throw new Error(result.error || 'Release creation failed');
    }

    //  ONLY UPDATE DB ON FULL SUCCESS
    const payload: Partial<Product> = {
      version: product.version,
      updatedAt: new Date().toISOString(),
      status: "Released" 
    };
    
    const updateResult = await updateProduct(product.id, payload);
    if (updateResult.error) {
      console.error('DB update failed:', updateResult.error);
      toast.error("Release created but DB update failed", { 
        id: "release-update-warning",
        duration: 5000 
      });
    } else {
      setProduct(updateResult.data!);
      toast.success("Release created successfully", { 
        id: "single-release-success",
        duration: 5000 
      });
    }
    
    setSingleCompletedCount(1);
    return true;

  } catch (e: any) {
    setReleaseLogs(prev => [...prev, `\n❌ SINGLE Error: ${e.message}`]);
    toast.error(`Single release failed: ${e.message}`, { 
      id: "single-release-error",
      duration: 6000 
    });
    return false;
  } finally {
    currentScanId.current = null;
    if (cleanup) cleanup();
    setIsReleaseRunning(false);
    setReleaseMode('none');
  }
}, [product, isReleaseRunning, releaseMode]);

// BATCH RELEASE - 1/N → 2/N → N/N (All or Nothing)
const runSequentialRelease = useCallback(async () => {
  if (!product || !window.electronAPI || isReleaseRunning || releaseMode !== 'none') {
    return;
  }

  setReleaseMode('batch');
  isReleaseCancelled.current = false;
  setCurrentRepoIndex(0);
  setBatchCompletedCount(0);
  let allReposSuccess = true; // Track ALL must succeed
  const failedRepos: number[] = []; //  Track failures

  setReleaseLogs([`🚀 BATCH GitHub Release STARTED: ${product.name}`,
    `${product.version} - ${product.repos.length} ${product.repos.length === 1 ? 'Repository' : 'Repositories'}`,
    `${"═".repeat(80)}\n`]);

  setIsReleaseRunning(true);

  // ✅ ALL REPOS MUST SUCCEED for batch DB update
  for (let i = 0; i < product.repos.length; i++) {
    if (isReleaseCancelled.current) {
      setReleaseLogs(prev => [...prev, "\n⚠️ BATCH cancelled by user"]);
      break;
    }

    setCurrentRepoIndex(i);
    const repo = product.repos[i];
    const scanId = crypto.randomUUID();
    currentScanId.current = scanId;

    setReleaseLogs(prev => [...prev,
      `${"═".repeat(80)}`,
      `🔹 BATCH REPO ${i + 1}/${product.repos.length}: ${repo.repoUrl}`,
      `   Version: ${product.version}`,
      `   Branch: ${repo.branch}`,
      `${"═".repeat(80)}`
    ]);

    const cleanup = window.electronAPI.onScanLog(scanId, (data) => {
      setReleaseLogs((prev) => [...prev, data.log]);
    });

    try {
      //  Capture result with exact backend type
      const result: ReleaseResult = await window.electronAPI.createGitHubRelease({
        repoUrl: repo.repoUrl,
        branch: repo.branch,
        version: product.version,
        scanId
      });

      // Only count as success if backend confirms
      if (result.success) {
        setBatchCompletedCount(prev => prev + 1);
        setReleaseLogs(prev => [...prev, `\n✅ REPO ${i + 1} SUCCESS`]);
      } else {
        allReposSuccess = false;
        failedRepos.push(i + 1);
        setReleaseLogs(prev => [...prev, `\n❌ REPO ${i + 1} FAILED: ${result.error}`]);
      }
    } catch (e: any) {
      allReposSuccess = false;
      failedRepos.push(i + 1);
      setReleaseLogs(prev => [...prev, `\n❌ BATCH Error [${i + 1}]: ${e.message}`]);
    } finally {
      currentScanId.current = null;
      if (cleanup) cleanup();
    }

    if (i < product.repos.length - 1 && !isReleaseCancelled.current) {
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }

  // ONLY UPDATE DB IF ALL REPOS SUCCESSFUL
  if (!isReleaseCancelled.current && allReposSuccess) {
    const payload: Partial<Product> = {
      version: product.version,
      updatedAt: new Date().toISOString(),
      status: "Released"
    };
    
    try {
      const updateResult = await updateProduct(product.id, payload);
      if (updateResult.error) {
        toast.error("All releases created but DB update failed", { 
          id: "batch-update-warning",
          duration: 5000 
        });
      } else {
        setProduct(updateResult.data!);
        toast.success(`Batch release completed: ${product.repos.length}/${product.repos.length}`, { 
          id: "batch-release-success",
          duration: 5000 
        });
      }
    } catch (error) {
      toast.error("Failed to update product metadata", { id: "batch-update-error" });
    }
  } else if (!isReleaseCancelled.current) {
    //  Partial or total failure - no DB update
    const successCount = batchCompletedCount;
    toast.error(
      `Batch failed: ${successCount}/${product.repos.length} successful` + 
      (failedRepos.length > 0 ? `\nFailed repos: ${failedRepos.join(', ')}` : ''), 
      { 
        id: "batch-release-failed", 
        duration: 7000 
      }
    );
  }

  setIsReleaseRunning(false);
  setReleaseMode('none');
}, [product, isReleaseRunning, releaseMode, batchCompletedCount]);

  const getProgressInfo = () => {
    if (releaseMode === 'single') {
      return {
        current: 1,
        total: 1,
        completed: singleCompletedCount,
        text: `Processing Repo ${currentRepoIndex + 1} • 1/1`
      };
    }
    return {
      current: currentRepoIndex + 1,
      total: product?.repos.length || 0,
      completed: batchCompletedCount,
      text: `Processing: ${currentRepoIndex + 1}/${product?.repos.length || 0} (${batchCompletedCount} completed)`
    };
  };

  const progressInfo = getProgressInfo();

  // LOADING STATE
  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "50vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  // NO PRODUCT FOUND
  if (!product) {
    return (
      <Container maxWidth="lg" sx={{ pt: 10, minHeight: "50vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Paper sx={{ p: 4, textAlign: "center" }}>
          <Typography color="text.secondary" mb={2}>
            Product not found
          </Typography>
          <Button variant="contained" onClick={() => navigate("/products")}>
            Go to Products
          </Button>
        </Paper>
      </Container>
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
                  Create release tag r{product.version} to publish
                </Typography>

                <Paper sx={{
                  p: 3, mb: 3, borderRadius: 2,
                  bgcolor: 'rgba(255,255,255, 0.02)',
                  border: '1px solid rgba(255,255,255, 0.08)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
                }}>
                  <Typography variant="h6" fontWeight={500} mb={2.5} color="#7b5cff" sx={{ fontFamily: 'monospace' }}>
                    📂 {product.repos.length === 1 ? 'Repository' : 'Repositories'} ({product.repos.length})
                  </Typography>

                  <Stack spacing={2}>
                    {product.repos.map((repo, index) => (
                      <Paper
                        key={index}
                        elevation={index === currentRepoIndex ? 4 : 1}
                        sx={{
                          p: 2.5, borderRadius: 2,
                          bgcolor: index === currentRepoIndex ? 'rgba(123, 92, 255, 0.08)' : 'rgba(255,255,255, 0.02)',
                          border: `1px solid ${index === currentRepoIndex ? 'rgba(123, 92, 255, 0.3)' : 'rgba(255,255,255, 0.05)'}`,
                          transition: 'all 0.3s ease',
                          opacity: isReleaseRunning ? 0.6 : 1,
                        }}
                      >
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Box sx={{
                            width: 40, height: 40, borderRadius: 2,
                            bgcolor: index === currentRepoIndex ? 'rgba(123, 92, 255, 0.2)' : 'rgba(255,255,255, 0.08)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: index === currentRepoIndex ? '2px solid #7b5cff' : '1px solid transparent'
                          }}>
                            <Typography variant="subtitle2" fontWeight={700}
                              color={index === currentRepoIndex ? '#7b5cff' : 'text.secondary'}
                              sx={{ fontSize: '0.9rem' }}>
                              {index + 1}
                            </Typography>
                          </Box>

                          <Box sx={{ flex: 1 }}>
                            <Typography variant="caption" color="text.secondary" fontSize={11} mb={0.5} sx={{ fontFamily: 'monospace' }}>
                              Repository
                            </Typography>
                            <Typography variant="body2" sx={{
                              fontFamily: 'monospace', fontSize: '0.85rem',
                              color: index === currentRepoIndex ? '#7b5cff' : 'white',
                              fontWeight: index === currentRepoIndex ? 600 : 400,
                              wordBreak: 'break-all', lineHeight: 1.3
                            }}>
                              {repo.repoUrl}
                            </Typography>
                          </Box>

                          <Chip label={repo.branch} size="small" sx={{
                            height: 32, fontFamily: 'monospace', fontSize: '0.75rem',
                            bgcolor: index === currentRepoIndex ? 'rgba(123, 92, 255, 0.2)' : 'rgba(255,255,255, 0.08)',
                            color: index === currentRepoIndex ? '#7b5cff' : 'text.primary',
                            border: index === currentRepoIndex ? '1px solid rgba(123, 92, 255, 0.3)' : 'none',
                          }} />

                          <Chip label={`${product.version}`} size="small" color="success"
                            sx={{ height: 32, fontSize: '0.75rem', fontFamily: 'monospace' }} />

                          <Button
                            variant="contained" size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              releaseSingleRepo(index);
                            }}
                            disabled={isReleaseRunning}
                            sx={{
                              minWidth: 44, height: 36,
                              bgcolor: "#7b5cff", color: "white",
                              fontSize: '0.75rem', fontWeight: 600,
                              boxShadow: "0 2px 8px rgba(123, 92, 255, 0.3)",
                              "&:hover": { bgcolor: "#7b5cff", boxShadow: "0 4px 12px rgba(123, 92, 255, 0.4)" },
                              "&:disabled": { bgcolor: "rgba(123, 92, 255, 0.3)" }
                            }}
                            startIcon={
                              index === currentRepoIndex && isReleaseRunning && releaseMode === 'single' ?
                                <CircularProgress size={16} sx={{ color: "white" }} /> :
                                <RocketLaunchIcon sx={{ fontSize: 16 }} />
                            }
                          >
                            Release
                          </Button>
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                </Paper>

                {isReleaseRunning && (
                  <Paper sx={{ m: 2, p: 2.5, bgcolor: "rgba(123, 92, 255, 0.1)", border: "1px solid rgba(123, 92, 255, 0.3)", borderRadius: 2 }}>
                    <Typography variant="body2" fontWeight={600} color="#7b5cff" mb={1.5}>
                      {progressInfo.text}
                    </Typography>
                    <Box sx={{ mb: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={releaseMode === 'single' ? 100 : (batchCompletedCount / product.repos.length) * 100}
                        sx={{
                          height: 8, borderRadius: 4,
                          bgcolor: 'rgba(255,255,255,0.1)', mx: 1, my: 0.5,
                          '& .MuiLinearProgress-bar': { backgroundColor: '#7b5cff', borderRadius: 4 }
                        }}
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                      r{product.version} • {progressInfo.current}/{progressInfo.total}
                    </Typography>
                  </Paper>
                )}
                {product.repos.length > 1 && (
                  <Stack sx={{ mt: 3 }} spacing={2}>
                    <Button
                      variant="contained" size="large"
                      onClick={runSequentialRelease}
                      disabled={isReleaseRunning}
                      sx={{
                        bgcolor: "#7b5cff", color: "white",
                        fontWeight: "bold", fontSize: '1.1rem', height: 56,
                        boxShadow: "0 8px 24px rgba(123, 92, 255, 0.4)", borderRadius: 2,
                        "&:hover": {
                          bgcolor: "#7b5cff",
                          boxShadow: "0 12px 32px rgba(123, 92, 255, 0.5)",
                          transform: 'translateY(-2px)'
                        },
                        "&:disabled": { bgcolor: "rgba(123, 92, 255, 0.3)", boxShadow: "none" }
                      }}
                      startIcon={isReleaseRunning && releaseMode === 'batch' ?
                        <CircularProgress size={24} sx={{ color: "white" }} /> :
                        <RocketLaunchIcon />
                      }
                    >
                      {isReleaseRunning && releaseMode === 'batch'
                        ? `Batch Release... (${batchCompletedCount}/${product.repos.length})`
                        : `Release All - ${product.version}`
                      }
                    </Button>
                  </Stack>
                )}

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
    </Box>
  );
}
