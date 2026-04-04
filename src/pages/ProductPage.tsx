import {
  Box,
  Button,
  Container,
  Typography,
  TextField,
  MenuItem,
  Stack,
  InputAdornment,
} from "@mui/material";
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";

import ProductCard from "../components/products/ProductCard";
import ProductDialog from "../components/products/ProductDialog";
import ConfirmDialog from "../components/ConfirmDialog";
import LoadingSpinner from "../components/LoadingSpinner";

import {
  getProductsPaginated,
  getOpenSourceProductsPaginated,
  deleteProduct,
  authorizeCreate,
} from "../services/productService";

import { checkStepAccess } from "../utils/workflowAccess";

import { Product } from "../models/Product";
import { useUserStore } from "../store/userStore";

import AddIcon from "@mui/icons-material/Add";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from '@mui/icons-material/Search';

const PAGE_SIZE = 6;

/**
 * ProductPage - Main products listing with pagination, search, filters
 * CENTRAL RBAC LOGIC - All authorization checks + confirmation popups live here
 * ProductCard handles visuals only. All business logic centralized here.
 */
export default function ProductPage() {
  const navigate = useNavigate();
  const user = useUserStore((s) => s.user);
  const isLicensedUser = user?.licenseValid;
  const canAddProject = authorizeCreate(user);

  /**
   * Backend pagination state from API response
   */
  const [productsData, setProductsData] = useState({
    items: [] as Product[],
    totalItems: 0,
    currentPage: 0,
    totalPages: 0,
    pageSize: 0,
    hasNext: false,
    hasPrevious: false,
  });

  /**
   * Loading and error states
   */
  const [loading, setLoading] = useState(false);
  const [_error, setError] = useState<string | null>(null);
  const [isBackendError, setIsBackendError] = useState(false);
  const [backendErrorShown, setBackendErrorShown] = useState(false);

  /**
   * UI Filter/Search states (client-side)
   */
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"All" | Product["status"]>("All");
  const [backendPage, setBackendPage] = useState(0);

  /**
   * Dialog states
   */
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"view" | "edit" | "create">("create");
  const [selected, setSelected] = useState<Product | null>(null);

  /**
   * Confirm dialog states for RBAC popups
   */
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | (() => void)>(null);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmDesc, setConfirmDesc] = useState("");

  /**
   * Loads products from backend API (paginated)
   * Handles licensed vs open-source product access
   */
  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (isLicensedUser) {
        const result = await getProductsPaginated(backendPage, PAGE_SIZE);
        if (!result.error) {
          setProductsData(result.data);
          setIsBackendError(false);
          setBackendErrorShown(false); // Reset on success
        } else {
          handleApiError(result.error);
        }
      } else {
        const result = await getOpenSourceProductsPaginated(backendPage, PAGE_SIZE);
        if (!result.error) {
          setProductsData(result.data);
          setIsBackendError(false);
          setBackendErrorShown(false); //  Reset on success
        } else {
          handleApiError(result.error);
        }
      }
    } catch (error: any) {
      console.error("Load products error:", error);
      const errorMsg = error.message || "Failed to load products";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [isLicensedUser, backendPage]);

  /**
   * Handles API errors with backend-offline detection
   */
  const handleApiError = (apiError: any) => {
    const errorMsg = apiError.message || "Unknown error";

    if (
      errorMsg.includes("ERR_CONNECTION_REFUSED") ||
      errorMsg.includes("Network Error") ||
      apiError.status === 0
    ) {
      if (!backendErrorShown) {
        setIsBackendError(true);
        setBackendErrorShown(true);
        toast("🔌 Backend offline", {
          duration: 6000,
          id: "backend-offline",
          style: { background: "#fff3cd", color: "#856404" },
        });
      }
    } else {
      setError(errorMsg);
      toast.error(errorMsg, { id: "general-error" });
    }
  };

  // Load products on mount
  useEffect(() => {
    loadProducts();
  }, []);

  // Reload on pagination change
  useEffect(() => {
    loadProducts();
  }, [backendPage]);

  /**
   * Refresh handler with toast feedback
   */
  const handleRefresh = useCallback(() => {
    setBackendPage(0);
    setBackendErrorShown(false);
    loadProducts();
  }, [loadProducts]);

  const handleRetry = () => {
    setError(null);
    setIsBackendError(false);
    loadProducts();
  };

  /**
   * Dialog handlers
   */
  function openCreate() {
    setDialogMode("create");
    setSelected(null);
    setDialogOpen(true);
  }

  function openView(p: Product) {
    setDialogMode("view");
    setSelected(p);
    setDialogOpen(true);
  }

  function openEdit(p: Product) {
    setDialogMode("edit");
    setSelected(p);
    setDialogOpen(true);
  }

  /**
   * Generic confirmation dialog executor
   * Used for ALL RBAC popups + delete confirmations
   */
  function confirmAndExec(title: string, desc: string, fn: () => void) {
    setConfirmTitle(title);
    setConfirmDesc(desc);
    setConfirmAction(() => () => {
      fn();
      setConfirmOpen(false);
    });
    setConfirmOpen(true);
  }

  /**
   * Delete product handler
   */
  const handleDelete = async (productId: string) => {
    const result = await deleteProduct(productId);
    if (!result.error) {
      toast.success("Product deleted successfully!");
      handleRefresh();
    } else {
      toast.error(result.error.message);
    }
  };

  /**
   * Navigation helper functions
   */
  function navigateToSecurityScan(productId: string) {
    navigate(`/product/${productId}/security-scan`);
  }

  function navigateToRelease(productId: string) {
    navigate(`/product/${productId}/releases`);
  }

  function navigateToCryptoSign(productId: string) {
    navigate(`/product/${productId}/cryptographic-signing`);
  }

  function navigateToSignatureVerify(productId: string) {
    navigate(`/product/${productId}/signature-verify`);
  }

//========================================== Access Validation =======================================
/**
 * Generic step click handler — delegates to workflowAccess utility.
 * Single source of truth for status + role checks.
 */
function openStepClick(p: Product, stepKey: string, navigateFn: () => void) {
  const access = checkStepAccess(stepKey, user, p);

  if (access.blocked) {
    // Hard block — show dialog, NO navigation
    confirmAndExec(access.title, access.message, () => {});
    return;
  }

  if (access.title) {
    // Role warning — show dialog, then navigate (view-only)
    confirmAndExec(access.title, access.message, navigateFn);
    return;
  }

  // Fully accessible — navigate directly
  navigateFn();
}

function openSecurityScanClick(p: Product) {
  openStepClick(p, "security-scan", () => navigateToSecurityScan(p.id));
}

function openReleaseWorkflowClick(p: Product) {
  openStepClick(p, "releases", () => navigateToRelease(p.id));
}

function openCryptoSignClick(p: Product) {
  openStepClick(p, "cryptographic-signing", () => navigateToCryptoSign(p.id));
}

function openSignatureVerifyClick(p: Product) {
  openStepClick(p, "signature-verify", () => navigateToSignatureVerify(p.id));
}

//========================================== Access Validation End =======================================

  /**
   * Pagination handlers
   */
  const handlePrevPage = () => {
    if (productsData.hasPrevious) {
      setBackendPage(productsData.currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (productsData.hasNext) {
      setBackendPage(productsData.currentPage + 1);
    }
  };

  /**
   * Client-side filtering for search + status filter
   */
  const filteredProducts = productsData.items.filter(
    (p) =>
      (filter === "All" || p.status === filter) &&
      p.name.toLowerCase().includes(search.toLowerCase())
  );

  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   *  UI
   * ═══════════════════════════════════════════════════════════════════════════════
   */
  return (
    <Box sx={{ pt: 8, pb: 6, minHeight: "80vh" }}>
      <Container maxWidth="xl">
        {/* PAGE HEADER */}
        <Typography variant="h4" textAlign="center" fontWeight={800} mb={3}>
          Product Distribution Pipeline
          {isLicensedUser && (
            <Typography variant="body2" color="text.secondary" mt={1}>
              (All Products)
            </Typography>
          )}
          {!isLicensedUser && (
            <Typography variant="body2" color="text.secondary" mt={1}>
              (Open Source Only)
            </Typography>
          )}
        </Typography>

        {/* FILTERS + CONTROLS */}
        <Stack direction="row" spacing={2} mb={4} alignItems="center" sx={{ flexWrap: "wrap", gap: 2 }}>
          <TextField
            select
            size="small"
            sx={{
              width: 220,
              minWidth: 220,
              height: 40,
              "& .MuiInputBase-root": { height: 40 }
            }}
            label="Status"
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
          >
            <MenuItem value="All">All Status</MenuItem>
            <MenuItem value="Pending">Pending</MenuItem>
            <MenuItem value="Approved">Approved</MenuItem>
            <MenuItem value="Rejected">Rejected</MenuItem>
            <MenuItem value="Released">Released</MenuItem>
            <MenuItem value="Signed">Signed</MenuItem>
          </TextField>

          <Box sx={{ flex: 1, minWidth: 300 }}>
            <TextField
              placeholder="Search products..."
              fullWidth
              size="small"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                )
              }}
              sx={{
                "& .MuiInputBase-root": { height: 40 }
              }}
            />
          </Box>

          <Box sx={{ display: "flex", gap: 1 }}>
            {canAddProject && (
              <Button
                startIcon={<AddIcon />}
                variant="contained"
                size="small"
                onClick={openCreate}
                sx={{
                  minWidth: 140,
                  height: 40,
                  background: "linear-gradient(135deg,#7b5cff,#5ce1e6)",
                  boxShadow: "0 4px 12px rgba(123, 92, 255, 0.3)",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                }}
              >
                Add Product
              </Button>
            )}
            <Button
              startIcon={<RefreshIcon />}
              variant="outlined"
              size="small"
              onClick={handleRefresh}
              sx={{
                minWidth: 120,
                height: 40,
                color: "#7b5cff",
                borderColor: "#7b5cff",
                fontWeight: 600,
                fontSize: "0.875rem",
                "&:hover": {
                  backgroundColor: "#7b5cff",
                  color: "white",
                  borderColor: "#7b5cff",
                },
              }}
            >
              Refresh
            </Button>
          </Box>
        </Stack>

        {/* LOADING STATE */}
        {loading && <LoadingSpinner message="Loading products..." />}

        {/* LICENSE WARNING */}
        {!loading && !isLicensedUser && (
          <Box sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            mb: 4,
            p: 3,
            bgcolor: "warning.lighter",
            border: "1px solid",
            borderColor: "warning.light",
            borderRadius: 2,
            mx: "auto"
          }}>
            <Typography variant="h6" fontWeight={600} color="warning.dark" gutterBottom>
              ⚠️ License Required
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
              License activation is required to access the proprietary product distribution pipeline, 
              although open source products remain fully accessible via our distribution pipeline.
            </Typography>
            <Button
              variant="contained"
              size="medium"
              sx={{
                background: "linear-gradient(135deg, #ff9800, #f57c00)",
                boxShadow: "0 4px 12px rgba(255,152,0,0.3)",
                fontWeight: 600,
                px: 3,
                "&:hover": {
                  background: "linear-gradient(135deg, #f57c00, #ef6c00)",
                  boxShadow: "0 6px 16px rgba(255,152,0,0.4)",
                  transform: "translateY(-1px)"
                }
              }}
              onClick={() => navigate("/license-activation")}
            >
              Activate License
            </Button>
          </Box>
        )}

        {/* BACKEND ERROR STATE */}
        {isBackendError && !loading && (
          <Box textAlign="center" py={6}>
            <Typography variant="h6" color="warning.main" mb={2}>
              🚨 Backend Server Offline
            </Typography>
            <Button
              variant="contained"
              startIcon={<RefreshIcon />}
              onClick={handleRetry}
            >
              🔄 Retry
            </Button>
          </Box>
        )}

        {/* PRODUCTS GRID */}
        {!loading && !isBackendError && (
          <Box sx={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 3,
            minHeight: "300px"
          }}>
            {filteredProducts.length === 0 ? (
              <Box sx={{
                gridColumn: "1 / -1",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                py: 8,
                gap: 1,
              }}>
                <Typography
                  variant="h6"
                  fontWeight={600}
                  color="text.secondary"
                  sx={{ mb: 1 }}
                >
                  No products found!
                </Typography>
                <Typography variant="body2" color="text.disabled">
                  Try adjusting your search or filters
                </Typography>
              </Box>
            ) : (
              filteredProducts.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  onView={() => openView(p)}
                  onEdit={() => openEdit(p)}
                  onDelete={() => confirmAndExec(
                    "Delete product",
                    "Are you sure you want to delete this product?",
                    () => handleDelete(p.id)
                  )}
                  onSecurityScan={() => openSecurityScanClick(p)}
                  onRelease={() => openReleaseWorkflowClick(p)}
                  onCryptographicSign={() => openCryptoSignClick(p)}
                  onSignatureVerify={() => openSignatureVerifyClick(p)}
                />
              ))
            )}
          </Box>
        )}

        {/* PAGINATION */}
        {!loading && productsData.items.length > 0 && (
          <Stack direction="row" justifyContent="center" spacing={2} mt={4}>
            <Button disabled={!productsData.hasPrevious} onClick={handlePrevPage}>
              Prev
            </Button>
            <Typography sx={{ pt: 1 }}>
              Page {productsData.currentPage + 1} of {productsData.totalPages}
              ({productsData.totalItems} total)
            </Typography>
            <Button disabled={!productsData.hasNext} onClick={handleNextPage}>
              Next
            </Button>
          </Stack>
        )}
      </Container>

      {/* PRODUCT DIALOG */}
      <ProductDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        product={selected ?? undefined}
        mode={dialogMode}
        refresh={handleRefresh}
      />

      {/* CONFIRMATION DIALOG - Used for ALL RBAC popups */}
      <ConfirmDialog
        open={confirmOpen}
        title={confirmTitle}
        description={confirmDesc}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          if (confirmAction) confirmAction();
        }}
      />
    </Box>
  );
}
