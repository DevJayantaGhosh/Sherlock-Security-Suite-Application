// src/pages/QuickSecurityScanPage.tsx
import { useState, useCallback, useEffect, SetStateAction } from "react";
import isElectron from 'is-electron';
import {
  Box, Button, Container, Stack, Typography, 
  TextField, Paper, Chip, CircularProgress,
  Switch, InputAdornment, Collapse, Tabs, Tab, IconButton
} from "@mui/material";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import RefreshIcon from '@mui/icons-material/Refresh';
import SecurityIcon from '@mui/icons-material/Security';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import LinkIcon from '@mui/icons-material/Link';

import QuickHeader from "../components/QuickHeader";
import RepoScanAccordion from "../components/security/RepoScanAccordion";
import { RepoDetails } from "../models/Product";

export default function QuickSecurityScanPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [localRepoFullPath, setLocalRepoFullPath] = useState("");
  const [standaloneAuth, setStandaloneAuth] = useState({
    isPrivate: false,
    githubToken: "",
  });
  
  const [isElectronMode, setIsElectronMode] = useState(false);
  const [repoDetails, setRepoDetails] = useState<RepoDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);

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

  // Clear fields on tab switch + disable after configure
  const handleTabChange = (_: any, newValue: SetStateAction<number>) => {
    if (isConfigured) {
      toast.error("Reset first to change configuration");
      return;
    }
    
    // Clear fields on tab switch
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
      if (loading || !window.electronAPI?.selectFolder) {
        toast.error("Folder picker temporarily unavailable");
        return;
      }
      
      setLoading(true);
      const path = await window.electronAPI.selectFolder();
      setLoading(false);
      
      if (path) {
        setLocalRepoFullPath(path);
        toast.success(`Selected: ${path}`);
      }
    } catch (e) {
      setLoading(false);
      console.error("Folder selection failed:", e);
      toast.error("Please type path manually");
    }
  };

  const handleConfigureRepo = useCallback(async () => {
    if (!isFormReady) {
      toast.error("Please fill all required fields");
      return;
    }

    setLoading(true);
    
    const configuredRepo: RepoDetails = {
      repoUrl: activeTab === 0 ? repoUrl.trim() : localRepoFullPath.trim(),
      branch: branch.trim(),
      scans: {}
    };

    setRepoDetails(configuredRepo);
    setIsConfigured(true);
    toast.success(
      activeTab === 0 
        ? "GitHub repository configured!"
        : "Local repository configured!",
      { duration: 4000 }
    );
    
    setLoading(false);
  }, [repoUrl, branch, localRepoFullPath, standaloneAuth, activeTab, isFormReady]);

  const handleReset = () => {
    setRepoUrl("");
    setBranch("main");
    setLocalRepoFullPath("");
    setStandaloneAuth({ isPrivate: false, githubToken: "" });
    setRepoDetails(null);
    setIsConfigured(false);
    setActiveTab(0);
    toast.success("Reset complete - configure new repository");
  };

  const handleRepoUpdate = async (updatedRepo: RepoDetails) => {
    setRepoDetails(updatedRepo);
  };

  const FolderPicker = () => (
    <TextField
      fullWidth
      label="Full Folder Path *"
      value={localRepoFullPath}
      onChange={(e) => setLocalRepoFullPath(e.target.value)}
      placeholder="C:\\Projects\\my-repo or /home/user/projects/my-repo"
      error={!isValidLocalPath()}
      helperText={!isValidLocalPath() ? "Required: Select your cloned repo folder" : ""}
      disabled={loading || isConfigured}
      size="small"
      InputProps={{
        readOnly: false,
        endAdornment: isElectronMode && !loading && !isConfigured ? (
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
    <Box sx={{ pt: 10, pb: 8, minHeight: "100vh" }}>
      <Container maxWidth="lg">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <QuickHeader pageType="security" />

          <Paper sx={{ p: 3, mb: 4, borderRadius: 3, boxShadow: 3 }}>
            <Stack spacing={2.5}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="h6" fontWeight={700} color="primary">
                  📝 Configure Repository
                </Typography>
                {isConfigured && (
                  <Chip label="CONFIGURED" color="success" size="small" sx={{ fontWeight: 600 }} />
                )}
              </Stack>

              <Tabs 
                value={activeTab} 
                onChange={handleTabChange}
                sx={{ mb: 3 }}
              >
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

              {/* GITHUB TAB */}
              {activeTab === 0 && (
                <Paper 
                  sx={{ 
                    p: 3, 
                    bgcolor: "rgba(255, 193, 7, 0.03)",
                    border: `2px solid`,
                    borderColor: "warning.main",
                    borderRadius: 3,
                    boxShadow: 2,
                    transition: "all 0.3s ease",
                    "&:hover": {
                      borderColor: "warning.dark",
                      boxShadow: 4,
                      transform: "translateY(-1px)"
                    }
                  }}
                >
                  <Stack spacing={2}>
                    <Typography variant="body2" fontWeight={700} color="warning.main">
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
                        disabled={loading || isConfigured}
                        size="small"
                      />
                      <TextField
                        label="Branch *"
                        value={branch}
                        onChange={(e) => setBranch(e.target.value)}
                        placeholder="main"
                        error={Boolean(!branch.trim())}
                        helperText={!branch.trim() ? "Required" : ""}
                        disabled={loading || isConfigured}
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
                        disabled={loading || isConfigured}
                        size="small"
                      />
                      <Box sx={{ ml: 1.5, flex: 1 }}>
                        <Typography variant="body2" fontWeight={500}>Private Repository</Typography>
                        <Typography variant="caption" color="warning.main" sx={{ fontWeight: 500 }}>
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
                          <Typography variant="body2" fontWeight={600} mb={2} color="warning.main">
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
                            disabled={loading || isConfigured}
                            fullWidth
                            InputProps={{ startAdornment: <InputAdornment position="start">🔑</InputAdornment> }}
                          />
                        </Paper>
                      </Collapse>
                    )}
                  </Stack>
                </Paper>
              )}

              {/* LOCAL TAB */}
              {activeTab === 1 && (
                <Paper 
                  sx={{ 
                    p: 3, 
                    bgcolor: "rgba(255, 193, 7, 0.04)",
                    border: `2px solid`,
                    borderColor: "warning.dark",
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
                      bgcolor: "warning.main",
                      borderRadius: "12px 12px 0 0",
                      zIndex: 1
                    },
                    "&:hover": {
                      borderColor: "warning.main",
                      boxShadow: 5,
                      transform: "translateY(-2px)"
                    }
                  }}
                >
                  <Typography variant="body2" fontWeight={700} mb={2} color="warning.dark">
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
                      disabled={loading || isConfigured}
                      size="small"
                    />
                  </Box>
                  
                  <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'warning.dark', fontWeight: 600 }}>
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
                borderTop: "1px solid rgba(255,255,255,0.1)"
              }}>
                <Button
                  variant="contained"
                  size="medium"
                  onClick={handleConfigureRepo}
                  disabled={!isFormReady || loading || isConfigured}
                  startIcon={<SecurityIcon />}
                  sx={{ minWidth: 180, height: 42, fontWeight: 600 }}
                >
                  {loading ? (
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
                  onClick={handleReset}
                  disabled={loading}
                  startIcon={<RefreshIcon />}
                  sx={{ minWidth: 100, height: 42, fontWeight: 600 }}
                >
                  Reset
                </Button>
              </Box>
            </Stack>
          </Paper>

          {isConfigured && repoDetails && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.3 }}
            >
              <Stack spacing={3}>
                <Typography variant="h5" fontWeight={700}>
                  🔍 Repository Security Scans & Analysis
                </Typography>

                <RepoScanAccordion
                  product={{} as any}
                  repoDetails={repoDetails}
                  onRepoUpdate={handleRepoUpdate}
                  disabled={false}
                  isQuickScan={true}
                  githubToken={activeTab === 0 ? standaloneAuth.githubToken : ""}
                />
              </Stack>
            </motion.div>
          )}
        </motion.div>
      </Container>
    </Box>
  );
}
