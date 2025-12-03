// src/components/security/StatusChip.tsx
import { Box, Typography } from "@mui/material";

export default function StatusChip({
  label,
  status,
}: {
  label: string;
  status: string;
}) {
  const mapColor = {
    idle: "rgba(255,255,255,0.06)",
    running: "rgba(97,144,255,0.12)",
    success: "rgba(76,175,80,0.12)",
    failed: "rgba(244,67,54,0.12)",
  } as Record<string, string>;

  const colorText = {
    idle: "#d1d5db",
    running: "#60a5fa",
    success: "#4ade80",
    failed: "#ff6b6b",
  } as Record<string, string>;

  return (
    <Box
      sx={{
        px: 1.2,
        py: 0.6,
        borderRadius: 1,
        bgcolor: mapColor[status] || mapColor.idle,
      }}
    >
      <Typography fontSize={12} sx={{ color: colorText[status] || colorText.idle }}>
        {label} {status === "idle" ? "" : `• ${status.toUpperCase()}`}
      </Typography>
    </Box>
  );
}
