// src/pages/ProductCryptoSigningPage.tsx
import { useEffect, useState, useCallback } from "react";
import { Box, Container, Stack, Paper, Typography, CircularProgress } from "@mui/material";
import { motion, Variants } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import ProductHeader from '../components/ProductHeader';
import BlockchainArchivalCard from "../components/signing/BlockchainArchivalCard";
import KeyGenerationCard from "../components/signing/KeyGenerationCard";
import DigitalSigningCard from "../components/signing/DigitalSigningCard";


import { authorizeToSign, getProductById } from "../services/productService";
import { Product } from "../models/Product";
import { useUserStore } from "../store/userStore";
import { ACCESS_MESSAGES } from "../constants/accessMessages";
import StatusUpdateCard from "../components/products/StatusUpdateCard";


const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.15, delayChildren: 0.1 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};


export default function ProductCryptoSigningPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useUserStore((s) => s.user);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);


  const loadProduct = useCallback(async () => {
    if (!id) {
      toast.error("Invalid product ID");
      navigate("/products");
      return;
    }
    setLoading(true);
    try {
      const result = await getProductById(id);
      if (result.error || !result.data) {
        toast.error(`Product not found`);
        navigate("/products");
        return;
      }
      setProduct(result.data);
    } catch (error) {
      toast.error("Failed to load product");
      navigate("/products");
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);


  useEffect(() => {
    loadProduct();
  }, [loadProduct]);



// Authorization and view‑only mode
const isAuthorized = product ? authorizeToSign(user, product) : false;
const isApproved = product?.status === "Approved";
const isRejected = product?.status === "Rejected";

const canSign = isAuthorized && isApproved;
const isViewOnlyMode = !isAuthorized || !isApproved || isRejected;

let tooltip = "";
if (isViewOnlyMode) {
  if (!isAuthorized) {
    tooltip = ACCESS_MESSAGES.RELEASE_ENGINEER_SIGN_MSG;
  } else if (isRejected) {
    tooltip = `Product is "${product?.status}". No further actions allowed.`;
  } else {
    // !isApproved (e.g. Pending, Signed, Released, anything but Approved)
    tooltip = `Product is "${product?.status}". Signing actions are not allowed at this stage.`;
  }
}


  const handleFolderSelect = async () => window.electronAPI?.selectFolder();
  const handleFileSelect = async () => window.electronAPI?.selectFile();

  if (loading || !product) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "50vh" }}>
        <CircularProgress />
      </Box>
    );
  }


  return (
    <Box sx={{ pt: 10, pb: 8, minHeight: "100vh", bgcolor: "background.default" }}>
      <Container maxWidth="lg">
        <motion.div variants={containerVariants} initial="hidden" animate="visible">

          {/* HEADER */}
          <motion.div variants={itemVariants}>
            <ProductHeader product={product} pageType="crypto" />
          </motion.div>

          {isViewOnlyMode && (
            <motion.div variants={itemVariants}>
              <Paper
                sx={{
                  p: 2,
                  mb: 3,
                  bgcolor: "rgba(255,193,7,0.1)",
                  border: "1px solid rgba(255,193,7,0.3)",
                }}
              >
                <Typography color="warning.main" fontWeight={600}>
                  View-Only Mode
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {tooltip}
                </Typography>
              </Paper>
            </motion.div>
          )}

          <Stack spacing={4}>
            <KeyGenerationCard
              disabled={!canSign || loading}
              borderColor="#00e5ff"
              onFolderSelect={handleFolderSelect}
              toolTip={tooltip}
            />

            {product.repos.map((repo, index) => (
              <DigitalSigningCard
                key={index}
                repoDetails={repo}
                isQuickScan={false}
                githubToken=""
                disabled={!canSign || loading}
                toolTip={tooltip}
                borderColor="#00e5ff"
                onFileSelect={handleFileSelect}
              />
            ))}

            <motion.div variants={itemVariants}>
              <BlockchainArchivalCard
                product={product}
                disabled={!canSign || loading}
                variants={itemVariants}
                toolTip={tooltip}
              />
            </motion.div>

            {/* Status Update Card */}
            <motion.div variants={itemVariants}>
              <StatusUpdateCard
                product={product}
                disabled={!canSign || loading}
                toolTip={tooltip}
                cardColor="#00e5ff"
                buttonText="Signed"
                confirmMessage="Are you sure you want to mark this product as Signed?"
                targetStatus="Signed"
                successMessage="✅ Product marked as Signed"
                onReload={loadProduct} 
                variants={itemVariants}
              />
            </motion.div>
          </Stack>
        </motion.div>
      </Container>
    </Box>
  );
}
