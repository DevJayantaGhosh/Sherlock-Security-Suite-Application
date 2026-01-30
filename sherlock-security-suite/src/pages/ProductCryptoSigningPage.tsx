import { useEffect, useState, useRef } from "react";
import {
  Box, Button, Container, Paper, Stack,
  Typography, Chip, TextField, MenuItem,
  IconButton, Collapse, InputAdornment,
  CircularProgress, Tooltip
} from "@mui/material";

import { useParams, useNavigate } from "react-router-dom";
import { motion, Variants } from "framer-motion";

// Icons
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import FingerprintIcon from "@mui/icons-material/Fingerprint";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import SaveIcon from "@mui/icons-material/Save";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import TerminalIcon from "@mui/icons-material/Terminal";
import CancelIcon from "@mui/icons-material/Cancel";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DownloadIcon from "@mui/icons-material/Download";

import { getProducts } from "../services/productService";
import { Product } from "../models/Product";
import { useUserStore } from "../store/userStore";

// --- ANIMATION VARIANTS ---
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

// --- COMPONENT: CYBER FINGERPRINT ---
const CyberFingerprint = ({ isActive }: { isActive: boolean }) => {
  return (
    <Box sx={{ position: "relative", width: 80, height: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <FingerprintIcon
        sx={{
          fontSize: 80,
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

// --- COMPONENT: LOG TERMINAL ---
interface LogTerminalProps {
  logs: string[];
  isVisible: boolean;
  isRunning: boolean;
  onCancel: () => void;
  title: string;
  color: string;
}

const LogTerminal = ({ logs, isVisible, isRunning, onCancel, title, color }: LogTerminalProps) => {
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible) logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, isVisible]);

  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([logs.join("")], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `${title.replace(/\s+/g, "_")}_Log_${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <Collapse in={isVisible}>
      <Box sx={{ mt: 3, borderTop: `1px solid rgba(255,255,255,0.1)`, pt: 2 }}>
        <Paper sx={{ bgcolor: "#0a0a0a", border: "1px solid #333", overflow: "hidden" }}>
          
          {/* Terminal Header */}
          <Box sx={{ px: 2, py: 1, borderBottom: "1px solid #333", display: "flex", justifyContent: "space-between", alignItems: "center", bgcolor: "#151515" }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <TerminalIcon sx={{ color: color, fontSize: 18 }} />
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

          {/* Terminal Body */}
          <Box sx={{ p: 2, height: 250, overflowY: "auto", fontFamily: "Consolas, monospace", fontSize: 13, bgcolor: "#0a0a0a" }}>
            {logs.length === 0 && (
              <Typography color="text.secondary" textAlign="center" mt={8} variant="caption" display="block">
                Waiting for process start...
              </Typography>
            )}
            {logs.map((log, i) => (
              <Typography key={i} component="pre" sx={{ m: 0, whiteSpace: "pre-wrap", color: log.includes("❌") ? "#ff5252" : log.includes("✅") ? "#69f0ae" : log.includes("WARN") ? "#ffd740" : "#e0e0e0" }}>
                {log}
              </Typography>
            ))}
            <div ref={logEndRef} />
          </Box>
        </Paper>
      </Box>
    </Collapse>
  );
};


export default function ProductCryptoSigningPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useUserStore((s) => s.user);

  const [product, setProduct] = useState<Product | null>(null);

  // --- KEY GEN STATE ---
  const [algo, setAlgo] = useState<"rsa" | "ecdsa">("rsa");
  const [keySize, setKeySize] = useState(2048);
  const [curve, setCurve] = useState("P-256");
  const [keyPassword, setKeyPassword] = useState("");
  const [outputDir, setOutputDir] = useState("");
  const [isKeyGenRunning, setIsKeyGenRunning] = useState(false);
  const [keyGenLogs, setKeyGenLogs] = useState<string[]>([]);
  
  // --- SIGNING STATE ---
  const [selectedRepoIndex, setSelectedRepoIndex] = useState(0);
  const [privateKeyPath, setPrivateKeyPath] = useState("");
  const [signPassword, setSignPassword] = useState("");
  const [isSigningRunning, setIsSigningRunning] = useState(false);
  const [signingLogs, setSigningLogs] = useState<string[]>([]);

  const currentScanId = useRef<string | null>(null);

  useEffect(() => {
    const p = getProducts().find((x) => x.id === id);
    if (!p) navigate("/products");
    else setProduct(p);
  }, [id, navigate]);

  // --- HANDLERS ---
  const handleSelectFolder = async () => {
    const path = await window.electronAPI.selectFolder();
    if (path) setOutputDir(path);
  };

  const handleSelectKeyFile = async () => {
    const path = await window.electronAPI.selectFile();
    if (path) setPrivateKeyPath(path);
  };

  const handleCancel = async () => {
    if (currentScanId.current) {
        const msg = "\n⏳ Requesting Cancellation...";
        if (isKeyGenRunning) setKeyGenLogs(prev => [...prev, msg]);
        if (isSigningRunning) setSigningLogs(prev => [...prev, msg]);
        await window.electronAPI.cancelScan({ scanId: currentScanId.current });
    }
  };

  const runKeyGeneration = async () => {
    if (!product) return;
    setIsKeyGenRunning(true);
    setKeyGenLogs([]); 
    
    const scanId = crypto.randomUUID();
    currentScanId.current = scanId;
    const cleanup = window.electronAPI.onScanLog(scanId, (data) => setKeyGenLogs((prev) => [...prev, data.log]));

    try {
      const result = await window.electronAPI.generateKeys({
        type: algo, size: keySize, curve: curve, password: keyPassword, outputDir, scanId
      });

      if (result.success) {
        let filename = algo === "rsa" ? `rsa-${keySize}-private.pem` : `${algo}-${curve.toLowerCase()}-private.pem`;
        const predictedPath = `${outputDir}\\${filename}`;
        setPrivateKeyPath(predictedPath);
      }
    } catch (e: any) {
        setKeyGenLogs((prev) => [...prev, `\n❌ Error: ${e.message}`]);
    } finally {
      cleanup();
      setIsKeyGenRunning(false);
      currentScanId.current = null;
    }
  };

  const runSigning = async () => {
    if (!product) return;
    setIsSigningRunning(true);
    setSigningLogs([]);

    const scanId = crypto.randomUUID();
    currentScanId.current = scanId;
    const cleanup = window.electronAPI.onScanLog(scanId, (data) => setSigningLogs((prev) => [...prev, data.log]));

    try {
      const targetRepo = product.repos[selectedRepoIndex];
      await window.electronAPI.signArtifact({
        repoUrl: targetRepo.repoUrl, branch: targetRepo.branch, privateKeyPath, password: signPassword, scanId
      });
    } catch (e: any) {
        setSigningLogs((prev) => [...prev, `\n❌ Error: ${e.message}`]);
    } finally {
      cleanup();
      setIsSigningRunning(false);
      currentScanId.current = null;
    }
  };

  if (!product) return null;

  return (
    <Box sx={{ pt: 10, pb: 8, minHeight: "100vh" }}>
      <Container maxWidth="lg">
        <motion.div variants={containerVariants} initial="hidden" animate="visible">
          
          {/* HEADER */}
          <motion.div variants={itemVariants}>
            <Paper sx={{ p: 3, mb: 4, background: "linear-gradient(140deg,#0c1023,#090c1c)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="h4" fontWeight={800} sx={{ color: "#ffffff" }}>
                    Cryptographic Signing Station
                  </Typography>
                  <Typography color="text.secondary" sx={{ mt: 1 }}>{product.name}</Typography>
                  <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                    <Chip label={`v${product.version}`} size="small" variant="outlined" sx={{ color: "white", borderColor: "rgba(255,255,255,0.2)" }} />
                    <Chip label={product.status} size="small" color="success" icon={<CheckCircleIcon />} />
                  </Stack>
                </Box>
                <CyberFingerprint isActive={isSigningRunning || isKeyGenRunning} />
              </Stack>
            </Paper>
          </motion.div>

          <Stack spacing={4}>
            
            {/* 1. KEY GENERATION CARD */}
            <motion.div variants={itemVariants}>
              <Paper sx={{ p: 3, borderLeft: "4px solid #7b5cff" }}>
                <Typography variant="h6" fontWeight={700} gutterBottom display="flex" alignItems="center" gap={1}>
                  <VpnKeyIcon color="primary" /> Key Generation
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={3}>
                  Generate compliant RSA or ECDSA key pairs.
                </Typography>
                
                {/* Inputs */}
                <Stack spacing={3}>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <TextField select label="Algorithm" value={algo} onChange={(e) => setAlgo(e.target.value as any)} sx={{ minWidth: 150 }} disabled={isKeyGenRunning}>
                      <MenuItem value="rsa">RSA</MenuItem>
                      <MenuItem value="ecdsa">ECDSA</MenuItem>
                    </TextField>
                    {algo === "rsa" ? (
                      <TextField select label="Key Size" value={keySize} onChange={(e) => setKeySize(Number(e.target.value))} sx={{ minWidth: 150 }} disabled={isKeyGenRunning}>
                        <MenuItem value={2048}>2048-bit</MenuItem>
                        <MenuItem value={4096}>4096-bit</MenuItem>
                      </TextField>
                    ) : (
                      <TextField select label="Elliptic Curve" value={curve} onChange={(e) => setCurve(e.target.value)} sx={{ minWidth: 150 }} disabled={isKeyGenRunning}>
                        <MenuItem value="P-256">NIST P-256</MenuItem>
                        <MenuItem value="P-384">NIST P-384</MenuItem>
                        <MenuItem value="P-521">NIST P-521</MenuItem>
                      </TextField>
                    )}
                    <TextField type="password" label="Key Password (Optional)" value={keyPassword} onChange={(e) => setKeyPassword(e.target.value)} fullWidth disabled={isKeyGenRunning} />
                  </Stack>
                  <Stack direction="row" spacing={2}>
                    <TextField fullWidth label="Output Directory" value={outputDir} InputProps={{ readOnly: true, endAdornment: (<InputAdornment position="end"><IconButton onClick={handleSelectFolder} disabled={isKeyGenRunning}><FolderOpenIcon /></IconButton></InputAdornment>) }} />
                    <Button variant="contained" onClick={runKeyGeneration} disabled={!outputDir || isKeyGenRunning} sx={{ minWidth: 160, bgcolor: "#7b5cff" }} startIcon={isKeyGenRunning ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}>Generate</Button>
                  </Stack>
                </Stack>

                {/* ATTACHED LOG TERMINAL */}
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

            {/* 2. DIGITAL SIGNING CARD */}
            <motion.div variants={itemVariants}>
              <Paper sx={{ p: 3, borderLeft: "4px solid #00e5ff" }}>
                <Typography variant="h6" fontWeight={700} gutterBottom display="flex" alignItems="center" gap={1}>
                  <FingerprintIcon sx={{ color: "#00e5ff" }} /> Digital Signing
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={3}>
                  Clone repository, verify integrity, and apply digital signature.
                </Typography>

                {/* Inputs */}
                <Stack spacing={3}>
                  <TextField select label="Select Repository to Sign" value={selectedRepoIndex} onChange={(e) => setSelectedRepoIndex(Number(e.target.value))} fullWidth disabled={isSigningRunning}>
                    {product.repos.map((repo, idx) => (
                        <MenuItem key={idx} value={idx}>{repo.repoUrl} &nbsp; <Typography variant="caption" color="text.secondary">({repo.branch})</Typography></MenuItem>
                    ))}
                  </TextField>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <TextField fullWidth label="Private Key Path" value={privateKeyPath} disabled={isSigningRunning} InputProps={{ readOnly: true, endAdornment: (<InputAdornment position="end"><IconButton onClick={handleSelectKeyFile} disabled={isSigningRunning}><FolderOpenIcon /></IconButton></InputAdornment>) }} />
                    <TextField type="password" label="Key Password" value={signPassword} onChange={(e) => setSignPassword(e.target.value)} sx={{ minWidth: 200 }} disabled={isSigningRunning} />
                  </Stack>
                  <Button variant="contained" size="large" onClick={runSigning} disabled={!privateKeyPath || isSigningRunning} sx={{ bgcolor: "#00e5ff", color: "black", fontWeight: "bold", "&:hover": { bgcolor: "#00b8cc" } }} startIcon={isSigningRunning ? <CircularProgress size={20} color="inherit" /> : <PlayArrowIcon />}>
                    {isSigningRunning ? "Signing in Progress..." : "Sign Artifact"}
                  </Button>
                </Stack>

                {/* ATTACHED LOG TERMINAL */}
                <LogTerminal 
                    logs={signingLogs} 
                    isVisible={signingLogs.length > 0 || isSigningRunning} 
                    isRunning={isSigningRunning} 
                    onCancel={handleCancel}
                    title="SIGNING PROCESS OUTPUT"
                    color="#00e5ff"
                />
              </Paper>
            </motion.div>

          </Stack>
        </motion.div>
      </Container>
    </Box>
  );
}
