import { Box, Container, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import FeatureCards from '../components/FeatureCards';

export default function About() {
  return (
    <Box
      sx={{
        p: 4,
        pt: 8,
        minHeight: "100vh",
        bgcolor: "#060712",
      }}
    >
      <Container maxWidth="xl">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        >

          <Typography
            variant="h3"
            fontWeight={800}
            mb={3}
            sx={{ lineHeight: 1.2, textAlign: "center", }}
          >
            About Sherlock Security Suite
          </Typography>

          <Typography
            color="text.secondary"
            sx={{
              fontSize: "1.15rem",
              lineHeight: 1.8,
              maxWidth: "700px",
              textAlign: "center",
              mx: "auto",
            }}
          >
            Sherlock helps organizations find, contain, and remediate threats
            with modern tooling and people. We combine managed detection,
            blockchain-backed auditing, and AI-driven analytics.
          </Typography>



        </motion.div>
         <Box sx={{
        pt: 6,
      }}>
        <FeatureCards />
         </Box>

      </Container>
    </Box>
  );
}
