/**
 * ProvenanceChainCard — Displays the full 3-stage provenance chain
 * (SCAN -> RELEASE -> SIGN) in a blockchain-like visual flow.
 * Each stage block is expandable. Includes IPFS artifact downloads.
 */
import { useState, useEffect } from "react";
import {
  Box, Paper, Stack, Typography, Chip, Collapse, IconButton,
  CircularProgress, Divider, Button, Table, TableBody, TableRow, TableCell, keyframes,
} from "@mui/material";
import { motion, Variants } from "framer-motion";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import PendingIcon from "@mui/icons-material/Pending";
import InventoryIcon from "@mui/icons-material/Inventory";
import PeopleIcon from "@mui/icons-material/People";
import FolderIcon from "@mui/icons-material/Folder";
import ExtensionIcon from "@mui/icons-material/Extension";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import TokenIcon from "@mui/icons-material/Token";
import HubIcon from "@mui/icons-material/Hub";
import DownloadIcon from "@mui/icons-material/Download";
import SecurityIcon from "@mui/icons-material/Security";
import FingerprintIcon from "@mui/icons-material/Fingerprint";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import VerifiedIcon from "@mui/icons-material/Verified";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";

import { Product } from "../../models/Product";
import { useToast } from "../ToastProvider";
import {
  getProductSnapshots, formatBlockchainTimestamp, shortenAddress,
  ProductSnapshot,
} from "../../services/blockchainService";
import { getGatewayUrl, fetchBytesFromIPFS } from "../../services/ipfsService";
import { ContractStage, getHashScanAccountUrl } from "../../config/blockchainConfig";

/* ── Props ── */
export interface ProvenanceChainCardProps {
  variants: Variants;
  product: Product;
  borderColor?: string;
}

/* ── Stage config ── */
const STAGES = [
  { key: "SCAN", label: "Security Scan", contractStage: ContractStage.SCAN, color: "#ff9800", icon: <SecurityIcon sx={{ fontSize: 20 }} /> },
  { key: "RELEASE", label: "Release", contractStage: ContractStage.RELEASE, color: "#7b5cff", icon: <RocketLaunchIcon sx={{ fontSize: 20 }} /> },
  { key: "SIGN", label: "Digital Signing", contractStage: ContractStage.SIGN, color: "#00e5ff", icon: <FingerprintIcon sx={{ fontSize: 20 }} /> },
] as const;

const glow = keyframes`0%,100%{box-shadow:0 0 8px rgba(76,175,80,.3)}50%{box-shadow:0 0 20px rgba(76,175,80,.6)}`;

/* ── Small helpers ── */
function R({ l, v }: { l: string; v: React.ReactNode }) {
  return (
    <TableRow>
      <TableCell sx={{ fontWeight: 700, width: 155, fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace", py: 0.4, border: "none", fontSize: ".82rem" }}>{l}</TableCell>
      <TableCell sx={{ py: 0.4, border: "none", fontSize: ".82rem" }}>{v}</TableCell>
    </TableRow>
  );
}

function SH({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) {
  return (
    <Stack direction="row" spacing={0.5} alignItems="center" mb={0.5}>
      {icon}
      <Typography variant="subtitle2" fontWeight={700} sx={{ color }}>{label}</Typography>
    </Stack>
  );
}

function ScanLines({ scans }: { scans: any }) {
  if (!scans) return null;
  const gpgS = scans.signatureVerification?.summary;
  const leakS = scans.secretLeakDetection?.summary;
  const vulnS = scans.vulnerabilityScan?.summary;
  return (
    <Box mt={0.5}>
      {scans.signatureVerification && (
        <Typography variant="caption" display="block" sx={{ ml: 1, color: gpgS && gpgS.goodSignatures === gpgS.totalCommits ? "#4caf50" : "#f44336" }}>
          {"• GPG: "}<strong>{scans.signatureVerification.status}</strong>
          {gpgS ? ` — ${gpgS.goodSignatures}/${gpgS.totalCommits} verified` : ""}
        </Typography>
      )}
      {scans.secretLeakDetection && (
        <Typography variant="caption" display="block" sx={{ ml: 1, color: leakS && leakS.findings === 0 ? "#4caf50" : "#f44336" }}>
          {"• Secrets: "}<strong>{scans.secretLeakDetection.status}</strong>
          {leakS ? ` — ${leakS.findings} findings` : ""}
        </Typography>
      )}
      {scans.vulnerabilityScan && (
        <Typography variant="caption" display="block" sx={{ ml: 1, color: vulnS && (vulnS.critical || 0) === 0 && (vulnS.high || 0) === 0 ? "#4caf50" : "#f44336" }}>
          {"• Vuln: "}<strong>{scans.vulnerabilityScan.status}</strong>
          {vulnS ? ` — C:${vulnS.critical || 0} H:${vulnS.high || 0} M:${vulnS.medium || 0} L:${vulnS.low || 0}` : ""}
        </Typography>
      )}
    </Box>
  );
}

function timeDiff(a: string | number | bigint, b: string | number | bigint): string {
  const toMs = (v: string | number | bigint) => typeof v === "bigint" ? Number(v) * 1000 : typeof v === "number" ? v * 1000 : new Date(v).getTime();
  const diff = Math.abs(toMs(b) - toMs(a));
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hrs > 24) return `${Math.floor(hrs / 24)}d ${hrs % 24}h`;
  return `${hrs}h ${mins}m`;
}

/* ════════ Component ════════ */
export default function ProvenanceChainCard({ variants, product, borderColor = "#4caf50" }: ProvenanceChainCardProps) {
  const showToast = useToast();
  const [chain, setChain] = useState<ProductSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await getProductSnapshots(product.id);
        if (error) showToast(error.message, "error");
        setChain(data || []);
      } catch {
        showToast("Failed to fetch provenance chain", "error");
      } finally {
        setLoading(false);
      }
    })();
  }, [product.id, showToast]);

  const toggle = (stage: number) => setExpanded((prev) => ({ ...prev, [stage]: !prev[stage] }));
  const snapByStage = (cs: number) => chain.find((s) => s.stage === cs) || null;
  const completedCount = STAGES.filter((s) => snapByStage(s.contractStage)).length;
  const isComplete = completedCount === 3;

  // IPFS artifacts
  const signSnap = snapByStage(ContractStage.SIGN);
  const sigIPFS = signSnap?.signatureFileIPFS || product.signatureFilePath || "";
  const pkIPFS = signSnap?.publicKeyFileIPFS || product.publicKeyFilePath || "";

  const [downloading, setDownloading] = useState<string | null>(null);

  const downloadFromIPFS = async (cid: string, filename: string) => {
    if (!cid) { showToast("No IPFS CID available", "warning"); return; }
    setDownloading(cid);
    try {
      showToast(`Fetching ${filename} from IPFS…`, "info");
      const buffer = await fetchBytesFromIPFS(cid);
      const blob = new Blob([buffer], { type: "application/octet-stream" });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      showToast(`✅ Downloaded ${filename}`, "success");
    } catch (err: any) {
      console.error("[IPFS Download]", err);
      showToast(`Download failed: ${err.message}`, "error");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <motion.div variants={variants}>
      <Paper sx={{ p: 3, borderLeft: `4px solid ${borderColor}`, borderRadius: 1, mb: 3 }}>
        {/* Header */}
        <Stack direction="row" spacing={1} alignItems="center" mb={1}>
          <HubIcon sx={{ color: "#4caf50", fontSize: 28 }} />
          <Typography variant="h6" fontWeight={700}>Product Provenance Chain</Typography>
        </Stack>
        <Stack direction="row" spacing={2} alignItems="center" mb={0.5}>
          <Typography variant="body2" color="text.secondary">
            <strong>{product.name}</strong> v{product.version}
          </Typography>
          <Chip
            label={isComplete ? `✅ COMPLETE (${completedCount}/3)` : `${completedCount}/3 stages`}
            size="small"
            sx={{
              bgcolor: isComplete ? "rgba(76,175,80,.15)" : "rgba(255,152,0,.15)",
              color: isComplete ? "#4caf50" : "#ff9800",
              fontWeight: 700,
              ...(isComplete ? { animation: `${glow} 2s infinite` } : {}),
            }}
          />
        </Stack>
        <Typography variant="caption" color="text.secondary" mb={3} display="block">
          Immutable provenance recorded on Hedera Hashgraph
        </Typography>

        {loading ? (
          <Box textAlign="center" py={4}>
            <CircularProgress size={32} sx={{ color: "#4caf50" }} />
          </Box>
        ) : (
          <Box>
            {/* Stage Blocks */}
            {STAGES.map((cfg, idx) => {
              const snap = snapByStage(cfg.contractStage);
              const exists = !!snap;
              const isExp = !!expanded[cfg.contractStage];
              let repos: any[] = [];
              if (snap) { try { repos = JSON.parse(snap.reposJson || "[]"); } catch { /* */ } }

              return (
                <Box key={cfg.key}>
                  <Paper
                    onClick={() => exists && toggle(cfg.contractStage)}
                    sx={{
                      p: 2, cursor: exists ? "pointer" : "default",
                      border: `2px solid ${exists ? cfg.color : "rgba(255,255,255,.1)"}`,
                      borderRadius: 2,
                      bgcolor: exists ? `${cfg.color}08` : "rgba(255,255,255,.02)",
                      opacity: exists ? 1 : 0.5,
                      transition: "all .3s",
                      "&:hover": exists ? { bgcolor: `${cfg.color}12` } : {},
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        {exists
                          ? <CheckCircleIcon sx={{ color: cfg.color, fontSize: 26 }} />
                          : <RadioButtonUncheckedIcon sx={{ color: "rgba(255,255,255,.25)", fontSize: 26 }} />}
                        <Box>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Box sx={{ color: cfg.color }}>{cfg.icon}</Box>
                            <Typography fontWeight={700} sx={{ color: exists ? cfg.color : "text.disabled" }}>
                              Stage {idx + 1}: {cfg.label}
                            </Typography>
                            {snap && (
                              <Chip label={snap.status} size="small" color={snap.status === "Rejected" ? "error" : "success"} sx={{ fontWeight: 700, ml: 1 }} />
                            )}
                          </Stack>
                          {snap
                            ? <Typography variant="caption" color="text.secondary">{formatBlockchainTimestamp(snap.timestamp)} · by {shortenAddress(snap.recordedBy)}</Typography>
                            : <Typography variant="caption" color="text.disabled">Not yet recorded</Typography>}
                        </Box>
                      </Stack>
                      {exists && (
                        <IconButton size="small" sx={{ color: cfg.color }}>
                          {isExp ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                      )}
                    </Stack>
                  </Paper>

                  {/* Expanded details */}
                  <Collapse in={isExp && exists}>
                    {snap && (
                      <Paper sx={{ mx: 2, p: 2.5, bgcolor: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.06)", borderTop: "none", borderRadius: "0 0 8px 8px" }}>
                        <SH icon={<InventoryIcon sx={{ fontSize: 16, color: cfg.color }} />} label="Product" color={cfg.color} />
                        <Table size="small" sx={{ mb: 1 }}>
                          <TableBody>
                            <R l="Product ID" v={<span style={{ fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace", fontSize: ".78rem" }}>{snap.productId}</span>} />
                            <R l="Name" v={snap.name} />
                            <R l="Version" v={snap.version} />
                            <R l="Open Source" v={snap.isOpenSource ? "Yes" : "No"} />
                            <R l="Description" v={snap.description || "—"} />
                          </TableBody>
                        </Table>

                        <Divider sx={{ my: 1, borderColor: "rgba(255,255,255,.08)" }} />
                        <SH icon={<PeopleIcon sx={{ fontSize: 16, color: cfg.color }} />} label="Stakeholders" color={cfg.color} />
                        <Table size="small" sx={{ mb: 1 }}>
                          <TableBody>
                            <R l="Director" v={snap.productDirector || "—"} />
                            <R l="Security Head" v={snap.securityHead || "—"} />
                            <R l="Engineers" v={snap.releaseEngineers || "—"} />
                          </TableBody>
                        </Table>

                        <Divider sx={{ my: 1, borderColor: "rgba(255,255,255,.08)" }} />
                        <SH icon={<FolderIcon sx={{ fontSize: 16, color: cfg.color }} />} label={`Repositories (${repos.length})`} color={cfg.color} />
                        {repos.length > 0 ? repos.map((rp: any, ri: number) => (
                          <Paper key={ri} sx={{ p: 1.5, mb: 1, bgcolor: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.06)" }}>
                            <Typography variant="body2" fontWeight={600} sx={{ fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace", fontSize: ".8rem" }}>{rp.repoUrl || rp.url || "—"}</Typography>
                            <Typography variant="caption" color="text.secondary">Branch: <strong>{rp.branch || "—"}</strong></Typography>
                            <ScanLines scans={rp.scans} />
                          </Paper>
                        )) : (
                          <Typography variant="body2" color="text.secondary">No repository data</Typography>
                        )}

                        <Divider sx={{ my: 1, borderColor: "rgba(255,255,255,.08)" }} />
                        <SH icon={<ExtensionIcon sx={{ fontSize: 16, color: cfg.color }} />} label="Dependencies" color={cfg.color} />
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: ".82rem" }}>{snap.dependencies || "None"}</Typography>

                        {(snap.signatureFileIPFS || snap.publicKeyFileIPFS) && (
                          <>
                            <Divider sx={{ my: 1, borderColor: "rgba(255,255,255,.08)" }} />
                            <SH icon={<VpnKeyIcon sx={{ fontSize: 16, color: cfg.color }} />} label="Signing Artifacts (IPFS)" color={cfg.color} />
                            <Table size="small" sx={{ mb: 1 }}>
                              <TableBody>
                                <R l="Signature" v={snap.signatureFileIPFS || "—"} />
                                <R l="Public Key" v={snap.publicKeyFileIPFS || "—"} />
                              </TableBody>
                            </Table>
                          </>
                        )}

                        <Divider sx={{ my: 1, borderColor: "rgba(255,255,255,.08)" }} />
                        <SH icon={<TokenIcon sx={{ fontSize: 16, color: cfg.color }} />} label="Blockchain Metadata" color={cfg.color} />
                        <Table size="small">
                          <TableBody>
                            <R l="Recorded By" v={
                              snap.recordedBy ? (
                                <Stack direction="row" spacing={0.5} alignItems="center">
                                  <span style={{ fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace" }}>{shortenAddress(snap.recordedBy)}</span>
                                  <IconButton
                                    size="small"
                                    href={getHashScanAccountUrl(snap.recordedBy)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="View on HashScan"
                                    sx={{ p: 0.25 }}
                                  >
                                    <OpenInNewIcon sx={{ fontSize: 14, color: "#4caf50" }} />
                                  </IconButton>
                                </Stack>
                              ) : "—"
                            } />
                            <R l="Created By" v={snap.createdBy} />
                            <R l="Timestamp" v={formatBlockchainTimestamp(snap.timestamp)} />
                            <R l="Remark" v={snap.remark || "—"} />
                          </TableBody>
                        </Table>
                      </Paper>
                    )}
                  </Collapse>

                  {/* Connector arrow */}
                  {idx < STAGES.length - 1 && (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>
                      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <Box sx={{ width: 3, height: 20, bgcolor: exists && snapByStage(STAGES[idx + 1].contractStage) ? cfg.color : "rgba(255,255,255,.12)", borderRadius: 1 }} />
                        <ArrowDownwardIcon sx={{ fontSize: 18, color: exists && snapByStage(STAGES[idx + 1].contractStage) ? cfg.color : "rgba(255,255,255,.15)" }} />
                      </Box>
                    </Box>
                  )}
                </Box>
              );
            })}

            {/* Chain Summary */}
            <Paper sx={{ p: 2, mt: 2, bgcolor: isComplete ? "rgba(76,175,80,.06)" : "rgba(255,255,255,.02)", border: `1px solid ${isComplete ? "rgba(76,175,80,.2)" : "rgba(255,255,255,.08)"}`, borderRadius: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                {isComplete ? <VerifiedIcon sx={{ color: "#4caf50" }} /> : <PendingIcon sx={{ color: "#ff9800" }} />}
                <Typography variant="subtitle2" fontWeight={700} sx={{ color: isComplete ? "#4caf50" : "#ff9800" }}>
                  {isComplete ? "Provenance Chain Complete" : "Provenance Chain Incomplete"}
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary" display="block">
                Stages recorded: {completedCount}/3
                {(() => {
                  const scanS = snapByStage(ContractStage.SCAN);
                  const signS = snapByStage(ContractStage.SIGN);
                  const releaseS = snapByStage(ContractStage.RELEASE);
                  const parts: string[] = [];
                  if (scanS && releaseS) parts.push(`Scan → Release: ${timeDiff(scanS.timestamp, releaseS.timestamp)}`);
                  if (releaseS && signS) parts.push(`Release → Sign: ${timeDiff(releaseS.timestamp, signS.timestamp)}`);
                  return parts.length > 0 ? ` · ${parts.join(" · ")}` : "";
                })()}
              </Typography>
              <Typography variant="caption" color="text.secondary">All data immutable on Hedera Hashgraph</Typography>
            </Paper>

            {/* IPFS Artifact Downloads */}
            {(sigIPFS || pkIPFS) && (
              <Paper sx={{ p: 2.5, mt: 2, border: "1px solid rgba(0,229,255,.2)", borderRadius: 2, bgcolor: "rgba(0,229,255,.04)" }}>
                <SH icon={<DownloadIcon sx={{ fontSize: 18, color: "#00e5ff" }} />} label="Download Signing Artifacts (from IPFS)" color="#00e5ff" />
                <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                  These files were uploaded to IPFS during the signing stage and are permanently stored.
                </Typography>
                <Stack spacing={1.5}>
                  {sigIPFS && (
                    <Paper sx={{ p: 2, bgcolor: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 1 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
                          <FingerprintIcon sx={{ fontSize: 20, color: "#00e5ff" }} />
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" fontWeight={600}>Signature File</Typography>
                            <Typography variant="caption" sx={{ fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace", fontSize: ".75rem", color: "text.secondary", wordBreak: "break-all" }}>{sigIPFS}</Typography>
                          </Box>
                        </Stack>
                        <Stack direction="row" spacing={1}>
                          <Button size="small" variant="outlined" disabled={downloading === sigIPFS} startIcon={downloading === sigIPFS ? <CircularProgress size={14} /> : <DownloadIcon />} onClick={() => downloadFromIPFS(sigIPFS, `${product.name}-signature.sig`)} sx={{ borderColor: "#00e5ff", color: "#00e5ff" }}>{downloading === sigIPFS ? "Downloading…" : "Download"}</Button>
                          <IconButton size="small" href={getGatewayUrl(sigIPFS)} target="_blank"><OpenInNewIcon sx={{ fontSize: 16 }} /></IconButton>
                        </Stack>
                      </Stack>
                    </Paper>
                  )}
                  {pkIPFS && (
                    <Paper sx={{ p: 2, bgcolor: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 1 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
                          <VpnKeyIcon sx={{ fontSize: 20, color: "#00e5ff" }} />
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" fontWeight={600}>Public Key File</Typography>
                            <Typography variant="caption" sx={{ fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace", fontSize: ".75rem", color: "text.secondary", wordBreak: "break-all" }}>{pkIPFS}</Typography>
                          </Box>
                        </Stack>
                        <Stack direction="row" spacing={1}>
                          <Button size="small" variant="outlined" disabled={downloading === pkIPFS} startIcon={downloading === pkIPFS ? <CircularProgress size={14} /> : <DownloadIcon />} onClick={() => downloadFromIPFS(pkIPFS, `${product.name}-publickey.pem`)} sx={{ borderColor: "#00e5ff", color: "#00e5ff" }}>{downloading === pkIPFS ? "Downloading…" : "Download"}</Button>
                          <IconButton size="small" href={getGatewayUrl(pkIPFS)} target="_blank"><OpenInNewIcon sx={{ fontSize: 16 }} /></IconButton>
                        </Stack>
                      </Stack>
                    </Paper>
                  )}
                </Stack>
              </Paper>
            )}
          </Box>
        )}
      </Paper>
    </motion.div>
  );
}