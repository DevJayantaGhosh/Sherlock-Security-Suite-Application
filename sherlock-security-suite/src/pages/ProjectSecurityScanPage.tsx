import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Container,
  Paper,
  Stack,
  Typography,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from "@mui/material";

import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";

import { useParams, useNavigate } from "react-router-dom";
import { getProjects } from "../services/projectService";
import { useUserStore } from "../store/userStore";

import RepoScanAccordion from "../components/security/RepoScanAccordion";
import DependencyAudit from "../components/security/DependencyAudit";

export default function ProjectSecurityScanPage() {

  const { id } = useParams();
  const navigate = useNavigate();

  const user = useUserStore(s => s.user);

  const [project, setProject] = useState<any>(null);
  const [wallet, setWallet] = useState<string | null>(null);

  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // ------------------------
  // LOAD PROJECT — FIXED USEEFFECT
  // ------------------------
  useEffect(() => {
    const p = getProjects().find(x => x.id === id);
    if (!p) {
      navigate("/projects");
      return;
    }
    setProject(p);
  }, [id, navigate]);

  if (!project) return null;

  // ------------------------
  // AUTH
  // ------------------------
  const isAuthorized =
    user?.role === "Admin" || project.securityHead === user?.id;

  if (!isAuthorized) {
    return (
      <Box p={4}>
        <Typography color="error">Unauthorized</Typography>
      </Box>
    );
  }

  // ------------------------
  // WALLET CONNECT
  // ------------------------
  async function connectWallet() {
    if (!(window as any).ethereum) {
      alert("MetaMask not installed");
      return;
    }

    const accounts = await (window as any).ethereum.request({
      method: "eth_requestAccounts"
    });

    setWallet(accounts[0]);
  }

  // ------------------------
  // APPROVE / REJECT FLOW
  // ------------------------
  function handleDecision(type: "approve" | "reject") {
    setDecision(type);
    setConfirmOpen(true);
  }

  function confirmDecision() {
    console.log("✅ FINAL DECISION:", decision);
    console.log("🔐 WALLET:", wallet);

    setConfirmOpen(false);
  }

  // ------------------------
  // RENDER
  // ------------------------
  return (
    <Box sx={{ pt: 8, pb: 8 }}>
      <Container maxWidth="lg">

        {/* ---------- HEADER ---------- */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Stack direction="row" justifyContent="space-between">
            <Box>
              <Typography variant="h4" fontWeight={800}>
                Security Scan — {project.name}
              </Typography>
              <Typography color="text.secondary">
                {project.description}
              </Typography>
            </Box>

            <Chip
              label={`Dependencies: ${project.dependencies?.length ?? 0}`}
              color="primary"
            />
          </Stack>
        </Paper>

        {/* ---------- REPO SCANS ---------- */}
        <Stack spacing={3}>
          {project.gitRepo?.map((repo: string, idx: number) => (
            <RepoScanAccordion
              key={repo + idx}
              projectId={project.id}
              repoIndex={idx}
              repoUrl={repo}
              branch={project.gitBrances?.[idx] ?? "main"}
              gpg={project.gpgKey?.[idx]}
            />
          ))}
        </Stack>

        {/* ---------- DEPENDENCY AUDIT ---------- */}
        <DependencyAudit
          dependencies={project.dependencies ?? []}
        />

        {/* ---------- FINAL ACTIONS ---------- */}
        <Paper sx={{ mt: 6, p: 3 }}>
          <Stack spacing={3} alignItems="center">

            <Button
              startIcon={<AccountBalanceWalletIcon />}
              onClick={connectWallet}
              variant="outlined"
            >
              {wallet
                ? `Wallet: ${wallet.slice(0, 6)}...${wallet.slice(-4)}`
                : "Connect MetaMask"}
            </Button>

            <Stack direction="row" spacing={3}>
              <Button
                color="success"
                startIcon={<CheckCircleIcon />}
                variant="contained"
                disabled={!wallet}
                onClick={() => handleDecision("approve")}
              >
                Approve
              </Button>

              <Button
                color="error"
                startIcon={<CancelIcon />}
                variant="contained"
                disabled={!wallet}
                onClick={() => handleDecision("reject")}
              >
                Reject
              </Button>
            </Stack>

          </Stack>
        </Paper>

        {/* ---------- CONFIRM DIALOG ---------- */}
        <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
          <DialogTitle>Confirm Security Decision</DialogTitle>

          <DialogContent>
            <Typography>
              Are you sure you want to <b>{decision}</b> this scan?
            </Typography>
          </DialogContent>

          <DialogActions>
            <Button onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>

            <Button
              disabled={!wallet}
              variant="contained"
              onClick={confirmDecision}
            >
              Confirm
            </Button>
          </DialogActions>
        </Dialog>

      </Container>
    </Box>
  );
}
