import React from 'react';
import { Box, Paper, Stack, Typography, Chip } from '@mui/material';
import { motion } from 'framer-motion';
import { Product } from '../models/Product'; // Adjust path

// Icons
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

// Icon Config
const ICON_CONFIG = {
  crypto: { color: '#00e5ff', shadow: 'rgba(0,229,255,0.5)' },
  security: { color: '#ff9800', shadow: 'rgba(255,152,0,0.5)' },
  release: { color: '#7b5cff', shadow: 'rgba(123,92,255,0.5)' },
  verify: { color: '#4caf50', shadow: 'rgba(76,175,80,0.5)' },
  default: { color: '#00e5ff', shadow: 'rgba(0,229,255,0.5)' }
} as const;

const FINAL_TITLES = {
  crypto: 'Cryptographic Signing Station',
  security: 'Security Scan & Analysis',
  release: 'Release Station',
  verify: 'Digital Signature Verification',
  default: 'Product Dashboard'
} as const;

const ProductHeader: React.FC<ProductHeaderProps> = ({ 
  product, 
  pageType = 'default', 
  description = product.description || '',
  titleOverride 
}) => {
  const config = ICON_CONFIG[pageType as keyof typeof ICON_CONFIG];

  // Get main title
  const mainTitle = titleOverride || FINAL_TITLES[pageType as keyof typeof FINAL_TITLES] || FINAL_TITLES.default;

  // MUI Icon with proper sx props
  const getIcon = (pageType: string, config: typeof ICON_CONFIG[keyof typeof ICON_CONFIG]) => {
    const iconSx = {
      fontSize: 95,
      color: config.color,
      transition: 'all 0.5s ease' as const,
      filter: `drop-shadow(0 0 15px ${config.shadow})` as const
    };

    switch (pageType) {
      case 'crypto': return <FingerprintIcon sx={iconSx} />;
      case 'security': return <SecurityIcon sx={iconSx} />;
      case 'release': return <RocketLaunchIcon sx={iconSx} />;
      case 'verify': return <ReceiptLongIcon sx={iconSx} />;
      default: return <FingerprintIcon sx={iconSx} />;
    }
  };

  // Scan line animation
  const ScanLine = () => (
    <motion.div
      initial={{ top: "0%", opacity: 0 }}
      animate={{ top: ["0%", "100%", "0%"], opacity: 1 }}
      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      style={{
        position: "absolute" as const,
        left: 0,
        width: "100%",
        height: "2px",
        background: "linear-gradient(90deg, transparent, #fff, transparent)",
        boxShadow: `0 0 10px ${config.color}, 0 0 20px ${config.color}`,
        zIndex: 2
      }}
    />
  );

  // Hex to RGB for chip backgrounds
  const hexToRgb = (hex: string): string => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result 
      ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
      : '255,255,255';
  };

  return (
    <Paper sx={{ 
      p: 3, 
      mb: 4, 
      background: "linear-gradient(140deg, #0c1023 0%, #090c1c 100%)", 
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 2
    }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Box sx={{ flex: 1 }}>
          {/* 1. MAIN HEADING */}
          <Typography variant="h4" fontWeight={800} sx={{ color: "#ffffff", mb: 0.5 }}>
            {mainTitle}
          </Typography>
          
          {/* 2. PRODUCT NAME - Subheading */}
          <Typography variant="h6" fontWeight={700} sx={{ color: "#00e5ff", mb: 1.5 }}>
            {product.name}
          </Typography>
          
          {/* 3. DESCRIPTION */}
          <Typography color="text.secondary" sx={{ fontSize: '1rem', lineHeight: 1.4, mb: 2.5 }}>
            {description}
          </Typography>
          
          {/* 4. CHIPS */}
          <Stack direction="row" spacing={2} alignItems="center">
            <Chip 
              label={`v${product.version}`} 
              size="small" 
              variant="outlined" 
              sx={{ color: "white", borderColor: "rgba(255,255,255,0.3)", fontWeight: 600 }} 
            />
            <Chip 
              label={`${product.repos.length === 1 ? 'Repository' : 'Repositories'} (${product.repos.length})`} 
              size="small" 
              sx={{ 
                color: config.color,
                bgcolor: `rgba(${hexToRgb(config.color)}, 0.15)`,
                fontWeight: 600,
                border: `1px solid rgba(${hexToRgb(config.color)}, 0.3)`
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
            />
          </Stack>
        </Box>

        {/* RIGHT SIDE: Animated Icon (unchanged) */}
        <Box sx={{ 
          position: "relative", 
          width: 80, 
          height: 80, 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center",
          ml: 3 
        }}>
          {getIcon(pageType, config)}
          <ScanLine />
        </Box>
      </Stack>
    </Paper>
  );
};

export default ProductHeader;
