// src/components/AdminStats.tsx
import { Card, Typography, Box } from "@mui/material";
import { motion } from "framer-motion";

interface Props {
  title: string;
  value: number;
  color?: string;
  icon?: React.ReactNode;
}

export default function AdminStats({
  title,
  value,
  color = "#7b5cff",
  icon,
}: Props) {
  return (
    <motion.div
      whileHover={{ scale: 1.04 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
    >
      <Card
        sx={{
          width: 242,
          height: 150,
          p: 3,
          borderRadius: 3,
          position: "relative",
          overflow: "hidden",
          background:
            "linear-gradient(145deg, rgba(11,15,32,0.9), rgba(16,20,45,0.95))",
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 15px 40px rgba(123,92,255,0.1)",
          backdropFilter: "blur(8px)",
          transition: "all .25s ease",
        }}
      >
        {/* glow highlight */}
        <Box
          sx={{
            position: "absolute",
            inset: "-40%",
            background: `radial-gradient(circle at top right, ${color}25, transparent 60%)`,
          }}
        />

        {/* Icon */}
        {icon && (
          <Box
            sx={{
              position: "absolute",
              top: 14,
              right: 14,
              opacity: 0.18,
            }}
          >
            {icon}
          </Box>
        )}

        <Box sx={{ position: "relative", zIndex: 5 }}>
          <Typography
            sx={{
              color: "text.secondary",
              letterSpacing: 1,
              textTransform: "uppercase",
              fontSize: 12,
              mb: 1,
            }}
          >
            {title}
          </Typography>

          <Typography
            variant="h2"
            sx={{
              fontWeight: 900,
              lineHeight: 1,
              background: `linear-gradient(135deg, ${color}, ${color}99)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {value}
          </Typography>
        </Box>
      </Card>
    </motion.div>
  );
}
