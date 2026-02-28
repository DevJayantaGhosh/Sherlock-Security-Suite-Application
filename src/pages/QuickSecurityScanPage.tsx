import { useState, useCallback } from "react";
import {
  Box, Container, Stack, Typography
} from "@mui/material";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import QuickHeader from "../components/QuickHeader";
import RepoScanAccordion from "../components/security/RepoScanAccordion";
import RepoConfigForm from "../components/repoconfig/RepoConfigForm";
import { RepoDetails } from "../models/Product";

import SearchIcon from '@mui/icons-material/Search';

export default function QuickSecurityScanPage() {
  const [repoDetails, setRepoDetails] = useState<RepoDetails | null>(null);
  const [githubToken, setGithubToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);

  const handleConfigureRepo = useCallback((repoDetails: RepoDetails, githubToken?: string) => {
    setRepoDetails(repoDetails);
    setGithubToken(githubToken || "");
    setIsConfigured(true);
    setLoading(false);
    
    const type = repoDetails.repoUrl.includes('github.com') ? 'GitHub' : 'Local';
    toast.success(
      `${type} repository configured!`, 
      { duration: 4000 }
    );
  }, []);

  const handleReset = useCallback(() => {
    setRepoDetails(null);
    setGithubToken("");
    setIsConfigured(false);
    toast.success("Reset complete - configure new repository");
  }, []);

  const handleRepoUpdate = useCallback((updatedRepo: RepoDetails) => {
    setRepoDetails(updatedRepo);
  }, []);

  return (
    <Box sx={{ pt: 10, pb: 8, minHeight: "100vh" }}>
      <Container maxWidth="lg">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <QuickHeader pageType="security" />

          <RepoConfigForm
            themeColor="security"  
            onConfigure={handleConfigureRepo}
            onReset={handleReset}
            isLoading={loading}
            isConfigured={isConfigured}
            repoDetails={repoDetails}
            hideBranchForLocal={false}
          />

          {isConfigured && repoDetails && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.3 }}
            >
              <Stack spacing={3} sx={{mt:3}}>
<Typography variant="h5" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
  <SearchIcon sx={{ fontSize: 28, color: 'inherit' }} />
  Repository Security Scans & Analysis
</Typography>

                <RepoScanAccordion
                  product={{} as any}
                  repoDetails={repoDetails}
                  onRepoUpdate={handleRepoUpdate}
                  disabled={false}
                  isQuickScan={true}
                  githubToken={githubToken}
                />
              </Stack>
            </motion.div>
          )}
        </motion.div>
      </Container>
    </Box>
  );
}
