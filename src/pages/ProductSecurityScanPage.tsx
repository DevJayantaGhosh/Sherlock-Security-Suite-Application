import { useEffect, useState } from "react";
import {
  Box, Button, Container, Paper, Stack,
  Typography, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions,
  Tooltip,
  Divider,
} from "@mui/material";

import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import SecurityIcon from "@mui/icons-material/Security";
import ProductHeader from '../components/ProductHeader';


import { useParams, useNavigate, useLocation } from "react-router-dom";
// ✅ IMPORT updateProduct to handle the MongoDB call
import { authorizeApprove, getProducts, updateProduct } from "../services/productService";
import { useUserStore } from "../store/userStore";

import RepoScanAccordion from "../components/security/RepoScanAccordion";
import DependencyAudit from "../components/security/DependencyAudit";

import { Product, RepoDetails } from "../models/Product";
import { motion, Variants } from "framer-motion";

// --- ANIMATION VARIANTS ---
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

const buttonGroupVariants: Variants = {
  hidden: { 
    opacity: 0, 
    scale: 0.9,
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: [0.4, 0, 0.2, 1],
      delay: 0.3,
    },
  },
};

export default function ProductSecurityScanPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useUserStore(s => s.user);

  const [product, setProduct] = useState<Product | null>(null);
  const [wallet, setWallet] = useState<string | null>(null);
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Load product
  useEffect(() => {
    console.log("[SECURITY SCAN PAGE] Loading product:", id);
    const p = getProducts().find(x => x.id === id);
    if (!p) {
      console.log("[SECURITY SCAN PAGE] Product not found, navigating away");
      navigate("/products");
    } else {
      setProduct(p);
    }
  }, [id, navigate]);

  // Scroll to top on mount
  useEffect(() => {
    console.log("[SECURITY SCAN PAGE] Mounted");
    window.scrollTo({ top: 0, behavior: "instant" });
    
    return () => {
      console.log("[SECURITY SCAN PAGE] Unmounting");
    };
  }, []);
  
    // Cleanup on route change
  useEffect(() => {
    return () => {
      console.log("[SECURITY SCAN PAGE] Route changing from:", location.pathname);
    };
  }, [location.pathname]);

  // ✅ HANDLER: Updates State & Calls DB Service
  const handleRepoUpdate = async (repoIndex: number, updatedRepo: RepoDetails) => {
    if (!product) return;

    console.group("🔄 [Repo Update Debug]");
    console.log("1. Previous Product State:", product);
    console.log(`2. Updating Repo at Index [${repoIndex}]`);
    console.log("3. New Repo Details:", updatedRepo);

    // 1. Create a safe copy of the repos array
    const updatedRepos = [...product.repos];
    updatedRepos[repoIndex] = updatedRepo;

    // 2. Create the new product object
    const updatedProduct = { 
      ...product, 
      repos: updatedRepos 
    };

    console.log("4. Final New Product (Sending to DB):", updatedProduct);
    console.groupEnd();

    // 3. Update Local State (Immediate UI feedback)
    setProduct(updatedProduct);

    // 4. Save to Backend/DB
    try {
      // Calls your service which should fire the API request to MongoDB
      await updateProduct(updatedProduct); 
      console.log(`✅ [DB SUCCESS] Saved scan results for repo ${repoIndex}`);
    } catch (error) {
      console.error("❌ [DB FAILURE] Failed to save scan results:", error);
    }
  };

  if (!product) {
    return (
      <Box sx={{ pt: 10, display: "flex", justifyContent: "center" }}>
        <Typography>Loading product...</Typography>
      </Box>
    );
  }

  // Auth
  const isAuthorized = authorizeApprove(user, product);
  const tooltip = isAuthorized
    ? ""
    : "You can view this page, but cannot perform any security review actions. Only the Product Director, Security Head, or Admin can approve/reject.";

  // Connect wallet
  async function connectWallet() {
    if (!(window as any).ethereum) {
      return alert("MetaMask not installed");
    }

    try {
      const accounts = await (window as any).ethereum.request({
        method: "eth_requestAccounts",
      });
      setWallet(accounts[0]);
    } catch (err) {
      console.error("[WALLET] Connection error:", err);
    }
  }

  // Handle decision
  function handleDecision(type: "approve" | "reject") {
    setDecision(type);
    setConfirmOpen(true);
  }

  // Confirm decision
  function confirmDecision() {
    console.log("✅ FINAL DECISION:", decision);
    console.log("🔐 WALLET:", wallet);
    console.log("📦 PRODUCT:", product?.id, product?.name);
    
    // TODO: Implement blockchain transaction
    // This would call a service to:
    // 1. Record decision on blockchain
    // 2. Update product status
    // 3. Notify stakeholders
    
    setConfirmOpen(false);
    
    // Navigate back after a short delay
    setTimeout(() => {
      navigate("/products");
    }, 1500);
  }

  return (
    <Box sx={{ pt: 10, pb: 8, minHeight: "100vh" }}>
      <Container maxWidth="lg">
        {/* Animated Container */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Product Header */}
          <motion.div variants={headerVariants}>
          <ProductHeader product={product} pageType="security" /> 
          </motion.div>

          {/* Authorization Warning */}
          {!isAuthorized && (
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
                  ⚠️ View-Only Mode
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  You can view security scans but cannot approve/reject. Only the assigned Security Head or Admin can make final decisions.
                </Typography>
              </Paper>
            </motion.div>
          )}

          {/* Scans Header */}
          <motion.div variants={itemVariants}>
            <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>
              Repository Security Scans
            </Typography>
          </motion.div>

          {/* Scans List */}
          <Stack spacing={3}>
            {product.repos.map((repo, idx) => (
              <motion.div
                key={`${repo.repoUrl}-${idx}`}
                variants={itemVariants}
              >
                <RepoScanAccordion
                  product={product}
                  repoDetails={repo}
                  // Pass the update handler to bubble up changes
                  onRepoUpdate={(updatedRepo) => handleRepoUpdate(idx, updatedRepo)}
                />

   {idx < product.repos.length - 1 && (
      <Divider 
        sx={{ 
          my: 3, 
          mx: -2, 
          py: 1,
          borderStyle: 'dashed',
          borderColor: 'grey.300',
          borderWidth: '2px'
        }} 
      >
        <Typography variant="caption" color="text.secondary">
          NEXT REPO
        </Typography>
      </Divider>
    )}
              </motion.div>
            ))}
          </Stack>

          {/* Dependency Audit */}
          <motion.div variants={itemVariants}>
            <DependencyAudit
              product={product}
              dependencies={product.dependencies ?? []}
            />
          </motion.div>

          {/* Final Decision */}
          <motion.div variants={itemVariants}>
            <Paper sx={{ mt: 6, p: 4, background: "linear-gradient(140deg,#0c1023,#090c1c)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <Typography variant="h6" fontWeight={700} textAlign="center" mb={3}>
                Security Review Decision
              </Typography>

              <Stack spacing={3} alignItems="center">
                <motion.div
                  variants={buttonGroupVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <Tooltip title={tooltip} arrow>
                    <span>
                      <Button
                        startIcon={<AccountBalanceWalletIcon />}
                        onClick={connectWallet}
                        disabled={!isAuthorized}
                        variant="outlined"
                        size="large"
                        sx={{
                          minWidth: 250,
                          borderWidth: 2,
                          "&:hover": {
                            borderWidth: 2,
                          },
                        }}
                      >
                        {wallet
                          ? `Wallet: ${wallet.slice(0, 6)}...${wallet.slice(-4)}`
                          : "Connect MetaMask"}
                      </Button>
                    </span>
                  </Tooltip>
                </motion.div>

                <motion.div
                  variants={buttonGroupVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <Stack direction="row" spacing={3}>
                    <Tooltip title={tooltip} arrow>
                      <span>
                        <Button
                          color="success"
                          startIcon={<CheckCircleIcon />}
                          variant="contained"
                          disabled={!wallet || !isAuthorized}
                          onClick={() => handleDecision("approve")}
                          size="large"
                          sx={{
                            minWidth: 180,
                            py: 1.5,
                            fontSize: 16,
                            fontWeight: 700,
                          }}
                        >
                          Approve
                        </Button>
                      </span>
                    </Tooltip>

                    <Tooltip title={tooltip} arrow>
                      <span>
                        <Button
                          color="error"
                          startIcon={<CancelIcon />}
                          variant="contained"
                          disabled={!wallet || !isAuthorized}
                          onClick={() => handleDecision("reject")}
                          size="large"
                          sx={{
                            minWidth: 180,
                            py: 1.5,
                            fontSize: 16,
                            fontWeight: 700,
                          }}
                        >
                          Reject
                        </Button>
                      </span>
                    </Tooltip>
                  </Stack>
                </motion.div>

                {wallet && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                  >
                    <Typography variant="caption" color="text.secondary" textAlign="center">
                      Your decision will be recorded on the blockchain and cannot be reverted.
                    </Typography>
                  </motion.div>
                )}
              </Stack>
            </Paper>
          </motion.div>
        </motion.div>

        {/* Confirmation Dialog */}
        <Dialog 
          open={confirmOpen} 
          onClose={() => setConfirmOpen(false)}
          PaperProps={{
            sx: {
              bgcolor: "#1e1e1e",
              backgroundImage: "none",
            },
          }}
        >
          <DialogTitle sx={{ bgcolor: "#2d2d2d", borderBottom: "1px solid #404040" }}>
            <Typography variant="h6" fontWeight={700}>
              Confirm Security Decision
            </Typography>
          </DialogTitle>

          <DialogContent sx={{ pt: 3 }}>
            <Typography variant="body1" sx={{ mb: 2 }}>
              Are you sure you want to <strong style={{ color: decision === "approve" ? "#4caf50" : "#f44336" }}>{decision?.toUpperCase()}</strong> this product?
            </Typography>

            <Paper sx={{ p: 2, bgcolor: "rgba(255,255,255,0.05)", mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                <strong>Product:</strong> {product.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Version:</strong> {product.version}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Security Head:</strong> {product.securityHead}
              </Typography>
            </Paper>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              This action will be recorded on the blockchain using wallet:
            </Typography>
            <Paper sx={{ p: 1.5, bgcolor: "#0c1023", border: "1px solid rgba(255,255,255,0.1)" }}>
              <Typography variant="body2" fontFamily="monospace" sx={{ wordBreak: "break-all" }}>
                {wallet}
              </Typography>
            </Paper>

            <Typography variant="caption" color="warning.main" sx={{ mt: 2, display: "block" }}>
              ⚠️ This decision is permanent and will be visible to all stakeholders.
            </Typography>
          </DialogContent>

          <DialogActions sx={{ p: 2, bgcolor: "#2d2d2d", borderTop: "1px solid #404040" }}>
            <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button
              disabled={!wallet}
              variant="contained"
              onClick={confirmDecision}
              color={decision === "approve" ? "success" : "error"}
              sx={{ fontWeight: 700 }}
            >
              Confirm {decision === "approve" ? "Approval" : "Rejection"}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
}
