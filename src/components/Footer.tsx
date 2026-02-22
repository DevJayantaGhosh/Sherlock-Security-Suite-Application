// src/components/Footer.tsx
import { Box, Container, Typography } from "@mui/material";

export default function Footer() {
  return (
    <Box
      component="footer"
      sx={{
        minHeight: 64,
        py: 2,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",

        background: "rgba(6,7,18,0.86)",
        backdropFilter: "blur(6px)",
        borderTop: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      <Container
        maxWidth="lg"
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 0.5,
          textAlign: "center",
        }}
      >
        <Typography variant="body2">
          © {new Date().getFullYear()} Sherlock Security Suite
        </Typography>

        <Typography variant="body2" sx={{ opacity: 0.85 }}>
          Jayanta Ghosh (CS23M513@smail.iitm.ac.in)
        </Typography>
      </Container>
    </Box>
  );
}
