// src/pages/ProductSignatureVerificationPage.tsx
import { useState, useCallback, useEffect } from "react";
import { Box, Container, CircularProgress, Paper, Typography, Button } from "@mui/material";
import { motion } from "framer-motion";
import ProductHeader from "../components/products/ProductHeader";
import ProductSignatureVerificationCard from "../components/verification/ProductSignatureVerificationCard";
import { getProductById } from "../services/productService";
import { Product } from "../models/Product";
import { toast } from "react-hot-toast";
import { useParams, useNavigate } from "react-router-dom";

interface ProductRepoDetails {
  repoUrl: string;
  branch: string;
  releaseTag?: string;
  isLocal: false;
}

export default function ProductSignatureVerificationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [product, setProduct] = useState<Product | null>(null);
  const [repoDetailsList, setRepoDetailsList] = useState<ProductRepoDetails[]>([]);
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
        toast.error("Product not found");
        navigate("/products");
        return;
      }

      const productData = result.data;
      setProduct(productData);

      // Transform product.repos → ProductRepoDetails[]
      const detailsList: ProductRepoDetails[] = productData.repos.map((repo: any) => ({
        repoUrl: repo.repoUrl,
        branch: repo.branch,
        releaseTag: `v${productData.version}`,
        isLocal: false
      }));

      setRepoDetailsList(detailsList);
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

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "50vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!product || repoDetailsList.length === 0) {
    return (
      <Container maxWidth="lg" sx={{ pt: 10, minHeight: "50vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Paper sx={{ p: 4, textAlign: "center" }}>
          <Typography color="text.secondary" mb={2}>Product not found</Typography>
          <Button variant="contained" onClick={() => navigate("/products")}>Go to Products</Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Box sx={{ pt: 10, pb: 8, minHeight: "100vh", bgcolor: "background.default" }}>
      <Container maxWidth="lg">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <ProductHeader product={product} pageType="verify" />

          <ProductSignatureVerificationCard
            repoDetailsList={repoDetailsList}
            productName={product.name}  // ✅ Add this
            productVersion={product.version}
            githubToken=""
            borderColor="#4caf50"
            savedPublicKeyPath={product.publicKeyFilePath}
            savedSignaturePath={product.signatureFilePath}
          />

        </motion.div>
      </Container>
    </Box>
  );
}
