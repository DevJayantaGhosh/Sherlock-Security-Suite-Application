import React from 'react';
import { Box, Paper, Stack, Typography, Chip } from '@mui/material';
import { motion } from 'framer-motion';
import { Product } from '../models/Product';

import FingerprintIcon from '@mui/icons-material/Fingerprint';
import SecurityIcon from '@mui/icons-material/Security';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';

interface ProductHeaderProps {
  product: Product;
  pageType: 'crypto' | 'security' | 'release' | 'verify' | 'default';
  description?: string;
  titleOverride?: string;
}

const PAGE_CONFIG = {
  crypto: { 
    color: '#00e5ff', 
    shadow: 'rgba(0,229,255,0.5)', 
    nameColor: '#00e5ff',
    repoColor: 'rgba(0,229,255,0.15)'
  },
  security: { 
    color: '#ff9800', 
    shadow: 'rgba(255,152,0,0.5)', 
    nameColor: '#ff9800',
    repoColor: 'rgba(255,152,0,0.15)'
  },
  release: { 
    color: '#7b5cff', 
    shadow: 'rgba(123,92,255,0.5)', 
    nameColor: '#7b5cff',
    repoColor: 'rgba(123,92,255,0.15)'
  },
  verify: { 
    color: '#4caf50', 
    shadow: 'rgba(76,175,80,0.5)', 
    nameColor: '#4caf50',
    repoColor: 'rgba(76,175,80,0.15)'
  },
  default: { 
    color: '#00e5ff', 
    shadow: 'rgba(0,229,255,0.5)', 
    nameColor: '#00e5ff',
    repoColor: 'rgba(0,229,255,0.15)'
  }
} as const;

const FINAL_TITLES = {
  crypto: 'Cryptographic Signing Station',
  security: 'Security Scan & Analysis',
  release: 'Release Station',
  verify: 'Digital Signature Verification',
  default: 'Product Distribution Pipeline'
} as const;

const ProductHeader: React.FC<ProductHeaderProps> = ({ 
  product, 
  pageType = 'default', 
  description = product.description || '',
  titleOverride 
}) => {
  const config = PAGE_CONFIG[pageType as keyof typeof PAGE_CONFIG];
  const mainTitle = titleOverride || FINAL_TITLES[pageType as keyof typeof FINAL_TITLES] || FINAL_TITLES.default;

  const getIcon = (pageType: string, config: typeof PAGE_CONFIG[keyof typeof PAGE_CONFIG]) => {
    const iconSx = {
      fontSize: 65, // Reduced from 95
      color: config.color,
      transition: 'all 0.5s ease' as const,
      filter: `drop-shadow(0 0 6px ${config.shadow}) drop-shadow(0 0 12px ${config.shadow})` as const
    };

    switch (pageType) {
      case 'crypto': return <FingerprintIcon sx={iconSx} />;
      case 'security': return <SecurityIcon sx={iconSx} />;
      case 'release': return <RocketLaunchIcon sx={iconSx} />;
      case 'verify': return <ReceiptLongIcon sx={iconSx} />;
      default: return <FingerprintIcon sx={iconSx} />;
    }
  };

  const ScanLineTop = () => (
    <motion.div
      initial={{ top: "0%", opacity: 0 }}
      animate={{ top: ["0%", "50%", "0%"], opacity: [0, 1, 0] }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      style={{
        position: "absolute" as const,
        left: 0,
        width: "100%",
        height: "1.5px", // Reduced thickness
        background: `linear-gradient(90deg, transparent, ${config.color}, white, ${config.color}, transparent)`,
        boxShadow: `0 0 10px ${config.color}`,
        zIndex: 2,
        top: 0
      }}
    />
  );

  const ScanLineBottom = () => (
    <motion.div
      initial={{ bottom: "0%", opacity: 0 }}
      animate={{ bottom: ["0%", "50%", "0%"], opacity: [0, 1, 0] }}
      transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
      style={{
        position: "absolute" as const,
        left: 0,
        width: "100%",
        height: "1.5px", // Reduced thickness
        background: `linear-gradient(90deg, transparent, ${config.color}, white, ${config.color}, transparent)`,
        boxShadow: `0 0 10px ${config.color}`,
        zIndex: 2,
        bottom: 0
      }}
    />
  );

  const hexToRgb = (hex: string): string => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result 
      ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
      : '255,255,255';
  };

  return (
    <Paper sx={{ 
      p: 3, // Reduced from 4
      mb: 3, // Reduced from 5
      background: "linear-gradient(140deg, #0c1023 0%, #090c1c 100%)", 
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 2, // Reduced from 3
      borderLeft: `4px solid ${config.color}`, // Reduced thickness
      boxShadow: `0 0 20px ${config.shadow}, inset 0 0 20px rgba(255,255,255,0.03)` // Reduced glow
    }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Box sx={{ flex: 1 }}>
          {/* MAIN HEADING - Smaller */}
          <Typography variant="h4" fontWeight={800} sx={{ // h3 -> h4
            color: "#ffffff", 
            mb: 0.5,
            textShadow: `0 0 10px rgba(255,255,255,0.2)` // Reduced glow
          }}>
            {mainTitle}
          </Typography>
          
          {/* PRODUCT NAME */}
          <Typography 
            variant="h6" // h5 -> h6
            fontWeight={700} 
            sx={{ 
              color: config.nameColor,
              mb: 1.5, // Reduced spacing
              textShadow: `0 0 8px ${config.shadow}`, // Single shadow, reduced
              transition: 'all 0.3s ease',
              letterSpacing: '0.2px'
            }}
          >
            {product.name}
          </Typography>
          
          {/* DESCRIPTION - More compact */}
          <Typography color="text.secondary" sx={{ 
            fontSize: '0.95rem', // Reduced from 1.1rem
            lineHeight: 1.4, 
            mb: 2, // Reduced spacing
            maxWidth: '450px'
          }}>
            {description}
          </Typography>
          
          {/* COMPACT CHIPS */}
          <Stack direction="row" spacing={1.5} alignItems="center"> {/* Reduced spacing */}
            <Chip 
              label={`v${product.version}`} 
              size="small" 
              variant="outlined" 
              sx={{ 
                color: "white", 
                borderColor: `rgba(${hexToRgb(config.color)}, 0.4)`,
                fontWeight: 600,
                fontSize: '0.75rem',
                height: 28 // Reduced from 36
              }} 
            />
            <Chip 
              label={`${product.repos.length === 1 ? 'Repository' : 'Repositories'} (${product.repos.length})`} 
              size="small"
              sx={{ 
                color: config.color,
                bgcolor: config.repoColor,
                fontWeight: 600,
                fontSize: '0.75rem',
                height: 28, // Reduced from 36
                border: `1px solid ${config.color}`,
                boxShadow: `0 0 6px ${config.shadow}` // Reduced glow
              }}
            />
            <Chip 
              label={product.status} 
              size="small"
              color={
                product.status === "Pending" ? "warning" :
                product.status === "Approved" || product.status === "Released" ? "success" :
                "error"
              }
              sx={{ height: 28, fontWeight: 600, fontSize: '0.75rem' }}
            />
          </Stack>
        </Box>

        {/* COMPACT ICON CONTAINER */}
        <Box sx={{ 
          position: "relative", 
          width: 85, // Reduced from 120
          height: 85, // Reduced from 120
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center",
          ml: 2 // Reduced from 4
        }}>
          {/* Smaller outer glow ring */}
          <Box sx={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            bgcolor: 'transparent',
            boxShadow: `0 0 20px ${config.shadow}`, // Reduced glow
          }} />
          
          {getIcon(pageType, config)}
          
          <ScanLineTop />
          <ScanLineBottom />
        </Box>
      </Stack>
    </Paper>
  );
};

export default ProductHeader;
