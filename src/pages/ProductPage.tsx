import {
  Box,
  Button,
  Container,
  Typography,
  TextField,
  MenuItem,
  Stack,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import ProductCard from "../components/products/ProductCard";
import ProductDialog from "../components/products/ProductDialog";
import ConfirmDialog from "../components/ConfirmDialog";

import {
  getProducts,
  deleteProduct,
  authorizeApprove,
  authorizeRelease,
} from "../services/productService";

import { Product } from "../models/Product";
import { useToast } from "../components/ToastProvider";

import AddIcon from "@mui/icons-material/Add";
import { useUserStore } from "../store/userStore";

const PAGE_SIZE = 6;

export default function ProductPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const user = useUserStore((s) => s.user);

  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"All" | Product["status"]>("All");
  const [page, setPage] = useState(0);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"view" | "edit" | "create">(
    "create"
  );
  const [selected, setSelected] = useState<Product | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | (() => void)>(null);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmDesc, setConfirmDesc] = useState("");

  function load() {
    setProducts(getProducts());
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = products.filter(
    (p) =>
      (filter === "All" || p.status === filter) &&
      p.name.toLowerCase().includes(search.toLowerCase())
  );

  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  /* ---------- Dialog handlers ---------- */

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

  /* --------------------------------------------------- */

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

  /* --------------------------------------------------- */

  function openSecurityScanClick(p: Product) {
    const canScan = authorizeApprove(user, p);
    if (!canScan) {
      confirmAndExec(
        "Restricted Access",
        "You can view this page but are not authorized to run security scans or approve/reject. Security review actions can only be performed by Cyber-Security Head or an Admin.",
        () => {
          navigateToSecurityScan(p.id);
        }
      );
    } else {
      navigateToSecurityScan(p.id);
    }
  }

  // --- Cryptographic Signing Handler ---
  function openCryptoSignClick(p: Product) {
    // 1. Check Status: Must be Approved (Security Check passed)
    // if (p.status !== "Approved") {
    //   confirmAndExec(
    //     "Cryptographic Signing Restricted",
    //     "This product is not yet 'Approved'. Security checks must be completed and approved before cryptographic signing can occur.",
    //     () => { /* Do nothing on confirm, just close dialog */ }
    //   );
    //   return;
    // }

    // 2. Check Permission: Reuse release authorization or create specific sign auth
    const canSign = authorizeRelease(user, p); 
    
    if (!canSign) {
      confirmAndExec(
        "Restricted Access",
        "You do not have permission to digitally sign artifacts. This action is restricted to Release Engineers.",
        () => navigateToCryptoSign(p.id) // Allow view-only access if desired
      );
    } else {
      navigateToCryptoSign(p.id);
    }
  }


    // --- Release Workflow Handler ---
  function openReleaseWorkflowClick(p: Product) {
    const canRelease = authorizeRelease(user, p);
    if (p.status !== "Approved") {
      confirmAndExec(
        "Release Restricted",
        "Product is not yet Approved!",
        () => {
          navigateToRelease(p.id); // Remove
        }
      );
      return;
    }

    if (!canRelease) {
      confirmAndExec(
        "Restricted Access",
        "You can view this page but are not authorized to make release. Release activity can only be performed by assigned Release Engineer or an Admin.",
        () => {
          navigateToRelease(p.id);
        }
      );
    } else {
      navigateToRelease(p.id);
    }
  }

    // --- Signature Verification Handler ---
  function openSignatureVerifyClick(p: Product) {
    if (p.status !== "Released") {
      confirmAndExec(
        "Signature Verification Restricted",
        "Product must be 'Released' before signatures can be verified. Complete the full workflow: Scan → Approve → Sign → Release.",
        () => {
          navigateToSignatureVerify(p.id); // Remove
        }
      );
      return;
    }
    // Open to ALL users (no permission check)
    navigateToSignatureVerify(p.id);
  }


  /* --------------------------------------------------- */

  return (
    <Box sx={{ pt: 8, pb: 6, minHeight: "80vh" }}>
      <Container maxWidth="xl">
        {/* ---------------------------------------------------
             HEADING (CENTERED)
        ---------------------------------------------------- */}
        <Typography variant="h4" textAlign="center" fontWeight={800} mb={3}>
          Product Dashboard
        </Typography>

        {/* ---------------------------------------------------
             FILTER + SEARCH + ADD BUTTON ROW
        ---------------------------------------------------- */}
        <Stack direction="row" spacing={2} mb={4} alignItems="center">
          <TextField
            select
            sx={{ width: 160 }}
            label="Status"
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
          >
            <MenuItem value="All">All</MenuItem>
            <MenuItem value="Pending">Pending</MenuItem>
            <MenuItem value="Approved">Approved</MenuItem>
            <MenuItem value="Rejected">Rejected</MenuItem>
            <MenuItem value="Released">Released</MenuItem>
          </TextField>

          <TextField
            placeholder="Search products..."
            fullWidth
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <Button
            startIcon={<AddIcon />}
            variant="contained"
            onClick={openCreate}
            sx={{
              minWidth: 180,
              background: "linear-gradient(135deg,#7b5cff,#5ce1e6)",
            }}
          >
            Add Product
          </Button>
        </Stack>

        {/* ---------------------------------------------------
             PRODUCT GRID — 3 CARDS PER ROW
        ---------------------------------------------------- */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 3,
          }}
        >
          {pageData.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onView={() => openView(p)}
              onEdit={() => openEdit(p)}
              onDelete={() =>
                confirmAndExec(
                  "Delete product",
                  "Are you sure you want to remove this product?",
                  () => {
                    deleteProduct(p.id);
                    toast("Deleted", "info");
                    load();
                  }
                )
              }
              onSecurityScan={() => openSecurityScanClick(p)}
              onCryptographicSign={() => openCryptoSignClick(p)}
              onRelease={() => openReleaseWorkflowClick(p)}
              onSignatureVerify={() => openSignatureVerifyClick(p)} 
            />
          ))}
        </Box>

        {/* ---------------------------------------------------
             PAGINATION
        ---------------------------------------------------- */}
        <Stack direction="row" justifyContent="center" spacing={2} mt={4}>
          <Button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Prev
          </Button>

          <Typography sx={{ pt: 1 }}>
            Page {page + 1} of{" "}
            {Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))}
          </Typography>

          <Button
            disabled={(page + 1) * PAGE_SIZE >= filtered.length}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </Stack>
      </Container>

      {/* ---------------------------------------------------
           MODALS
      ---------------------------------------------------- */}

      <ProductDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        product={selected ?? undefined}
        mode={dialogMode}
        refresh={load}
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
