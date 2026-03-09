import { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Tooltip,
  CircularProgress,
} from "@mui/material";
import { motion } from "framer-motion";
import { Product } from "../../models/Product";

interface ProductReleaseCardProps {
  product: Product;
  borderColor?: string;
  disabled?: boolean;
  tooltipTitle?: string;
  tooltipSingleTitle?: string;
  tooltipBatchTitle?: string;
}

export default function ProductReleaseCard({
  product,
  borderColor = "#7b5cff",
  disabled = false,
  tooltipTitle = "",
}: ProductReleaseCardProps) {
  const [loading] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <Card
        sx={{
          mb: 3,
          border: `1px solid ${borderColor}33`,
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            Release Information
          </Typography>

          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Product: <strong>{product.name}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Version: <strong>{product.version || "N/A"}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Status: <strong>{product.status}</strong>
            </Typography>
          </Box>

          <Tooltip title={tooltipTitle} arrow>
            <span>
              <Button
                variant="contained"
                disabled={disabled || loading}
                sx={{
                  bgcolor: borderColor,
                  "&:hover": { bgcolor: `${borderColor}dd` },
                }}
              >
                {loading ? (
                  <CircularProgress size={20} sx={{ color: "white" }} />
                ) : (
                  "Prepare Release"
                )}
              </Button>
            </span>
          </Tooltip>
        </CardContent>
      </Card>
    </motion.div>
  );
}