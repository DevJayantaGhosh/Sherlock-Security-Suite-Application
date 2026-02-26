// src/components/LoadingSpinner.tsx
import { 
  Box, 
  CircularProgress, 
  Typography, 
  Fade 
} from "@mui/material";
import { motion } from "framer-motion";

interface LoadingSpinnerProps {
  message?: string;
  blockInteractions?: boolean;
}

const LoadingSpinner = ({ 
  message = "Loading products...", 
  blockInteractions = true 
}: LoadingSpinnerProps) => {
  return (
    <Fade in={true} timeout={600}>
      <Box
        sx={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
          bgcolor: blockInteractions ? "rgba(0, 0, 0, 0.7)" : "transparent",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: blockInteractions ? "auto" : "none",
          gap: 3,
          p: 4,
        }}
      >
        {/* 🎨 TRIPLE RING SPINNER - PERFECTLY ALIGNED */}
        <Box sx={{ position: "relative", width: 120, height: 120 }}>
          <CircularProgress
            variant="determinate"
            size={120}
            thickness={2.5}
            sx={{ 
              color: "grey.400", 
              position: "absolute",
              top: 0,
              left: 0,
            }}
            value={100}
          />

          <CircularProgress
            size={65}
            thickness={5}
            sx={{
              color: "#7b5cff",
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              animation: "spin 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite",
            }}
          />
        </Box>

        {/* ✨ BOUNCING DOTS - FIXED TYPE ERROR */}
        <Box sx={{ display: "flex", gap: 0.75, mb: 2 }}>
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ y: [0, -12, 0] }}
              transition={{ 
                duration: 1.2, 
                repeat: Infinity, 
                repeatType: "reverse" as const,
                delay: i * 0.01 
              }}
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                backgroundColor: i === 1 ? "#7b5cff" : "#5ce1e6",
                boxShadow: "0 2px 8px rgba(123, 92, 255, 0.4)",
              }}
            />
          ))}
        </Box>

        {/* 📝 TEXT - Perfectly aligned */}
        <Box sx={{ textAlign: "center", mt: 1 }}>
          <Typography 
            variant="h4" 
            fontWeight={500} 
            sx={{ 
              background: "linear-gradient(135deg, #7b5cff 0%, #5ce1e6 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              mb: 0.5,
            }}
          >
            {message}
          </Typography>
          <Typography variant="body1" color="text.secondary" fontWeight={200}>
            Please wait while we load your data...
          </Typography>
        </Box>
      </Box>
    </Fade>
  );
};

export default LoadingSpinner;
