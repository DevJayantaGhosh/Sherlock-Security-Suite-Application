import { useState } from "react";
import {
  Box, Container, Paper, Typography, TextField, Button
} from "@mui/material";
import { motion } from "framer-motion";
import { login } from "../services/userService";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState(""); 
  const navigate = useNavigate();

  // EMAIL VALIDATION FUNCTION
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);

    if (value && !validateEmail(value)) {
      setEmailError("Please enter a valid email address");
    } else {
      setEmailError("");
    }
  };

  async function handleSignIn() {
    try {
      setLoading(true);
      
      const result = await login(email, password);
      
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      
      const { licenseValid } = result.data; 
      
      if (!licenseValid) {
        navigate("/license-activation"); // ✅ GO TO SEPARATE PAGE
        return;
      }
      
      navigate("/products");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  // LOGIN FORM 
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
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9 }}>
          <Paper sx={{ p: 4 }}>
            <Typography variant="h5" fontWeight={800} mb={2}>Login</Typography>
            <TextField
              fullWidth
              label="Email"
              type="email"
              sx={{ mb: 2 }}
              value={email}
              onChange={handleEmailChange}
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
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />

            <Button
              variant="contained"
              color="primary"
              fullWidth
              onClick={handleSignIn}
              disabled={loading || !email || !!emailError || !password}  
            >
              {loading ? "Signing in..." : "Sign in"}
            </Button>

            <Box sx={{ mt: 2 }}>
              <Button onClick={() => navigate("/forgot-password")} variant="text" size="small">
                Forgot Password?
              </Button>
              <Button onClick={() => navigate("/register")} variant="text" size="small">
                New User?
              </Button>
            </Box>

            <Typography variant="caption" sx={{ display: "block", mt: 2, color: "text.secondary" }}>
              Demo accounts (any password): [admin@gmail.com](mailto:admin@gmail.com), [paiduser@gmail.com](mailto:paiduser@gmail.com), [user@gmail.com](mailto:user@gmail.com)
            </Typography>
          </Paper>
        </motion.div>
      </Container>
    </Box>
  );
}
