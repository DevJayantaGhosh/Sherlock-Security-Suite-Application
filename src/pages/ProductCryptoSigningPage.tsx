import { useEffect, useState, useRef, useCallback } from "react";
import {
  Box, Button, Container, Paper, Stack,
  Typography, Chip, TextField, MenuItem,
  IconButton, Collapse,
  CircularProgress, Tooltip,
  InputAdornment, LinearProgress, Alert
} from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";
import { motion, Variants } from "framer-motion";
import { toast } from "react-hot-toast";
import ProductHeader from '../components/ProductHeader';
import BlockchainArchivalCard from "../components/cryptosigning/BlockchainArchivalCard";
import { authorizeToSign, getProductById, updateProduct } from "../services/productService";
import { Product } from "../models/Product";
import { useUserStore } from "../store/userStore";
import { ACCESS_MESSAGES } from "../constants/accessMessages";

import VpnKeyIcon from "@mui/icons-material/VpnKey";
import FingerprintIcon from "@mui/icons-material/Fingerprint";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import SaveIcon from "@mui/icons-material/Save";
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
  if (text.includes("❌") || text.includes("Error") || text.includes("FAILED") || text.includes("MISSING") || text.includes("💥"))
    return { color: "#ff5252", fontWeight: "50" };
  if (text.includes("✅") || text.includes("EXISTS") || text.includes("SUCCESS") || text.includes("OK"))
    return { color: "#69f0ae", fontWeight: "50" };
  if (text.includes("🔴") || text.includes("⚠️") || text.includes("ERROR") || text.includes("ISSUE"))
    return { color: "#ffd740" };
  if (text.includes("🔑") || text.includes("🔍") || text.includes("INITIATED") || text.includes("STARTED"))
    return { color: "#00e5ff", fontWeight: "50" };
  if (text.includes("🔹")) return { color: "#b39ddb" };
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
          position: "relative"
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
              p: 1.5, // Reduced padding
              maxHeight: 300,
              height: 300,
              overflowY: "auto",
              fontFamily: "'Consolas', 'Monaco', monospace",
              fontSize: "12px", // 🔧 SMALL FONT LIKE SECURITY PAGE
              lineHeight: 1.4, // Tighter line height
              bgcolor: "#0a0a0a",
              scrollbarWidth: "thin",
              "&::-webkit-scrollbar": {
                width: "6px"
              },
              "&::-webkit-scrollbar-track": {
                background: "#1a1a1a"
              },
              "&::-webkit-scrollbar-thumb": {
                background: "#444",
                borderRadius: "3px"
              }
            }}
          >
            {logs.length === 0 && (
              <Typography color="text.secondary" textAlign="center" mt={8} variant="caption" display="block" sx={{ opacity: 0.5, fontSize: "12px" }}>
                _ Waiting for backend process...
              </Typography>
            )}
            {logs.map((log, i) => (
              <Typography 
                key={i} 
                component="div" 
                sx={{ 
                  m: 0, 
                  whiteSpace: "pre-wrap", 
                  lineHeight: 1.4,
                  fontSize: "12px", // 🔧 CONSISTENT SMALL FONT
                  ...getLogStyle(log) 
                }}
              >
                {log}
              </Typography>
            ))}
          </Box>
        </Paper>
      </Box>
    </Collapse>
  );
};

export default function ProductCryptoSigningPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useUserStore((s) => s.user);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  // KEY GENERATION STATE
  const [algo, setAlgo] = useState<"rsa" | "ecdsa">("rsa");
  const [keySize, setKeySize] = useState(2048);
  const [curve, setCurve] = useState("P-256");
  const [keyPassword, setKeyPassword] = useState("");
  const [outputDir, setOutputDir] = useState("");
  const [isKeyGenRunning, setIsKeyGenRunning] = useState(false);
  const [keyGenLogs, setKeyGenLogs] = useState<string[]>([]);

  // SEQUENTIAL SIGNING STATE
  const [privateKeyPath, setPrivateKeyPath] = useState("");
  const [signPassword, setSignPassword] = useState("");
  const [isSigningRunning, setIsSigningRunning] = useState(false);
  const [signingLogs, setSigningLogs] = useState<string[]>([]);
  const [currentRepoIndex, setCurrentRepoIndex] = useState(0);
  const [completedReposCount, setCompletedReposCount] = useState(0);
  const [lastSignedFile, setLastSignedFile] = useState("");

  const currentScanId = useRef<string | null>(null);
  const isSigningCancelled = useRef(false);

  // Load product using getProductById(id)
  const loadProduct = useCallback(async () => {
    if (!id) {
      toast.error("Invalid product ID", { id: "invalid-product-id" });
      navigate("/products");
      return;
    }

    setLoading(true);
    console.log("[CRYPTO SIGNING PAGE] Loading product:", id);

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
      toast.error("Failed to load product", { id: "product-load-failed" });
      navigate("/products");
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  // AUTHORIZATION LOGIC
const isAuthorized = product ? authorizeToSign(user, product) : false;
const isViewOnlyMode = product?.status !== "Approved" || !isAuthorized;

const tooltip = isViewOnlyMode 
  ? (product?.status !== "Approved"
      ? `Product status is "${product?.status}". No actions allowed.`
      : ACCESS_MESSAGES.RELEASE_ENGINEER_SIGN_MSG)
  : "";


  const handleSelectFolder = async () => {
    if (!isAuthorized) {
      toast.error("View-only mode: Cannot select folders", { id: "auth-folder" });
      return;
    }
    try {
      const path = await window.electronAPI?.selectFolder();
      if (path) setOutputDir(path);
    } catch (e) {
      console.error("Folder selection failed:", e);
      toast.error("Failed to select folder", { id: "folder-select-error" });
    }
  };

  const handleSelectKeyFile = async () => {
    if (!isAuthorized) {
      toast.error("View-only mode: Cannot select files", { id: "auth-keyfile" });
      return;
    }
    try {
      const path = await window.electronAPI?.selectFile();
      if (path) setPrivateKeyPath(path);
    } catch (e) {
      console.error("File selection failed:", e);
      toast.error("Failed to select key file", { id: "keyfile-select-error" });
    }
  };

  const handleCancel = async () => {
    isSigningCancelled.current = true;
    if (currentScanId.current && window.electronAPI?.cancelScan) {
      if (isKeyGenRunning) setKeyGenLogs(prev => [...prev, "\n⏳ Requesting cancellation..."]);
      if (isSigningRunning) setSigningLogs(prev => [...prev, "\n⏳ Requesting cancellation..."]);
      try {
        await window.electronAPI.cancelScan({ scanId: currentScanId.current });
        toast.success("Cancellation requested", { id: "cancel-success" });
      } catch (e) {
        console.error("Cancel failed:", e);
        toast.error("Failed to cancel operation", { id: "cancel-error" });
      }
    }
  };

  const runKeyGeneration = async () => {
    if (!isAuthorized) {
      toast.error("Only authorized users can generate keys");
      return;
    }
    if (!product || !outputDir || !window.electronAPI) {
      toast.error("Please select output directory", { id: "keygen-missing-dir" });
      return;
    }

    setIsKeyGenRunning(true);
    setKeyGenLogs([]);

    const scanId = crypto.randomUUID();
    currentScanId.current = scanId;

    const cleanup = window.electronAPI.onScanLog(scanId, (data) => {
      setKeyGenLogs((prev) => [...prev, data.log]);
    });

    try {
      await window.electronAPI.generateKeys({
        type: algo,
        size: keySize,
        curve,
        password: keyPassword,
        outputDir,
        scanId
      });
      toast.success("Keys generated successfully!", { id: "keygen-success" });
    } catch (e: any) {
      setKeyGenLogs(prev => [...prev, `\n❌ Frontend Error: ${e.message}`]);
      toast.error(`Key generation failed: ${e.message}`, { id: "keygen-error" });
    } finally {
      setTimeout(() => {
        setIsKeyGenRunning(false);
        currentScanId.current = null;
        if (cleanup) cleanup();
      }, 1500);
    }
  };

  const signSingleRepo = useCallback(async (repoIndex: number) => {
    if (!product || !privateKeyPath || !window.electronAPI) return false;

    const targetRepo = product.repos[repoIndex];
    const scanId = crypto.randomUUID();
    currentScanId.current = scanId;

    setSigningLogs(prev => [...prev,
    `\n${"═".repeat(80)}`,
    `🔹 REPO ${repoIndex + 1}/${product.repos.length}: ${targetRepo.repoUrl}`,
    `   Branch: ${targetRepo.branch}`,
    `${"═".repeat(80)}\n`
    ]);

    setIsSigningRunning(true);

    const cleanup = window.electronAPI.onScanLog(scanId, (data) => {
      setSigningLogs((prev) => [...prev, data.log]);
    });

    try {
      await window.electronAPI.signArtifact({
        repoUrl: targetRepo.repoUrl,
        branch: targetRepo.branch,
        privateKeyPath,
        password: signPassword,
        isQuickScan: false,
        githubToken: "",
        scanId
      });
      setLastSignedFile("signature.sig (Ready for Upload)");
      toast.success(`Repo ${repoIndex + 1} signed successfully`, { id: `sign-repo-${repoIndex}-success` });
      return true;
    } catch (e: any) {
      setSigningLogs(prev => [...prev, `\n❌ Frontend Error: ${e.message}`]);
      toast.error(`Failed to sign repo ${repoIndex + 1}: ${e.message}`, { id: `sign-repo-${repoIndex}-error` });
      return false;
    } finally {
      setTimeout(() => {
        setIsSigningRunning(false);
        currentScanId.current = null;
        if (cleanup) cleanup();
      }, 1500);
    }
  }, [product, privateKeyPath, signPassword]);

  const runSequentialSigning = useCallback(async () => {
    if (!isAuthorized) {
      toast.error("Only authorized users can sign artifacts");
      return;
    }
    if (!product || !privateKeyPath || !window.electronAPI) return;

    isSigningCancelled.current = false;
    setCurrentRepoIndex(0);
    setCompletedReposCount(0);

    setSigningLogs([`🔹 Sequential signing STARTED: ${product.name}`,
    `${product.repos.length} repositories`,
    `${"═".repeat(80)}\n`]);

    for (let i = 0; i < product.repos.length; i++) {
      if (isSigningCancelled.current) {
        setSigningLogs(prev => [...prev, `\n⚠️ Signing cancelled by user`]);
        break;
      }

      setCurrentRepoIndex(i);
      const success = await signSingleRepo(i);

      if (success) {
        setCompletedReposCount(prev => prev + 1);
      }

      if (i < product.repos.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }, [product, privateKeyPath, signPassword, signSingleRepo, completedReposCount]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "50vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!product) {
    return null;
  }

  return (
    <Box sx={{ pt: 10, pb: 8, minHeight: "100vh", bgcolor: "background.default" }}>
      <Container maxWidth="lg">
        <motion.div variants={containerVariants} initial="hidden" animate="visible">

          {/* HEADER */}
          <motion.div variants={itemVariants}>
            <ProductHeader product={product} pageType="crypto" />
          </motion.div>

          {/* 🔐 AUTHORIZATION WARNING */}
          {!isAuthorized && (
            <motion.div variants={itemVariants}>
              <Paper sx={{
                p: 2,
                mb: 3,
                bgcolor: "rgba(255,193,7,0.1)",
                border: "1px solid rgba(255,193,7,0.3)",
              }}>
                <Typography color="warning.main" fontWeight={600}>
                  View-Only Mode
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {ACCESS_MESSAGES.RELEASE_ENGINEER_SIGN_MSG}
                </Typography>
              </Paper>
            </motion.div>
          )}

          <Stack spacing={4}>
            {/* KEY GENERATION CARD */}
            <motion.div variants={itemVariants}>
              <Paper sx={{ p: 3, borderLeft: "4px solid #00e5ff", borderRadius: 1 }}>
                <Typography variant="h6" fontWeight={700} gutterBottom display="flex" alignItems="center" gap={1}>
                  <VpnKeyIcon color="primary" sx={{ fontSize: 24 }} /> Key Generation
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={3}>
                  Generate RSA or ECDSA key pairs for artifact signing.
                </Typography>

                <Stack spacing={3}>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="flex-end">
                    <TextField
                      select
                      label="Algorithm"
                      value={algo}
                      onChange={(e) => setAlgo(e.target.value as "rsa" | "ecdsa")}
                      sx={{ minWidth: 150 }}
                      disabled={!isAuthorized || isKeyGenRunning}
                    >
                      <MenuItem value="rsa">RSA</MenuItem>
                      <MenuItem value="ecdsa">ECDSA</MenuItem>
                    </TextField>

                    {algo === "rsa" ? (
                      <TextField
                        select
                        label="Key Size"
                        value={keySize}
                        onChange={(e) => setKeySize(Number(e.target.value))}
                        sx={{ minWidth: 150 }}
                        disabled={!isAuthorized || isKeyGenRunning}
                      >
                        <MenuItem value={2048}>2048-bit</MenuItem>
                        <MenuItem value={4096}>4096-bit</MenuItem>
                      </TextField>
                    ) : (
                      <TextField
                        select
                        label="Curve"
                        value={curve}
                        onChange={(e) => setCurve(e.target.value as string)}
                        sx={{ minWidth: 150 }}
                        disabled={!isAuthorized || isKeyGenRunning}
                      >
                        <MenuItem value="P-256">P-256</MenuItem>
                        <MenuItem value="P-384">P-384</MenuItem>
                        <MenuItem value="P-521">P-521</MenuItem>
                      </TextField>
                    )}

                    <TextField
                      type="password"
                      label="Key Password (optional)"
                      value={keyPassword}
                      onChange={(e) => setKeyPassword(e.target.value)}
                      fullWidth
                      disabled={!isAuthorized || isKeyGenRunning}
                      placeholder="Leave empty for unprotected key"
                    />
                  </Stack>

                  <Stack direction="row" spacing={2} alignItems="center">
                    <TextField
                      fullWidth
                      label="Output Directory"
                      value={outputDir}
                      disabled={!isAuthorized}
                      InputProps={{
                        readOnly: true,
                        endAdornment: (
                          <InputAdornment position="end">
                            <Tooltip title={!isAuthorized ? tooltip : ""} arrow>
                              <span>
                                <IconButton 
                                  onClick={handleSelectFolder} 
                                  disabled={!isAuthorized || isKeyGenRunning}
                                  size="small"
                                >
                                  <FolderOpenIcon />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </InputAdornment>
                        )
                      }}
                    />
                    <Tooltip title={!isAuthorized ? tooltip : ""} arrow>
                      <span>
                        <Button
                          variant="contained"
                          onClick={runKeyGeneration}
                          disabled={!outputDir || isKeyGenRunning || !isAuthorized}
                          sx={{
                            minWidth: 160,
                            bgcolor: "#7b5cff",
                            boxShadow: "0 4px 14px 0 rgb(123 92 255 / 40%)",
                            "&:hover": { bgcolor: "#6633cc" }
                          }}
                          startIcon={isKeyGenRunning ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                        >
                          {isKeyGenRunning ? "Generating..." : "Generate Keys"}
                        </Button>
                      </span>
                    </Tooltip>
                  </Stack>

                  <LogTerminal
                    logs={keyGenLogs}
                    isVisible={keyGenLogs.length > 0 || isKeyGenRunning}
                    isRunning={isKeyGenRunning}
                    onCancel={handleCancel}
                    title="KEY GENERATION OUTPUT"
                    color="#7b5cff"
                  />
                </Stack>
              </Paper>
            </motion.div>

            {/* DIGITAL SIGNING CARD */}
            <motion.div variants={itemVariants}>
              <Paper sx={{ p: 3, borderLeft: "4px solid #00e5ff", borderRadius: 1 }}>
                <Typography variant="h6" fontWeight={700} gutterBottom display="flex" alignItems="center" gap={1}>
                  <FingerprintIcon sx={{ color: "#00e5ff", fontSize: 24 }} /> Digital Signing
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={3}>
                  Process each repository and apply a cryptographic signature
                </Typography>

                <Stack spacing={3}>
                  {/* REPO LIST */}
                  <Paper sx={{
                    p: 3,
                    mb: 3,
                    borderRadius: 2,
                    bgcolor: 'rgba(255,255,255, 0.02)',
                    border: '1px solid rgba(255,255,255, 0.08)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
                  }}>
                    <Typography variant="h6" fontWeight={500} mb={2.5} color="#00e5ff" sx={{ fontFamily: 'monospace' }}>
                      📂 {product.repos.length === 1 ? 'Repository' : 'Repositories'} ({product.repos.length})
                    </Typography>
                    <Stack spacing={1.5}>
                      {product.repos.map((repo, index) => (
                        <Paper
                          key={index}
                          elevation={index === currentRepoIndex ? 4 : 1}
                          sx={{
                            p: 1.5,
                            borderRadius: 1,
                            bgcolor: index === currentRepoIndex ? 'rgba(0, 229, 255, 0.08)' : 'transparent',
                            border: index === currentRepoIndex ? '2px solid rgba(0, 229, 255, 0.3)' : '1px solid rgba(255,255,255, 0.05)',
                            transition: 'all 0.3s ease',
                          }}
                        >
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <Box sx={{
                              width: 36, height: 36,
                              borderRadius: 1,
                              bgcolor: index === currentRepoIndex ? 'rgba(0, 229, 255, 0.2)' : 'rgba(255,255,255, 0.08)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              border: index === currentRepoIndex ? '2px solid #00e5ff' : '1px solid transparent'
                            }}>
                              <Typography variant="subtitle2" fontWeight={700} color={index === currentRepoIndex ? '#00e5ff' : 'text.secondary'} sx={{ fontSize: '0.875rem' }}>
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
                                color: index === currentRepoIndex ? '#00e5ff' : 'white',
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
                                bgcolor: index === currentRepoIndex ? 'rgba(0, 229, 255, 0.2)' : 'rgba(255,255,255, 0.08)',
                                color: index === currentRepoIndex ? '#00e5ff' : 'text.primary',
                                border: index === currentRepoIndex ? '1px solid rgba(0, 229, 255, 0.3)' : 'none',
                                '& .MuiChip-label': { py: 0.25 }
                              }}
                            />
                            {index === currentRepoIndex && isSigningRunning && (
                              <CircularProgress size={20} />
                            )}
                          </Stack>
                        </Paper>
                      ))}
                    </Stack>
                  </Paper>

                  {/* Progress Summary */}
                  {isSigningRunning && (
                    <Paper sx={{ p: 2, bgcolor: "rgba(0, 229, 255, 0.1)", border: "1px solid rgba(0, 229, 255, 0.3)" }}>
                      <Typography variant="body2" fontWeight={600} color="#00e5ff">
                        Processing: {currentRepoIndex + 1} / {product.repos.length}
                        ({completedReposCount} completed)
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={(completedReposCount / product.repos.length) * 100}
                        sx={{ mt: 1, height: 6 }}
                      />
                    </Paper>
                  )}

                  {/* Key selection fields */}
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <TextField
                      fullWidth
                      label="Private Key File"
                      value={privateKeyPath}
                      disabled={!isAuthorized || isSigningRunning}
                      InputProps={{
                        readOnly: true,
                        endAdornment: (
                          <InputAdornment position="end">
                            <Tooltip title={!isAuthorized ? tooltip : ""} arrow>
                              <span>
                                <IconButton 
                                  onClick={handleSelectKeyFile} 
                                  disabled={!isAuthorized || isSigningRunning}
                                  size="small"
                                >
                                  <FolderOpenIcon />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </InputAdornment>
                        )
                      }}
                    />
                    <TextField
                      type="password"
                      label="Key Password"
                      value={signPassword}
                      onChange={(e) => setSignPassword(e.target.value)}
                      sx={{ minWidth: 200 }}
                      disabled={!isAuthorized || isSigningRunning}
                    />
                  </Stack>

                  <Tooltip title={!isAuthorized ? tooltip : ""} arrow>
                    <span>
                      <Button
                        variant="contained"
                        size="large"
                        onClick={runSequentialSigning}
                        disabled={!privateKeyPath || isSigningRunning || !isAuthorized}
                        sx={{
                          bgcolor: "#00e5ff",
                          color: "black",
                          fontWeight: "bold",
                          boxShadow: "0 4px 14px 0 rgb(0 229 255 / 40%)",
                          "&:hover": { bgcolor: "#00b8d4" }
                        }}
                        startIcon={isSigningRunning ? <CircularProgress size={20} /> : <PlayArrowIcon />}
                      >
                        {isSigningRunning
                          ? `Signing... (${completedReposCount}/${product.repos.length})`
                          : `Sign Artifacts`
                        }
                      </Button>
                    </span>
                  </Tooltip>

                  <LogTerminal
                    logs={signingLogs}
                    isVisible={signingLogs.length > 0 || isSigningRunning}
                    isRunning={isSigningRunning}
                    onCancel={handleCancel}
                    title="SEQUENTIAL SIGNING OUTPUT"
                    color="#00e5ff"
                  />
                </Stack>
              </Paper>
            </motion.div>

            {/* BLOCKCHAIN ARCHIVAL */}
            <motion.div variants={itemVariants}>
              <BlockchainArchivalCard
                variants={itemVariants}
                product={product}
                disabled={!isAuthorized}
              />
            </motion.div>
          </Stack>
        </motion.div>
      </Container>
    </Box>
  );
}
