import { Box, Container, Typography } from '@mui/material';
import { motion } from 'framer-motion';

export default function About() {
  return (
    <Box
      sx={{
        pt: 14,
        pb: 12,
        minHeight: "80vh", // keep footer down
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
      }}
    >
      <Container maxWidth="md">
        
        {/* Fade + Slide Animation Wrapper */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        >
          <Typography
            variant="h3"
            fontWeight={800}
            mb={3}
            sx={{ lineHeight: 1.2 }}
          >
            About Sherlock Security Suite
          </Typography>

          <Typography
            color="text.secondary"
            sx={{
              fontSize: "1.15rem",
              lineHeight: 1.8,
              maxWidth: "700px",
              mx: "auto",
            }}
          >
            Sherlock helps organizations find, contain, and remediate threats 
            with modern tooling and people. We combine managed detection, 
            blockchain-backed auditing, and AI-driven analytics.
          </Typography>
        </motion.div>

      </Container>
    </Box>
  );
}
