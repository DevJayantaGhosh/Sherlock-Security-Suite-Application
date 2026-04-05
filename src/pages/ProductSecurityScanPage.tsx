import { useEffect, useState, useCallback } from "react";
import {
  Box, Button, Container, Paper, Stack,
  Typography, Divider, CircularProgress, Alert,
} from "@mui/material";
import { useNavigate, useParams, useLocation } from "react-router-dom";

import RefreshIcon from "@mui/icons-material/Refresh";

import ProductHeader from '../components/products/ProductHeader';
import { useToast } from "../components/ToastProvider";
import { useUserStore } from "../store/userStore";
import { authorizeApprove, getProductById, updateProduct } from "../services/productService";
import RepoScanAccordion from "../components/security/RepoScanAccordion";
import BlockchainInscriptionCard from "../components/blockchain/BlockchainInscriptionCard";
import ProductWorkflowNav from "../components/products/ProductWorkflowNav";
import { Product, RepoDetails } from "../models/Product";
import { motion, Variants } from "framer-motion";
import { ACCESS_MESSAGES } from "../constants/accessMessages";

// Animation variants (keeping your exact style)
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { 
    opacity: 0, 
    y: 20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.4, 0, 0.2, 1],
    },
  },
};

const headerVariants: Variants = {
  hidden: { 
    opacity: 0, 
    y: -30,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.4, 0, 0.2, 1],
    },
  },
};

export default function ProductSecurityScanPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useUserStore(s => s.user);
  const toast = useToast();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load product using getProductById(id)
  const loadProduct = useCallback(async () => {
    if (!id) {
      toast("Invalid product ID", "error");
      navigate("/products");
      return;
    }

    setLoading(true);
    console.log("[SECURITY SCAN PAGE] Loading product:", id);

    try {
      const result = await getProductById(id);
      if (result.error || !result.data) {
        toast(`Product not found: ${result.error?.message || "Unknown error"}`, "error");
        navigate("/products");
        return;
      }

      setProduct(result.data);
    } catch (error) {
      toast("Failed to load product", "error");
      navigate("/products");
    } finally {
      setLoading(false);
    }
  }, [id, navigate, toast]);

  // Load on mount + scroll to top
  useEffect(() => {
    loadProduct();
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [loadProduct]);

  // Cleanup on route change
  useEffect(() => {
    return () => {
      console.log("[SECURITY SCAN PAGE] Route changing from:", location.pathname);
    };
  }, [location.pathname]);

  // Save repo updates using updateProduct(product)
  const handleRepoUpdate = async (repoIndex: number, updatedRepo: RepoDetails) => {
    if (!product) return;

    console.group("[Repo Update Debug]");
    console.log(`Updating Repo at Index [${repoIndex}]`);
    console.log("New Repo Details:", updatedRepo);

    setSaving(true);
    
    // Optimistic update
    const updatedRepos = [...product.repos];
    updatedRepos[repoIndex] = updatedRepo;
    
    const payload: Partial<Product> = {
      repos: updatedRepos,
      updatedAt: new Date().toISOString()
    };

    try {
      const result = await updateProduct({ ...product, ...payload });
      if (result.error) {
        toast("Scan results saved to database failed", "warning");
      } else {
        setProduct(result.data);
        toast("Scan results saved to database", "success");
      }
    } catch (error) {
      toast("Failed to sync with backend", "error");
    } finally {
      setSaving(false);
      console.groupEnd();
    }
  };

// Authorization and view‑only mode
const isAuthorized = product ? authorizeApprove(user, product) : false;
const isPending = product?.status === "Pending";
const isRejected = product?.status === "Rejected";

const canScan = isAuthorized && isPending;
const isViewOnlyMode = !isAuthorized || !isPending || isRejected;

let tooltip = "";
if (isViewOnlyMode) {
  if (!isAuthorized) {
    tooltip = ACCESS_MESSAGES.SECURITY_HEAD_MSG;
  } else if (isRejected) {
    tooltip = `Product is "${product?.status}". No further actions allowed.`;
  } else {
    // !isPending (Approved, Signed, Released, etc.)
    tooltip = `Product is "${product?.status}". Security scan has already been completed.`;
  }
}

  // Blockchain inscription callback — fires after BlockchainInscriptionCard
  // has already inscribed on-chain AND updated the product in the DB.
  // Stay on the page and refresh product details to reflect the new status.
  const handleBlockchainDecision = async (status: "Approved" | "Rejected", _remark: string) => {
    toast(`Product ${status} — decision permanently inscribed on Hedera Hashgraph`, "success");

    // Reload the product to reflect the updated status, scan report URL, etc.
    try {
      const result = await getProductById(product?.id || id || "");
      if (result.data) {
        setProduct(result.data);
      }
    } catch {
      // Silently ignore — the inscription already succeeded
    }
  };

  // Loading state
  if (loading) {
    return (
      <Box sx={{ pt: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <CircularProgress size={40} />
        <Typography sx={{ mt: 2, color: "text.secondary" }}>Loading security scan...</Typography>
        <Button onClick={loadProduct} startIcon={<RefreshIcon />} sx={{ mt: 2 }} variant="outlined">
          Retry
        </Button>
      </Box>
    );
  }

  if (!product) {
    return (
      <Box sx={{ pt: 10, display: "flex", justifyContent: "center" }}>
        <Typography color="error">Product not found</Typography>
        <Button onClick={loadProduct} startIcon={<RefreshIcon />} sx={{ mt: 2 }} variant="outlined">
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ pt: 10, pb: 8, minHeight: "100vh" }}>
      <Container maxWidth="lg">
        <motion.div variants={containerVariants} initial="hidden" animate="visible">
          {/* Product Header */}
          <motion.div variants={headerVariants}>
            <ProductHeader product={product} pageType="security" />
          </motion.div>

          {/* Authorization Warning */}
          {isViewOnlyMode && (
            <motion.div variants={itemVariants}>
              <Paper sx={{
                p: 2,
                mb: 3,
                bgcolor: "rgba(255,193,7,0.1)",
                border: "1px solid rgba(255,193,7,0.3)",
              }}>
                <Typography color="warning.main" fontWeight={600}>
                  View-Only Mode
                </Typography>
                <Typography variant="body2" color="text.secondary">
                     {tooltip}
                </Typography>
              </Paper>
            </motion.div>
          )}

          {/* Scans Header */}
          <motion.div variants={itemVariants}>
            <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>
              Repository Security Scans
            </Typography>
            {saving && (
              <Alert severity="info" sx={{ mb: 3 }}>
                Saving scan results...
              </Alert>
            )}
          </motion.div>

          {/* Scans List */}
          <Stack spacing={3}>
            {product.repos.map((repo, idx) => (
              <motion.div key={`${repo.repoUrl}-${idx}`} variants={itemVariants}>
                <RepoScanAccordion
                  product={product}
                  repoDetails={repo}
                  // Pass the update handler to bubble up changes
                  onRepoUpdate={(updatedRepo) => handleRepoUpdate(idx, updatedRepo)}
                  disabled={!canScan ||saving} 
                  isQuickScan={false} 
                  githubToken={""}                />
                {idx < product.repos.length - 1 && (
                  <Divider sx={{ 
                    my: 3, 
                    mx: -2, 
                    py: 1,
                    borderStyle: 'dashed',
                    borderColor: 'grey.300',
                    borderWidth: '2px'
                  }}>
                    <Typography variant="caption" color="text.secondary">
                      NEXT REPO
                    </Typography>
                  </Divider>
                )}
              </motion.div>
            ))}
          </Stack>



          {/* Blockchain Inscription — SCAN Step */}
          <motion.div variants={itemVariants}>
            <Box sx={{ mt: 4 }}>
              <BlockchainInscriptionCard
                variants={itemVariants}
                product={product}
                disabled={isViewOnlyMode || saving}
                toolTip={tooltip}
                step="SCAN"
                onStatusDecision={handleBlockchainDecision}
              />
            </Box>
          </motion.div>

          {/* Workflow Navigation */}
          <motion.div variants={itemVariants}>
            <ProductWorkflowNav
              currentStep="security-scan"
              product={product}
              accentColor="#ff9800"
            />
          </motion.div>
        </motion.div>
      </Container>
    </Box>
  );
}
