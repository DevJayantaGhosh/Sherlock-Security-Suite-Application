import {
  Box,
  Button,
  Container,
  Typography,
  TextField,
  MenuItem,
  Stack,
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
  authorizeApprove,
  authorizeRelease,
} from "../services/productService";

import { Product } from "../models/Product";
import { useUserStore } from "../store/userStore";

import AddIcon from "@mui/icons-material/Add";
import RefreshIcon from "@mui/icons-material/Refresh";

const PAGE_SIZE = 6;

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * STATE MANAGEMENT
 * ═══════════════════════════════════════════════════════════════════════════════
 */
export default function ProductPage() {
  const navigate = useNavigate();
  const user = useUserStore((s) => s.user);
  const isLicensedUser = user?.licenseValid;

  // Backend pagination
  const [productsData, setProductsData] = useState({
    items: [] as Product[],
    totalItems: 0,
    currentPage: 0,
    totalPages: 0,
    pageSize: 0,
    hasNext: false,
    hasPrevious: false,
  });

  // Error & Backend states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBackendError, setIsBackendError] = useState(false);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"All" | Product["status"]>("All");
  const [backendPage, setBackendPage] = useState(0);

  // Dialog states 
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"view" | "edit" | "create">("create");
  const [selected, setSelected] = useState<Product | null>(null);

  // Confirm dialog states 
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | (() => void)>(null);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmDesc, setConfirmDesc] = useState("");

  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   *  LOAD PRODUCTS 
   * ═══════════════════════════════════════════════════════════════════════════════
   */
  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIsBackendError(false);

    try {
      if (isLicensedUser) {
        const result = await getProductsPaginated(backendPage, PAGE_SIZE);
        if (!result.error) {
          setProductsData(result.data);
          //SILENT LOAD - No toast on initial/pagination
        } else {
          handleApiError(result.error);
        }
      } else {
        const result = await getOpenSourceProductsPaginated(backendPage, PAGE_SIZE);
        if (!result.error) {
          setProductsData(result.data);
          // SILENT LOAD - No toast on initial/pagination
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

  // Error handler
  const handleApiError = (apiError: any) => {
    const errorMsg = apiError.message || "Unknown error";

    if (
      errorMsg.includes("ERR_CONNECTION_REFUSED") ||
      errorMsg.includes("Network Error") ||
      apiError.status === 0
    ) {
      setIsBackendError(true);
      toast("🔌 Backend offline", {
        duration: 5000,
        style: {
          background: "#fff3cd",
          color: "#856404",
        },
      });
    } else {
      setError(errorMsg);
      toast.error(errorMsg);
    }
  };


  // Initial load - runs ONCE on mount only
  useEffect(() => {
    loadProducts();
  }, []); // Empty deps = ONCE only

  // Pagination + licensed user changes
  useEffect(() => {
    loadProducts();
  }, [isLicensedUser, backendPage]); //  Only when these change

  // Refresh WITH toast
  const handleRefresh = useCallback(() => {
    setBackendPage(0);
    loadProducts();
  }, [loadProducts]);

  // Retry
  const handleRetry = () => {
    setError(null);
    setIsBackendError(false);
    loadProducts();
  };

  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   *  ALL HANDLERS
   * ═══════════════════════════════════════════════════════════════════════════════
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

  function confirmAndExec(title: string, desc: string, fn: () => void) {
    setConfirmTitle(title);
    setConfirmDesc(desc);
    setConfirmAction(() => () => {
      fn();
      setConfirmOpen(false);
    });
    setConfirmOpen(true);
  }

  // Delete with proper toast
  const handleDelete = async (productId: string) => {
    const result = await deleteProduct(productId);
    if (!result.error) {
      toast.success("Product deleted successfully!");
      handleRefresh();
    } else {
      toast.error(result.error.message);
    }
  };

  function navigateToSecurityScan(productId: string) {
    navigate(`/product/${productId}/security-scan`);
  }

  function navigateToCryptoSign(productId: string) {
    navigate(`/product/${productId}/cryptographic-signing`);
  }

  function navigateToRelease(productId: string) {
    navigate(`/product/${productId}/releases`);
  }

  function navigateToSignatureVerify(productId: string) {
    navigate(`/product/${productId}/signature-verify`);
  }

  function openSecurityScanClick(p: Product) {
    const canScan = authorizeApprove(user, p);
    if (!canScan) {
      confirmAndExec(
        "Restricted Access",
        "You can view this page but are not authorized to run security scans or approve/reject.",
        () => navigateToSecurityScan(p.id)
      );
    } else {
      navigateToSecurityScan(p.id);
    }
  }

  function openCryptoSignClick(p: Product) {
    const canSign = authorizeRelease(user, p);
    if (!canSign) {
      confirmAndExec(
        "Restricted Access",
        "You do not have permission to digitally sign artifacts.",
        () => navigateToCryptoSign(p.id)
      );
    } else {
      navigateToCryptoSign(p.id);
    }
  }

  function openReleaseWorkflowClick(p: Product) {
    const canRelease = authorizeRelease(user, p);
    if (p.status !== "Approved") {
      confirmAndExec(
        "Release Restricted",
        "Product is not yet Approved!",
        () => navigateToRelease(p.id)
      );
      return;
    }

    if (!canRelease) {
      confirmAndExec(
        "Restricted Access",
        "You can view this page but are not authorized to make release.",
        () => navigateToRelease(p.id)
      );
    } else {
      navigateToRelease(p.id);
    }
  }

  function openSignatureVerifyClick(p: Product) {
    if (p.status !== "Released") {
      confirmAndExec(
        "Signature Verification Restricted",
        "Product must be 'Released' before signatures can be verified.",
        () => navigateToSignatureVerify(p.id)
      );
      return;
    }
    navigateToSignatureVerify(p.id);
  }

  // Pagination 
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

  // Filter products (client-side)
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
        {/* HEADER */}
        <Typography variant="h4" textAlign="center" fontWeight={800} mb={3}>
          Product Dashboard
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

        {/* FILTERS + BUTTONS */}
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
            <MenuItem value="Pending">⏳ Pending</MenuItem>
            <MenuItem value="Approved"> Approved</MenuItem>
            <MenuItem value="Rejected">❌ Rejected</MenuItem>
            <MenuItem value="Released">🚀 Released</MenuItem>
          </TextField>

          <Box sx={{ flex: 1, minWidth: 300 }}>
            <TextField
              placeholder="🔍 Search products..."
              fullWidth
              size="small"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{
                "& .MuiInputBase-root": { height: 40 }
              }}
            />
          </Box>

          {isLicensedUser && (
            <Box sx={{ display: "flex", gap: 1 }}>
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
          )}
        </Stack>

        {/* LOADING */}
        {loading && <LoadingSpinner message="Loading products..." />}

        {/* BACKEND ERROR */}
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
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 3 }}>
            {filteredProducts.length === 0 ? (
              <Typography variant="h6" textAlign="center" py={8} color="text.secondary">
                No products found matching your criteria
              </Typography>
            ) : (
              filteredProducts.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  onView={() => openView(p)}
                  onEdit={() => openEdit(p)}
                  onDelete={() => confirmAndExec(
                    "Delete product",
                    "Are you sure you want to remove this product?",
                    () => handleDelete(p.id)
                  )}
                  onSecurityScan={() => openSecurityScanClick(p)}
                  onCryptographicSign={() => openCryptoSignClick(p)}
                  onRelease={() => openReleaseWorkflowClick(p)}
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

      {/* DIALOGS */}
      <ProductDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        product={selected ?? undefined}
        mode={dialogMode}
        refresh={handleRefresh}
      />

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
