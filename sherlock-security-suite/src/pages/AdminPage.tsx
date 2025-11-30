// src/pages/Admin.tsx
import { Box, Container, Typography, Paper } from "@mui/material";
import { motion } from "framer-motion";

export default function AdminPage() {
  return (
    <Box sx={{ pt: 14, pb: 12, minHeight: "80vh" }}>
      <Container maxWidth="lg">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <Paper sx={{ p: 4 }}>
            <Typography variant="h4" fontWeight={800} mb={2}>Admin Dashboard (stub)</Typography>
            <Typography color="text.secondary">This is a placeholder for admin features: user management, stats, etc.</Typography>
          </Paper>
        </motion.div>
      </Container>
    </Box>
  );
}
