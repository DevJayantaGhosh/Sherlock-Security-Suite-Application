import {
  Box, Container, Paper, Typography, Alert, Chip, Button
} from "@mui/material";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";

export default function LicenseActivationPage() {
  const navigate = useNavigate();

  const handleTryLoginAgain = () => {
    navigate("/login");
  };

  return (
    <Box sx={{
      pt: 10, pb: 8, minHeight: "30vh",
      display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center",
    }}>
      <Container maxWidth="md">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6 }}>
          <Paper sx={{ p: 6, borderRadius: 4, boxShadow: "0 20px 60px rgba(255,193,7,0.3)" }}>
            <Typography variant="h4" fontWeight={600} mb={3} color="warning.main">
              ⚠️ License Expired
            </Typography>

            <Alert severity="warning" sx={{ mb: 4 }}>
              Your license has expired. Choose an activation option below.
            </Alert>

            <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 2, mb: 3 }}>
              {/* 1. INTERNAL EMPLOYEE - SAME STRUCTURE */}
              <Paper sx={{
                flex: 1,
                p: 2,
                bgcolor: "rgba(16,185,129,0.15)",
                border: "1px solid rgba(16,185,129,0.3)",
                borderRadius: 1.5,
                color: "white",
                display: "flex",
                flexDirection: "column",
                height: 180  
              }}>
                <Box sx={{
                  width: 40, height: 40,
                  borderRadius: "50%",
                  bgcolor: "#10b981",
                  mx: "auto", mb: 1.5,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1.3rem",
                  flexShrink: 0
                }}>
                  🏢
                </Box>

                <Typography variant="body2" fontWeight={700} mb={1} sx={{ color: "#34d399", fontSize: "0.9rem", mx: "auto" }}>
                  Internal Employee
                </Typography>

                <Typography variant="caption" mb={2} sx={{ color: "rgba(255,255,255,0.85)", fontSize: "0.75rem", lineHeight: 1.3, mx: "auto" }}>
                  Please contact with admin
                </Typography>

                <Chip
                  label="Contact Admin"
                  clickable
                  component="a"
                  href="mailto:jayantaghosh.iitmadras@gmail.com?subject=License Activation"
                  sx={{
                    bgcolor: "#10b981",
                    color: "white",
                    fontSize: "0.7rem",
                    height: 28,
                    fontWeight: 600,
                    mx: "auto",
                    mt: "auto",
                    boxShadow: "0 2px 8px rgba(16,185,129,0.3)"
                  }}
                />
              </Paper>

              {/* 2. EXTERNAL USER - IDENTICAL STRUCTURE */}
              <Paper sx={{
                flex: 1,
                p: 2,
                bgcolor: "rgba(59,130,246,0.15)",
                border: "1px solid rgba(59,130,246,0.3)",
                borderRadius: 1.5,
                color: "white",
                display: "flex",
                flexDirection: "column",
                height: 180  
              }}>
                <Box sx={{
                  width: 40, height: 40,
                  borderRadius: "50%",
                  bgcolor: "#3b82f6",
                  mx: "auto", mb: 1.5,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1.3rem",
                  flexShrink: 0
                }}>
                  🌐
                </Box>

                <Typography variant="body2" fontWeight={700} mb={1} sx={{ color: "#60a5fa", fontSize: "0.9rem", mx: "auto" }}>
                  External User
                </Typography>

                <Typography variant="caption" mb={2} sx={{ color: "rgba(255,255,255,0.85)", fontSize: "0.75rem", lineHeight: 1.3, mx: "auto" }}>
                  Make payment for license activation
                </Typography>

                <Box sx={{ display: "flex", gap: 0.75, mt: "auto", justifyContent: "center" }}>
                  <Button
                    variant="contained"
                    size="small"
                    sx={{
                      py: 0.5,
                      fontSize: "0.7rem",
                      height: 28,
                      minWidth: 44,
                      background: "#14b8a6",
                      "&:hover": { background: "#0d9488" }
                    }}
                    onClick={() => {
                      navigator.clipboard.writeText("sherlock@pay");
                      toast.success("✅ UPI ID copied: sherlock@pay");
                    }}
                  >
                    📱 UPI Pay
                  </Button>
                  <Button
                    variant="contained"
                    size="small"
                    sx={{
                      py: 0.5,
                      fontSize: "0.7rem",
                      height: 28,
                      minWidth: 44,
                      background: "#f59e0b",
                      "&:hover": { background: "#d97706" }
                    }}
                    onClick={() => window.open("https://nowpayments.io", "_blank")}
                  >
                    🪙 CryptoPay
                  </Button>
                </Box>
              </Paper>
            </Box>

            <Button
              variant="outlined"
              size="large"
              fullWidth
              sx={{ mt: 4 }}
              onClick={handleTryLoginAgain}
            >
              Try Login Again
            </Button>
          </Paper>
        </motion.div>
      </Container>
    </Box>
  );
}
