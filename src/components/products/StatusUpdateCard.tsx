// src/components/product/StatusUpdateCard.tsx
import { useState } from "react";
import { Button, Paper, Stack, Typography, Dialog, DialogTitle, DialogContent, DialogActions, Tooltip } from "@mui/material";
import { motion, Variants } from "framer-motion";
import { toast } from "react-hot-toast";
import { updateProduct } from "../../services/productService";
import { Product, ProductStatus } from "../../models/Product";


interface StatusUpdateCardProps {
  product: Product;
  disabled: boolean;
  toolTip: string;
  cardColor: string;
  buttonText: string;
  confirmMessage: string;
  targetStatus: ProductStatus;
  successMessage?: string;
  onReload: () => void; // to refetch the product
  variants?: Variants;
}


export default function StatusUpdateCard({
  product,
  disabled = false,
  toolTip = "",
  cardColor = "#00e5ff",
  buttonText,
  confirmMessage,
  targetStatus,
  successMessage = `Product marked as ${targetStatus}`,
  onReload,
  variants,
}: StatusUpdateCardProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);


  const handleConfirm = async () => {
    setSaving(true);
    const payload: Partial<Product> = {
      updatedAt: new Date().toISOString(),
      status: targetStatus,
    };

    try {
      const result = await updateProduct(product.id, payload);
      if (!result.error && result.data) {
        toast.success(successMessage);
        onReload();
      } else {
        toast.error("Failed to update product status");
      }
    } catch (error) {
      toast.error("Failed to update product status");
    } finally {
      setSaving(false);
      setOpen(false);
    }
  };


  const handleCancel = () => {
    setOpen(false);
  };


  return (
    <motion.div variants={variants}>
      <Paper
        sx={{
          p: 3,
          borderLeft: `4px solid ${cardColor}`,
          borderRadius: 1,
          bgcolor: "rgba(0,229,255,0.05)",
        }}
      >
        <Stack spacing={2} alignItems="center" textAlign="center">
          {/* Heading */}
          <Typography variant="h6" fontWeight={700}>
            Update Product Status
          </Typography>

          {/* Current status */}
          <Typography variant="body2" color="text.secondary">
            <strong>Current status:</strong> {product.status}
          </Typography>

          {/* Target status note */}
          <Typography variant="body2" color="text.secondary">
            Change to: <strong>{targetStatus}</strong>
          </Typography>

          {/* Centered button */}
          <Tooltip title={disabled ? toolTip : ""} arrow placement="top">
            <span>
              <Button
                variant="contained"
                onClick={() => setOpen(true)}
                disabled={disabled || saving}
                sx={{
                  bgcolor: cardColor,
                  color: "black",
                  fontWeight: 700,
                  minWidth: 160,
                  "&:hover": { bgcolor: `${cardColor}CC` },
                  alignSelf: "center",
                }}
              >
                {saving ? "Updating..." : buttonText}
              </Button>
            </span>
          </Tooltip>
        </Stack>

        {/* Confirmation dialog */}
        <Dialog open={open} onClose={() => !saving && handleCancel()}>
          <DialogTitle>{buttonText}</DialogTitle>
          <DialogContent>
            <Typography>{confirmMessage}</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCancel} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleConfirm}
              disabled={saving}
              sx={{
                bgcolor: cardColor,
                color: "black",
                "&:hover": { bgcolor: `${cardColor}CC` },
              }}
            >
              Yes, {buttonText}
            </Button>
          </DialogActions>
        </Dialog>
      </Paper>
    </motion.div>
  );
}
