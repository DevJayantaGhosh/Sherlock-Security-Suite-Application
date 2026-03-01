import { useEffect, useState, useCallback } from "react";
import {
  Box, Button, Container, Paper, Stack,
  Typography, Dialog, DialogTitle,
  DialogContent, DialogActions,
  Tooltip, Divider, CircularProgress,
  Chip, Alert,
} from "@mui/material";
import { toast } from "react-hot-toast";
import { useNavigate, useParams, useLocation } from "react-router-dom";

import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import RefreshIcon from "@mui/icons-material/Refresh";

import ProductHeader from '../components/ProductHeader';
import { useUserStore } from "../store/userStore";
import { authorizeApprove, getProductById, updateProduct } from "../services/productService";
import RepoScanAccordion from "../components/security/RepoScanAccordion";
import DependencyAudit from "../components/security/DependencyAudit";
import { Product, RepoDetails, ProductStatus } from "../models/Product";
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
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useUserStore(s => s.user);

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [wallet, setWallet] = useState<string | null>(null);
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Load product using getProductById(id)
  const loadProduct = useCallback(async () => {
    if (!id) {
      toast.error("Invalid product ID", { id: "invalid-product-id" });
      navigate("/products");
      return;
    }

    setLoading(true);
    console.log("[SECURITY SCAN PAGE] Loading product:", id);

    try {
      const result = await getProductById(id);
      if (result.error || !result.data) {
        toast.error(`Product not found: ${result.error?.message || "Unknown error"}`, { 
          id: "product-load-error" 
        });
        navigate("/products");
        return;
      }

      setProduct(result.data);
    } catch (error) {
      toast.error("Failed to load product", { id: "product-load-failed" });
      navigate("/products");
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

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

  // Save repo updates using updateProduct(id, partial)
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
      const result = await updateProduct(product.id, payload);
      if (result.error) {
        toast.error("Saved locally but backend sync failed", { 
          id: "repo-sync-warning", 
          duration: 4000 
        });
      } else {
        setProduct(result.data);
        toast.success("Scan results saved to database", { 
          id: "repo-sync-success", 
          duration: 2500 
        });
      }
    } catch (error) {
      toast.error("Failed to sync with backend", { id: "repo-sync-error" });
    } finally {
      setSaving(false);
      console.groupEnd();
    }
  };

  // Wallet connection (keeping your exact UX)
  async function connectWallet() {
    if (!(window as any).ethereum) {
      toast.error("MetaMask not installed");
      return;
    }

    try {
      const accounts = await (window as any).ethereum.request({
        method: "eth_requestAccounts",
      });
      setWallet(accounts[0]);
      toast.success(`Connected: ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}`, {
        id: "wallet-connected",
        duration: 4000
      });
    } catch (err) {
      toast.error("Wallet connection rejected");
      console.error("[WALLET] Connection error:", err);
    }
  }

  // Authorization check and View-OnlyMode
  const isAuthorized = product ? authorizeApprove(user, product) : false;
  const isViewOnlyMode = product?.status !== "Pending" || !isAuthorized;

const tooltip = isViewOnlyMode 
  ? (product?.status !== "Pending" 
      ? `Product status is "${product?.status}". No actions allowed.`
      : ACCESS_MESSAGES.SECURITY_HEAD_MSG)
  : "";

  // Decision handlers
  function handleDecision(type: "approve" | "reject") {
    if (!isAuthorized) {
      toast.error("Only Security-Head/Admin can approve/reject");
      return;
    }
    if (!wallet) {
      toast.error("Please connect wallet first");
      return;
    }
    setDecision(type);
    setConfirmOpen(true);
  }

  // Confirm decision
  async function confirmDecision() {
    if (!product || !decision || !wallet) return;

    setSaving(true);
    // TODO: Implement blockchain transaction
    
    try {
      const status: ProductStatus = decision === "approve" ? "Approved" : "Rejected";
      
      const payload: Partial<Product> = {
        status,
        remark: `Security decision recorded by wallet ${wallet.slice(0, 10)}... on ${new Date().toISOString()}`,
        updatedAt: new Date().toISOString()
      };

      const result = await updateProduct(product.id, payload);
      
      if (result.error) {
        toast.error(`Failed to save ${decision.toUpperCase()} decision`);
        return;
      }

      toast.success(`Product ${decision.toUpperCase()}D successfully`, {
        id: "decision-success",
        duration: 5000
      });

      setTimeout(() => {
        navigate("/products");
      }, 2000);

    } catch (error) {
      toast.error("Decision processing failed");
    } finally {
      setConfirmOpen(false);
      setSaving(false);
    }
  }

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
          {!isAuthorized && (
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
                     {ACCESS_MESSAGES.SECURITY_HEAD_MSG}
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
                  disabled={!isAuthorized || saving || product.status !== "Pending"} 
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
                <motion.div variants={buttonGroupVariants} initial="hidden" animate="visible">
                  <Tooltip title={tooltip} arrow>
                    <span>
                      <Button
                        startIcon={<AccountBalanceWalletIcon />}
                        onClick={connectWallet}
                        disabled={!isAuthorized || saving}
                        variant="outlined"
                        size="large"
                        sx={{
                          minWidth: 250,
                          borderWidth: 2,
                          "&:hover": { borderWidth: 2 },
                        }}
                      >
                        {wallet
                          ? `Wallet: ${wallet.slice(0, 6)}...${wallet.slice(-4)}`
                          : "Connect MetaMask"
                        }
                      </Button>
                    </span>
                  </Tooltip>
                </motion.div>

                <motion.div variants={buttonGroupVariants} initial="hidden" animate="visible">
                  <Stack direction="row" spacing={3}>
                    <Tooltip title={tooltip} arrow>
                      <span>
                        <Button
                          color="success"
                          startIcon={<CheckCircleIcon />}
                          variant="contained"
                          disabled={!wallet || !isAuthorized || saving}
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
                          disabled={!wallet || !isAuthorized || saving}
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
          onClose={() => !saving && setConfirmOpen(false)}
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
              This decision is permanent and will be visible to all stakeholders.
            </Typography>
          </DialogContent>

          <DialogActions sx={{ p: 2, bgcolor: "#2d2d2d", borderTop: "1px solid #404040" }}>
            <Button onClick={() => setConfirmOpen(false)} disabled={saving}>Cancel</Button>
            <Button
              disabled={!wallet || saving}
              variant="contained"
              onClick={confirmDecision}
              color={decision === "approve" ? "success" : "error"}
              sx={{ fontWeight: 700 }}
            >
              {saving ? (
                <>
                  <CircularProgress size={20} sx={{ mr: 1, color: "white" }} />
                  Processing...
                </>
              ) : (
                `Confirm ${decision === "approve" ? "Approval" : "Rejection"}`
              )}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
}
