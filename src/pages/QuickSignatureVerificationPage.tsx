// QuickSignatureVerificationPage.tsx
import { useState, useCallback } from "react";
import { Box, Container } from "@mui/material";
import { motion } from "framer-motion";
import QuickHeader from "../components/QuickHeader";
import SignatureVerificationCard from "../components/verification/SignatureVerificationCard";
import TagBasedRepoConfig, { TagBasedRepoDetails } from "../components/repoconfig/TagBasedRepoConfig";
import { toast } from "react-hot-toast";

export default function QuickSignatureVerificationPage() {
  const [repoDetails, setRepoDetails] = useState<TagBasedRepoDetails | null>(null);
  const [githubToken, setGithubToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);

  const handleConfigureRepo = useCallback((details: TagBasedRepoDetails, token?: string) => {
    setRepoDetails(details);
    setGithubToken(token || "");
    setIsConfigured(true);
    setLoading(false);
    
    const type = details.isLocal ? 'Local' : (token ? 'Private GitHub' : 'Public GitHub');
    const tagDisplay = details.releaseTag ? `Tag: ${details.releaseTag}` : 'No tag (local)';
    toast.success(`${type} repository configured!\n${tagDisplay}`, { duration: 5000 });
  }, []);

  const handleReset = useCallback(() => {
    setRepoDetails(null);
    setGithubToken("");
    setIsConfigured(false);
    toast.success("Reset complete");
  }, []);

  return (
    <Box sx={{ pt: 10, pb: 8, minHeight: "100vh", bgcolor: "background.default" }}>
      <Container maxWidth="lg">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <QuickHeader pageType="verify" />

          <TagBasedRepoConfig
            themeColor="verify"
            onConfigure={handleConfigureRepo}
            onReset={handleReset}
            isLoading={loading}
            isConfigured={isConfigured}
            repoDetails={repoDetails}
          />

          {isConfigured && repoDetails && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
              <SignatureVerificationCard
                repoDetails={repoDetails}
                githubToken={githubToken}
                borderColor="#4caf50"
              />
            </motion.div>
          )}
        </motion.div>
      </Container>
    </Box>
  );
}
