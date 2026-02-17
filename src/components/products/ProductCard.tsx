import { motion } from "framer-motion";
import {
  Box,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SecurityIcon from "@mui/icons-material/Security";
import FingerprintIcon from "@mui/icons-material/Fingerprint";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";

import { Product } from "../../models/Product";
import { authorizeEdit } from "../../services/productService";
import { useUserStore } from "../../store/userStore";

const STATUS: Record<Product["status"], string> = {
  Pending: "#ffe920ff",
  Approved: "#1ca153ff",
  Rejected: "#c22020ff",
  Released: "#7b5cff",
};

interface Props {
  product: Product;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSecurityScan: () => void;
  onCryptographicSign: () => void;
  onRelease: () => void;
  onSignatureVerify: () => void;
}

export default function ProductCard({
  product,
  onView,
  onEdit,
  onDelete,
  onSecurityScan,
  onCryptographicSign,
  onRelease,
  onSignatureVerify,
}: Props) {
  const user = useUserStore((s) => s.user);

  return (
    <motion.div
      layout
      whileHover={{ y: -6, scale: 1.03 }}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 220 }}
      style={{ height: "100%", display: "flex", flexDirection: "column" }}
    >
      <Box
        sx={{
          flex: 1,
          p: 3,
          borderRadius: 3,
          background: "linear-gradient(140deg,#0c1023,#090c1c,#060712)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 12px 40px rgba(123,92,255,0.18)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          overflow: "hidden",
        }}
      >
        {/* HEADER SECTION */}
        <Box sx={{ mb: 2 }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="flex-start"
            spacing={1}
            mb={1}
          >
            <Typography
              variant="h6"
              fontWeight={800}
              sx={{
                lineHeight: 1.3,
                wordBreak: "break-word",
                minWidth: 0,
              }}
            >
              {product.name}
            </Typography>

            {/* Status + OpenSource Chips */}
            <Stack direction="row" spacing={0.5} alignItems="flex-start">
              <Chip
                label={product.status}
                size="small"
                sx={{
                  bgcolor: STATUS[product.status],
                  fontWeight: 800,
                  color: "#000",
                  flexShrink: 0,
                  height: 24,
                }}
              />
              {product?.isOpenSource && (
                <Chip
                  label="OpenSource"
                  size="small"
                  color="success"
                  variant="outlined"
                  sx={{
                    fontWeight: 700,
                    fontSize: "0.65rem",
                    height: 24,
                  }}
                />
                )}

            </Stack>
          </Stack>

          <Typography color="text.secondary" noWrap>
            {product.description}
          </Typography>
        </Box>

        {/* ACTION BUTTONS */}
        <Stack
          direction="row"
          spacing={0.5}
          mt="auto"
          flexWrap="wrap"
          sx={{ rowGap: 1 }}
        >
          <Tooltip title="View" arrow>
            <IconButton onClick={onView} size="small">
              <VisibilityIcon />
            </IconButton>
          </Tooltip>

          {authorizeEdit(user, product) && (
            <>
              <Tooltip title="Edit" arrow>
                <IconButton onClick={onEdit} size="small">
                  <EditIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete" arrow>
                <IconButton onClick={onDelete} size="small">
                  <DeleteIcon />
                </IconButton>
              </Tooltip>
            </>
          )}

          <Tooltip title="Run Security Scan" arrow>
            <IconButton color="warning" onClick={onSecurityScan} size="small">
              <SecurityIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Cryptographic Digital Signature" arrow>
            <IconButton
              onClick={onCryptographicSign}
              size="small"
              sx={{
                color: "#00e5ff",
                "&:hover": {
                  backgroundColor: "rgba(0, 229, 255, 0.1)",
                },
              }}
            >
              <FingerprintIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Release workflow" arrow>
            <IconButton sx={{ color: "#7b5cff" }} onClick={onRelease} size="small">
              <RocketLaunchIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Verify Digital Signature" arrow>
            <IconButton color="success" onClick={onSignatureVerify} size="small">
              <ReceiptLongIcon />
            </IconButton>
          </Tooltip>

        </Stack>
      </Box>
    </motion.div>
  );
}
