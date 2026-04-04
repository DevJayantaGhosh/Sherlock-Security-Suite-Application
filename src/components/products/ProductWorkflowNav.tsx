/**
 * ProductWorkflowNav — Previous / Next navigation for product workflow pages.
 *
 * Uses workflowAccess for status + role validation.
 * Placed at the bottom of each product workflow page.
 *
 * Workflow order:
 *   1. Security Scan          /product/:id/security-scan
 *   2. Releases               /product/:id/releases
 *   3. Cryptographic Signing  /product/:id/cryptographic-signing
 *   4. Signature Verification /product/:id/signature-verify
 */
import { useState } from "react";
import {
  Button, Paper, Stack, Typography, Chip, Tooltip,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import LockIcon from "@mui/icons-material/Lock";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import BlockIcon from "@mui/icons-material/Block";
import { useNavigate } from "react-router-dom";

import { Product } from "../../models/Product";
import { useUserStore } from "../../store/userStore";
import ConfirmDialog from "../ConfirmDialog";
import {
  WORKFLOW_STEPS,
  checkStepAccess,
} from "../../utils/workflowAccess";

interface ProductWorkflowNavProps {
  /** The current page's path segment, e.g. "security-scan" */
  currentStep: string;
  /** The product object (needed for status + role checks) */
  product: Product;
  /** Optional accent color */
  accentColor?: string;
}

export default function ProductWorkflowNav({
  currentStep,
  product,
  accentColor = "#00e5ff",
}: ProductWorkflowNavProps) {
  const navigate = useNavigate();
  const user = useUserStore((s) => s.user);
  const currentIndex = WORKFLOW_STEPS.findIndex((s) => s.key === currentStep);

  // Confirm dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmDesc, setConfirmDesc] = useState("");
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);

  if (currentIndex === -1) return null;

  const prevStep = currentIndex > 0 ? WORKFLOW_STEPS[currentIndex - 1] : null;
  const nextStep = currentIndex < WORKFLOW_STEPS.length - 1 ? WORKFLOW_STEPS[currentIndex + 1] : null;

  /** Navigate to a step with access validation */
  function navigateToStep(stepKey: string) {
    const access = checkStepAccess(stepKey, user, product);

    if (access.blocked) {
      // Hard block — show dialog, NO navigation
      setConfirmTitle(access.title);
      setConfirmDesc(access.message);
      setConfirmAction(null);
      setConfirmOpen(true);
      return;
    }

    if (access.title) {
      // Role warning — show dialog, then navigate (view-only)
      setConfirmTitle(access.title);
      setConfirmDesc(access.message);
      setConfirmAction(() => () => {
        navigate(`/product/${product.id}/${stepKey}`);
        setConfirmOpen(false);
      });
      setConfirmOpen(true);
      return;
    }

    // Fully accessible — navigate directly
    navigate(`/product/${product.id}/${stepKey}`);
  }

  /** Chip style based on access */
  function getChipStyle(stepKey: string, idx: number) {
    const isCurrent = idx === currentIndex;

    if (isCurrent) {
      return {
        bgcolor: `${accentColor}25`,
        color: accentColor,
        border: `1px solid ${accentColor}`,
        fontWeight: 700,
        cursor: "default" as const,
      };
    }

    const access = checkStepAccess(stepKey, user, product);

    if (access.blocked) {
      return {
        bgcolor: "rgba(244, 67, 54, 0.08)",
        color: "rgba(244, 67, 54, 0.6)",
        border: "1px solid rgba(244, 67, 54, 0.2)",
        fontWeight: 400,
        cursor: "pointer" as const,
      };
    }

    if (access.title) {
      // Has role warning
      return {
        bgcolor: "rgba(255, 193, 7, 0.08)",
        color: "rgba(255, 193, 7, 0.8)",
        border: "1px solid rgba(255, 193, 7, 0.2)",
        fontWeight: 400,
        cursor: "pointer" as const,
      };
    }

    return {
      bgcolor: "rgba(76, 175, 80, 0.08)",
      color: "rgba(76, 175, 80, 0.8)",
      border: "1px solid rgba(76, 175, 80, 0.2)",
      fontWeight: 400,
      cursor: "pointer" as const,
    };
  }

  function getChipIcon(stepKey: string, idx: number) {
    if (idx === currentIndex) return undefined;
    const access = checkStepAccess(stepKey, user, product);
    if (access.blocked) return <BlockIcon sx={{ fontSize: 14 }} />;
    if (access.title) return <LockIcon sx={{ fontSize: 14 }} />;
    return <CheckCircleIcon sx={{ fontSize: 14 }} />;
  }

  function getChipTooltip(stepKey: string, idx: number) {
    if (idx === currentIndex) return "Current step";
    const access = checkStepAccess(stepKey, user, product);
    if (access.blocked) return access.message;
    if (access.title) return `${access.message} (view-only)`;
    return "Click to navigate";
  }

  return (
    <>
      <Paper
        sx={{
          p: 2.5,
          mt: 4,
          mb: 2,
          borderRadius: 2,
          bgcolor: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Step indicator chips */}
        <Stack direction="row" spacing={1} justifyContent="center" mb={2.5} flexWrap="wrap">
          {WORKFLOW_STEPS.map((step, idx) => (
            <Tooltip key={step.key} title={getChipTooltip(step.key, idx)} arrow>
              <Chip
                label={`${idx + 1}. ${step.shortLabel}`}
                size="small"
                icon={getChipIcon(step.key, idx)}
                onClick={idx === currentIndex ? undefined : () => navigateToStep(step.key)}
                sx={{
                  fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace",
                  ...getChipStyle(step.key, idx),
                  "&:hover": idx !== currentIndex ? {
                    opacity: 0.9,
                    transform: "translateY(-1px)",
                  } : {},
                  transition: "all 0.2s ease",
                }}
              />
            </Tooltip>
          ))}
        </Stack>

        {/* Previous / Next buttons */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          {prevStep ? (
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => navigateToStep(prevStep.key)}
              sx={{ color: "text.secondary", textTransform: "none" }}
            >
              <Stack alignItems="flex-start" spacing={0}>
                <Typography variant="caption" color="text.disabled">Previous</Typography>
                <Typography variant="body2" fontWeight={600}>{prevStep.label}</Typography>
              </Stack>
            </Button>
          ) : (
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate("/products")}
              sx={{ color: "text.secondary", textTransform: "none" }}
            >
              <Stack alignItems="flex-start" spacing={0}>
                <Typography variant="caption" color="text.disabled">Back to</Typography>
                <Typography variant="body2" fontWeight={600}>Products</Typography>
              </Stack>
            </Button>
          )}

          <Typography variant="caption" color="text.disabled" sx={{ fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace" }}>
            Step {currentIndex + 1} of {WORKFLOW_STEPS.length}
          </Typography>

          {nextStep ? (
            <Button
              endIcon={<ArrowForwardIcon />}
              onClick={() => navigateToStep(nextStep.key)}
              sx={{ color: accentColor, textTransform: "none" }}
            >
              <Stack alignItems="flex-end" spacing={0}>
                <Typography variant="caption" color="text.disabled">Next</Typography>
                <Typography variant="body2" fontWeight={600}>{nextStep.label}</Typography>
              </Stack>
            </Button>
          ) : (
            <Button
              endIcon={<ArrowForwardIcon />}
              onClick={() => navigate("/products")}
              sx={{ color: "text.secondary", textTransform: "none" }}
            >
              <Stack alignItems="flex-end" spacing={0}>
                <Typography variant="caption" color="text.disabled">Back to</Typography>
                <Typography variant="body2" fontWeight={600}>Products</Typography>
              </Stack>
            </Button>
          )}
        </Stack>
      </Paper>

      {/* Confirm Dialog for blocked/warned steps */}
      <ConfirmDialog
        open={confirmOpen}
        title={confirmTitle}
        description={confirmDesc}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          if (confirmAction) {
            confirmAction();
          } else {
            setConfirmOpen(false);
          }
        }}
      />
    </>
  );
}