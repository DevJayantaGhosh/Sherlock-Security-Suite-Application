import {
  Box,
  Typography,
  IconButton,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TextField,
  Button,
  Paper,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  TableContainer,
  Tooltip,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import LinkIcon from "@mui/icons-material/Link";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";

import { useState, useCallback } from "react";
import toast from "react-hot-toast";
import { AppUser } from "../../models/User";
import { getHashScanAccountUrl } from "../../config/blockchainConfig";
import {
  connectServiceWallet,
  getServiceAccounts,
  addServiceAccountOnChain,
  enableServiceAccountOnChain,
  disableServiceAccountOnChain,
  ServiceAccount,
  shortenAddress,
} from "../../services/blockchainService";

/** Client-side tx history per address */
interface TxRecord {
  txHash: string;
  hashScanUrl: string;
  action: string; // "Added" | "Enabled" | "Disabled"
}

export default function BlockchainServiceAccountManagement({ user }: { user: AppUser | null }) {
  // Wallet connection state
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [connecting, setConnecting] = useState(false);

  // Data state
  const [accounts, setAccounts] = useState<ServiceAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Tx history per address (client-side, stored in component state)
  const [txHistory, setTxHistory] = useState<Record<string, TxRecord>>({});

  // Add modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newAddress, setNewAddress] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  // Confirm toggle modal
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAccount, setConfirmAccount] = useState<ServiceAccount | null>(null);

  // Last tx info banner
  const [lastTx, setLastTx] = useState<{ hash: string; url: string } | null>(null);

  const isAdmin = user?.role === "Admin";

  // ── Connect Wallet ────────────────────────────────────

  const handleConnectWallet = useCallback(async () => {
    setConnecting(true);
    try {
      const result = await connectServiceWallet();
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      setWalletAddress(result.data);
      setWalletConnected(true);
      toast.success(`Wallet connected: ${result.data.slice(0, 10)}…`);

      // Auto-load accounts after connecting
      setLoading(true);
      const acctResult = await getServiceAccounts();
      if (acctResult.error) {
        toast.error(acctResult.error.message);
        setAccounts([]);
      } else {
        setAccounts(acctResult.data);
      }
      setLoading(false);
    } catch (err: any) {
      toast.error("Failed to connect wallet");
    } finally {
      setConnecting(false);
    }
  }, []);

  // ── Load accounts ─────────────────────────────────────

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getServiceAccounts();
      if (result.error) {
        toast.error(result.error.message);
        setAccounts([]);
        return;
      }
      setAccounts(result.data);
    } catch (err: any) {
      toast.error("Failed to load service accounts");
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Store tx record ───────────────────────────────────

  const storeTx = (address: string, txHash: string, hashScanUrl: string, action: string) => {
    setTxHistory((prev) => ({
      ...prev,
      [address.toLowerCase()]: { txHash, hashScanUrl, action },
    }));
    setLastTx({ hash: txHash, url: hashScanUrl });
  };

  // ── Add new service account ───────────────────────────

  const handleAdd = async () => {
    const trimmed = newAddress.trim();
    if (!trimmed) {
      toast.error("Please enter an address");
      return;
    }

    setAddLoading(true);
    try {
      const result = await addServiceAccountOnChain(trimmed);
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Service account added on-chain!");
      if (result.data) {
        storeTx(trimmed, result.data.txHash, result.data.hashScanUrl, "Added");
      }
      setAddModalOpen(false);
      setNewAddress("");
      await loadAccounts();
    } catch (err: any) {
      toast.error("Failed to add service account");
    } finally {
      setAddLoading(false);
    }
  };

  // ── Toggle enable/disable ─────────────────────────────

  const openConfirmToggle = (account: ServiceAccount) => {
    setConfirmAccount(account);
    setConfirmOpen(true);
  };

  const handleToggle = async () => {
    if (!confirmAccount) return;

    const addr = confirmAccount.address;
    setToggling(addr);
    setConfirmOpen(false);

    try {
      const result = confirmAccount.isActive
        ? await disableServiceAccountOnChain(addr)
        : await enableServiceAccountOnChain(addr);

      if (result.error) {
        toast.error(result.error.message);
        return;
      }

      const action = confirmAccount.isActive ? "Disabled" : "Enabled";
      toast.success(`Service account ${action.toLowerCase()} on-chain!`);

      if (result.data) {
        storeTx(addr, result.data.txHash, result.data.hashScanUrl, action);
      }

      await loadAccounts();
    } catch (err: any) {
      toast.error("Failed to toggle service account");
    } finally {
      setToggling(null);
      setConfirmAccount(null);
    }
  };

  // ── Filtered list ─────────────────────────────────────

  const filteredAccounts = (accounts || []).filter((a) =>
    a.address.toLowerCase().includes(search.toLowerCase())
  );

  // ── Render: Not Connected ─────────────────────────────

  if (!walletConnected) {
    return (
      <Paper
        sx={{
          p: 6,
          bgcolor: "#0c1023",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 300,
          gap: 3,
        }}
      >
        <AccountBalanceWalletIcon sx={{ fontSize: 64, color: "#7b5cff", opacity: 0.6 }} />
        <Typography variant="h6" sx={{ color: "white", fontWeight: 700 }}>
          Blockchain Service Account Management
        </Typography>
        <Typography variant="body2" sx={{ color: "#9ca3af", textAlign: "center", maxWidth: 480 }}>
          Connect to the service wallet to view and manage blockchain service accounts
          registered on the ProductRegistry smart contract.
        </Typography>
        <Button
          variant="contained"
          startIcon={
            connecting ? (
              <CircularProgress size={20} sx={{ color: "white" }} />
            ) : (
              <AccountBalanceWalletIcon />
            )
          }
          onClick={handleConnectWallet}
          disabled={connecting}
          sx={{
            background: "linear-gradient(135deg,#7b5cff,#5ce1e6)",
            textTransform: "none",
            px: 5,
            py: 1.5,
            fontSize: "1rem",
            fontWeight: 600,
            mt: 1,
          }}
        >
          {connecting ? "Connecting…" : "Connect to Wallet"}
        </Button>
      </Paper>
    );
  }

  // ── Render: Connected ─────────────────────────────────

  return (
    <Paper sx={{ p: 3, flex: 1, bgcolor: "#0c1023", minHeight: "100%" }}>
      {/* WALLET INFO BAR */}
      <Box
        sx={{
          mb: 2,
          p: 1.5,
          borderRadius: 1,
          bgcolor: "rgba(123, 92, 255, 0.08)",
          border: "1px solid rgba(123, 92, 255, 0.3)",
          display: "flex",
          alignItems: "center",
          gap: 1.5,
        }}
      >
        <AccountBalanceWalletIcon sx={{ color: "#7b5cff", fontSize: 20 }} />
        <Typography variant="body2" sx={{ color: "#7b5cff", fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace" }}>
          Connected: {walletAddress}
        </Typography>
        <IconButton
          size="small"
          href={getHashScanAccountUrl(walletAddress)}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ color: "#7b5cff", ml: "auto" }}
        >
          <OpenInNewIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* LAST TX BANNER */}
      {lastTx && (
        <Box
          sx={{
            mb: 2,
            p: 1.5,
            borderRadius: 1,
            bgcolor: "rgba(92, 225, 230, 0.08)",
            border: "1px solid rgba(92, 225, 230, 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <LinkIcon sx={{ color: "#5ce1e6", fontSize: 18 }} />
            <Typography variant="body2" sx={{ color: "#5ce1e6", fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace" }}>
              Last Tx: {lastTx.hash.slice(0, 16)}…{lastTx.hash.slice(-8)}
            </Typography>
          </Box>
          <Button
            size="small"
            href={lastTx.url}
            target="_blank"
            rel="noopener noreferrer"
            endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
            sx={{ color: "#5ce1e6", textTransform: "none", fontSize: "0.8rem" }}
          >
            View on HashScan
          </Button>
        </Box>
      )}

      {/* TOP CONTROLS */}
      <Box sx={{ display: "flex", gap: 2, alignItems: "center", mb: 3, flexWrap: "wrap" }}>
        <TextField
          size="small"
          label="Search by address"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ flex: 1, minWidth: 300 }}
        />

        {isAdmin && (
          <>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setAddModalOpen(true)}
              disabled={loading}
              sx={{
                background: "linear-gradient(135deg,#7b5cff,#5ce1e6)",
                textTransform: "none",
                px: 3,
                minWidth: 180,
              }}
            >
              Add Service Account
            </Button>

            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={loadAccounts}
              disabled={loading}
              sx={{
                color: "white",
                borderColor: "rgba(255,255,255,0.3)",
                "&:hover": { borderColor: "white" },
              }}
            >
              Refresh
            </Button>
          </>
        )}
      </Box>

      {/* TABLE */}
      <Paper sx={{ overflow: "hidden", bgcolor: "#0c1023" }}>
        {loading ? (
          <Box sx={{ p: 8, display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
            <CircularProgress size={32} sx={{ color: "#7b5cff" }} />
            <Typography sx={{ ml: 2, color: "#9ca3af", mt: 1 }}>
              Reading from smart contract...
            </Typography>
          </Box>
        ) : filteredAccounts.length === 0 ? (
          <Box sx={{ p: 8, textAlign: "center" }}>
            <Typography sx={{ color: "#9ca3af", mb: 1 }}>
              {search ? "No matching service accounts" : "No service accounts found on-chain"}
            </Typography>
          </Box>
        ) : (
          <TableContainer sx={{ bgcolor: "#0c1023" }}>
            <Table size="small" sx={{ minWidth: 650 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: "#1e1e2e" }}>
                  <TableCell sx={{ color: "white", fontWeight: 600 }}>Address</TableCell>
                  <TableCell sx={{ color: "white", fontWeight: 600 }}>HashScan</TableCell>
                  <TableCell sx={{ color: "white", fontWeight: 600, minWidth: 120 }}>Status</TableCell>
                  <TableCell sx={{ color: "white", fontWeight: 600, minWidth: 160 }}>Last Tx</TableCell>
                  {isAdmin && (
                    <TableCell
                      align="right"
                      sx={{ color: "white", fontWeight: 600, minWidth: 140 }}
                    >
                      Enable / Disable
                    </TableCell>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredAccounts.map((account) => {
                  const txRec = txHistory[account.address.toLowerCase()];
                  return (
                    <TableRow
                      key={account.address}
                      hover
                      sx={{ "&:hover": { bgcolor: "#1e1e2e" } }}
                    >
                      {/* Address */}
                      <TableCell>
                        <Tooltip title={account.address} arrow>
                          <Typography
                            sx={{
                              color: "white",
                              fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace",
                              fontSize: "0.875rem",
                              fontWeight: 500,
                            }}
                          >
                            {shortenAddress(account.address)}
                          </Typography>
                        </Tooltip>
                      </TableCell>

                      {/* HashScan Link */}
                      <TableCell>
                        <IconButton
                          size="small"
                          href={getHashScanAccountUrl(account.address)}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{ color: "#7b5cff" }}
                        >
                          <OpenInNewIcon fontSize="small" />
                        </IconButton>
                      </TableCell>

                      {/* Status Chip */}
                      <TableCell>
                        <Chip
                          label={account.isActive ? "Active" : "Disabled"}
                          color={account.isActive ? "success" : "error"}
                          size="small"
                          sx={{ fontWeight: 600 }}
                        />
                      </TableCell>

                      {/* Last Tx Hash link */}
                      <TableCell>
                        {txRec ? (
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                            <Chip
                              label={txRec.action}
                              size="small"
                              variant="outlined"
                              sx={{
                                fontWeight: 600,
                                fontSize: "0.7rem",
                                color: "#5ce1e6",
                                borderColor: "rgba(92,225,230,0.3)",
                              }}
                            />
                            <Tooltip title={txRec.txHash} arrow>
                              <Button
                                size="small"
                                href={txRec.hashScanUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                endIcon={<OpenInNewIcon sx={{ fontSize: 12 }} />}
                                sx={{
                                  color: "#5ce1e6",
                                  textTransform: "none",
                                  fontSize: "0.75rem",
                                  fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace",
                                  minWidth: 0,
                                  p: 0.5,
                                }}
                              >
                                {txRec.txHash.slice(0, 10)}…
                              </Button>
                            </Tooltip>
                          </Box>
                        ) : (
                          <Typography sx={{ color: "#555", fontSize: "0.8rem" }}>—</Typography>
                        )}
                      </TableCell>

                      {/* Toggle switch */}
                      {isAdmin && (
                        <TableCell align="right">
                          {toggling === account.address ? (
                            <CircularProgress size={24} sx={{ color: "#7b5cff" }} />
                          ) : (
                            <Switch
                              checked={account.isActive}
                              onChange={() => openConfirmToggle(account)}
                              sx={{
                                "& .MuiSwitch-switchBase.Mui-checked": {
                                  color: "#10b981",
                                },
                                "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                                  backgroundColor: "#10b981",
                                },
                              }}
                            />
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* ADD SERVICE ACCOUNT MODAL */}
      <Dialog open={addModalOpen} onClose={() => setAddModalOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ bgcolor: "#1e1e2e", color: "white" }}>
          Add New Service Account
        </DialogTitle>
        <DialogContent sx={{ bgcolor: "#0c1023" }}>
          <Box sx={{ pt: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} mb={1} sx={{ color: "white" }}>
              Ethereum / Hedera Address
            </Typography>
            <Typography variant="caption" sx={{ color: "#9ca3af", mb: 2, display: "block" }}>
              This address will be authorized to record product snapshots on the blockchain.
              The transaction requires the connected wallet to be the contract owner.
            </Typography>
            <TextField
              label="Address (0x…)"
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              fullWidth
              size="small"
              placeholder="0x0000000000000000000000000000000000000000"
              sx={{ mt: 2 }}
              inputProps={{ style: { fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace" } }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ bgcolor: "#1e1e2e", p: 3 }}>
          <Button onClick={() => setAddModalOpen(false)} startIcon={<CloseIcon />}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAdd}
            disabled={!newAddress.trim() || addLoading}
            sx={{
              background: "linear-gradient(135deg,#7b5cff,#5ce1e6)",
              textTransform: "none",
              px: 4,
            }}
          >
            {addLoading ? (
              <>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                Sending Tx…
              </>
            ) : (
              "Add Service Account"
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* CONFIRM TOGGLE MODAL */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle sx={{ bgcolor: "#1e1e2e", color: "white" }}>
          {confirmAccount?.isActive ? "Disable" : "Enable"} Service Account
        </DialogTitle>
        <DialogContent sx={{ bgcolor: "#0c1023", p: 3 }}>
          <Typography sx={{ color: "white", mt: 1, mb: 1 }}>
            Are you sure you want to{" "}
            <strong>{confirmAccount?.isActive ? "disable" : "enable"}</strong> this service
            account?
          </Typography>
          <Typography
            sx={{
              color: "#9ca3af",
              fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace",
              fontSize: "0.85rem",
              mt: 1,
              wordBreak: "break-all",
            }}
          >
            {confirmAccount?.address}
          </Typography>
          <Typography variant="caption" sx={{ color: "#f59e0b", mt: 2, display: "block" }}>
            This will send a blockchain transaction and cost gas (HBAR).
          </Typography>
        </DialogContent>
        <DialogActions sx={{ bgcolor: "#1e1e2e", p: 3 }}>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleToggle}
            sx={{
              background: confirmAccount?.isActive
                ? "linear-gradient(135deg,#ef4444,#dc2626)"
                : "linear-gradient(135deg,#10b981,#059669)",
              textTransform: "none",
            }}
          >
            {confirmAccount?.isActive ? "Disable Account" : "Enable Account"}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}