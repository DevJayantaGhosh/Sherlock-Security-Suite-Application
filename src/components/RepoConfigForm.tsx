// src/components/security/RepoConfigForm.tsx
import { useState, useCallback, useEffect } from "react";
import isElectron from 'is-electron';
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
import { RepoDetails } from "../models/Product";

interface ThemeConfig {
  color: string;
  shadow: string;
  nameColor: string;
}

interface RepoConfigFormProps {
  onConfigure: (repoDetails: RepoDetails, githubToken?: string) => void;
  onReset: () => void;
  isLoading: boolean;
  isConfigured: boolean;
  repoDetails: RepoDetails | null;
  themeColor: keyof typeof PAGE_CONFIG;
}

const PAGE_CONFIG = {
  crypto: { 
    color: '#00e5ff', 
    shadow: 'rgba(0,229,255,0.5)', 
    nameColor: '#00e5ff'
  },
  security: { 
    color: '#ff9800', 
    shadow: 'rgba(255,152,0,0.5)', 
    nameColor: '#ff9800'
  },
  verify: { 
    color: '#4caf50', 
    shadow: 'rgba(76,175,80,0.5)', 
    nameColor: '#4caf50'
  },
  default: { 
    color: '#00e5ff', 
    shadow: 'rgba(0,229,255,0.5)', 
    nameColor: '#00e5ff'
  }
} as const;

export default function RepoConfigForm({
  onConfigure,
  onReset,
  isLoading,
  isConfigured,
  repoDetails,
  themeColor = 'default'
}: RepoConfigFormProps) {
  const theme: ThemeConfig = PAGE_CONFIG[themeColor];

    useEffect(() => {
    if (!isConfigured) {
      setActiveTab(0);
      setRepoUrl("");
      setBranch("main");
      setLocalRepoFullPath("");
      setStandaloneAuth({ isPrivate: false, githubToken: "" });
    }
  }, [isConfigured]); // Reset when isConfigured changes to false
  
  const [activeTab, setActiveTab] = useState(0);
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [localRepoFullPath, setLocalRepoFullPath] = useState("");
  const [standaloneAuth, setStandaloneAuth] = useState({
    isPrivate: false,
    githubToken: "",
  });
  const [isElectronMode, setIsElectronMode] = useState(false);

  useEffect(() => {
    setIsElectronMode(isElectron());
  }, []);

  const isValidUrl = (): boolean => {
    const urlPattern = /^(https:\/\/github\.com\/[^\/\s]+\/[^\/\s]+)(\.git)?\/?$/i;
    return urlPattern.test(repoUrl.trim());
  };

  const validateStandaloneAuth = (): boolean => {
    if (!standaloneAuth.isPrivate) return true;
    return Boolean(standaloneAuth.githubToken.trim());
  };

  const isValidLocalPath = (): boolean => {
    return localRepoFullPath.trim().length > 0;
  };

  const isFormReady = (activeTab === 0 
    ? (isValidUrl() && validateStandaloneAuth() && branch.trim())
    : (isValidLocalPath() && branch.trim())
  );

  const handleTabChange = (_: any, newValue: number) => {
    if (isConfigured) {
      toast.error("Reset first to change configuration");
      return;
    }
    
    if (activeTab !== newValue) {
      setRepoUrl("");
      setLocalRepoFullPath("");
      setStandaloneAuth({ isPrivate: false, githubToken: "" });
      setBranch("main");
    }
    
    setActiveTab(newValue);
  };

  const handleSelectFolder = async () => {
    if (!isElectronMode) {
      toast.error("Folder picker available only in desktop app");
      return;
    }
    
    try {
      if (isLoading || !window.electronAPI?.selectFolder) {
        toast.error("Folder picker temporarily unavailable");
        return;
      }
      
      const path = await window.electronAPI.selectFolder();
      if (path) {
        setLocalRepoFullPath(path);
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

    const configuredRepo: RepoDetails = {
      repoUrl: activeTab === 0 ? repoUrl.trim() : localRepoFullPath.trim(),
      branch: branch.trim(),
      scans: {}
    };

    onConfigure(configuredRepo, activeTab === 0 ? standaloneAuth.githubToken : undefined);
  }, [repoUrl, branch, localRepoFullPath, standaloneAuth, activeTab, isFormReady, onConfigure]);

  const FolderPicker = () => (
    <TextField
      fullWidth
      label="Full Folder Path *"
      value={localRepoFullPath}
      onChange={(e) => setLocalRepoFullPath(e.target.value)}
      placeholder="C:\\Projects\\my-repo or /home/user/projects/my-repo"
      error={!isValidLocalPath()}
      helperText={!isValidLocalPath() ? "Required: Select your cloned repo folder" : ""}
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
          <Typography variant="h6" fontWeight={700} sx={{ color: theme.color }}>
            📝 Configure Repository
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
            sx={{ 
              fontWeight: activeTab === 0 ? 700 : 500,
              opacity: isConfigured && activeTab !== 0 ? 0.5 : 1
            }} 
          />
          {isElectronMode && (
            <Tab 
              label="Local Repository"
              icon={<FolderOpenIcon />}
              iconPosition="start"
              disabled={isConfigured}
              sx={{ 
                fontWeight: activeTab === 1 ? 700 : 500,
                opacity: isConfigured && activeTab !== 1 ? 0.5 : 1
              }} 
            />
          )}
        </Tabs>

        {activeTab === 0 && (
          <Paper sx={{ 
            p: 3, 
            bgcolor: "rgba(255, 193, 7, 0.03)",
            border: `2px solid`,
            borderColor: theme.color,
            borderRadius: 3,
            boxShadow: 2,
            transition: "all 0.3s ease",
            "&:hover": {
              borderColor: theme.shadow,
              boxShadow: 4,
              transform: "translateY(-1px)"
            }
          }}>
            <Stack spacing={2}>
              <Typography variant="body2" fontWeight={700} sx={{ color: theme.color }}>
                🌐 GitHub Repository Configuration
              </Typography>
              
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 2 }}>
                <TextField
                  label="Repository URL *"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/username/repository"
                  error={Boolean(!isValidUrl() && repoUrl.trim())}
                  helperText={!isValidUrl() && repoUrl.trim() ? "Invalid GitHub URL" : ""}
                  disabled={isLoading || isConfigured}
                  size="small"
                />
                <TextField
                  label="Branch *"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="main"
                  error={Boolean(!branch.trim())}
                  helperText={!branch.trim() ? "Required" : ""}
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
                  <Typography variant="body2" fontWeight={500}>Private Repository</Typography>
                  <Typography variant="caption" sx={{ color: theme.color, fontWeight: 500 }}>
                    ⚠️ Requires authentication token
                  </Typography>
                </Box>
              </Box>

              {standaloneAuth.isPrivate && (
                <Collapse in={standaloneAuth.isPrivate} timeout={200}>
                  <Paper sx={{ 
                    p: 2.5, 
                    bgcolor: "rgba(255,152,0,0.08)", 
                    border: "1px solid rgba(255,152,0,0.3)",
                    borderRadius: 2 
                  }}>
                    <Typography variant="body2" fontWeight={600} mb={2} sx={{ color: theme.color }}>
                      🔐 Authentication Required
                    </Typography>
                    <TextField
                      label="GitHub Token (Recommended)"
                      value={standaloneAuth.githubToken}
                      onChange={(e) => setStandaloneAuth({ ...standaloneAuth, githubToken: e.target.value })}
                      type="password"
                      size="small"
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      error={standaloneAuth.isPrivate && !validateStandaloneAuth()}
                      helperText={
                        standaloneAuth.isPrivate && !validateStandaloneAuth()
                          ? "Security Note: Application **NEVER stores** your token"
                          : "Paste your GitHub Personal Access Token"
                      }
                      disabled={isLoading || isConfigured}
                      fullWidth
                      InputProps={{ startAdornment: <InputAdornment position="start">🔑</InputAdornment> }}
                    />
                  </Paper>
                </Collapse>
              )}
            </Stack>
          </Paper>
        )}

        {activeTab === 1 && (
          <Paper sx={{ 
            p: 3, 
            bgcolor: "rgba(255, 193, 7, 0.04)",
            border: `2px solid`,
            borderColor: theme.shadow,
            borderRadius: 3,
            boxShadow: 3,
            position: "relative",
            "&:before": {
              content: '""',
              position: "absolute",
              top: -2,
              left: -2,
              right: -2,
              height: 4,
              bgcolor: theme.color,
              borderRadius: "12px 12px 0 0",
              zIndex: 1
            },
            "&:hover": {
              borderColor: theme.color,
              boxShadow: 5,
              transform: "translateY(-2px)"
            }
          }}>
            <Typography variant="body2" fontWeight={700} mb={2} sx={{ color: theme.shadow }}>
              📁 Local Repository Configuration
            </Typography>
            
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 2, mb: 2, position: "relative", zIndex: 2 }}>
              <FolderPicker />
              <TextField
                label="Branch *"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="main"
                error={Boolean(!branch.trim())}
                helperText={!branch.trim() ? "Required" : ""}
                disabled={isLoading || isConfigured}
                size="small"
              />
            </Box>
            
            <Typography variant="caption" sx={{ mt: 1, display: 'block', color: theme.shadow, fontWeight: 600 }}>
              ⚠️ Both folder path and branch are required
            </Typography>
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
              minWidth: 180, 
              height: 42, 
              fontWeight: 600,
              backgroundColor: theme.color,
              '&:hover': {
                backgroundColor: theme.shadow,
              }
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
              `Configure & Scan ${activeTab === 0 ? '(GitHub)' : '(Local)'}`
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
                color: theme.shadow,
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
