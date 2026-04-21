import { useState, useCallback, useEffect } from "react";
import isElectron from 'is-electron';
import { platform } from "../../platform";
import {
  Box, Paper, TextField, Switch, InputAdornment, Collapse,
  Tabs, Tab, IconButton, Typography, Chip, CircularProgress,
  Button, Stack
} from "@mui/material";
import { toast } from "react-hot-toast";
import RefreshIcon from '@mui/icons-material/Refresh';
import SecurityIcon from '@mui/icons-material/Security';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import LinkIcon from '@mui/icons-material/Link';
import SearchIcon from '@mui/icons-material/Search';

export interface TagBasedRepoDetails {
  repoUrl: string;
  releaseTag?: string;  // Optional for local repos
  isLocal: boolean;
}

const PAGE_CONFIG = {
  release: {
    color: '#7c4dff',
    shadow: 'rgba(124,77,255,0.5)',
    nameColor: '#7c4dff',
    title: 'Release Target',
    icon: '🚀',
    buttonLabel: 'Configure Release Target'
  },
  crypto: {
    color: '#00e5ff',
    shadow: 'rgba(0,229,255,0.5)',
    nameColor: '#00e5ff',
    title: 'Signing Target',
    icon: '🔏',
    buttonLabel: 'Configure Signing Target'
  },
  verify: {
    color: '#4caf50',
    shadow: 'rgba(76,175,80,0.5)',
    nameColor: '#4caf50',
    title: 'Verification Target',
    icon: '🔍',
    buttonLabel: 'Configure Verification Target'
  },
  default: {
    color: '#4caf50',
    shadow: 'rgba(76,175,80,0.5)',
    nameColor: '#4caf50',
    title: 'Repository Target',
    icon: '📦',
    buttonLabel: 'Configure Target'
  }
} as const;

type ThemeKey = keyof typeof PAGE_CONFIG;

interface TagBasedRepoConfigProps {
  onConfigure: (details: TagBasedRepoDetails, githubToken?: string) => void;
  onReset: () => void;
  isLoading: boolean;
  isConfigured: boolean;
  repoDetails: TagBasedRepoDetails | null;
  themeColor?: string;
  /** When true, the "Local Repository" tab is hidden even in Electron mode */
  hideLocal?: boolean;
}

export default function TagBasedRepoConfig({
  onConfigure,
  onReset,
  isLoading,
  isConfigured,
  repoDetails: _repoDetails,
  themeColor = 'default',
  hideLocal = false
}: TagBasedRepoConfigProps) {
  const theme = PAGE_CONFIG[(themeColor in PAGE_CONFIG ? themeColor : 'default') as ThemeKey];

  const [activeTab, setActiveTab] = useState(0);
  const [repoUrl, setRepoUrl] = useState("");
  const [releaseTag, setReleaseTag] = useState("");
  const [localRepoPath, setLocalRepoPath] = useState("");
  const [standaloneAuth, setStandaloneAuth] = useState({
    isPrivate: false,
    githubToken: "",
  });
  const [isElectronMode, setIsElectronMode] = useState(false);

  useEffect(() => {
    setIsElectronMode(isElectron());
  }, []);

  useEffect(() => {
    if (!isConfigured) {
      setActiveTab(0);
      setRepoUrl("");
      setReleaseTag("");
      setLocalRepoPath("");
      setStandaloneAuth({ isPrivate: false, githubToken: "" });
    }
  }, [isConfigured]);

  const isValidUrl = (): boolean => {
    return repoUrl.trim().length > 0;
  };

  const isValidReleaseTag = (): boolean => {
    return releaseTag.trim().length > 0;
  };

  const isValidLocalPath = (): boolean => {
    return localRepoPath.trim().length > 0;
  };

  const validateStandaloneAuth = (): boolean => {
    if (!standaloneAuth.isPrivate) return true;
    return Boolean(standaloneAuth.githubToken.trim());
  };

  const isFormReady = (activeTab === 0
    ? (isValidUrl() && isValidReleaseTag() && validateStandaloneAuth())
    : isValidLocalPath()
  );

  const handleTabChange = (_: any, newValue: number) => {
    if (isConfigured) {
      toast.error("Reset first to change configuration");
      return;
    }

    if (activeTab !== newValue) {
      setRepoUrl("");
      setLocalRepoPath("");
      setReleaseTag("");
      setStandaloneAuth({ isPrivate: false, githubToken: "" });
    }

    setActiveTab(newValue);
  };

  const handleSelectFolder = async () => {
    if (!isElectronMode) {
      toast.error("Folder picker available only in desktop app");
      return;
    }

    try {
      if (isLoading) {
        toast.error("Folder picker temporarily unavailable");
        return;
      }

      const path = await platform.selectFolder();
      if (path) {
        setLocalRepoPath(path);
        toast.success(`Selected: ${path}`);
      }
    } catch (e) {
      console.error("Folder selection failed:", e);
      toast.error("Please type path manually");
    }
  };

  const handleConfigureRepo = useCallback(() => {
    if (!isFormReady) {
      toast.error("Please fill all required fields");
      return;
    }

    const configuredRepo: TagBasedRepoDetails = {
      repoUrl: activeTab === 0 ? repoUrl.trim() : localRepoPath.trim(),
      releaseTag: activeTab === 0 ? releaseTag.trim() : undefined,
      isLocal: activeTab === 1
    };

    const token = activeTab === 0 ? (standaloneAuth.githubToken || undefined) : undefined;
    onConfigure(configuredRepo, token);
  }, [repoUrl, releaseTag, localRepoPath, standaloneAuth, activeTab, isFormReady, onConfigure]);

  const FolderPicker = () => (
    <TextField
      fullWidth
      label="Repository Path *"
      value={localRepoPath}
      onChange={(e) => setLocalRepoPath(e.target.value)}
      placeholder="/home/user/my-repo or C:\\Projects\\my-repo"
      error={!isValidLocalPath()}
      helperText={!isValidLocalPath() ? "Required: Select cloned repo folder" : ""}
      disabled={isLoading || isConfigured}
      size="small"
      InputProps={{
        readOnly: false,
        endAdornment: isElectronMode && !isLoading && !isConfigured ? (
          <InputAdornment position="end">
            <IconButton
              onClick={handleSelectFolder}
              size="small"
              edge="end"
              sx={{ mr: 0.5 }}
            >
              <FolderOpenIcon />
            </IconButton>
          </InputAdornment>
        ) : null
      }}
    />
  );

  return (
    <Paper sx={{ p: 3, borderLeft: `4px solid ${theme.color}`, borderRadius: 1 }}>
      <Stack spacing={2.5}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" fontWeight={700} sx={{ color: theme.color, display: 'flex', alignItems: 'center', gap: 1 }}>
            <SearchIcon sx={{ fontSize: 24 }} />
            {theme.title}
          </Typography>
          {isConfigured && (
            <Chip label="CONFIGURED" color="success" size="small" sx={{ fontWeight: 600 }} />
          )}
        </Stack>

        <Tabs value={activeTab} onChange={handleTabChange} sx={{ mb: 3 }}>
          <Tab
            label="GitHub Repository"
            icon={<LinkIcon />}
            iconPosition="start"
            disabled={isConfigured}
          />
          {isElectronMode && !hideLocal && (
            <Tab
              label="Local Repository"
              icon={<FolderOpenIcon />}
              iconPosition="start"
              disabled={isConfigured}
            />
          )}
        </Tabs>

        {/* GitHub Tab */}
        {activeTab === 0 && (
          <Paper sx={{
            p: 3,
            bgcolor: `${theme.color}08`,
            border: `2px solid ${theme.color}`,
            borderRadius: 3,
            boxShadow: 2
          }}>
            <Stack spacing={2}>
              <Typography variant="body2" fontWeight={700} sx={{ color: theme.color }}>
                🌐 GitHub Repository & Version (Release Tag)
              </Typography>

              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: 2 }}>
                <TextField
                  label="Repository URL *"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/username/repository"
                  disabled={isLoading || isConfigured}
                  size="small"
                />
                <TextField
                  label="Version (Release Tag) *"
                  value={releaseTag}
                  onChange={(e) => setReleaseTag(e.target.value)}
                  placeholder="1.2.3"
                  disabled={isLoading || isConfigured}
                  size="small"
                />
              </Box>

              <Box sx={{ display: "flex", alignItems: "center" }}>
                <Switch
                  checked={standaloneAuth.isPrivate}
                  onChange={(e) => setStandaloneAuth({
                    ...standaloneAuth,
                    isPrivate: e.target.checked
                  })}
                  disabled={isLoading || isConfigured}
                  size="small"
                />
                <Box sx={{ ml: 1.5, flex: 1 }}>
                  <Typography variant="body2" fontWeight={500}>
                    Private Repository
                  </Typography>
                  <Typography variant="caption" sx={{ color: theme.color, fontWeight: 500 }}>
                    Enable for private repos (Public repos don't need token)
                  </Typography>
                </Box>
              </Box>

              {standaloneAuth.isPrivate && (
                <Collapse in={standaloneAuth.isPrivate} timeout={200}>
                  <Paper sx={{
                    p: 2.5,
                    bgcolor: `${theme.color}14`,
                    border: `1px solid ${theme.color}4D`,
                    borderRadius: 2
                  }}>
                    <Typography variant="body2" fontWeight={600} mb={2} sx={{ color: theme.color }}>
                      🔐 GitHub Token Required
                    </Typography>
                    <TextField
                      label="GitHub Personal Access Token"
                      value={standaloneAuth.githubToken}
                      onChange={(e) => setStandaloneAuth({
                        ...standaloneAuth,
                        githubToken: e.target.value
                      })}
                      type="password"
                      size="small"
                      placeholder="github_pat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      error={standaloneAuth.isPrivate && !validateStandaloneAuth()}
                      helperText={
                        standaloneAuth.isPrivate && !validateStandaloneAuth()
                          ? "Required for private repos"
                          : "Scopes: repo (full), public_repo. Token never stored"
                      }
                      disabled={isLoading || isConfigured}
                      fullWidth
                      InputProps={{
                        startAdornment: <InputAdornment position="start">🔑</InputAdornment>
                      }}
                    />
                  </Paper>
                </Collapse>
              )}
            </Stack>
          </Paper>
        )}

        {/* Local Tab - No Release Tag */}
        {activeTab === 1 && (
          <Paper sx={{
            p: 3,
            bgcolor: `${theme.color}0A`,
            border: `2px solid ${theme.color}`,
            borderRadius: 3,
            boxShadow: 3
          }}>
            <Typography variant="body2" fontWeight={700} mb={2} sx={{ color: theme.color }}>
              📁 Local Repository Only
            </Typography>

            <Box sx={{ mb: 2 }}>
              <FolderPicker />
            </Box>

          </Paper>
        )}

        <Box sx={{
          display: "flex",
          justifyContent: "center",
          gap: 3,
          mt: 2,
          pt: 2,
          borderTop: `1px solid ${theme.color}20`
        }}>
          <Button
            variant="contained"
            size="medium"
            onClick={handleConfigureRepo}
            disabled={!isFormReady || isLoading || isConfigured}
            startIcon={<SecurityIcon />}
            sx={{
              minWidth: 220,
              height: 42,
              fontWeight: 600,
              backgroundColor: theme.color,
              '&:hover': { backgroundColor: theme.shadow }
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
              theme.buttonLabel
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
              borderColor: theme.color,
              color: theme.color,
              '&:hover': {
                borderColor: theme.shadow,
                color: theme.shadow
              }
            }}
          >
            Reset
          </Button>
        </Box>
      </Stack>
    </Paper>
  );
}