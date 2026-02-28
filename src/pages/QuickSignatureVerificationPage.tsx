import { useState, useCallback, useRef, useEffect } from "react";
import {
  Box, Container, Stack, Typography, Paper, TextField, 
  Button, IconButton, InputAdornment, LinearProgress,
  Chip, CircularProgress, Collapse, Tooltip, Alert
} from "@mui/material";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import QuickHeader from "../components/QuickHeader";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import TerminalIcon from "@mui/icons-material/Terminal";
import CancelIcon from "@mui/icons-material/Cancel";
import DownloadIcon from "@mui/icons-material/Download";
import VerificationRepoConfigForm, { VerificationRepoDetails } from "../components/repoconfig/VerificationRepoConfigForm";

interface LogTerminalProps {
  logs: string[];
  isVisible: boolean;
  isRunning: boolean;
  onCancel: () => void;
  title: string;
  color: string;
}

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

export default function QuickSignatureVerificationPage() {
  const [repoDetails, setRepoDetails] = useState<VerificationRepoDetails | null>(null);
  const [githubToken, setGithubToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);

  // VERIFICATION STATE
  const [publicKeyPath, setPublicKeyPath] = useState("");
  const [signaturePath, setSignaturePath] = useState("");
  const [isVerifyingRunning, setIsVerifyingRunning] = useState(false);
  const [verifyLogs, setVerifyLogs] = useState<string[]>([]);
  const [completedReposCount, setCompletedReposCount] = useState(0);
  const [verificationStatus, setVerificationStatus] = useState<"idle" | "valid" | "invalid">("idle");

  const currentScanId = useRef<string | null>(null);
  const isVerifyingCancelled = useRef(false);

  const handleConfigureRepo = useCallback((details: VerificationRepoDetails, token?: string) => {
    setRepoDetails(details);
    setGithubToken(token || "");
    setIsConfigured(true);
    setLoading(false);
    
    // Reset verification state
    setPublicKeyPath("");
    setSignaturePath("");
    setVerifyLogs([]);
    setIsVerifyingRunning(false);
    setCompletedReposCount(0);
    setVerificationStatus("idle");
    
    const type = details.isLocal ? 'Local' : (token ? 'Private GitHub' : 'Public GitHub');
    const tagDisplay = details.releaseTag ? `Tag: ${details.releaseTag}` : 'No tag (local)';
    toast.success(`${type} repository configured!\n${tagDisplay}`, { 
      duration: 5000 
    });
  }, []);

  const handleReset = useCallback(() => {
    setRepoDetails(null);
    setGithubToken("");
    setIsConfigured(false);
    setPublicKeyPath("");
    setSignaturePath("");
    setVerifyLogs([]);
    setIsVerifyingRunning(false);
    setCompletedReposCount(0);
    setVerificationStatus("idle");
    toast.success("Reset complete - configure new repository");
  }, []);

  const handleSelectPublicKey = async () => {
    try {
      if (!window.electronAPI?.selectFile) {
        toast.error("File picker unavailable");
        return;
      }
      const path = await window.electronAPI.selectFile();
      if (path) {
        setPublicKeyPath(path);
        toast.success("Public key selected", { duration: 1500 });
      }
    } catch (e) {
      console.error("Public key selection failed:", e);
      toast.error("Failed to select public key file");
    }
  };

  const handleSelectSignature = async () => {
    try {
      if (!window.electronAPI?.selectFile) {
        toast.error("File picker unavailable");
        return;
      }
      const path = await window.electronAPI.selectFile();
      if (path) {
        setSignaturePath(path);
        toast.success("Signature file selected", { duration: 1500 });
      }
    } catch (e) {
      console.error("Signature selection failed:", e);
      toast.error("Failed to select signature file");
    }
  };

  const handleCancel = async () => {
    isVerifyingCancelled.current = true;
    if (currentScanId.current && window.electronAPI?.cancelScan) {
      setVerifyLogs(prev => [...prev, "\n⏳ Requesting cancellation..."]);
      try {
        await window.electronAPI.cancelScan({ scanId: currentScanId.current! });
        toast.success("Cancellation requested");
      } catch (e) {
        console.error("Cancel failed:", e);
        toast.error("Failed to cancel operation");
      }
    }
    setIsVerifyingRunning(false);
  };

  const verifySingleRepo = useCallback(async () => {
    if (!repoDetails || !publicKeyPath || !signaturePath || !window.electronAPI) {
      toast.error("Missing configuration or files");
      return false;
    }

    const version = repoDetails.isLocal ? "HEAD" : (repoDetails.releaseTag || "latest");
    const scanId = crypto.randomUUID();
    currentScanId.current = scanId;

    setVerifyLogs(prev => [...prev,
      `\n${"═".repeat(80)}`,
      `🔹 REPO: ${repoDetails.repoUrl}`,
      `   Tag: ${repoDetails.releaseTag || 'LOCAL (HEAD)'}`,
      `   Type: ${repoDetails.isLocal ? 'Local' : (githubToken ? 'Private GitHub' : 'Public GitHub')}`,
      `${"═".repeat(80)}\n`
    ]);

    setIsVerifyingRunning(true);

    const cleanup = window.electronAPI.onScanLog(scanId, (data) => {
      setVerifyLogs((prev) => [...prev, data.log]);
    });

    try {
      const result = await window.electronAPI.verifySignature({
        repoUrl: repoDetails.repoUrl,
        branch: "main",
        version: version,
        isQuickScan: repoDetails.isLocal,
        localRepoLocation: repoDetails.isLocal ? repoDetails.repoUrl : "",
        githubToken: githubToken || "",
        publicKeyPath,
        signaturePath,
        scanId
      });
      
      const verified = result.verified ?? false;
      setVerificationStatus(verified ? "valid" : "invalid");
      
      const tagDisplay = repoDetails.releaseTag || 'local repo';
      if (verified) {
        toast.success(`✅ Signature verified successfully for ${tagDisplay}!`);
        setCompletedReposCount(1);
      } else {
        toast.error("❌ Signature verification failed");
      }
      return verified;
    } catch (e: any) {
      setVerifyLogs(prev => [...prev, `\n❌ Frontend Error: ${e.message}`]);
      toast.error(`❌ Verification failed: ${e.message}`);
      return false;
    } finally {
      setTimeout(() => {
        setIsVerifyingRunning(false);
        currentScanId.current = null;
        if (cleanup) cleanup();
      }, 1500);
    }
  }, [repoDetails, publicKeyPath, signaturePath, githubToken]);

  const runVerification = useCallback(async () => {
    if (!repoDetails || !publicKeyPath || !signaturePath || !window.electronAPI) {
      toast.error("Please configure repository and select both files");
      return;
    }

    isVerifyingCancelled.current = false;
    const repoType = repoDetails.isLocal ? 'Local' : (githubToken ? 'Private GitHub' : 'Public GitHub');
    const tagDisplay = repoDetails.releaseTag || 'LOCAL';
    setVerifyLogs([`🔍 Signature verification STARTED: ${repoDetails.repoUrl}`,
      `Version: ${tagDisplay}`,
      `Repository: ${repoType}`,
      `${"═".repeat(80)}\n`]);

    await verifySingleRepo();
  }, [repoDetails, publicKeyPath, signaturePath, githubToken, verifySingleRepo]);

  return (
    <Box sx={{ pt: 10, pb: 8, minHeight: "100vh", bgcolor: "background.default" }}>
      <Container maxWidth="lg">
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.5 }}
        >
          <QuickHeader pageType="verify" />

          <VerificationRepoConfigForm
            themeColor="verify"
            onConfigure={handleConfigureRepo}
            onReset={handleReset}
            isLoading={loading}
            isConfigured={isConfigured}
            repoDetails={repoDetails}
          />

          {isConfigured && repoDetails && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }} 
              animate={{ opacity: 1, height: "auto" }} 
              transition={{ duration: 0.3 }}
            >
              <Paper sx={{ p: 3, mt: 4, borderLeft: "4px solid #4caf50", borderRadius: 1 }}>
                <Typography variant="h6" fontWeight={700} gutterBottom display="flex" alignItems="center" gap={1}>
                  <VpnKeyIcon sx={{ color: "#4caf50", fontSize: 24 }} /> Signature Verification
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={3}>
                  Verify cryptographic signatures against{' '}
                  <strong>{repoDetails.releaseTag ? `release tag ${repoDetails.releaseTag}` : 'local repository contents'}</strong>
                  {githubToken && !repoDetails.isLocal && (
                    <Chip 
                      label="🔐 Private" 
                      size="small" 
                      color="warning" 
                      sx={{ ml: 1, height: 22, fontSize: '0.7rem' }} 
                    />
                  )}
                </Typography>

                <Stack spacing={3}>
                  {/* Repository Info */}
                  <Paper sx={{ p: 3, mb: 3, borderRadius: 2, bgcolor: 'rgba(255,255,255, 0.02)', border: '1px solid rgba(255,255,255, 0.08)' }}>
                    <Typography variant="h6" fontWeight={500} mb={2.5} color="#4caf50" sx={{ fontFamily: 'monospace' }}>
                      📂 Verification Target (1)
                    </Typography>
                    <Paper sx={{ p: 2, borderRadius: 1, border: '2px solid rgba(76, 175, 80, 0.3)', bgcolor: 'rgba(76, 175, 80, 0.08)' }}>
                      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                        <Box sx={{ width: 40, height: 40, borderRadius: 1, bgcolor: 'rgba(76, 175, 80, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #4caf50' }}>
                          <Typography variant="subtitle2" fontWeight={700} color="#4caf50" sx={{ fontSize: '1rem' }}>1</Typography>
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 200 }}>
                          <Typography variant="caption" color="text.secondary" fontSize={11} mb={0.5} sx={{ fontFamily: 'monospace' }}>
                            Repository{repoDetails.isLocal ? ' Path' : ''}
                          </Typography>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#4caf50', fontWeight: 600, wordBreak: 'break-all' }}>
                            {repoDetails.repoUrl}
                          </Typography>
                        </Box>
                        {repoDetails.releaseTag && (
                          <Chip 
                            label={repoDetails.releaseTag} 
                            size="small" 
                            color="success"
                            sx={{ height: 28, fontFamily: 'monospace', fontSize: '0.75rem' }} 
                          />
                        )}
                        <Chip 
                          label={repoDetails.isLocal ? 'LOCAL' : (githubToken ? 'PRIVATE' : 'PUBLIC')} 
                          size="small" 
                          color={repoDetails.isLocal ? "default" : (githubToken ? "warning" : "primary")}
                          sx={{ height: 28, fontFamily: 'monospace', fontSize: '0.75rem' }} 
                        />
                        {isVerifyingRunning && <CircularProgress size={20} />}
                      </Stack>
                    </Paper>
                  </Paper>

                  {/* FINAL STATUS */}
                  {verificationStatus !== "idle" && !isVerifyingRunning && (
                    <Alert
                      severity={verificationStatus === "valid" ? "success" : "error"}
                      sx={{ mb: 3 }}
                      icon={verificationStatus === "valid" ? <CheckCircleIcon /> : <ErrorIcon />}
                    >
                      <Typography variant="body2" fontWeight={600}>
                        {verificationStatus === "valid" 
                          ? `✅ Signature verified successfully for ${repoDetails.releaseTag || 'local repo'}!` 
                          : "❌ Signature verification failed"}
                      </Typography>
                    </Alert>
                  )}

                  {/* PROGRESS */}
                  {isVerifyingRunning && (
                    <Paper sx={{ p: 2, bgcolor: "rgba(76, 175, 80, 0.1)", border: "1px solid rgba(76, 175, 80, 0.3)" }}>
                      <Typography variant="body2" fontWeight={600} color="#4caf50">
                        Verifying: 1 / 1 ({completedReposCount} verified)
                      </Typography>
                      <LinearProgress variant="determinate" value={100} sx={{ mt: 1, height: 6 }} />
                    </Paper>
                  )}

                  {/* FILE SELECTION */}
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <TextField
                      fullWidth={!publicKeyPath}
                      label="Public Key File (.pub)"
                      value={publicKeyPath}
                      disabled={isVerifyingRunning}
                      InputProps={{
                        readOnly: true,
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton onClick={handleSelectPublicKey} disabled={isVerifyingRunning} size="small">
                              <FolderOpenIcon />
                            </IconButton>
                          </InputAdornment>
                        )
                      }}
                    />
                    <TextField
                      fullWidth={!signaturePath}
                      label="Signature File (.sig)"
                      value={signaturePath}
                      disabled={isVerifyingRunning}
                      InputProps={{
                        readOnly: true,
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton onClick={handleSelectSignature} disabled={isVerifyingRunning} size="small">
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
                    onClick={runVerification}
                    disabled={!publicKeyPath || !signaturePath || isVerifyingRunning}
                    sx={{
                      bgcolor: "#4caf50",
                      color: "white",
                      fontWeight: "bold",
                      boxShadow: "0 4px 14px 0 rgb(76 175 80 / 40%)",
                      "&:hover": { bgcolor: "#45a049" },
                      minWidth: 280
                    }}
                    startIcon={isVerifyingRunning ? <CircularProgress size={20} color="inherit" /> : <PlayArrowIcon />}
                  >
                    {isVerifyingRunning 
                      ? `Verifying... (${repoDetails.releaseTag || 'local'})` 
                      : `Verify Signature (${repoDetails.releaseTag || 'local'})`}
                  </Button>

                  <LogTerminal
                    logs={verifyLogs}
                    isVisible={verifyLogs.length > 0 || isVerifyingRunning}
                    isRunning={isVerifyingRunning}
                    onCancel={handleCancel}
                    title="SIGNATURE VERIFICATION OUTPUT"
                    color="#4caf50"
                  />
                </Stack>
              </Paper>
            </motion.div>
          )}
        </motion.div>
      </Container>
    </Box>
  );
}
