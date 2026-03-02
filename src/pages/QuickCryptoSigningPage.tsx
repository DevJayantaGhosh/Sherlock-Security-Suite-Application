// QuickCryptoSigningPage.tsx
import { useState, useCallback } from "react";
import { Box, Container } from "@mui/material";
import { motion } from "framer-motion";
import QuickHeader from "../components/QuickHeader";

import { RepoDetails } from "../models/Product";
import { toast } from "react-hot-toast";
import KeyGenerationCard from "../components/signing/KeyGenerationCard";
import RepoConfigForm from "../components/repoconfig/RepoConfigForm";
import DigitalSigningCard from "../components/signing/DigitalSigningCard";

export default function QuickCryptoSigningPage() {
  const [repoDetails, setRepoDetails] = useState<RepoDetails | null>(null);
  const [githubToken, setGithubToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);

  const handleConfigureRepo = useCallback((repoDetails: RepoDetails, token?: string) => {
    setRepoDetails(repoDetails);
    setGithubToken(token || "");
    setIsConfigured(true);
    setLoading(false);
    const type = repoDetails.repoUrl.includes('github.com') ? 'GitHub' : 'Local';
    toast.success(`${type} repository configured!`);
  }, []);

  const handleReset = useCallback(() => {
    setRepoDetails(null);
    setGithubToken("");
    setIsConfigured(false);
    toast.success("Reset complete");
  }, []);

  const handleFolderSelect = async () => window.electronAPI?.selectFolder();
  const handleFileSelect = async () => window.electronAPI?.selectFile();

  return (
    <Box sx={{ pt: 10, pb: 8, minHeight: "100vh", bgcolor: "background.default" }}>
      <Container maxWidth="lg">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <QuickHeader pageType="crypto" />

          <KeyGenerationCard
            borderColor="#00e5ff" 
            onFolderSelect={handleFolderSelect} 
            disabled={false} toolTip={""} 
          />

          <RepoConfigForm
            themeColor="crypto"
            onConfigure={handleConfigureRepo}
            onReset={handleReset}
            isLoading={loading}
            isConfigured={isConfigured}
            repoDetails={repoDetails}
            hideBranchForLocal={true}
          />
          

          {isConfigured && repoDetails && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
              <DigitalSigningCard
                repoDetails={repoDetails}
                isQuickScan={true}
                disabled ={false}
                githubToken={githubToken}
                borderColor="#00e5ff" 
                onFileSelect={handleFileSelect} 
                toolTip={""}              
                />
            </motion.div>
          )}
        </motion.div>
      </Container>
    </Box>
  );
}
