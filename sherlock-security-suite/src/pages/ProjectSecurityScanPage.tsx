import { useEffect, useState } from "react";
import {
  Box, Button, Container, Paper, Stack,
  Typography, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions
} from "@mui/material";

import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";

import { useParams, useNavigate } from "react-router-dom";
import { getProjects } from "../services/projectService";
import { useUserStore } from "../store/userStore";

import RepoScanAccordion from "../components/security/RepoScanAccordion";
import DependencyAudit from "../components/security/DependencyAudit";

import { Project } from "../models/Project";

export default function ProjectSecurityScanPage() {

  const { id } = useParams();
  const navigate = useNavigate();
  const user = useUserStore(s => s.user);

  const [project, setProject] = useState<Project | null>(null);

  const [wallet, setWallet] = useState<string | null>(null);
  const [decision, setDecision] =
    useState<"approve" | "reject" | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);

  /* ---------------- LOAD PROJECT ---------------- */

  useEffect(() => {
    const p = getProjects().find(x => x.id === id);
    if (!p) navigate("/projects");
    else setProject(p);
  }, [id, navigate]);

  useEffect(() => window.scrollTo({ top: 0, behavior: "instant" }), []);

  if (!project) return null;

  /* ---------------- AUTH ---------------- */

  const isAuthorized =
    user?.role === "Admin" ||
    project.securityHead === user?.id;

  if (!isAuthorized) {
    return <Typography color="error">Unauthorized</Typography>;
  }

  /* ---------------- WALLET ---------------- */

  async function connectWallet() {
    if (!(window as any).ethereum)
      return alert("MetaMask not installed");

    const accounts = await (window as any).ethereum.request({
      method: "eth_requestAccounts",
    });

    setWallet(accounts[0]);
  }

  function handleDecision(type: "approve" | "reject") {
    setDecision(type);
    setConfirmOpen(true);
  }

  function confirmDecision() {
    console.log("✅ FINAL:", decision);
    console.log("🔐 WALLET:", wallet);
    setConfirmOpen(false);
  }

  /* ---------------- RENDER ---------------- */

  return (
    <Box sx={{ pt: 8, pb: 8 }}>
      <Container maxWidth="lg">

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
              label={`Repositories: ${project.repos.length}`}
              color="primary"
            />

          </Stack>
        </Paper>

        {/* ✅ CORRECT ACCORDION MAPPING */}
        <Stack spacing={3}>
          {project.repos.map((repo, idx) => (
            <RepoScanAccordion
              key={`${repo.repoUrl}-${idx}`}
              projectId={project.id}
              repoIndex={idx}
              repoUrl={repo.repoUrl}
              branch={repo.branch}
              gpg={repo.gpgKey}
            />
          ))}
        </Stack>

        <DependencyAudit
          dependencies={project.dependencies ?? []}
        />

        {/* ---------------- FINAL DECISION ---------------- */}

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

        <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
          <DialogTitle>Confirm Security Decision</DialogTitle>

          <DialogContent>
            Are you sure you want to <b>{decision}</b>?
          </DialogContent>

          <DialogActions>
            <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
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
