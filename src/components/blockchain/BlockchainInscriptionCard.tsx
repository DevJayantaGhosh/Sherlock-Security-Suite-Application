import { useState, useEffect, useCallback } from "react";
import {
  Box, Button, Paper, Stack, Typography, Chip, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Collapse, IconButton, CircularProgress, Divider, Link, Alert,
  Table, TableBody, TableRow, TableCell, TextField, Backdrop, keyframes,
} from "@mui/material";
import { motion, Variants } from "framer-motion";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import LinkIcon from "@mui/icons-material/Link";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import InventoryIcon from "@mui/icons-material/Inventory";
import PeopleIcon from "@mui/icons-material/People";
import FolderIcon from "@mui/icons-material/Folder";
import ExtensionIcon from "@mui/icons-material/Extension";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import TokenIcon from "@mui/icons-material/Token";
import HubIcon from "@mui/icons-material/Hub";
import { Product } from "../../models/Product";
import { useToast } from "../ToastProvider";
import { useUserStore } from "../../store/userStore";
import { STEP_CONFIG, HEDERA_TESTNET, ContractStep } from "../../config/blockchainConfig";
import {
  connectServiceWallet, buildProductSnapshot, inscribeOnLedger,
  getProductSnapshots, formatBlockchainTimestamp, shortenAddress,
  getStepName, ProductSnapshot,
} from "../../services/blockchainService";
import { updateProduct } from "../../services/productService";

/* ────────────────────────────────────────────────────────────
 *  Props
 * ──────────────────────────────────────────────────────────── */
export interface BlockchainInscriptionProps {
  variants: Variants;
  product: Product;
  disabled: boolean;
  toolTip: string;
  step: "SCAN" | "SIGN" | "RELEASE";
  onStatusDecision?: (status: "Approved" | "Rejected", remark: string) => void;
}

/* ────────────────────────────────────────────────────────────
 *  Animations & Constants
 * ──────────────────────────────────────────────────────────── */
const pulse = keyframes`0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)}`;
const slide = keyframes`0%{transform:translateX(-10px);opacity:0}50%{transform:translateX(0);opacity:1}100%{transform:translateX(10px);opacity:0}`;
const STEPS = ["Preparing…", "Broadcasting to Hedera…", "Confirming block…", "Saving to DB…", "Done"];

/* ────────────────────────────────────────────────────────────
 *  Helpers
 * ──────────────────────────────────────────────────────────── */
function R({ l, v }: { l: string; v: React.ReactNode }) {
  return (
    <TableRow>
      <TableCell sx={{ fontWeight: 700, width: 155, fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace", py: .4, border: "none", fontSize: ".82rem" }}>{l}</TableCell>
      <TableCell sx={{ py: .4, border: "none", fontSize: ".82rem" }}>{v}</TableCell>
    </TableRow>
  );
}

/* Section header — MUI icon + label */
function SH({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) {
  return (
    <Stack direction="row" spacing={.5} alignItems="center" mb={.5}>
      {icon}
      <Typography variant="subtitle2" fontWeight={700} sx={{ color }}>{label}</Typography>
    </Stack>
  );
}

/* ────────────────────────────────────────────────────────────
 *  Inline scan summary — plain text, no misleading green chips
 * ──────────────────────────────────────────────────────────── */
function ScanLines({ scans }: { scans: any }) {
  if (!scans) return null;

  /* GPG: green if all commits verified (good === total), red otherwise */
  const gpgSummary = scans.signatureVerification?.summary;
  const gpgOk = gpgSummary ? gpgSummary.goodSignatures === gpgSummary.totalCommits : false;

  /* Secret Leak: green if 0 findings, red otherwise */
  const leakSummary = scans.secretLeakDetection?.summary;
  const leakOk = leakSummary ? leakSummary.findings === 0 : false;

  /* Vulnerability: green only if all severity counts are 0, red otherwise */
  const vulnSummary = scans.vulnerabilityScan?.summary;
  const vulnOk = vulnSummary
    ? (vulnSummary.critical || 0) === 0 && (vulnSummary.high || 0) === 0 && (vulnSummary.medium || 0) === 0 && (vulnSummary.low || 0) === 0
    : false;

  return (
    <Box mt={.5}>
      {scans.signatureVerification && (
        <Typography variant="caption" display="block" sx={{ ml: 1, color: gpgOk ? "#4caf50" : "#f44336" }}>
          {"• GPG Verification: "}<strong>{scans.signatureVerification.status}</strong>
          {gpgSummary ? ` — ${gpgSummary.goodSignatures}/${gpgSummary.totalCommits} commits verified` : ""}
        </Typography>
      )}
      {scans.secretLeakDetection && (
        <Typography variant="caption" display="block" sx={{ ml: 1, color: leakOk ? "#4caf50" : "#f44336" }}>
          {"• Secret Leak Detection: "}<strong>{scans.secretLeakDetection.status}</strong>
          {leakSummary ? ` — ${leakSummary.findings} findings` : ""}
        </Typography>
      )}
      {scans.sbomGeneration && (
        <Typography variant="caption" display="block" sx={{ ml: 1, color: scans.sbomGeneration.status === "success" ? "#4caf50" : "#f44336" }}>
          {"• SBOM Generation: "}<strong>{scans.sbomGeneration.status}</strong>
          {scans.sbomGeneration.summary ? ` — ${scans.sbomGeneration.summary.totalPackages} packages` : ""}
        </Typography>
      )}
      {scans.vulnerabilityScan && (
        <Typography variant="caption" display="block" sx={{ ml: 1, color: vulnOk ? "#4caf50" : "#f44336" }}>
          {"• Vulnerability Scan: "}<strong>{scans.vulnerabilityScan.status}</strong>
          {vulnSummary ? ` — ${vulnSummary.vulnerabilities} CVEs (Critical: ${vulnSummary.critical || 0}, High: ${vulnSummary.high || 0}, Medium: ${vulnSummary.medium || 0}, Low: ${vulnSummary.low || 0})` : ""}
        </Typography>
      )}
    </Box>
  );
}

/* ════════════════════════════════════════════════════════════
 *  Main Component
 * ════════════════════════════════════════════════════════════ */
export default function BlockchainInscriptionCard({ variants, product, disabled, toolTip, step, onStatusDecision }: BlockchainInscriptionProps) {
  const toast = useToast();
  const user = useUserStore((s) => s.user);
  const cfg = STEP_CONFIG[step];

  const [wallet, setWallet] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [inscribing, setInscribing] = useState(false);
  const [txStep, setTxStep] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [status, setStatus] = useState<"Approved" | "Rejected" | "Signed" | "Released">("Approved");
  const [remark, setRemark] = useState("");
  const [done, setDone] = useState(false);
  const [url, setUrl] = useState("");
  const [chain, setChain] = useState<ProductSnapshot[]>([]);
  const [showChain, setShowChain] = useState(false);
  const [loadChain, setLoadChain] = useState(false);

  /* Detect already-inscribed */
  useEffect(() => {
    const rp = product[cfg.reportField];
    if (rp && rp.startsWith("https://hashscan.io")) { setDone(true); setUrl(rp); } else { setDone(false); setUrl(""); }
  }, [product, cfg.reportField]);

  /* Connect wallet */
  const connect = useCallback(async () => {
    if (disabled) { toast(toolTip || "View-only", "warning"); return; }
    setConnecting(true); setErr(null);
    try { const { data, error } = await connectServiceWallet(); if (error) { toast(error.message, "error"); return; } setWallet(data); toast(`Connected: ${data.slice(0, 6)}…${data.slice(-4)}`, "success"); }
    catch (e: any) { toast(e.message || "Failed", "error"); } finally { setConnecting(false); }
  }, [disabled, toolTip, toast]);

  /* Open preview */
  const openPreview = (s: "Approved" | "Rejected" | "Signed" | "Released") => {
    if (disabled) { toast(toolTip || "View-only", "warning"); return; }
    setStatus(s); setRemark(""); setErr(null); setPreview(true);
  };

  /* Confirm & inscribe */
  const confirm = async () => {
    setPreview(false); setInscribing(true); setTxStep(0); setErr(null);
    try {
      const cs = step === "SCAN" ? ContractStep.SCAN : step === "SIGN" ? ContractStep.SIGN : ContractStep.RELEASE;
      const auto = `${step}: ${status} by ${user?.name || user?.email || "unknown"}`;
      const rmk = remark.trim() ? `${remark.trim()} | ${auto}` : auto;
      const snap = buildProductSnapshot(product, cs, status, user?.email || user?.name || "unknown", rmk,
        step === "SIGN" ? product.signatureFilePath || "" : "", step === "SIGN" ? product.publicKeyFilePath || "" : "");
      setTxStep(1);
      const { data: res, error } = await inscribeOnLedger(snap);
      if (error) { setErr(error.message); setInscribing(false); toast(error.message, "error"); return; }
      setTxStep(2); setTxStep(3);
      const upd = {
        ...product,
        status: status as any,
        [cfg.reportField]: res.hashScanUrl,
        remark: remark.trim() ? `${remark.trim()} | Tx:${res.txHash.slice(0, 20)}… Block:${res.blockNumber}` : `Hedera Tx:${res.txHash.slice(0, 20)}… Block:${res.blockNumber}`,
      };
      const { error: de } = await updateProduct(upd);
      if (de) toast(`Chain OK, DB failed: ${de.message}`, "warning");
      setTxStep(4); toast(`Inscribed! Tx: ${res.txHash.slice(0, 16)}…`, "success");
      setDone(true); setUrl(res.hashScanUrl);
      try { const { data: sn } = await getProductSnapshots(product.id); setChain(sn); setShowChain(true); } catch { }
      if (onStatusDecision) onStatusDecision(status as "Approved" | "Rejected", rmk);
    } catch (e: any) { const m = e.message || "Failed"; setErr(m); toast(m, "error"); }
    finally { setInscribing(false); setTxStep(0); }
  };

  /* Toggle chain data */
  const toggleChain = async () => {
    if (showChain) { setShowChain(false); return; }
    setLoadChain(true); setShowChain(true);
    try { const { data, error } = await getProductSnapshots(product.id); if (error) toast(error.message, "error"); setChain(data); }
    catch { toast("Failed to fetch chain data", "error"); } finally { setLoadChain(false); }
  };

  /* ══════════ RENDER ══════════ */
  return (
    <motion.div variants={variants}>

      {/* ── Full-screen transaction loader ── */}
      <Backdrop open={inscribing} sx={{ zIndex: 9999, bgcolor: "rgba(0,0,0,.85)", flexDirection: "column", gap: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          {[0,1,2,3,4].map(i => (
            <Box key={i} sx={{ display: "flex", alignItems: "center" }}>
              <Box sx={{ width: 28, height: 28, borderRadius: "6px", bgcolor: i <= txStep ? cfg.color : "rgba(255,255,255,.15)", animation: i === txStep ? `${pulse} 1s infinite` : "none", transition: "background-color .5s", boxShadow: i <= txStep ? `0 0 12px ${cfg.color}50` : "none" }} />
              {i < 4 && <Box sx={{ width: 32, height: 3, mx: .5, bgcolor: i < txStep ? cfg.color : "rgba(255,255,255,.1)", borderRadius: 1, position: "relative", overflow: "hidden", "&::after": i === txStep ? { content: '""', position: "absolute", width: 10, height: "100%", bgcolor: cfg.color, animation: `${slide} 1s infinite` } : {} }} />}
            </Box>
          ))}
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <HubIcon sx={{ fontSize: 28, color: cfg.color }} />
          <Typography variant="h5" fontWeight={700} sx={{ color: cfg.color, fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace" }}>Blockchain Transaction</Typography>
        </Stack>
        <Typography color="grey.400">{STEPS[txStep]}</Typography>
        <CircularProgress size={32} sx={{ color: cfg.color }} />
        <Typography variant="caption" color="grey.600">Do not close. May take 10-30 s.</Typography>
      </Backdrop>

      {/* ── Main Card ── */}
      <Paper sx={{ p: 3, borderLeft: `4px solid ${cfg.color}`, borderRadius: 1, mb: 3 }}>
        <Typography variant="h6" fontWeight={700} gutterBottom>{cfg.icon} {cfg.title}</Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>Record your {step.toLowerCase()} decision permanently on Hedera Hashgraph.</Typography>

        {err && <Alert severity="error" icon={<ErrorOutlineIcon />} sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}

        {done ? (
          <Box>
            <Stack direction="row" spacing={1.5} alignItems="center" mb={2}>
              <CheckCircleIcon sx={{ color: "#4caf50", fontSize: 28 }} />
              <Typography fontWeight={600} color="#4caf50">Already inscribed on ledger</Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center" mb={2}>
              <LinkIcon sx={{ fontSize: 18, color: cfg.color }} />
              <Link href={url} target="_blank" rel="noopener" sx={{ fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace", fontSize: ".85rem", color: cfg.color }}>{url}</Link>
              <IconButton size="small" href={url} target="_blank"><OpenInNewIcon sx={{ fontSize: 16 }} /></IconButton>
            </Stack>
            <Button size="small" variant="outlined" onClick={toggleChain} endIcon={showChain ? <ExpandLessIcon /> : <ExpandMoreIcon />} sx={{ mb: 1, borderColor: cfg.color, color: cfg.color }}>
              {showChain ? "Hide" : "View"} On-Chain Data
            </Button>

            {/* ── On-chain data (ALL fields) ── */}
            <Collapse in={showChain}>
              <Box mt={1.5}>
                {loadChain ? <Box textAlign="center" py={3}><CircularProgress size={24} sx={{ color: cfg.color }} /></Box>
                  : chain.filter(s => s.step === cfg.contractStep).length > 0
                    ? chain.filter(s => s.step === cfg.contractStep).map((s, i) => {
                      let repos: any[] = []; try { repos = JSON.parse(s.reposJson || "[]"); } catch {}
                      return (
                        <Paper key={i} sx={{ p: 2.5, mb: 1.5, bgcolor: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)" }}>
                          <Stack direction="row" spacing={1} alignItems="center" mb={1.5}>
                            <Chip label={getStepName(s.step)} size="small" sx={{ bgcolor: s.step === 0 ? "#ff9800" : s.step === 1 ? "#00e5ff" : "#7b5cff", color: "#000", fontWeight: 700 }} />
                            <Chip label={s.status} size="small" color={s.status === "Rejected" ? "error" : "success"} />
                            <Typography variant="caption" sx={{ fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace" }}>{formatBlockchainTimestamp(s.timestamp)}</Typography>
                          </Stack>

                          <SH icon={<InventoryIcon sx={{ fontSize: 16, color: cfg.color }} />} label="Product" color={cfg.color} />
                          <Table size="small" sx={{ mb: 1 }}><TableBody>
                            <R l="Product ID" v={<span style={{ fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace", fontSize: ".78rem" }}>{s.productId}</span>} />
                            <R l="Name" v={s.name} /><R l="Version" v={s.version} />
                            <R l="Open Source" v={s.isOpenSource ? "Yes" : "No"} />
                            <R l="Description" v={s.description || "—"} /><R l="Status" v={s.status} />
                          </TableBody></Table>

                          <Divider sx={{ my: 1, borderColor: "rgba(255,255,255,.08)" }} />
                          <SH icon={<PeopleIcon sx={{ fontSize: 16, color: cfg.color }} />} label="Stakeholders" color={cfg.color} />
                          <Table size="small" sx={{ mb: 1 }}><TableBody>
                            <R l="Director" v={s.productDirector || "—"} />
                            <R l="Security Head" v={s.securityHead || "—"} />
                            <R l="Engineers" v={s.releaseEngineers || "—"} />
                          </TableBody></Table>

                          <Divider sx={{ my: 1, borderColor: "rgba(255,255,255,.08)" }} />
                          <SH icon={<FolderIcon sx={{ fontSize: 16, color: cfg.color }} />} label={`Repositories (${repos.length})`} color={cfg.color} />
                          {repos.length > 0 ? repos.map((rp: any, ri: number) => (
                            <Paper key={ri} sx={{ p: 1.5, mb: 1, bgcolor: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.06)" }}>
                              <Typography variant="body2" fontWeight={600} sx={{ fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace", fontSize: ".8rem" }}>{rp.repoUrl || rp.url || "—"}</Typography>
                              <Typography variant="caption" color="text.secondary">Branch: <strong>{rp.branch || "—"}</strong></Typography>
                              <ScanLines scans={rp.scans} />
                            </Paper>
                          )) : <Typography variant="body2" color="text.secondary">No repository data</Typography>}

                          <Divider sx={{ my: 1, borderColor: "rgba(255,255,255,.08)" }} />
                          <SH icon={<ExtensionIcon sx={{ fontSize: 16, color: cfg.color }} />} label="Dependencies" color={cfg.color} />
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: ".82rem" }}>{s.dependencies || "None"}</Typography>

                          {(s.signatureFileIPFS || s.publicKeyFileIPFS) && (<>
                            <Divider sx={{ my: 1, borderColor: "rgba(255,255,255,.08)" }} />
                            <SH icon={<VpnKeyIcon sx={{ fontSize: 16, color: cfg.color }} />} label="Signing Artifacts" color={cfg.color} />
                            <Table size="small" sx={{ mb: 1 }}><TableBody>
                              <R l="Signature IPFS" v={s.signatureFileIPFS || "—"} />
                              <R l="Public Key IPFS" v={s.publicKeyFileIPFS || "—"} />
                            </TableBody></Table>
                          </>)}

                          <Divider sx={{ my: 1, borderColor: "rgba(255,255,255,.08)" }} />
                          <SH icon={<TokenIcon sx={{ fontSize: 16, color: cfg.color }} />} label="Blockchain Metadata" color={cfg.color} />
                          <Table size="small"><TableBody>
                            <R l="Recorded By" v={<span style={{ fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace" }}>{shortenAddress(s.recordedBy)}</span>} />
                            <R l="Created By" v={s.createdBy} />
                            <R l="Timestamp" v={formatBlockchainTimestamp(s.timestamp)} />
                            <R l="Remark" v={s.remark || "—"} />
                          </TableBody></Table>
                        </Paper>
                      );
                    })
                    : <Typography variant="body2" color="text.secondary">No on-chain data found.</Typography>}
              </Box>
            </Collapse>
          </Box>
        ) : (
          /* ── Not inscribed — wallet + buttons ── */
          <Box>
            <Paper sx={{ p: 2.5, mb: 3, bgcolor: `${cfg.color}15`, border: `2px dashed ${cfg.color}` }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box display="flex" alignItems="center" gap={2}>
                  <AccountBalanceWalletIcon sx={{ fontSize: 30, color: wallet ? "#4caf50" : cfg.color }} />
                  <Box>
                    <Typography fontWeight={600}>{wallet ? "Connected" : "Connect Wallet"}</Typography>
                    {wallet && <Typography variant="caption" sx={{ fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace" }}>{shortenAddress(wallet)}</Typography>}
                  </Box>
                </Box>
                <Tooltip title={disabled ? toolTip : ""}><span>
                  <Button variant="contained" onClick={connect} disabled={!!wallet || connecting || disabled}
                    sx={{ bgcolor: cfg.color, color: "#000", fontWeight: 700, "&:hover": { bgcolor: cfg.color, opacity: .9 } }}
                    startIcon={connecting ? <CircularProgress size={16} color="inherit" /> : <LinkIcon />}>
                    {connecting ? "Connecting…" : wallet ? "Connected" : "Connect"}
                  </Button>
                </span></Tooltip>
              </Stack>
            </Paper>
            {wallet && (
              <Stack direction="row" spacing={2}>
                <Tooltip title={disabled ? toolTip : ""}><span>
                  <Button variant="contained" size="large" disabled={disabled} startIcon={<HubIcon />}
                    onClick={() => openPreview(step === "SCAN" ? "Approved" : step === "SIGN" ? "Signed" : "Released")}
                    sx={{ bgcolor: cfg.color, color: "#000", fontWeight: 700, px: 3 }}>{cfg.approveButton}</Button>
                </span></Tooltip>
                {step === "SCAN" && cfg.rejectButton && (
                  <Tooltip title={disabled ? toolTip : ""}><span>
                    <Button variant="outlined" size="large" color="error" disabled={disabled}
                      onClick={() => openPreview("Rejected")} sx={{ fontWeight: 700, px: 3 }}>{cfg.rejectButton}</Button>
                  </span></Tooltip>
                )}
              </Stack>
            )}
          </Box>
        )}
      </Paper>

      {/* ── Preview Dialog — review before inscribing ── */}
      <Dialog open={preview} onClose={() => setPreview(false)} maxWidth="md" fullWidth PaperProps={{ sx: { maxHeight: "85vh" } }}>
        <DialogTitle sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
          <HubIcon sx={{ color: cfg.color }} /> Review — Blockchain Inscription
        </DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 2 }}>This data will be <strong>permanently inscribed</strong> on Hedera Hashgraph. Review carefully.</Alert>

          {/* ── Product ── */}
          <SH icon={<InventoryIcon sx={{ fontSize: 16, color: cfg.color }} />} label="Product" color={cfg.color} />
          <Table size="small" sx={{ mb: 1.5 }}><TableBody>
            <R l="ID" v={<span style={{ fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace" }}>{product.id}</span>} />
            <R l="Name" v={product.name} />
            <R l="Version" v={product.version} />
            <R l="Open Source" v={product.isOpenSource ? "Yes" : "No"} />
            <R l="Description" v={product.description || "—"} />
            <R l="Status" v={product.status} />
          </TableBody></Table>

          <Divider sx={{ my: 1 }} />
          <SH icon={<PeopleIcon sx={{ fontSize: 16, color: cfg.color }} />} label="Stakeholders" color={cfg.color} />
          <Table size="small" sx={{ mb: 1.5 }}><TableBody>
            <R l="Director" v={product.productDirector || "—"} />
            <R l="Security Head" v={product.securityHead || "—"} />
            <R l="Engineers" v={product.releaseEngineers?.join(", ") || "—"} />
          </TableBody></Table>

          <Divider sx={{ my: 1 }} />
          <SH icon={<FolderIcon sx={{ fontSize: 16, color: cfg.color }} />} label={`Repositories (${product.repos?.length || 0})`} color={cfg.color} />
          {product.repos?.map((r, i) => (
            <Paper key={i} sx={{ p: 1.5, mb: 1, bgcolor: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)" }}>
              <Typography variant="body2" fontWeight={600} sx={{ fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace" }}>{r.repoUrl}</Typography>
              <Typography variant="caption" color="text.secondary">Branch: <strong>{r.branch}</strong></Typography>
              <ScanLines scans={r.scans} />
            </Paper>
          ))}

          <Divider sx={{ my: 1 }} />
          <SH icon={<ExtensionIcon sx={{ fontSize: 16, color: cfg.color }} />} label={`Dependencies (${product.dependencies?.length || 0})`} color={cfg.color} />
          {product.dependencies?.length ? (
            <Stack direction="row" spacing={.5} flexWrap="wrap" mb={1}>
              {product.dependencies.map((d, i) => <Chip key={i} label={d} size="small" variant="outlined" sx={{ fontSize: ".75rem", mb: .5 }} />)}
            </Stack>
          ) : <Typography variant="body2" color="text.secondary" mb={1}>None</Typography>}

          {step === "SIGN" && (<>
            <Divider sx={{ my: 1 }} />
            <SH icon={<VpnKeyIcon sx={{ fontSize: 16, color: cfg.color }} />} label="Signing Artifacts" color={cfg.color} />
            <Table size="small"><TableBody>
              <R l="Signature IPFS" v={product.signatureFilePath || "—"} />
              <R l="Public Key IPFS" v={product.publicKeyFilePath || "—"} />
            </TableBody></Table>
          </>)}

          <Divider sx={{ my: 1 }} />
          <SH icon={<HubIcon sx={{ fontSize: 16, color: cfg.color }} />} label="Inscription" color={cfg.color} />
          <Table size="small" sx={{ mb: 2 }}><TableBody>
            <R l="Step" v={step} />
            <R l="Decision" v={<Chip label={status} size="small" color={status === "Rejected" ? "error" : "success"} />} />
            <R l="Wallet" v={<span style={{ fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace" }}>{shortenAddress(wallet)}</span>} />
            <R l="Network" v={HEDERA_TESTNET.name} />
            <R l="By" v={user?.name || user?.email || "unknown"} />
          </TableBody></Table>

          <TextField label="Remark (optional — inscribed on-chain)" value={remark} onChange={e => setRemark(e.target.value)}
            multiline minRows={2} maxRows={4} fullWidth inputProps={{ maxLength: 500 }}
            helperText={`${remark.length}/500`} />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setPreview(false)}>Cancel</Button>
          <Button variant="contained" onClick={confirm} startIcon={<HubIcon />}
            sx={{ bgcolor: cfg.color, color: "#000", fontWeight: 700, "&:hover": { bgcolor: cfg.color, opacity: .9 } }}>
            Confirm & Inscribe on Ledger
          </Button>
        </DialogActions>
      </Dialog>
    </motion.div>
  );
}
