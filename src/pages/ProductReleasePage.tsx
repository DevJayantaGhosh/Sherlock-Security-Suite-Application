// ProductReleasePage.tsx
import { useEffect, useState, useCallback } from "react";
import { Box, Container, Typography, Button, CircularProgress } from "@mui/material";
import { motion, Variants } from "framer-motion";
import { toast } from "react-hot-toast";
import { useParams, useNavigate } from "react-router-dom";
import ProductHeader from '../components/products/ProductHeader';
import { authorizeRelease, getProductById } from "../services/productService";
import { Product } from "../models/Product";
import { useUserStore } from "../store/userStore";
import ProductReleaseCard from "../components/productrelease/ProductReleaseCard";
import BlockchainInscriptionCard from "../components/blockchain/BlockchainInscriptionCard";
import ProductWorkflowNav from "../components/products/ProductWorkflowNav";

import { ACCESS_MESSAGES } from "../constants/accessMessages";

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function ProductReleasePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useUserStore((state) => state.user);
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
        toast.error(`Product not found: ${result.error?.message || "Unknown error"}`);
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
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [loadProduct]);

  // Authorization and view‑only mode
  const isAuthorized = product ? authorizeRelease(user, product) : false;
  const isApproved = product?.status === "Approved";
  const isRejected = product?.status === "Rejected";
  const isReleased = product?.status === "Released";

  // GitHub Release — requires Approved status (flow: Scan → Release → Sign → Verify)
  const canRelease = isAuthorized && isApproved;

  let releaseTooltip = "";
  if (!isAuthorized) {
    releaseTooltip = ACCESS_MESSAGES.RELEASE_ENGINEER_RELEASE_MSG;
  } else if (isRejected) {
    releaseTooltip = `Product is "${product?.status}". No further actions allowed.`;
  } else if (isReleased) {
    releaseTooltip = "Product already released.";
  } else if (!isApproved) {
    releaseTooltip = `Product is "${product?.status}". Must be "Approved" before Release.`;
  }

  // Blockchain inscription — only after GitHub release is done
  const canInscribe = isAuthorized && isReleased;
  let blockchainTooltip = "";
  if (!isAuthorized) {
    blockchainTooltip = ACCESS_MESSAGES.RELEASE_ENGINEER_RELEASE_MSG;
  } else if (isRejected) {
    blockchainTooltip = `Product is "${product?.status}". No further actions allowed.`;
  } else if (!isReleased) {
    blockchainTooltip = `Product must be "Released" on GitHub before blockchain inscription.`;
  }

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "50vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!product) {
    return (
      <Container maxWidth="lg" sx={{ pt: 10, minHeight: "50vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Box sx={{ p: 4, textAlign: "center" }}>
          <Typography color="text.secondary" mb={2}>Product not found</Typography>
          <Button variant="contained" onClick={() => navigate("/products")}>Go to Products</Button>
        </Box>
      </Container>
    );
  }

  return (
    <Box sx={{ pt: 10, pb: 8, minHeight: "100vh", bgcolor: "background.default" }}>
      <Container maxWidth="lg">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <ProductHeader product={product} pageType="release" />

          {/* RELEASE CARD */}
          <ProductReleaseCard
            product={product}
            borderColor="#7b5cff"
            disabled={!canRelease || loading}
            tooltipTitle={releaseTooltip}
            tooltipSingleTitle={releaseTooltip}
            tooltipBatchTitle={releaseTooltip}
            onReleaseComplete={() => loadProduct()}
          />

          {/* Blockchain Inscription — only enabled after GitHub release is done */}
          <BlockchainInscriptionCard
            product={product}
            disabled={!canInscribe || loading}
            variants={itemVariants}
            toolTip={blockchainTooltip}
            stage="RELEASE"
            onStatusDecision={() => loadProduct()}
          />

          {/* Workflow Navigation */}
          <ProductWorkflowNav
            currentStep="releases"
            product={product}
            accentColor="#7b5cff"
          />

        </motion.div>
      </Container>
    </Box>
  );
}