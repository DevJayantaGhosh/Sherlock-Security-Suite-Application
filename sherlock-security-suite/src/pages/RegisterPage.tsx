// src/pages/RegisterPage.tsx
import { useState } from "react";
import { Box, Container, Paper, Typography, TextField, Button } from "@mui/material";
import { motion } from "framer-motion";
import { registerLocal } from "../services/userService";
import { useNavigate } from "react-router-dom";

export default function RegisterPage() {
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  function handleRegister() {
    try {
      registerLocal(userName,email,password);
      navigate("/products");
    } catch (err) {
      alert((err as Error).message);
    }
  }

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
            <TextField fullWidth label="UserName" sx={{ mb: 2 }} value={userName} onChange={(e) => setUserName(e.target.value)} />
            <TextField fullWidth label="Email" sx={{ mb: 2 }} value={email} onChange={(e) => setEmail(e.target.value)} />
            <TextField fullWidth label="Password" type="password" sx={{ mb: 3 }} value={password} onChange={(e) => setPassword(e.target.value)} />
            <Button variant="contained" color="primary" fullWidth onClick={handleRegister}>Sign up</Button>
            <Typography variant="caption" sx={{ display: "block", mt: 2, color: "text.secondary" }}>
              Use one of the demo emails: admin@gmail.com, director@gmail.com, security@gmail.com, engineer@gmail.com, user@gmail.com
            </Typography>
          </Paper>
        </motion.div>
      </Container>
    </Box>
  );
}
