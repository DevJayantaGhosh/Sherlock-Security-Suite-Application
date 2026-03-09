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

import { ACCESS_MESSAGES } from "../constants/accessMessages";
import StatusUpdateCard from "../components/products/StatusUpdateCard";

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
  const isSigned = product?.status === "Signed";
  const isRejected = product?.status === "Rejected";

  const canRelease = isAuthorized && isSigned;
  const isViewOnlyMode =
    !isAuthorized || !isSigned || isRejected;

  let tooltip = "";
  if (isViewOnlyMode) {
    if (!isAuthorized) {
      tooltip = ACCESS_MESSAGES.RELEASE_ENGINEER_SIGN_MSG;
    } else if (isRejected) {
      tooltip = `Product is "${product?.status}". No further actions allowed.`;
    } else {
      // !isSigned (e.g. Pending, Approved, Released, any non‑Signed)
      tooltip = `Product is "${product?.status}". Must be "Signed" before Release.`;
    }
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
            tooltipTitle={tooltip}
            tooltipSingleTitle={tooltip}
            tooltipBatchTitle={tooltip}
          />

          {/* Status Update Card */}
          <motion.div variants={itemVariants}>
            <StatusUpdateCard
              product={product}
              disabled={!canRelease || loading}
              toolTip={tooltip}
              cardColor="#7b5cff"
              buttonText="Released"
              confirmMessage="Are you sure you want to mark this product as Released ?"
              targetStatus="Released"
              successMessage="✅ Product marked as Released"
              onReload={loadProduct}
              variants={itemVariants}
            />
          </motion.div>

        </motion.div>
      </Container>
    </Box>
  );
}
