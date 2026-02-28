import { useRef } from 'react';
import { Container, Card, CardContent, Typography, Box } from '@mui/material';
import { motion } from 'framer-motion';


import SecurityIcon from '@mui/icons-material/Security';
import LanIcon from '@mui/icons-material/Lan';
import FingerprintIcon from '@mui/icons-material/Fingerprint';

const features = [
  {
    title: 'Vulnerability Scan',
    body: 'Vulnerability scanning and proactive defense against next-gen cyber attacks.',
    icon: <SecurityIcon fontSize="large" />,
  },
  {
    title: 'Cryptographic Trust',
    body: 'Software integrity guaranteed by cryptographic signing and verification.',
    icon: <FingerprintIcon fontSize="large" />,
  },
  {
    title: 'Secure Distribution',
    body: 'Blockchain-backed auditing that guarantee trusted software distribution.',
    icon: <LanIcon fontSize="large" />,

  },
];

export default function FeatureCards() {
  const ref = useRef<HTMLDivElement | null>(null);

  return (
    <Box
      ref={ref}
      sx={{
        py: { xs: 6, md: 12 },
        mt: { xs: -4, md: -8 },
      }}
    >
      <Container
        maxWidth={false}
        sx={{
          width: '100%',
          maxWidth: '1400px !important',
          px: { xs: 2, md: 4 },
          boxSizing: 'border-box',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >

          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 2,
              flexWrap: 'nowrap', // prevents wrapping
            }}
          >
            {features.map((f) => (
              <motion.div
                key={f.title}
                whileHover={{ y: -10 }}
                transition={{ type: 'spring', stiffness: 200 }}
              >
                <Card
                  sx={{
                    width: 330, // same width each card, ensures 3 fit in one row
                    p: 2,
                    minHeight: 200,
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.02)',
                      boxShadow: '0 0 35px rgba(123,92,255,0.35)',
                    backdropFilter: 'blur(6px)',
                    transition: '0.3s',
                    '&:hover': {
                      boxShadow: '0 0 35px rgba(123,92,255,0.35)',
                      borderColor: 'rgba(123,92,255,0.4)',
                    },
                  }}
                >
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={2} mb={2}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: 2,
                          background: 'linear-gradient(135deg,#7b5cff,#5ce1e6)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#060712',
                        }}
                      >
                        {f.icon}
                      </Box>

                      <Typography variant="h6" fontWeight={800}>
                        {f.title}
                      </Typography>
                    </Box>

                    <Typography color="text.secondary">{f.body}</Typography>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </Box>
        </motion.div>
      </Container>
    </Box>
  );
}
