// src/components/repoconfig/ReleaseRepoConfig.tsx
// Dedicated repo configuration for GitHub Release — always requires a token.
// Works in both Web (host-server) and Electron modes.

import { useState, useCallback, useEffect } from "react";
import {
  Box, Paper, TextField, InputAdornment,
  Typography, Chip, CircularProgress,
  Button, Stack, Alert
} from "@mui/material";
import { toast } from "react-hot-toast";
import RefreshIcon from "@mui/icons-material/Refresh";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import SearchIcon from "@mui/icons-material/Search";

/* ── Exported types ────────────────────────────────────────── */
export interface ReleaseRepoDetails {
  repoUrl: string;
  branch: string;
  version: string;       // release tag, e.g. "1.2.3"
  githubToken: string;   // always required for GitHub releases
}

/* ── Props ─────────────────────────────────────────────────── */
interface ReleaseRepoConfigProps {
  onConfigure: (details: ReleaseRepoDetails) => void;
  onReset: () => void;
  isLoading: boolean;
  isConfigured: boolean;
  repoDetails: ReleaseRepoDetails | null;
}

/* ── Theme ─────────────────────────────────────────────────── */
const THEME = {
  color: "#7c4dff",
  shadow: "rgba(124,77,255,0.5)",
};

export default function ReleaseRepoConfig({
  onConfigure,
  onReset,
  isLoading,
  isConfigured,
  repoDetails: _repoDetails,
}: ReleaseRepoConfigProps) {
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [version, setVersion] = useState("");
  const [githubToken, setGithubToken] = useState("");

  // Reset fields when parent resets
  useEffect(() => {
    if (!isConfigured) {
      setRepoUrl("");
      setBranch("main");
      setVersion("");
      setGithubToken("");
    }
  }, [isConfigured]);

  /* ── Validators ────────────────────────────────────────── */
  const isValidUrl = (): boolean => {
    const trimmed = repoUrl.trim();
    return trimmed.length > 0 && /github\.com\/[^/]+\/[^/]+/.test(trimmed);
  };

  const isValidBranch = (): boolean => branch.trim().length > 0;

  const isValidVersion = (): boolean => version.trim().length > 0;

  const isValidToken = (): boolean => githubToken.trim().length > 0;

  const isFormReady = isValidUrl() && isValidBranch() && isValidVersion() && isValidToken();

  /* ── Handler ───────────────────────────────────────────── */
  const handleConfigure = useCallback(() => {
    if (!isFormReady) {
      toast.error("Please fill all required fields");
      return;
    }

    onConfigure({
      repoUrl: repoUrl.trim(),
      branch: branch.trim(),
      version: version.trim(),
      githubToken: githubToken.trim(),
    });
  }, [repoUrl, branch, version, githubToken, isFormReady, onConfigure]);

  /* ── Render ────────────────────────────────────────────── */
  return (
    <Paper sx={{ p: 3, borderLeft: `4px solid ${THEME.color}`, borderRadius: 1 }}>
      <Stack spacing={2.5}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography
            variant="h6"
            fontWeight={700}
            sx={{ color: THEME.color, display: "flex", alignItems: "center", gap: 1 }}
          >
            <SearchIcon sx={{ fontSize: 24 }} />
            Release Target
          </Typography>
          {isConfigured && (
            <Chip label="CONFIGURED" color="success" size="small" sx={{ fontWeight: 600 }} />
          )}
        </Stack>

        {/* Info Alert */}
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          <strong>GitHub token is always required</strong> for creating releases — 
          Token is never stored by application.
        </Alert>

        {/* Form */}
        <Paper
          sx={{
            p: 3,
            bgcolor: `${THEME.color}08`,
            border: `2px solid ${THEME.color}`,
            borderRadius: 3,
            boxShadow: 2,
          }}
        >
          <Stack spacing={2}>
            <Typography variant="body2" fontWeight={700} sx={{ color: THEME.color }}>
              🚀 GitHub Repository, Branch & Version
            </Typography>

            {/* Row 1: URL + Branch */}
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: 2 }}>
              <TextField
                label="Repository URL *"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/owner/repo"
                disabled={isLoading || isConfigured}
                size="small"
                error={repoUrl.length > 0 && !isValidUrl()}
                helperText={
                  repoUrl.length > 0 && !isValidUrl()
                    ? "Must be a valid GitHub URL (https://github.com/owner/repo)"
                    : ""
                }
              />
              <TextField
                label="Branch *"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="main"
                disabled={isLoading || isConfigured}
                size="small"
                error={branch.length > 0 && !isValidBranch()}
              />
            </Box>

            {/* Row 2: Version */}
            <TextField
              label="Version (Release Tag) *"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="1.2.3"
              disabled={isLoading || isConfigured}
              size="small"
              fullWidth
              error={version.length > 0 && !isValidVersion()}
              helperText="This becomes the Git tag and release name"
            />

            {/* Row 3: Token — always required */}
            <Paper
              sx={{
                p: 2.5,
                bgcolor: `${THEME.color}14`,
                border: `1px solid ${THEME.color}4D`,
                borderRadius: 2,
              }}
            >
              <Typography variant="body2" fontWeight={600} mb={2} sx={{ color: THEME.color }}>
                🔐 GitHub Personal Access Token (Required)
              </Typography>
              <TextField
                label="GitHub Token *"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                type="password"
                size="small"
                placeholder="github_pat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                error={githubToken.length > 0 && !isValidToken()}
                helperText="Scopes: repo (private) or public_repo (public). Token never stored."
                disabled={isLoading || isConfigured}
                fullWidth
                InputProps={{
                  startAdornment: <InputAdornment position="start">🔑</InputAdornment>,
                }}
              />
            </Paper>
          </Stack>
        </Paper>

        {/* Action Buttons */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            gap: 3,
            mt: 2,
            pt: 2,
            borderTop: `1px solid ${THEME.color}20`,
          }}
        >
          <Button
            variant="contained"
            size="medium"
            onClick={handleConfigure}
            disabled={!isFormReady || isLoading || isConfigured}
            startIcon={<RocketLaunchIcon />}
            sx={{
              minWidth: 250,
              height: 42,
              fontWeight: 600,
              backgroundColor: THEME.color,
              "&:hover": { backgroundColor: THEME.shadow },
            }}
          >
            {isLoading ? (
              <>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                Configuring...
              </>
            ) : isConfigured ? (
              "Configured"
            ) : (
              "Configure Release Target"
            )}
          </Button>

          <Button
            variant="outlined"
            size="medium"
            onClick={onReset}
            disabled={isLoading}
            startIcon={<RefreshIcon />}
            sx={{
              minWidth: 100,
              height: 42,
              fontWeight: 600,
              borderColor: THEME.color,
              color: THEME.color,
              "&:hover": {
                borderColor: THEME.shadow,
                color: THEME.shadow,
              },
            }}
          >
            Reset
          </Button>
        </Box>
      </Stack>
    </Paper>
  );
}