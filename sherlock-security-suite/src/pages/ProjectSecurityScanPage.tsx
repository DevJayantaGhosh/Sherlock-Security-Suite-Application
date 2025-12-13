// src/pages/ProjectSecurityScanPage.tsx
import { useEffect, useState, useCallback } from "react";
import {
  Box, Button, Container, Paper, Stack,
  Typography, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions,
  Tooltip
} from "@mui/material";

import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";

import { useParams, useNavigate, useLocation } from "react-router-dom";
import { authorizeApprove, getProjects } from "../services/projectService";
import { useUserStore } from "../store/userStore";

import RepoScanAccordion from "../components/security/RepoScanAccordion";
import DependencyAudit from "../components/security/DependencyAudit";

import { Project } from "../models/Project";

export default function ProjectSecurityScanPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useUserStore(s => s.user);

  const [project, setProject] = useState<Project | null>(null);
  const [wallet, setWallet] = useState<string | null>(null);
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // ✅ Load project
  useEffect(() => {
    console.log("[SECURITY SCAN PAGE] Loading project:", id);
    const p = getProjects().find(x => x.id === id);
    if (!p) {
      console.log("[SECURITY SCAN PAGE] Project not found, navigating away");
      navigate("/projects");
    } else {
      setProject(p);
    }
  }, [id, navigate]);

  // ✅ Scroll to top on mount
  useEffect(() => {
    console.log("[SECURITY SCAN PAGE] Mounted");
    window.scrollTo({ top: 0, behavior: "instant" });
    
    return () => {
      console.log("[SECURITY SCAN PAGE] Unmounting");
    };
  }, []);

  // ✅ Cleanup on route change
  useEffect(() => {
    return () => {
      console.log("[SECURITY SCAN PAGE] Route changing from:", location.pathname);
    };
  }, [location.pathname]);

  if (!project) {
    return (
      <Box sx={{ pt: 8, display: "flex", justifyContent: "center" }}>
        <Typography>Loading project...</Typography>
      </Box>
    );
  }

  // Auth
  const isAuthorized = authorizeApprove(user, project);
  const tooltip = isAuthorized
    ? ""
    : "You can view this page, but cannot perform any security review actions";

  // Connect wallet
  async function connectWallet() {
    if (!(window as any).ethereum) {
      return alert("MetaMask not installed");
    }

    try {
      const accounts = await (window as any).ethereum.request({
        method: "eth_requestAccounts",
      });
      setWallet(accounts[0]);
    } catch (err) {
      console.error("[WALLET] Connection error:", err);
    }
  }

  // Handle decision
  function handleDecision(type: "approve" | "reject") {
    setDecision(type);
    setConfirmOpen(true);
  }

  // Confirm decision
  function confirmDecision() {
    console.log("✅ FINAL DECISION:", decision);
    console.log("🔐 WALLET:", wallet);
    // TODO: Implement blockchain transaction
    setConfirmOpen(false);
  }

  return (
    <Box sx={{ pt: 8, pb: 8 }}>
      <Container maxWidth="lg">
        {/* Project Header */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
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

        {/* Repository Scans */}
        <Stack spacing={3}>
          {project.repos.map((repo, idx) => (
            <RepoScanAccordion
              key={`${repo.repoUrl}-${idx}`}
              project={project}
              repoUrl={repo.repoUrl}
              branch={repo.branch}
            />
          ))}
        </Stack>

        {/* Dependency Audit */}
        <DependencyAudit
          project={project}
          dependencies={project.dependencies ?? []}
        />

        {/* Final Decision */}
        <Paper sx={{ mt: 6, p: 3 }}>
          <Stack spacing={3} alignItems="center">
            <Tooltip title={tooltip}>
              <span>
                <Button
                  startIcon={<AccountBalanceWalletIcon />}
                  onClick={connectWallet}
                  disabled={!isAuthorized}
                  variant="outlined"
                >
                  {wallet
                    ? `Wallet: ${wallet.slice(0, 6)}...${wallet.slice(-4)}`
                    : "Connect MetaMask"}
                </Button>
              </span>
            </Tooltip>

            <Stack direction="row" spacing={3}>
              <Tooltip title={tooltip}>
                <span>
                  <Button
                    color="success"
                    startIcon={<CheckCircleIcon />}
                    variant="contained"
                    disabled={!wallet || !isAuthorized}
                    onClick={() => handleDecision("approve")}
                  >
                    Approve
                  </Button>
                </span>
              </Tooltip>

              <Tooltip title={tooltip}>
                <span>
                  <Button
                    color="error"
                    startIcon={<CancelIcon />}
                    variant="contained"
                    disabled={!wallet || !isAuthorized}
                    onClick={() => handleDecision("reject")}
                  >
                    Reject
                  </Button>
                </span>
              </Tooltip>
            </Stack>
          </Stack>
        </Paper>

        {/* Confirmation Dialog */}
        <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
          <DialogTitle>Confirm Security Decision</DialogTitle>

          <DialogContent>
            <Typography>
              Are you sure you want to <strong>{decision}</strong> this project?
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              This action will be recorded on the blockchain using wallet:
            </Typography>
            <Typography variant="body2" fontFamily="monospace">
              {wallet}
            </Typography>
          </DialogContent>

          <DialogActions>
            <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button
              disabled={!wallet}
              variant="contained"
              onClick={confirmDecision}
              color={decision === "approve" ? "success" : "error"}
            >
              Confirm {decision === "approve" ? "Approval" : "Rejection"}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
}
