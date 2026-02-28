import { useEffect, useState, useRef, useCallback } from "react";
import {
  Box, Button, Container, Paper, Stack,
  Typography, Chip, TextField,
  IconButton, Collapse, CircularProgress, Tooltip,
  InputAdornment, LinearProgress, Alert
} from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { motion, Variants } from "framer-motion";
import ProductHeader from '../components/ProductHeader';
import { getProductById } from "../services/productService"; 
import { Product } from "../models/Product";
import { useUserStore } from "../store/userStore";

import VpnKeyIcon from "@mui/icons-material/VpnKey";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
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
  if (text.includes("❌") || text.includes("INVALID") || text.includes("FAILED"))
    return { color: "#ff5252", fontWeight: "bold" };
  if (text.includes("✅") || text.includes("VALID") || text.includes("MATCHES"))
    return { color: "#69f0ae", fontWeight: "bold" };
  if (text.includes("🔍") || text.includes("VERIFYING"))
    return { color: "#00e5ff", fontWeight: "bold" };
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
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
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
            }}
          >
            {logs.length === 0 && (
              <Typography color="text.secondary" textAlign="center" mt={8} variant="caption" sx={{ opacity: 0.5 }}>
                _ Waiting for verification process...
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

export default function SignatureVerificationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true); //  Loading state

  // Verification state
  const [publicKeyPath, setPublicKeyPath] = useState("");
  const [signaturePath, setSignaturePath] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyLogs, setVerifyLogs] = useState<string[]>([]);
  const [currentRepoIndex, setCurrentRepoIndex] = useState(0);
  const [verifiedCount, setVerifiedCount] = useState(0);
  const [verificationStatus, setVerificationStatus] = useState<"idle" | "valid" | "invalid">("idle");

  const currentScanId = useRef<string | null>(null);
  const isCancelled = useRef(false);

  //  Load product using getProductById 
  const loadProduct = useCallback(async () => {
    if (!id) {
      toast.error("Invalid product ID", { id: "invalid-product-id" });
      navigate("/products");
      return;
    }

    setLoading(true);
    console.log("[SIGNATURE VERIFY PAGE] Loading product:", id);

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
      console.error("[SIGNATURE VERIFY PAGE] Failed to load product:", error);
      toast.error("Failed to load product", { id: "product-load-failed" });
      navigate("/products");
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  //  Load on mount + scroll to top
  useEffect(() => {
    loadProduct();
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [loadProduct]);

  // RESET VERIFICATION STATE ON NEW PRODUCT
  useEffect(() => {
    if (product) {
      setVerifiedCount(0);
      setCurrentRepoIndex(0);
      setVerificationStatus("idle");
      setVerifyLogs([]);
      setPublicKeyPath("");
      setSignaturePath("");
    }
  }, [product?.id]);

  const handleSelectPublicKey = async () => {
    try {
      if (isVerifying) return;
      const path = await window.electronAPI?.selectFile();
      if (path) {
        setPublicKeyPath(path);
        toast.success("Public key selected", { id: "public-key-selected", duration: 1500 });
      }
    } catch (e) {
      console.error("Public key selection failed:", e);
      toast.error("Failed to select public key file", { id: "public-key-error" });
    }
  };

  const handleSelectSignature = async () => {
    try {
      if (isVerifying) return;
      const path = await window.electronAPI?.selectFile();
      if (path) {
        setSignaturePath(path);
        toast.success("Signature file selected", { id: "signature-selected", duration: 1500 });
      }
    } catch (e) {
      console.error("Signature selection failed:", e);
      toast.error("Failed to select signature file", { id: "signature-error" });
    }
  };

  const handleCancel = async () => {
    isCancelled.current = true;
    if (currentScanId.current && window.electronAPI?.cancelScan) {
      setVerifyLogs(prev => [...prev, "\n⏳ Requesting cancellation..."]);
      try {
        await window.electronAPI.cancelScan({ scanId: currentScanId.current });
      } catch (e) {
        console.error("Cancel failed:", e);
      }
    }
    setIsVerifying(false);
    toast.success("Verification cancelled", { id: "verification-cancelled" });
  };

  const verifySingleRepo = useCallback(async (repoIndex: number) => {
    if (!product || !publicKeyPath || !signaturePath || !window.electronAPI || isCancelled.current) {
      toast.error("Missing files or verification cancelled", { id: "verify-missing-files" });
      return false;
    }

    const targetRepo = product.repos[repoIndex];
    const scanId = crypto.randomUUID();
    currentScanId.current = scanId;


    setVerifyLogs(prev => [...prev,
    `\n${"═".repeat(80)}`,
    `🔹 REPO ${repoIndex + 1}/${product.repos.length}: ${targetRepo.repoUrl}`,
    `   Branch: ${targetRepo.branch}`,
    `   Version: v${product.version}`,
    `   Scan ID: ${scanId.slice(0, 8)}...`,
    `${"═".repeat(80)}\n`
    ]);

    setIsVerifying(true);
    setCurrentRepoIndex(repoIndex);

    // Listen for real-time logs from backend (accumulates to existing logs)
    const cleanupLogListener = window.electronAPI.onScanLog(scanId, (data) => {
      setVerifyLogs((prev) => [...prev, data.log]); // **APPENDS** to existing logs
    });

    try {
      const result = await window.electronAPI.verifySignature({
        repoUrl: targetRepo.repoUrl,
        branch: targetRepo.branch,
        version: product.version,
        publicKeyPath,
        signaturePath,
        isQuickScan: false,
        localRepoLocation: "",
        githubToken: "",
        scanId,
      });

      cleanupLogListener();
      return result.verified ?? false;
    } catch (e: any) {
      cleanupLogListener();
      setVerifyLogs(prev => [...prev, `\n❌ Frontend Error: ${e.message}`]);
      toast.error(`Verification failed for repo ${repoIndex + 1}: ${e.message}`, {
        id: `verify-repo-${repoIndex}-error`
      });
      return false;
    }
  }, [product, publicKeyPath, signaturePath, isCancelled]);

  const runSequentialVerification = useCallback(async () => {
    if (!product || !publicKeyPath || !signaturePath || !window.electronAPI) {
      toast.error("Please select both public key and signature files", { id: "verify-missing-files-batch" });
      return;
    }

    isCancelled.current = false;
    setCurrentRepoIndex(0);
    setVerifiedCount(0);
    setVerifyLogs([]);

    // Initial header
    setVerifyLogs([`🔍 Sequential verification STARTED: ${product.name}`,
    `${product.repos.length} repositories - v${product.version}`,
    `${"═".repeat(80)}\n`]);

    setIsVerifying(true);
    toast.loading("Starting sequential verification...", { id: "batch-verification-start" });

    for (let i = 0; i < product.repos.length; i++) {
      if (isCancelled.current) {
        setVerifyLogs(prev => [...prev, `\n⚠️ Verification cancelled by user`]);
        toast.dismiss("batch-verification-start");
        toast.error("Verification cancelled by user", { id: "batch-verification-cancelled" });
        break;
      }

      setCurrentRepoIndex(i);
      const success = await verifySingleRepo(i);

      if (success) {
        setVerifiedCount(prev => prev + 1);
      }

      if (i < product.repos.length - 1 && !isCancelled.current) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    setIsVerifying(false);

    // Final status
    const finalStatus = verifiedCount === product.repos.length ? "valid" : "invalid";
    setVerificationStatus(finalStatus);

    toast.dismiss("batch-verification-start");
    if (finalStatus === "valid") {
      toast.success(` All ${product.repos.length} signatures verified!`, { id: "batch-verification-success" });
    } else {
      toast.error(`${verifiedCount}/${product.repos.length} signatures verified`, { id: "batch-verification-partial" });
    }
  }, [product, publicKeyPath, signaturePath, verifySingleRepo, verifiedCount]);

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
            <ProductHeader product={product} pageType="verify" />
          </motion.div>

          <Stack spacing={4}>
            <motion.div variants={itemVariants}>
              <Paper sx={{ p: 3, borderLeft: "4px solid #4caf50", borderRadius: 1 }}>
                <Typography variant="h6" fontWeight={700} gutterBottom display="flex" alignItems="center" gap={1}>
                  <VpnKeyIcon sx={{ color: "#4caf50", fontSize: 24 }} /> Signature Verification
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={3}>
                   Verify cryptographic signatures against repositories using public key of (v{product.version})
                </Typography>

                {/* REPOSITORIES LIST WITH PROGRESS */}
                <Paper sx={{
                  p: 3,
                  mb: 3,
                  borderRadius: 2,
                  bgcolor: 'rgba(255,255,255, 0.02)',
                  border: '1px solid rgba(255,255,255, 0.08)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
                }}>
                  <Typography variant="h6" fontWeight={500} mb={2.5} color="#4caf50" sx={{ fontFamily: 'monospace' }}>
                    📂 {`${product.repos.length === 1 ? 'Repository ' : 'Repositories '} (${product.repos.length})`}
                  </Typography>

                  <Stack spacing={1.5}>
                    {product.repos.map((repo, index) => (
                      <Paper
                        key={index}
                        elevation={index === currentRepoIndex ? 4 : 1}
                        sx={{
                          p: 1.5,
                          borderRadius: 1,
                          bgcolor: index === currentRepoIndex ? 'rgba(76, 175, 80, 0.08)' : 'transparent',
                          border: index === currentRepoIndex ? '2px solid rgba(76, 175, 80, 0.3)' : '1px solid rgba(255,255,255, 0.05)',
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            bgcolor: index === currentRepoIndex ? 'rgba(76, 175, 80, 0.12)' : 'rgba(255,255,255, 0.05)',
                          }
                        }}
                      >
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Box sx={{
                            width: 36, height: 36,
                            borderRadius: 1,
                            bgcolor: index === currentRepoIndex ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255,255,255, 0.08)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: index === currentRepoIndex ? '2px solid #4caf50' : '1px solid transparent'
                          }}>
                            <Typography variant="subtitle2" fontWeight={700} color={index === currentRepoIndex ? '#4caf50' : 'text.secondary'}>
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
                              color: index === currentRepoIndex ? '#4caf50' : 'white',
                              fontWeight: index === currentRepoIndex ? 600 : 400,
                              wordBreak: 'break-all'
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
                              bgcolor: index === currentRepoIndex ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255,255,255, 0.08)',
                              color: index === currentRepoIndex ? '#4caf50' : 'text.primary'
                            }}
                          />
                          <Chip
                            label={`v${product.version}`}
                            size="small"
                            color="success"
                            sx={{ height: 28, fontSize: '0.7rem', fontFamily: 'monospace' }}
                          />
                          {index === currentRepoIndex && isVerifying && (
                            <CircularProgress size={20} />
                          )}
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                </Paper>

                {/*  SAVED SIGNATURE FILES LINKS */}
                {(product?.publicKeyFilePath || product?.signatureFilePath) && (
                  <Paper sx={{ p: 3, mb: 3, bgcolor: 'rgba(76, 175, 80, 0.08)', border: '2px solid rgba(76, 175, 80, 0.3)', borderRadius: 2 }}>
                    <Stack spacing={1.5}>
                      {product.publicKeyFilePath && (
                        <Box sx={{ p: 2, bgcolor: 'rgba(33, 150, 243, 0.08)', borderRadius: 1, border: '1px solid rgba(33, 150, 243, 0.2)' }}>
                          <Typography
                            variant="body2"
                            component="div"
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1.5,
                              cursor: 'pointer',
                              fontFamily: 'monospace',
                              color: '#2196f3',
                              fontWeight: 500,
                              '&:hover': {
                                color: '#1976d2',
                                textDecoration: 'underline'
                              },
                              mb: 0.5
                            }}
                            onClick={async () => {
                              try {
                                if (window.electronAPI?.openFilePath) {
                                  await window.electronAPI.openFilePath(product.publicKeyFilePath!);
                                }
                                else {
                                  window.open(product.publicKeyFilePath!, '_blank');
                                }
                              } catch (error) {
                                toast.error("Failed to open file");
                              }
                            }}
                          >
                            <VpnKeyIcon sx={{ fontSize: 18 }} />
                            🔓 Public Key: {product.publicKeyFilePath}
                          </Typography>
                        </Box>
                      )}

                      {product.signatureFilePath && (
                        <Box sx={{ p: 2, bgcolor: 'rgba(76, 175, 80, 0.08)', borderRadius: 1, border: '1px solid rgba(76, 175, 80, 0.2)' }}>
                          <Typography
                            variant="body2"
                            component="div"
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1.5,
                              cursor: 'pointer',
                              fontFamily: 'monospace',
                              color: '#4caf50',
                              fontWeight: 500,
                              '&:hover': {
                                color: '#388e3c',
                                textDecoration: 'underline'
                              },
                              mb: 0.5
                            }}
                            onClick={async () => {
                              try {
                                if (window.electronAPI?.openFilePath) {
                                  await window.electronAPI.openFilePath(product.signatureFilePath!);
                                }
                                else {
                                  window.open(product.signatureFilePath!, '_blank');
                                }
                              } catch (error) {
                                toast.error("Failed to open file");
                              }
                            }}
                          >
                            <CheckCircleIcon sx={{ fontSize: 18 }} />
                            ✅ Signature: {product.signatureFilePath}
                          </Typography>
                        </Box>
                      )}
                    </Stack>
                  </Paper>
                )}

                {/* PROGRESS SUMMARY */}
                {isVerifying && (
                  <Paper sx={{ m: 3, p: 2, bgcolor: "rgba(76, 175, 80, 0.1)", border: "1px solid rgba(76, 175, 80, 0.3)" }}>
                    <Typography variant="body2" fontWeight={600} color="#4caf50">
                      Processing: {currentRepoIndex + 1} / {product.repos.length}
                      ({verifiedCount} verified)
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={(verifiedCount / product.repos.length) * 100}
                      sx={{ mt: 1, height: 6 }}
                    />
                  </Paper>
                )}

                {verificationStatus !== "idle" && !isVerifying && (
                  <Alert
                    severity={verificationStatus === "valid" ? "success" : "error"}
                    sx={{ mb: 3 }}
                    icon={verificationStatus === "valid" ? <CheckCircleIcon /> : <ErrorIcon />}
                  >
                    <Typography variant="body2" fontWeight={600}>
                      {verificationStatus === "valid"
                        ? `✅ All ${product.repos.length} signatures verified successfully!`
                        : `❌ ${verifiedCount}/${product.repos.length} signatures verified`}
                    </Typography>
                  </Alert>
                )}

                {/* FILE SELECTION & BUTTON */}
                <Stack spacing={3}>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <TextField
                      fullWidth
                      label="Public Key File (.pub)"
                      value={publicKeyPath}
                      disabled={isVerifying}
                      InputProps={{
                        readOnly: true,
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton onClick={handleSelectPublicKey} disabled={isVerifying} size="small">
                              <FolderOpenIcon />
                            </IconButton>
                          </InputAdornment>
                        )
                      }}
                    />
                    <TextField
                      fullWidth
                      label="Signature File (.sig)"
                      value={signaturePath}
                      disabled={isVerifying}
                      InputProps={{
                        readOnly: true,
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton onClick={handleSelectSignature} disabled={isVerifying} size="small">
                              <FolderOpenIcon />
                            </IconButton>
                          </InputAdornment>
                        )
                      }}
                    />
                  </Stack>

                  <Button
                    variant="contained"
                    size="large"
                    onClick={runSequentialVerification}
                    disabled={!publicKeyPath || !signaturePath || isVerifying}
                    sx={{
                      bgcolor: "#4caf50",
                      color: "white",
                      fontWeight: "bold",
                      boxShadow: "0 4px 14px 0 rgb(76 175 80 / 40%)",
                      "&:hover": { bgcolor: "#45a049" },
                      minWidth: 280
                    }}
                    startIcon={isVerifying ? <CircularProgress size={20} color="inherit" /> : <PlayArrowIcon />}
                  >
                    {isVerifying
                      ? `Verifying... (${verifiedCount}/${product.repos.length})`
                      : `Verify Signature `
                    }
                  </Button>

                  <LogTerminal
                    logs={verifyLogs}
                    isVisible={verifyLogs.length > 0 || isVerifying}
                    isRunning={isVerifying}
                    onCancel={handleCancel}
                    title="SEQUENTIAL VERIFICATION OUTPUT"
                    color="#4caf50"
                  />
                </Stack>
              </Paper>
            </motion.div>
          </Stack>
        </motion.div>
      </Container>
    </Box>
  );
}
