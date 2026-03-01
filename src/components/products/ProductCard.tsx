import { motion } from "framer-motion";
import {
  Box,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Paper,
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

/**
 * STATUS COLORS - Maps product status to gradient background colors for chips
 */
const STATUS: Record<Product["status"], string> = {
  Pending: "#ffe920ff",
  Approved: "#1ca153ff",
  Signed: "#00e5ff",
  Released: "#7b5cff",
  Rejected: "#c22020ff",
};

/**
 * PIPELINE STEPS CONFIG - Defines 4-step workflow with icons and colors
 */
const PIPELINE_STEPS = [
  { label: "Security Scan", icon: SecurityIcon, color: "#ff9800" },
  { label: "Sign", icon: FingerprintIcon, color: "#00e5ff" },
  { label: "Release", icon: RocketLaunchIcon, color: "#7b5cff" },
  { label: "Verify", icon: ReceiptLongIcon, color: "#4caf50" },
];

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

/**
 * ProductCard - Visual representation of product pipeline status
 * Handles visual states only. All RBAC + business logic in ProductPage
 * Buttons are ALWAYS clickable - ProductPage handles authorization popups
 */
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

  /**
   * Calculates pipeline progress based on product status
   * Rejected shows all 4 steps as failed (red X icons)
   */
  const getPipelineState = () => {
    switch (product.status) {
      case "Released":
        return { progress: 4, failed: false }; // All steps complete
      case "Signed":
        return { progress: 2, failed: false }; // Sign complete (step 2/4)
      case "Approved":
        return { progress: 1, failed: false }; // Scan complete (step 1/4)
      case "Pending":
        return { progress: 0, failed: false }; // No steps started
      case "Rejected":
        return { progress: 4, failed: true };  // All steps failed
      default:
        return { progress: 0, failed: false };
    }
  };

  const { progress: pipelineProgress, failed } = getPipelineState();
  const isRejected = product.status === "Rejected";

  /**
   * Visual completion states for button glow effects
   * No business logic - purely visual feedback
   */
  const isSecurityScanComplete = pipelineProgress >= 1 && !isRejected;
  const isSignComplete = pipelineProgress >= 2 && !isRejected;
  const isReleaseComplete = pipelineProgress >= 3 && !isRejected;
  const isVerifyComplete = pipelineProgress >= 4 && !isRejected;

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
          // Dramatic red styling for rejected products
          background: isRejected
            ? "linear-gradient(140deg, #200a0a, #150707, #0a0505)"
            : "linear-gradient(140deg,#0c1023,#090c1c,#060712)",
          border: isRejected
            ? "1px solid rgba(255,0,0,0.3)"
            : "1px solid rgba(255,255,255,0.08)",
          boxShadow: isRejected
            ? "0 12px 40px rgba(194,32,32,0.4)"
            : "0 12px 40px rgba(123,92,255,0.18)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          overflow: "hidden",
        }}
      >
        {/* HEADER - Product name, version, status chip, description */}
        <Box sx={{ mb: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1} mb={1}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Typography
                variant="h6"
                fontWeight={800}
                sx={{
                  lineHeight: 1.3,
                  wordBreak: "break-word",
                  color: isRejected ? "#ff5252" : "inherit", // Red title for rejected
                }}
              >
                {product.name}
              </Typography>
            </Stack>

            {/* Version + Status + OpenSource chips */}
            <Stack direction="row" spacing={0.5} alignItems="flex-start">
              <Chip
                label={`v${product.version}`}
                size="small"
                sx={{
                  bgcolor: "#ded7c8",
                  fontWeight: 800,
                  color: "#000",
                  flexShrink: 0,
                  height: 24,
                }}
              />
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

          <Typography color={isRejected ? "error.light" : "text.secondary"} noWrap>
            {product.description}
          </Typography>
        </Box>

        {/* PIPELINE STEPPER - Visual progress indicator */}
        <Paper
          sx={{
            p: 2,
            mb: 2.5,
            bgcolor: isRejected ? "rgba(255,82,82,0.1)" : "rgba(255,255,255,0.03)",
            border: isRejected ? "2px solid rgba(255,82,82,0.4)" : "1px solid rgba(255,255,255,0.1)",
            borderRadius: 2,
          }}
        >
          <Typography
            variant="caption"
            fontWeight={700}
            mb={1.5}
            display="block"
            color={isRejected ? "error.main" : "text.secondary"}
            sx={{ textAlign: "center" }}
          >
            Pipeline Progress ({pipelineProgress}/4) {isRejected && "- FAILED"}
          </Typography>
          <Stepper
            activeStep={pipelineProgress > 0 ? pipelineProgress - 1 : -1}
            alternativeLabel
            orientation="horizontal"
            sx={{
              py: 1,
              gap: 1,
              "& .MuiStepper-horizontal": { minHeight: 52, alignItems: "center" },
              "& .MuiStep-root": { flex: 1, minWidth: 0, padding: "4px 8px" },
              "& .MuiStepConnector-lineHorizontal": {
                borderTopWidth: 3,
                minHeight: 4,
                margin: "0 12px",
                borderTopColor: isRejected ? "#ff5252" : "rgba(255,255,255,0.3)",
              },
            }}
          >
            {PIPELINE_STEPS.map((step, index) => {
              const IconComponent = step.icon;
              const completed = index < pipelineProgress && !isRejected;
              const failedStep = isRejected;
              const active = index === pipelineProgress - 1 && pipelineProgress > 0 && !isRejected;

              return (
                <Step key={step.label}>
                  <StepLabel
                    sx={{
                      "& .MuiStepLabel-root": { alignItems: "center" },
                      "& .MuiStepLabel-labelContainer": {
                        marginTop: 0,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 1,
                      },
                      "& .MuiStepLabel-label": {
                        marginTop: 0,
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        lineHeight: 1.5,
                      },
                    }}
                    StepIconComponent={(props) => (
                      <Tooltip title={step.label}>
                        <Box
                          component={motion.div as any}
                          whileHover={{ scale: 1.1 }}
                          sx={{
                            bgcolor: failedStep
                              ? "#f44336"
                              : completed
                              ? "#4caf50"
                              : active
                              ? step.color + "25"
                              : "rgba(255,255,255,0.15)",
                            color: failedStep ? "#fff" : completed ? "white" : step.color,
                            borderRadius: "50%",
                            width: 32,
                            height: 32,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 13,
                            fontWeight: 800,
                            border: `2px solid ${failedStep ? "#f44336" : step.color}50`,
                            boxShadow: `0 4px 12px ${
                              failedStep ? "#f4433630" : step.color + "30"
                            }`,
                            cursor: "pointer",
                            mb: 1.5,
                            transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                            "&:hover": {
                              boxShadow: `0 6px 16px ${
                                failedStep ? "#f4433640" : step.color + "40"
                              }`,
                              transform: "translateY(-1px)",
                            },
                          }}
                        >
                          {failedStep ? "✕" : completed ? "✓" : index + 1}
                        </Box>
                      </Tooltip>
                    )}
                  >
                    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                      <IconComponent
                        sx={{
                          mb: 1,
                          fontSize: 16,
                          color: failedStep
                            ? "#f44336 !important"
                            : step.color + (completed ? "!important" : ""),
                          opacity: failedStep ? 1 : completed ? 1 : active ? 1 : 0.7,
                        }}
                      />
                      <Typography
                        variant="caption"
                        fontWeight={700}
                        sx={{
                          lineHeight: 1.15,
                          color: failedStep
                            ? "#f44336"
                            : completed
                            ? "#4caf50"
                            : active
                            ? step.color
                            : "text.secondary",
                          textTransform: "uppercase",
                          letterSpacing: 0.3,
                        }}
                      >
                        {step.label}
                      </Typography>
                    </Box>
                  </StepLabel>
                </Step>
              );
            })}
          </Stepper>
        </Paper>

        {/* ACTION BUTTONS - ALWAYS CLICKABLE (RBAC handled by ProductPage) */}
        <Stack direction="row" justifyContent="space-between" spacing={2}>
          {/* PIPELINE ACTIONS - Visual feedback only */}
          <Stack direction="row" spacing={1.5} sx={{ flex: 1 }}>
            {/* Security Scan Button - Hero button for rejected products */}
            <Tooltip title="Security Scan">
              <IconButton
                size="medium"
                color="warning"
                onClick={onSecurityScan}
                sx={{
                  bgcolor: isSecurityScanComplete ? "#ff980025" : "transparent",
                  color: "#ff9800",
                  width: 44,
                  height: 44,
                  "&:hover": {
                    bgcolor: "#ff980025",
                    transform: "scale(1.05)",
                  },
                }}
              >
                <SecurityIcon />
              </IconButton>
            </Tooltip>

            {/* Cryptographic Sign */}
            <Tooltip title="Cryptographic Sign">
              <IconButton
                size="medium"
                onClick={onCryptographicSign}
                sx={{
                  color: "#00e5ff",
                  bgcolor: isSignComplete ? "#00e5ff25" : "transparent",
                  width: 44,
                  height: 44,
                  "&:hover": {
                    bgcolor: "#00e5ff25",
                    transform: "scale(1.05)",
                  },
                }}
              >
                <FingerprintIcon />
              </IconButton>
            </Tooltip>

            {/* Release Workflow */}
            <Tooltip title="Release Workflow">
              <IconButton
                size="medium"
                onClick={onRelease}
                sx={{
                  color: "#7b5cff",
                  bgcolor: isReleaseComplete ? "#7b5cff25" : "transparent",
                  width: 44,
                  height: 44,
                  "&:hover": {
                    bgcolor: "#7b5cff25",
                    transform: "scale(1.05)",
                  },
                }}
              >
                <RocketLaunchIcon />
              </IconButton>
            </Tooltip>

            {/* Signature Verify */}
            <Tooltip title="Verify Signature">
              <IconButton
                size="medium"
                color="success"
                onClick={onSignatureVerify}
                sx={{
                  bgcolor: isVerifyComplete ? "#4caf5025" : "transparent",
                  width: 44,
                  height: 44,
                  "&:hover": {
                    bgcolor: "#4caf5025",
                    transform: "scale(1.05)",
                  },
                }}
              >
                <ReceiptLongIcon />
              </IconButton>
            </Tooltip>
          </Stack>

          {/* CRUD ACTIONS - Uses existing authorizeEdit logic */}
          <Stack direction="row" spacing={0.75}>
            <Tooltip title="View">
              <IconButton onClick={onView} size="medium" sx={{ width: 44, height: 44 }}>
                <VisibilityIcon />
              </IconButton>
            </Tooltip>
            {authorizeEdit(user, product) && (
              <>
                <Tooltip title="Edit">
                  <IconButton onClick={onEdit} size="medium" sx={{ width: 44, height: 44 }}>
                    <EditIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton onClick={onDelete} size="medium" sx={{ width: 44, height: 44 }}>
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </Stack>
        </Stack>
      </Box>
    </motion.div>
  );
}
