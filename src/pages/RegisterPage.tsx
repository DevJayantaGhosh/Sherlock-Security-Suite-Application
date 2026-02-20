// src/pages/RegisterPage.tsx - COMPLETE WITH EMAIL + PASSWORD VALIDATION
import { useState } from "react";
import { Box, Container, Paper, Typography, TextField, Button, Chip } from "@mui/material";
import { motion } from "framer-motion";
import { register } from "../services/userService";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";

export default function RegisterPage() {
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState(""); 
  const navigate = useNavigate();

  //Email validation function
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };
  const validatePassword = (password: string) => password.length >= 6;
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    
    if (value && !validateEmail(value)) {
      setEmailError("Please enter a valid email address");
    } else {
      setEmailError("");
    }
  };


  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    
    if (value && !validatePassword(value)) {
      setPasswordError("Password must be at least 6 characters");
    } else {
      setPasswordError("");
    }
  };


  async function handleRegister() {
    try {
      if (!email || !validateEmail(email)) {
        toast.error("Please enter a valid email");
        return;
      }
      
      if (!password || !validatePassword(password)) {
        toast.error("Password must be at least 6 characters");
        return;
      }
      
      setLoading(true);
      await register(userName, email, password);
      setSuccess(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  //  SUCCESS SCREEN
  if (success) {
    return (
      <Box sx={{
        pt: 10,
        pb: 8,
        minHeight: "70vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
      }}>
        <Container maxWidth="sm">
          <motion.div 
            initial={{ opacity: 0, y: 40, scale: 0.95 }} 
            animate={{ opacity: 1, y: 0, scale: 1 }} 
            transition={{ duration: 0.9 }}
          >
            <Paper sx={{ 
              p: 3, 
              maxWidth: 450,
              mx: "auto",
              borderRadius: 2,
              bgcolor: "rgba(17, 24, 39, 0.95)",
              color: "white",
              border: "2px solid rgba(123,92,255,0.4)",
              position: "relative",
              boxShadow: "0 8px 32px rgba(123,92,255,0.5)",
              "&::before": {
                content: '""',
                position: "absolute",
                inset: -4,
                borderRadius: "inherit",
                background: "linear-gradient(45deg, transparent 20%, #7b5cff 50%, #7b5cff 70%, transparent 80%)",
                filter: "blur(12px)",
                animation: "purpleGlow 2s ease-in-out infinite alternate",
                zIndex: -1
              }
            }}>
              <Typography variant="h6" fontWeight={800} mb={2} sx={{ color: '#7b5cff' }}>
                🎉 Registration Successful!
              </Typography>
              
              <Typography variant="body2" mb={3} sx={{ color: "rgba(255,255,255,0.9)", fontWeight: 500 }}>
                Welcome, <strong style={{ color: '#7b5cff' }}>{userName}</strong>!
              </Typography>

              <Paper sx={{ 
                p: 2.5, mb: 2.5, 
                bgcolor: "rgba(16,185,129,0.15)",
                border: "1px solid rgba(16,185,129,0.4)",
                borderRadius: 1.5,
                color: "white"
              }}>
                <Typography variant="body2" fontWeight={700} mb={1} sx={{ color: "#34d399" }}>
                  🏢 Internal Employee
                </Typography>
                <Typography variant="caption" display="block" mb={1.5} sx={{ color: "rgba(255,255,255,0.8)" }}>
                  Please contact admin to activate your license:
                </Typography>
                <Chip 
                  label="jayantaghosh.iitmadras@gmail.com" 
                  clickable 
                  component="a" 
                  href="mailto:jayantaghosh.iitmadras@gmail.com"
                  sx={{ 
                    bgcolor: "#10b981", 
                    color: "white", 
                    fontSize: "0.75rem", 
                    height: 28 
                  }}
                />
              </Paper>

              <Paper sx={{ 
                p: 2.5, mb: 3, 
                bgcolor: "rgba(59,130,246,0.15)",
                border: "1px solid rgba(59,130,246,0.4)",
                borderRadius: 1.5,
                color: "white"
              }}>
                <Typography variant="body2" fontWeight={700} mb={1.5} sx={{ color: "#60a5fa" }}>
                  🌐 External User
                </Typography>
                <Typography variant="caption" display="block" mb={2} sx={{ color: "rgba(255,255,255,0.8)" }}>
                  Make payment for license activation (<strong style={{ color: '#7b5cff' }}>₹999/year</strong>):
                </Typography>
                <Box sx={{ display: "flex", gap: 1 }}>
                  <Button 
                    variant="contained" 
                    size="small"
                    sx={{ 
                      flex: 1, 
                      fontSize: "0.75rem",
                      py: 0.75,
                      background: "#14b8a6",
                      color: "white",
                      "&:hover": { background: "#0d9488" }
                    }}
                    onClick={() => {
                      navigator.clipboard.writeText("sherlock@pay");
                      alert("✅ UPI ID copied: sherlock@pay");
                    }}
                  >
                    📱 UPI Pay
                  </Button>
                  <Button 
                    variant="contained" 
                    size="small"
                    sx={{ 
                      flex: 1, 
                      fontSize: "0.75rem",
                      py: 0.75,
                      background: "#f59e0b",
                      color: "white",
                      "&:hover": { background: "#d97706" }
                    }}
                    onClick={() => window.open("https://nowpayments.io", "_blank")}
                  >
                    🪙 CryptoPay
                  </Button>
                </Box>
              </Paper>

              <Button 
                variant="contained" 
                color="primary" 
                size="large" 
                fullWidth
                sx={{ 
                  py: 1.5,
                  fontWeight: 700,
                  fontSize: "1rem"
                }}
                onClick={() => navigate("/login")}
              >
                → Login
              </Button>
            </Paper>
          </motion.div>
        </Container>

        <style>{`
          @keyframes purpleGlow {
            0% { 
              opacity: 0.7;
              transform: scale(1);
            }
            100% { 
              opacity: 1;
              transform: scale(1.05);
            }
          }
        `}</style>
      </Box>
    );
  }

  //  REGISTER FORM
  return (
    <Box sx={{
      pt: 14,
      pb: 12,
      minHeight: "80vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
    }}>
      <Container maxWidth="sm">
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9 }}>
          <Paper sx={{ p: 4 }}>
            <Typography variant="h5" fontWeight={800} mb={2}>Register</Typography>
            
            <TextField fullWidth label="UserName" sx={{ mb: 2 }} value={userName} onChange={(e) => setUserName(e.target.value)} disabled={loading} />
            
            <TextField 
              fullWidth 
              label="Email" 
              sx={{ mb: 2 }} 
              value={email} 
              onChange={handleEmailChange}
              type="email" 
              disabled={loading}
              error={!!emailError}
              helperText={emailError}
            />
            
            <TextField 
              fullWidth 
              label="Password" 
              type="password" 
              sx={{ mb: 3 }} 
              value={password} 
              onChange={handlePasswordChange}
              disabled={loading}
              error={!!passwordError}
              helperText={passwordError}
            />
            
            <Button 
              variant="contained" 
              color="primary" 
              fullWidth 
              onClick={handleRegister}
              disabled={loading || !userName || !!emailError || !!passwordError || !password}
            >
              {loading ? "Creating..." : "Sign up"}
            </Button>
            
            <Typography variant="caption" sx={{ display: "block", mt: 2, color: "text.secondary" }}>
              Use one of the demo emails: [admin@gmail.com](mailto:admin@gmail.com), [director@gmail.com](mailto:director@gmail.com), [security@gmail.com](mailto:security@gmail.com), [engineer@gmail.com](mailto:engineer@gmail.com), [user@gmail.com](mailto:user@gmail.com)
            </Typography>
          </Paper>
        </motion.div>
      </Container>
    </Box>
  );
}
