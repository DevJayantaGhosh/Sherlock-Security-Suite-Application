// src/components/Hero.tsx
import { useRef } from "react";
import { Box, Container, Typography, Button } from "@mui/material";
import { motion } from "framer-motion";
import useOnScreen from "../hooks/useOnScreen";
import { Link } from "react-router-dom";

export default function Hero() {
  const ref = useRef<HTMLDivElement | null>(null);
  const visible = useOnScreen(ref, "-80px");

  return (
    <Box ref={ref} sx={{ minHeight: "80vh", pt: 4, display: "flex", alignItems: "center" }}>
      <Container maxWidth="lg" sx={{ display: "flex", gap: 4, alignItems: "center", flexDirection: { xs: "column", md: "row" } }}>
        <motion.div initial={{ opacity: 0, x: -40 }} animate={visible ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.6 }} style={{ flex: 1 }}>
          <Typography variant="h2" sx={{ fontWeight: 900, lineHeight: 1.02, mb: 2 }}>Next-Gen <Box component="span" sx={{ color: "primary.main" }}>Cybersecurity</Box> for a Safer Tomorrow</Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 600, mb: 4 }}>Protect your digital world with cutting-edge threat detection, AI-powered monitoring, and enterprise-grade security solutions built for modern teams.</Typography>

          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            <Button variant="contained" color="primary" size="large" component={Link} to="/projects">Get Started</Button>
            <Button variant="outlined" size="large" component={Link} to="/about" sx={{ color: "rgba(188,165,255,0.95)", borderColor: "rgba(188,165,255,0.16)" }}>Learn More</Button>
          </Box>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={visible ? { opacity: 1, scale: 1 } : {}} transition={{ duration: 0.8 }} style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <Box component="img" src="/cyber-shield-glow.png" alt="shield" sx={{
            width: { xs: 220, md: 460 },
            WebkitMaskImage: "radial-gradient(circle, white 10%, transparent 100%)",
            maskImage: "radial-gradient(circle, white 10%, transparent 100%)",
            filter: "drop-shadow(0 20px 60px rgba(123,92,255,0.22))",
          }} />
        </motion.div>
      </Container>
    </Box>
  );
}
