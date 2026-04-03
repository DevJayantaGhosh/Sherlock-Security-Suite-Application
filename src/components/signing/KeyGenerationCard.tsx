// src/components/signing/KeyGenerationCard.tsx
import { useState, useRef, useEffect } from "react";
import {
  Box, Paper, Stack, Typography, TextField, MenuItem,
  Button, IconButton, InputAdornment, LinearProgress, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Collapse, Tooltip
} from "@mui/material";
import { toast } from "react-hot-toast";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import SaveIcon from "@mui/icons-material/Save";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CancelIcon from "@mui/icons-material/Cancel";
import DownloadIcon from "@mui/icons-material/Download";
import CloseIcon from "@mui/icons-material/Close";

import { platform } from "../../platform";

type ScanStatus = "idle" | "running" | "success" | "failed";

interface KeyGenerationCardProps {
  disabled: boolean;
  toolTip: string;
  borderColor?: string;
  onFolderSelect: () => Promise<string | null>;
}

export default function KeyGenerationCard({
  disabled = false,
  toolTip = "",
  borderColor = "#00e5ff",
  onFolderSelect
}: KeyGenerationCardProps) {
  const isElectron = platform.isElectron;

  const [algo, setAlgo] = useState<"rsa" | "ecdsa">("rsa");
  const [keySize, setKeySize] = useState(2048);
  const [curve, setCurve] = useState("P-256");
  const [keyPassword, setKeyPassword] = useState("");
  const [outputDir, setOutputDir] = useState("");
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  // Web-mode: hold generated key content for display
  const [generatedPublicKey, setGeneratedPublicKey] = useState("");
  const [generatedPrivateKey, setGeneratedPrivateKey] = useState("");

  const scanIdRef = useRef<string | null>(null);
  const logCleanupRef = useRef<(() => void) | null>(null);
  const completeCleanupRef = useRef<(() => void) | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const logsRef = useRef<string[]>([]);

  // Auto-scroll logs in modal
  useEffect(() => {
    if (modalOpen && logs.length > 0 && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, modalOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (logCleanupRef.current) logCleanupRef.current();
      if (completeCleanupRef.current) completeCleanupRef.current();
      if (scanIdRef.current) {
        platform.cancelScan({ scanId: scanIdRef.current });
      }
    };
  }, []);

  const handleSelectFolder = async () => {
    try {
      const path = await onFolderSelect();
      if (path) {
        setOutputDir(path);
        toast.success(`Output directory: ${path}`);
      }
    } catch (e) {
      toast.error("Failed to select folder");
    }
  };

  const runKeyGeneration = async () => {
    // Electron requires outputDir; web mode does not
    if (isElectron && !outputDir) {
      toast.error("Please select output directory");
      return;
    }

    const scanId = crypto.randomUUID();
    scanIdRef.current = scanId;

    const initLogs = [
      `Key Generation STARTED`,
      `Algorithm: ${algo.toUpperCase()} ${algo === "rsa" ? keySize + "-bit" : curve}`,
      ...(isElectron ? [`Output: ${outputDir}`] : []),
      `Password: ${keyPassword ? "Protected" : "Unprotected"}`,
      `${"═".repeat(60)}\n`
    ];

    setLogs(initLogs);
    logsRef.current = [...initLogs];
    setStatus("running");
    setProgress(0);
    setShowLogs(false);
    setModalOpen(true);
    setGeneratedPublicKey("");
    setGeneratedPrivateKey("");

    const logCleanup = platform.onScanLog(scanId, (data) => {
      setLogs(prev => [...prev, data.log]);
      logsRef.current.push(data.log);
      setProgress(data.progress || 0);
    });
    logCleanupRef.current = logCleanup;

    const completeCleanup = platform.onScanComplete(scanId, (data) => {
      const newStatus = data.success ? "success" : "failed";
      setStatus(newStatus);
      setProgress(100);

      // Web mode: capture returned key data
      if (!isElectron && data.keyData) {
        setGeneratedPublicKey(data.keyData.publicKey || "");
        setGeneratedPrivateKey(data.keyData.privateKey || "");
      }

      cleanupListeners();
    });
    completeCleanupRef.current = completeCleanup;

    try {
      await platform.generateKeys({
        type: algo,
        size: keySize,
        curve,
        password: keyPassword,
        outputDir: isElectron ? outputDir : undefined,
        scanId
      });
      toast.success("✅ Keys generated successfully!");
    } catch (err: any) {
      if (err.message !== "cancelled") {
        const errorMsg = `\n❌ Error: ${err.message}\n`;
        setLogs(prev => [...prev, errorMsg]);
        logsRef.current.push(errorMsg);
      }
    }
  };

  const cancelScan = async () => {
    if (!scanIdRef.current) return;
    setIsCancelling(true);
    const msg = "\n⏳ Cancelling key generation...\n";
    setLogs(prev => [...prev, msg]);
    logsRef.current.push(msg);

    try {
      await platform.cancelScan({ scanId: scanIdRef.current });
      setStatus("failed");
    } finally {
      cleanupListeners();
      setIsCancelling(false);
      setTimeout(() => setModalOpen(false), 800);
    }
  };

  const cleanupListeners = () => {
    if (logCleanupRef.current) {
      logCleanupRef.current();
      logCleanupRef.current = null;
    }
    if (completeCleanupRef.current) {
      completeCleanupRef.current();
      completeCleanupRef.current = null;
    }
    scanIdRef.current = null;
  };

  const downloadLogs = () => {
    const logText = logs.join("\n");
    const blob = new Blob([logText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `key-generation-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`${label} copied to clipboard`);
    }).catch(() => {
      toast.error(`Failed to copy ${label}`);
    });
  };

  const isRunning = status === "running";
  const canClose = !isRunning && !isCancelling;
  // Electron: need outputDir. Web: always ready (no folder needed).
  const isButtonDisabled = (isElectron && !outputDir) || isRunning || disabled;

  return (
    <>
      <Paper sx={{ p: 3, borderLeft: `4px solid ${borderColor}`, borderRadius: 1, mb: 4 }}>
        <Typography variant="h6" fontWeight={700} gutterBottom display="flex" alignItems="center" gap={1}>
          <VpnKeyIcon color="primary" sx={{ fontSize: 24 }} /> Key Generation
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          Generate RSA or ECDSA key pairs for artifact signing.
          {!isElectron && " Keys will be displayed here — copy and store them securely."}
        </Typography>

        <Stack spacing={3}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="flex-end">
            <TextField
              select
              label="Algorithm"
              value={algo}
              onChange={(e) => setAlgo(e.target.value as "rsa" | "ecdsa")}
              sx={{ minWidth: 150 }}
              disabled={disabled || isRunning}
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
                disabled={disabled || isRunning}
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
                disabled={disabled || isRunning}
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
              disabled={disabled || isRunning}
            />
          </Stack>

          <Stack direction="row" spacing={2} alignItems="center">
            {/* Folder picker — Electron only */}
            {isElectron && (
              <TextField
                fullWidth
                label="Output Directory"
                value={outputDir}
                InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={handleSelectFolder} disabled={disabled || isRunning} size="small">
                        <FolderOpenIcon />
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
            )}
            <Tooltip
              title={isButtonDisabled ? toolTip : ""}
              arrow
              placement="top"
              disableHoverListener={!isButtonDisabled}
            >
              <span>
                <Button
                  variant="contained"
                  onClick={runKeyGeneration}
                  disabled={isButtonDisabled}
                  sx={{
                    minWidth: 160,
                    bgcolor: "#7b5cff",
                    boxShadow: "0 4px 14px 0 rgb(123 92 255 / 40%)",
                    "&:hover": { bgcolor: "#6633cc" }
                  }}
                  startIcon={isRunning ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                >
                  {isRunning ? "Generating..." : "Generate Keys"}
                </Button>
              </span>
            </Tooltip>
          </Stack>

          {/* Web mode: display generated keys in copyable textareas */}
          {!isElectron && generatedPublicKey && (
            <Stack spacing={2}>
              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
                  <Typography variant="subtitle2" fontWeight={600}>🔑 Public Key</Typography>
                  <Button
                    size="small"
                    startIcon={<ContentCopyIcon />}
                    onClick={() => copyToClipboard(generatedPublicKey, "Public key")}
                  >
                    Copy
                  </Button>
                </Stack>
                <TextField
                  fullWidth
                  multiline
                  minRows={4}
                  maxRows={8}
                  value={generatedPublicKey}
                  InputProps={{ readOnly: true, sx: { fontFamily: "monospace", fontSize: 12 } }}
                />
              </Box>
              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
                  <Typography variant="subtitle2" fontWeight={600}>🔐 Private Key</Typography>
                  <Button
                    size="small"
                    startIcon={<ContentCopyIcon />}
                    onClick={() => copyToClipboard(generatedPrivateKey, "Private key")}
                  >
                    Copy
                  </Button>
                </Stack>
                <TextField
                  fullWidth
                  multiline
                  minRows={4}
                  maxRows={8}
                  value={generatedPrivateKey}
                  InputProps={{ readOnly: true, sx: { fontFamily: "monospace", fontSize: 12 } }}
                />
                <Typography variant="caption" color="warning.main" mt={0.5}>
                  ⚠️ Store your private key securely. It will NOT be shown again.
                </Typography>
              </Box>
            </Stack>
          )}

          {/* Hide/Show Logs */}
          {logs.length > 0 && !isRunning && (
            <Box>
              <Button
                onClick={() => setShowLogs(!showLogs)}
                endIcon={showLogs ? <ExpandMoreIcon /> : <ExpandLessIcon />}
                variant="outlined"
                size="small"
                fullWidth
              >
                {showLogs ? "Hide Logs" : "Show Logs"} ({logs.length} lines)
              </Button>
              <Collapse in={showLogs}>
                <Paper sx={{
                  mt: 2, maxHeight: "400px", overflow: "auto",
                  bgcolor: "#1a1a1a", border: "1px solid #333", p: 2,
                  fontFamily: "monospace", fontSize: 12, color: "#e0e0e0"
                }}>
                  {logs.map((log, i) => (
                    <Typography key={i} component="pre" sx={{ m: 0, fontSize: 12 }}>
                      {log}
                    </Typography>
                  ))}
                </Paper>
              </Collapse>
            </Box>
          )}
        </Stack>
      </Paper>

      {/* Modal — same as before */}
      <Dialog open={modalOpen} onClose={() => canClose && setModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ bgcolor: "#2d2d2d", borderBottom: "1px solid #404040" }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" fontWeight={700}>
              <VpnKeyIcon sx={{ mr: 1, fontSize: 24, color: "#7b5cff" }} /> Key Generation
            </Typography>
            {canClose && <IconButton onClick={() => setModalOpen(false)}><CloseIcon /></IconButton>}
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
          <Box sx={{ fontFamily: "monospace", fontSize: 12, lineHeight: 1.5, color: "#e0e0e0", whiteSpace: "pre-wrap", mt: 1 }}>
            {logs.map((log, i) => (
              <Typography key={i} component="pre" sx={{ m: 0, fontSize: 12 }}>
                {log}
              </Typography>
            ))}
            <div ref={logEndRef} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, bgcolor: "#2d2d2d" }}>
          {isRunning && (
            <Button onClick={cancelScan} color="error" variant="contained"
              startIcon={isCancelling ? <CircularProgress size={16} color="inherit" /> : <CancelIcon />}>
              {isCancelling ? "Cancelling..." : "Cancel Generation"}
            </Button>
          )}
          {logs.length > 0 && <Button startIcon={<DownloadIcon />} onClick={downloadLogs}>Download Logs</Button>}
          {canClose && <Button onClick={() => setModalOpen(false)}>Close</Button>}
        </DialogActions>
      </Dialog>
    </>
  );
}