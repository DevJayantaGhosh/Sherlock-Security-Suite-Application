import { useState, useEffect, useCallback } from "react";
import {
  Box, Button, Paper, Stack, Typography, TextField,
  IconButton, Dialog, DialogContent,
  Chip
} from "@mui/material";
import { motion, Variants } from "framer-motion";
import { ethers } from "ethers";
import { toast } from 'react-hot-toast';
import isElectron from 'is-electron';
import { Product } from '../../models/Product';
import { updateProduct } from '../../services/productService';
import { uploadToIPFS } from '../../services/ipfsService';

// Icons
import TokenIcon from "@mui/icons-material/Token";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import LinkIcon from "@mui/icons-material/Link";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";

// HEDERA CONFIG
const HEDERA_TESTNET_CONFIG = {
  chainId: "0x128",
  chainName: "Hedera Testnet",
  nativeCurrency: { name: "HBAR", symbol: "HBAR", decimals: 18 },
  rpcUrls: ["https://testnet.hashio.io/api"],
  blockExplorerUrls: ["https://hashscan.io/testnet/"],
};

interface BlockchainProps {
  variants: Variants;
  product: Product;
}

// UNIVERSAL FILE SELECTION (Electron + Web)
const selectFileUniversal = async (): Promise<string | null> => {
  if (isElectron() && (window as any).electronAPI?.selectFile) {
    try {
      return await (window as any).electronAPI.selectFile();
    } catch (error) {
      console.error("File dialog failed:", error);
      return null;
    }
  }

  // Web browser file picker
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.pub,.pem,.key,.txt,.sig,gpg.asc';
  input.style.display = 'none';

  return new Promise((resolve) => {
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      resolve(file ? file.name : null);
    };
    input.oncancel = () => resolve(null);
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  });
};

export default function BlockchainArchivalCard({
  variants,
  product
}: BlockchainProps) {
  const [walletAddress, setWalletAddress] = useState("");
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [isElectronApp, setIsElectronApp] = useState(false);

  // File states
  const [publicKeyLocalPath, setPublicKeyLocalPath] = useState("");
  const [publicKeyIpfsPath, setPublicKeyIpfsPath] = useState(product.publicKeyFilePath || "");
  const [signatureLocalPath, setSignatureLocalPath] = useState("");
  const [signatureIpfsPath, setSignatureIpfsPath] = useState(product.signatureFilePath || "");

  const [isProcessing, setIsProcessing] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [showModal, setShowModal] = useState(false);

  // Detect environment
  useEffect(() => {
    setIsElectronApp(isElectron());
  }, []);

  const updateProductWithSignature = useCallback(async (signatureFilePath: string) => {
    if (!product) return;

    try {
      const updatedProduct: Partial<Product> = {
        signatureFilePath,
      };

      await updateProduct(product.id, updatedProduct);
      toast.success(`Signature saved: ${signatureFilePath.substring(0, 50)}...`, {
        id: `signature-save-${product.id}`
      });
    } catch (error: any) {
      console.error("Failed to update product:", error);
      toast.error("Failed to save signature to product", {
        id: `signature-save-error-${product.id}`
      });
    }
  }, [product]);

  const updateProductWithPublicKey = useCallback(async (publicKeyFilePath: string) => {
    if (!product) return;

    try {
      const updatedProduct: Partial<Product> = {
        publicKeyFilePath,
      };

      await updateProduct(product.id, updatedProduct);
      toast.success(`Public key saved: ${publicKeyFilePath.substring(0, 50)}...`, {
        id: `publickey-save-${product.id}`
      });
    } catch (error: any) {
      console.error("Failed to update product:", error);
      toast.error("Failed to save public key to product", {
        id: `publickey-save-error-${product.id}`
      });
    }
  }, [product]);

  // File selection handlers
  const handleSelectPublicKeyFile = async () => {
    const path = await selectFileUniversal();
    if (path) {
      setPublicKeyLocalPath(path);
      toast.success(`File selected`);
    }
  };

  const handleSelectSignatureFile = async () => {
    const path = await selectFileUniversal();
    if (path) {
      setSignatureLocalPath(path);
      toast.success(` File selected`);
    }
  };

  // Upload to IPFS (Mock for now)
  const handleUploadToIPFS = async (localPath: string, type: 'publickey' | 'signature') => {
    if (!localPath) {
      toast.error("Please select a file first");
      return;
    }

    setIsProcessing(true);
    try {
      const ipfsPath = await uploadToIPFS(localPath);

      if (type === 'publickey') {
        setPublicKeyIpfsPath(ipfsPath);
      } else {
        setSignatureIpfsPath(ipfsPath);
      }

      toast.success(`${type} uploaded to IPFS: ${ipfsPath.substring(0, 30)}...`);
    } catch (error: any) {
      toast.error(`IPFS upload failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Connect wallet
  async function connectWallet() {
    if (!(window as any).ethereum) {
      toast.error("MetaMask not installed");
      return;
    }

    try {
      const accounts = await (window as any).ethereum.request({
        method: "eth_requestAccounts",
      });
      setWalletAddress(accounts[0]);
      toast.success(`Connected: ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}`, {
        id: "wallet-connected",
        duration: 4000
      });
    } catch (err) {
      toast.error("Wallet connection rejected");
      console.error("[WALLET] Connection error:", err);
    }
  }

  // Archive to blockchain + Save to DB
  const archiveToBlockchain = async (fileType: 'publickey' | 'signature') => {
    if (!walletAddress || !provider) {
      toast.error("Please connect wallet first");
      return;
    }

    const ipfsPath = fileType === 'publickey' ? publicKeyIpfsPath : signatureIpfsPath;
    if (!ipfsPath) {
      toast.error("Please upload file to IPFS first");
      return;
    }

    setIsProcessing(true);
    try {
      // 1. Update DB using YOUR exact functions
      if (fileType === 'publickey') {
        await updateProductWithPublicKey(ipfsPath);
      } else {
        await updateProductWithSignature(ipfsPath);
      }

      // 2. Archive to blockchain
      const signer = await provider.getSigner();
      const txData = `Product:${product.name}|${fileType}:${ipfsPath}`;

      const tx = await signer.sendTransaction({
        to: walletAddress,
        value: 0,
        data: ethers.hexlify(ethers.toUtf8Bytes(txData))
      });

      // ✅ FIX: Handle null receipt
      const receipt = await tx.wait();
      if (receipt) {
        setTxHash(receipt.hash);
        setShowModal(true);
        toast.success(`✅ ${fileType} archived on Hedera! Tx: ${receipt.hash.slice(0, 10)}...`);
      }
    } catch (error: any) {
      toast.error(`Archive failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <motion.div variants={variants}>
      <Paper sx={{ p: 3, borderLeft: "4px solid #00e5ff", borderRadius: 1, mb: 3 }}>
        <Typography variant="h6" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TokenIcon sx={{ color: "#00e5ff", fontSize: 24 }} />
          Blockchain Archival
        </Typography>

        {/* Product Info */}
        
          <Typography variant="body2" color="text.secondary" mb={3}>
            Upload the generated signature hash to the Hedera network for immutable proof of existence.
          </Typography>
        

        {/*  WALLET */}
        <Paper sx={{ p: 3, mb: 4, bgcolor: "rgba(0,229,255,0.1)", border: "2px dashed #00e5ff" }}>
          <Typography variant="h6" fontWeight={500} mb={2.5} color="#00e5ff" sx={{ fontFamily: 'monospace' }}>
            Connect Wallet
          </Typography>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <AccountBalanceWalletIcon sx={{ fontSize: 32, color: walletAddress ? "#4caf50" : "#00e5ff" }} />
              <Box>
                <Typography fontWeight={600}>{walletAddress ? "✅ Connected" : "Connect MetaMask"}</Typography>
                {walletAddress && (
                  <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                    {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                  </Typography>
                )}
              </Box>
            </Box>
            <Button
              variant="contained"
              onClick={connectWallet}
              disabled={!!walletAddress || isProcessing}
              sx={{ bgcolor: "#00e5ff", color: "black", fontWeight: 700 }}
            >
              {walletAddress ? "Connected" : "Connect Wallet"}
            </Button>
          </Stack>
        </Paper>

        {/* 2. PUBLIC KEY */}
        <Paper sx={{ p: 3, mb: 4,  bgcolor: "rgba(0,229,255,0.1)" }}>
          <Typography variant="h6" fontWeight={500} mb={2.5} color="#00e5ff" sx={{ fontFamily: 'monospace' }}>
            🔑 Public Key
          </Typography>
          {/* Existing Path */}
          {product.publicKeyFilePath && (
            <Chip label="Existing Path" color="success" size="small" sx={{ mb: 2 }} />
          )}

          {/* File Select Row */}
          <Stack direction="row" spacing={2} sx={{ mb: 3, alignItems: 'center' }}>
            <TextField
              sx={{ flex: 1 }}
              label="Select File"
              value={publicKeyLocalPath}
              InputProps={{
                readOnly: true,
                endAdornment: (
                  <IconButton onClick={handleSelectPublicKeyFile} disabled={isProcessing}>
                    <FolderOpenIcon />
                  </IconButton>
                )
              }}
            />
            <Button
              variant="outlined"
              onClick={() => handleUploadToIPFS(publicKeyLocalPath, 'publickey')}
              disabled={!publicKeyLocalPath || isProcessing}
              startIcon={<CloudUploadIcon />}
              sx={{ minWidth: 180 }}
            >
              IPFS Upload
            </Button>
          </Stack>

          {/* IPFS Path + Archive Row */}
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <TextField
              sx={{ flex: 1 }}
              label="IPFS Path"
              value={publicKeyIpfsPath}
              InputProps={{
                readOnly: true,
                endAdornment: publicKeyIpfsPath && (
                  <IconButton onClick={() => navigator.clipboard.writeText(publicKeyIpfsPath || '')}>
                    <ContentCopyIcon />
                  </IconButton>
                )
              }}
            />
            <Button
              variant="contained"
              onClick={() => archiveToBlockchain('publickey')}
              disabled={!publicKeyIpfsPath || !walletAddress || isProcessing}
              sx={{ bgcolor: "#4caf50", color: "black", minWidth: 180 }}
            >
              Blockchain Archive
            </Button>
          </Stack>
        </Paper>

        {/* 3. SIGNATURE */}
        <Paper sx={{ p: 3, bgcolor: "rgba(0,229,255,0.1)" }}>
          <Typography variant="h6" fontWeight={500} mb={2.5} color="#00e5ff" sx={{ fontFamily: 'monospace' }}>
            🔐 Signature File
          </Typography>

          {/* Existing Path */}
          {product.signatureFilePath && (
            <Chip label="Existing Path" color="success" size="small" sx={{ mb: 2 }} />
          )}

          {/* File Select Row */}
          <Stack direction="row" spacing={2} sx={{ mb: 3, alignItems: 'center' }}>
            <TextField
              sx={{ flex: 1 }}
              label="Select File"
              value={signatureLocalPath}
              InputProps={{
                readOnly: true,
                endAdornment: (
                  <IconButton onClick={handleSelectSignatureFile} disabled={isProcessing}>
                    <FolderOpenIcon />
                  </IconButton>
                )
              }}
            />
            <Button
              variant="outlined"
              onClick={() => handleUploadToIPFS(signatureLocalPath, 'signature')}
              disabled={!signatureLocalPath || isProcessing}
              startIcon={<CloudUploadIcon />}
              sx={{ minWidth: 180 }}
            >
              IPFS Upload
            </Button>
          </Stack>

          {/* IPFS Path + Archive Row */}
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <TextField
              sx={{ flex: 1 }}
              label="IPFS Path"
              value={signatureIpfsPath}
              InputProps={{
                readOnly: true,
                endAdornment: signatureIpfsPath && (
                  <IconButton onClick={() => navigator.clipboard.writeText(signatureIpfsPath || '')}>
                    <ContentCopyIcon />
                  </IconButton>
                )
              }}
            />
            <Button
              variant="contained"
              onClick={() => archiveToBlockchain('signature')}
              disabled={!signatureIpfsPath || !walletAddress || isProcessing}
              sx={{ bgcolor: "#00e5ff", color: "black", minWidth: 180 }}
            >
              Blockchain Archive
            </Button>
          </Stack>
        </Paper>
      </Paper>

      {/* Success Modal */}
      <Dialog open={showModal} maxWidth="sm" fullWidth>
        <DialogContent sx={{ p: 4, textAlign: 'center' }}>
          <CheckCircleIcon sx={{ fontSize: 80, color: '#4caf50', mb: 2 }} />
          <Typography variant="h5" gutterBottom fontWeight={700}>
            Successfully Archived!
          </Typography>
          <Typography sx={{ mb: 3, fontFamily: 'monospace', wordBreak: 'break-all' }}>
            {txHash}
          </Typography>
          <IconButton
            href={`https://hashscan.io/testnet/transaction/${txHash}`}
            target="_blank"
            sx={{ mr: 2 }}
          >
            <LinkIcon />
          </IconButton>
          <Button variant="contained" onClick={() => setShowModal(false)}>
            Close
          </Button>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
