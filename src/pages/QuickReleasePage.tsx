// QuickReleasePage.tsx
import { useState, useCallback } from "react";
import { Box, Container } from "@mui/material";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";

import QuickHeader from "../components/QuickHeader";
import ReleaseRepoConfig, { ReleaseRepoDetails } from "../components/repoconfig/ReleaseRepoConfig";
import ProductReleaseCard from "../components/productrelease/ProductReleaseCard";
import { Product } from "../models/Product";

export default function QuickReleasePage() {
  const [repoDetails, setRepoDetails] = useState<ReleaseRepoDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);

  const handleConfigureRepo = useCallback((details: ReleaseRepoDetails) => {
    setRepoDetails(details);
    setIsConfigured(true);
    setLoading(false);
    toast.success("Repository configured for release!");
  }, []);

  const handleReset = useCallback(() => {
    setRepoDetails(null);
    setIsConfigured(false);
    toast.success("Reset complete");
  }, []);

  // Build a temporary Product object from ReleaseRepoDetails for ProductReleaseCard
  const buildQuickProduct = (): Product | null => {
    if (!repoDetails) return null;
    return {
      id: `quick-release-${Date.now()}`,
      name: repoDetails.repoUrl.split("/").pop()?.replace(".git", "") || "Quick Release",
      version: repoDetails.version || "v1.0.0",
      isOpenSource: true,
      description: "Quick release from repository configuration",
      repos: [
        {
          repoUrl: repoDetails.repoUrl,
          branch: repoDetails.branch,
        },
      ],
      releaseEngineers: [],
      createdBy: "quick-release",
      createdAt: new Date().toISOString(),
      status: "Approved",
    };
  };

  const quickProduct = buildQuickProduct();

  return (
    <Box sx={{ pt: 10, pb: 8, minHeight: "100vh", bgcolor: "background.default" }}>
      <Container maxWidth="lg">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <QuickHeader pageType="release" />

          <ReleaseRepoConfig
            onConfigure={handleConfigureRepo}
            onReset={handleReset}
            isLoading={loading}
            isConfigured={isConfigured}
            repoDetails={repoDetails}
          />

          {isConfigured && repoDetails && quickProduct && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
              <ProductReleaseCard
                product={quickProduct}
                borderColor="#7c4dff"
                disabled={false}
                tooltipTitle=""
                githubToken={repoDetails.githubToken}
                onReleaseComplete={() => {
                  toast.success("Release process completed!");
                }}
              />
            </motion.div>
          )}
        </motion.div>
      </Container>
    </Box>
  );
}