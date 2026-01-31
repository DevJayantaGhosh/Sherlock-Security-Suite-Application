import { useEffect, useState, useRef } from "react";
import {
  Box, Button, Container, Paper, Stack,
  Typography, Chip, TextField, MenuItem,
  IconButton, Collapse, 
  CircularProgress, Tooltip,
  InputAdornment
} from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";
import { motion, Variants } from "framer-motion";

import BlockchainArchivalCard from "../components/cryptosigning/BlockchainArchivalCard"; 
import { getProducts } from "../services/productService";
import { Product } from "../models/Product";
import { useUserStore } from "../store/userStore";

import VpnKeyIcon from "@mui/icons-material/VpnKey";
import FingerprintIcon from "@mui/icons-material/Fingerprint";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import SaveIcon from "@mui/icons-material/Save";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import TerminalIcon from "@mui/icons-material/Terminal";
import CancelIcon from "@mui/icons-material/Cancel";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
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
    return { color: "#ff5252", fontWeight: "bold" };
  if (text.includes("✅") || text.includes("EXISTS") || text.includes("SUCCESS") || text.includes("OK")) 
    return { color: "#69f0ae", fontWeight: "bold" };
  if (text.includes("🔴") || text.includes("⚠️") || text.includes("ERROR") || text.includes("ISSUE")) 
    return { color: "#ffd740" };
  if (text.includes("🔑") || text.includes("🔍") || text.includes("INITIATED") || text.includes("STARTED")) 
    return { color: "#00e5ff", fontWeight: "bold" };
  if (text.includes("🔹")) return { color: "#b39ddb" }; 
  if (text.includes("═")) return { color: "rgb(38, 194, 191)" };
  return { color: "#e0e0e0" };
};

const CyberFingerprint = ({ isActive }: { isActive: boolean }) => {
  return (
    <Box sx={{ position: "relative", width: 80, height: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <FingerprintIcon
        sx={{
          fontSize: 100,
          color: isActive ? "#00e5ff" : "rgba(255, 255, 255, 0.15)",
          transition: "all 0.5s ease",
          filter: isActive ? "drop-shadow(0 0 15px rgba(0, 229, 255, 0.5))" : "none",
        }}
      />
      {isActive && (
        <motion.div
          initial={{ top: "0%", opacity: 0 }}
          animate={{ top: ["0%", "100%", "0%"], opacity: 1 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: "absolute", left: 0, width: "100%", height: "2px",
            background: "linear-gradient(90deg, transparent, #fff, transparent)",
            boxShadow: "0 0 10px #00e5ff, 0 0 20px #00e5ff", zIndex: 2,
          }}
        />
      )}
    </Box>
  );
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
              p: 2, 
              maxHeight: 300, 
              height: 300, 
              overflowY: "auto", 
              fontFamily: "'Consolas', 'Monaco', monospace", 
              fontSize: 13, 
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
              <Typography color="text.secondary" textAlign="center" mt={8} variant="caption" display="block" sx={{ opacity: 0.5 }}>
                _ Waiting for backend process...
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

export default function ProductCryptoSigningPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useUserStore((s) => s.user);
  console.log(user)
  const [product, setProduct] = useState<Product | null>(null);

  // KEY GENERATION STATE
  const [algo, setAlgo] = useState<"rsa" | "ecdsa">("rsa");
  const [keySize, setKeySize] = useState(2048);
  const [curve, setCurve] = useState("P-256");
  const [keyPassword, setKeyPassword] = useState("");
  const [outputDir, setOutputDir] = useState("");
  const [isKeyGenRunning, setIsKeyGenRunning] = useState(false);
  const [keyGenLogs, setKeyGenLogs] = useState<string[]>([]);

  // SIGNING STATE
  const [selectedRepoIndex, setSelectedRepoIndex] = useState(0);
  const [privateKeyPath, setPrivateKeyPath] = useState("");
  const [signPassword, setSignPassword] = useState("");
  const [isSigningRunning, setIsSigningRunning] = useState(false);
  const [signingLogs, setSigningLogs] = useState<string[]>([]);
  const [lastSignedFile, setLastSignedFile] = useState("");

  const currentScanId = useRef<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const p = getProducts().find((x) => x.id === id);
    if (!p) {
      navigate("/products");
      return;
    }
    setProduct(p);
  }, [id, navigate]);

  const handleSelectFolder = async () => {
    try {
      const path = await window.electronAPI?.selectFolder();
      if (path) setOutputDir(path);
    } catch (e) {
      console.error("Folder selection failed:", e);
    }
  };

  const handleSelectKeyFile = async () => {
    try {
      const path = await window.electronAPI?.selectFile();
      if (path) setPrivateKeyPath(path);
    } catch (e) {
      console.error("File selection failed:", e);
    }
  };

  const handleCancel = async () => {
    if (currentScanId.current && window.electronAPI?.cancelScan) {
      if (isKeyGenRunning) setKeyGenLogs(prev => [...prev, "\n⏳ Requesting cancellation..."]);
      if (isSigningRunning) setSigningLogs(prev => [...prev, "\n⏳ Requesting cancellation..."]);
      try {
        await window.electronAPI.cancelScan({ scanId: currentScanId.current });
      } catch (e) {
        console.error("Cancel failed:", e);
      }
    }
  };


  const runKeyGeneration = async () => {
    if (!product || !outputDir || !window.electronAPI) return;
    
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
      
      
    } catch (e: any) {
      setKeyGenLogs(prev => [...prev, `\n❌ Frontend Error: ${e.message}`]);
    } finally {
      setTimeout(() => {
        setIsKeyGenRunning(false);
        currentScanId.current = null;
        if (cleanup) cleanup();
      }, 1500);
    }
  };

  const runSigning = async () => {
    if (!product || !privateKeyPath || !window.electronAPI) return;
    
    setIsSigningRunning(true);
    setSigningLogs([]);
    
    const scanId = crypto.randomUUID();
    currentScanId.current = scanId;
    
    const cleanup = window.electronAPI.onScanLog(scanId, (data) => {
      setSigningLogs((prev) => [...prev, data.log]);
    });

    try {
      const targetRepo = product.repos[selectedRepoIndex];
      await window.electronAPI.signArtifact({
        repoUrl: targetRepo.repoUrl,
        branch: targetRepo.branch,
        privateKeyPath,
        password: signPassword,
        scanId
      });
      setLastSignedFile("signature.sig (Ready for Upload)");
    } catch (e: any) {
      setSigningLogs(prev => [...prev, `\n❌ Frontend Error: ${e.message}`]);
    } finally {
      setTimeout(() => {
        setIsSigningRunning(false);
        currentScanId.current = null;
        if (cleanup) cleanup();
      }, 1500);
    }
  };

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
          
          {/* HEADER */}
          <motion.div variants={itemVariants}>
            <Paper sx={{ 
              p: 3, 
              mb: 4, 
              background: "linear-gradient(140deg, #0c1023 0%, #090c1c 100%)", 
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 2
            }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="h4" fontWeight={800} sx={{ color: "#ffffff" }}>
                    Cryptographic Signing Station
                  </Typography>
                  <Typography color="text.secondary" sx={{ mt: 1, fontSize: '1.1rem' }}>
                    {product.name}
                  </Typography>
                  <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                    <Chip 
                      label={`v${product.version}`} 
                      size="small" 
                      variant="outlined" 
                      sx={{ 
                        color: "white", 
                        borderColor: "rgba(255,255,255,0.3)",
                        fontWeight: 600
                      }} 
                    />
                    <Chip 
                      label={product.status} 
                      size="small" 
                      color="success" 
                      icon={<CheckCircleIcon />} 
                    />
                  </Stack>
                </Box>
                <CyberFingerprint isActive={true} />
              </Stack>
            </Paper>
          </motion.div>

          <Stack spacing={4}>
            {/* KEY GENERATION CARD */}
            <motion.div variants={itemVariants}>
              <Paper sx={{ p: 3, borderLeft: "4px solid #7b5cff", borderRadius: 1 }}>
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
                      disabled={isKeyGenRunning}
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
                        disabled={isKeyGenRunning}
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
                        disabled={isKeyGenRunning}
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
                      disabled={isKeyGenRunning}
                      placeholder="Leave empty for unprotected key"
                    />
                  </Stack>
                  
                  <Stack direction="row" spacing={2} alignItems="center">
                    <TextField 
                      fullWidth 
                      label="Output Directory" 
                      value={outputDir} 
                      InputProps={{ 
                        readOnly: true, 
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton onClick={handleSelectFolder} disabled={isKeyGenRunning} size="small">
                              <FolderOpenIcon />
                            </IconButton>
                          </InputAdornment>
                        ) 
                      }} 
                    />
                    <Button 
                      variant="contained" 
                      onClick={runKeyGeneration} 
                      disabled={!outputDir || isKeyGenRunning} 
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
                  </Stack>
                </Stack>
                
                <LogTerminal 
                  logs={keyGenLogs} 
                  isVisible={keyGenLogs.length > 0 || isKeyGenRunning} 
                  isRunning={isKeyGenRunning} 
                  onCancel={handleCancel} 
                  title="KEY GENERATION OUTPUT" 
                  color="#7b5cff" 
                />
              </Paper>
            </motion.div>

            {/* DIGITAL SIGNING CARD */}
            <motion.div variants={itemVariants}>
              <Paper sx={{ p: 3, borderLeft: "4px solid #00e5ff", borderRadius: 1 }}>
                <Typography variant="h6" fontWeight={700} gutterBottom display="flex" alignItems="center" gap={1}>
                  <FingerprintIcon sx={{ color: "#00e5ff", fontSize: 24 }} /> Digital Signing
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={3}>
                  Clone repository and apply cryptographic signature.
                </Typography>

                <Stack spacing={3}>
                  <TextField 
                    select 
                    label="Repository to Sign" 
                    value={selectedRepoIndex} 
                    onChange={(e) => setSelectedRepoIndex(Number(e.target.value))} 
                    fullWidth 
                    disabled={isSigningRunning}
                  >
                    {product.repos.map((repo, idx) => (
                      <MenuItem key={idx} value={idx}>
                        <Box sx={{ display: "flex", flexDirection: "column", width: "100%" }}>
                          <Typography variant="body2" noWrap>{repo.repoUrl}</Typography>
                          <Typography variant="caption" color="text.secondary">({repo.branch})</Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </TextField>
                  
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <TextField 
                      fullWidth 
                      label="Private Key File" 
                      value={privateKeyPath} 
                      disabled={isSigningRunning}
                      InputProps={{ 
                        readOnly: true, 
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton onClick={handleSelectKeyFile} disabled={isSigningRunning} size="small">
                              <FolderOpenIcon />
                            </IconButton>
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
                      disabled={isSigningRunning} 
                    />
                  </Stack>
                  
                  <Button 
                    variant="contained" 
                    size="large" 
                    onClick={runSigning} 
                    disabled={!privateKeyPath || isSigningRunning} 
                    sx={{ 
                      bgcolor: "#00e5ff", 
                      color: "black", 
                      fontWeight: "bold",
                      boxShadow: "0 4px 14px 0 rgb(0 229 255 / 40%)",
                      "&:hover": { bgcolor: "#00b8d4" }
                    }} 
                    startIcon={isSigningRunning ? <CircularProgress size={20} /> : <PlayArrowIcon />}
                  >
                    {isSigningRunning ? "Signing Repository..." : "Sign Artifact"}
                  </Button>
                </Stack>
                
                <LogTerminal 
                  logs={signingLogs} 
                  isVisible={signingLogs.length > 0 || isSigningRunning} 
                  isRunning={isSigningRunning} 
                  onCancel={handleCancel} 
                  title="SIGNING OUTPUT" 
                  color="#00e5ff" 
                />
              </Paper>
            </motion.div>

            {/* BLOCKCHAIN ARCHIVAL */}
            <motion.div variants={itemVariants}>
              <BlockchainArchivalCard variants={itemVariants} suggestedFile={lastSignedFile} />
            </motion.div>
          </Stack>
        </motion.div>
      </Container>
    </Box>
  );
}
