// src/pages/QuickCryptoSigningPage.tsx
import { useState, useCallback, useRef, useEffect } from "react";
import {
  Box, Container, Stack, Typography, Paper, TextField, 
  Button, IconButton, InputAdornment, LinearProgress,
  Chip, MenuItem, CircularProgress, Collapse, Tooltip
} from "@mui/material";
import { toast } from "react-hot-toast";
import { motion, Variants } from "framer-motion";
import QuickHeader from "../components/QuickHeader";
import RepoConfigForm from "../components/RepoConfigForm";
import { RepoDetails } from "../models/Product";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import FingerprintIcon from "@mui/icons-material/Fingerprint";
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

export default function QuickCryptoSigningPage() {
  const [repoDetails, setRepoDetails] = useState<RepoDetails | null>(null);
  const [githubToken, setGithubToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);

  // KEY GENERATION STATE
  const [algo, setAlgo] = useState<"rsa" | "ecdsa">("rsa");
  const [keySize, setKeySize] = useState(2048);
  const [curve, setCurve] = useState("P-256");
  const [keyPassword, setKeyPassword] = useState("");
  const [outputDir, setOutputDir] = useState("");
  const [isKeyGenRunning, setIsKeyGenRunning] = useState(false);
  const [keyGenLogs, setKeyGenLogs] = useState<string[]>([]);

  // DIGITAL SIGNING STATE
  const [privateKeyPath, setPrivateKeyPath] = useState("");
  const [signPassword, setSignPassword] = useState("");
  const [isSigningRunning, setIsSigningRunning] = useState(false);
  const [signingLogs, setSigningLogs] = useState<string[]>([]);
  const [completedReposCount, setCompletedReposCount] = useState(0);

  const currentScanId = useRef<string | null>(null);
  const isSigningCancelled = useRef(false);

  const handleConfigureRepo = useCallback((repoDetails: RepoDetails, githubToken?: string) => {
    setRepoDetails(repoDetails);
    setGithubToken(githubToken || "");
    setIsConfigured(true);
    setLoading(false);
    
    const type = repoDetails.repoUrl.includes('github.com') ? 'GitHub' : 'Local';
    toast.success(`${type} repository configured!`, { duration: 4000 });
  }, []);

  const handleReset = useCallback(() => {
    setRepoDetails(null);
    setGithubToken("");
    setIsConfigured(false);
    // Reset crypto-specific state
    setAlgo("rsa");
    setKeySize(2048);
    setCurve("P-256");
    setKeyPassword("");
    setOutputDir("");
    setPrivateKeyPath("");
    setSignPassword("");
    setKeyGenLogs([]);
    setSigningLogs([]);
    setIsKeyGenRunning(false);
    setIsSigningRunning(false);
    toast.success("Reset complete - configure new repository");
  }, []);

  const handleSelectFolder = async () => {
    try {
      const path = await window.electronAPI?.selectFolder();
      if (path) setOutputDir(path);
    } catch (e) {
      console.error("Folder selection failed:", e);
      toast.error("Failed to select folder");
    }
  };

  const handleSelectKeyFile = async () => {
    try {
      const path = await window.electronAPI?.selectFile();
      if (path) setPrivateKeyPath(path);
    } catch (e) {
      console.error("File selection failed:", e);
      toast.error("Failed to select key file");
    }
  };

  const handleCancel = async () => {
    isSigningCancelled.current = true;
    if (currentScanId.current && window.electronAPI?.cancelScan) {
      if (isKeyGenRunning) setKeyGenLogs(prev => [...prev, "\n⏳ Requesting cancellation..."]);
      if (isSigningRunning) setSigningLogs(prev => [...prev, "\n⏳ Requesting cancellation..."]);
      try {
        await window.electronAPI.cancelScan({ scanId: currentScanId.current });
        toast.success("Cancellation requested");
      } catch (e) {
        console.error("Cancel failed:", e);
        toast.error("Failed to cancel operation");
      }
    }
  };

  const runKeyGeneration = async () => {
    if (!outputDir || !window.electronAPI) {
      toast.error("Please select output directory");
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
      toast.success("Keys generated successfully!");
    } catch (e: any) {
      setKeyGenLogs(prev => [...prev, `\n❌ Frontend Error: ${e.message}`]);
      toast.error(`Key generation failed: ${e.message}`);
    } finally {
      setTimeout(() => {
        setIsKeyGenRunning(false);
        currentScanId.current = null;
        if (cleanup) cleanup();
      }, 1500);
    }
  };

  const signSingleRepo = useCallback(async () => {
    if (!repoDetails || !privateKeyPath || !window.electronAPI) return false;

    const scanId = crypto.randomUUID();
    currentScanId.current = scanId;

    setSigningLogs(prev => [...prev,
      `\n${"═".repeat(80)}`,
      `🔹 REPO: ${repoDetails.repoUrl}`,
      `  Branch: ${repoDetails.branch}`,
      `${"═".repeat(80)}\n`
    ]);

    setIsSigningRunning(true);

    const cleanup = window.electronAPI.onScanLog(scanId, (data) => {
      setSigningLogs((prev) => [...prev, data.log]);
    });

    try {
      await window.electronAPI.signArtifact({
        repoUrl: repoDetails.repoUrl,
        branch: repoDetails.branch,
        privateKeyPath,
        password: signPassword,
        scanId
      });
      toast.success("Repository signed successfully");
      return true;
    } catch (e: any) {
      setSigningLogs(prev => [...prev, `\n❌ Frontend Error: ${e.message}`]);
      toast.error(`Failed to sign repository: ${e.message}`);
      return false;
    } finally {
      setTimeout(() => {
        setIsSigningRunning(false);
        currentScanId.current = null;
        if (cleanup) cleanup();
      }, 1500);
    }
  }, [repoDetails, privateKeyPath, signPassword]);

  const runSigning = useCallback(async () => {
    if (!repoDetails || !privateKeyPath || !window.electronAPI) return;

    isSigningCancelled.current = false;
    setSigningLogs([`🔹 Digital signing STARTED: ${repoDetails.repoUrl}`, `${"═".repeat(80)}\n`]);

    const success = await signSingleRepo();
    if (success) {
      setCompletedReposCount(1);
    }
  }, [repoDetails, privateKeyPath, signPassword, signSingleRepo]);

  // const handleRepoUpdate = useCallback((updatedRepo: RepoDetails) => {
  //   setRepoDetails(updatedRepo);
  // }, []);

  return (
    <Box sx={{ pt: 10, pb: 8, minHeight: "100vh" }}>
      <Container maxWidth="lg">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <QuickHeader pageType="crypto" />

          {/* KEY GENERATION CARD */}
          <motion.div variants={itemVariants}>
            <Paper sx={{ p: 3, borderLeft: "4px solid #00e5ff", borderRadius: 1, mb: 4 }}>
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

          <RepoConfigForm
            themeColor="crypto"
            onConfigure={handleConfigureRepo}
            onReset={handleReset}
            isLoading={loading}
            isConfigured={isConfigured}
            repoDetails={repoDetails}
          />

          {isConfigured && repoDetails && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} transition={{ duration: 0.3 }}>
              {/* DIGITAL SIGNING CARD */}
              <motion.div variants={itemVariants}>
                <Paper sx={{ p: 3 ,mt:4, borderLeft: "4px solid #00e5ff", borderRadius: 1 }}>
                  <Typography variant="h6" fontWeight={700} gutterBottom display="flex" alignItems="center" gap={1}>
                    <FingerprintIcon sx={{ color: "#00e5ff", fontSize: 24 }} /> Digital Signing
                  </Typography>
                  <Typography variant="body2" color="text.secondary" mb={3}>
                    Process repository and apply cryptographic signature
                  </Typography>

                  <Stack spacing={3}>
                    {/* Repository Info */}
                    <Paper sx={{ p: 3, mb: 3, borderRadius: 2, bgcolor: 'rgba(255,255,255, 0.02)', border: '1px solid rgba(255,255,255, 0.08)' }}>
                      <Typography variant="h6" fontWeight={500} mb={2.5} color="#00e5ff" sx={{ fontFamily: 'monospace' }}>
                        📂 Repository (1)
                      </Typography>
                      <Paper sx={{ p: 2, borderRadius: 1, border: '2px solid rgba(0, 229, 255, 0.3)', bgcolor: 'rgba(0, 229, 255, 0.08)' }}>
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Box sx={{ width: 40, height: 40, borderRadius: 1, bgcolor: 'rgba(0, 229, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #00e5ff' }}>
                            <Typography variant="subtitle2" fontWeight={700} color="#00e5ff" sx={{ fontSize: '1rem' }}>1</Typography>
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="caption" color="text.secondary" fontSize={11} mb={0.5} sx={{ fontFamily: 'monospace' }}>Repository</Typography>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#00e5ff', fontWeight: 600, wordBreak: 'break-all' }}>
                              {repoDetails.repoUrl}
                            </Typography>
                          </Box>
                          <Chip label={repoDetails.branch} size="small" sx={{ height: 28, fontFamily: 'monospace', fontSize: '0.75rem', bgcolor: 'rgba(0, 229, 255, 0.2)', color: '#00e5ff', border: '1px solid rgba(0, 229, 255, 0.3)' }} />
                          {isSigningRunning && <CircularProgress size={20} />}
                        </Stack>
                      </Paper>
                    </Paper>

                    {isSigningRunning && (
                      <Paper sx={{ p: 2, bgcolor: "rgba(0, 229, 255, 0.1)", border: "1px solid rgba(0, 229, 255, 0.3)" }}>
                        <Typography variant="body2" fontWeight={600} color="#00e5ff">
                          Processing: 1 / 1 ({completedReposCount} completed)
                        </Typography>
                        <LinearProgress variant="determinate" value={100} sx={{ mt: 1, height: 6 }} />
                      </Paper>
                    )}

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
                      {isSigningRunning ? `Signing... (1/1)` : `Sign Artifact`}
                    </Button>

                    <LogTerminal
                      logs={signingLogs}
                      isVisible={signingLogs.length > 0 || isSigningRunning}
                      isRunning={isSigningRunning}
                      onCancel={handleCancel}
                      title="DIGITAL SIGNING OUTPUT"
                      color="#00e5ff"
                    />
                  </Stack>
                </Paper>
              </motion.div>


            </motion.div>
          )}
        </motion.div>
      </Container>
    </Box>
  );
}
