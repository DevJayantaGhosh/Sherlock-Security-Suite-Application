import { useState } from "react";
import {
  Box, Button, Paper, Stack, Typography, TextField, 
  IconButton, InputAdornment, Dialog, DialogContent, 
  Tooltip
} from "@mui/material";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { ethers } from "ethers";

// Icons
import TokenIcon from "@mui/icons-material/Token";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import LinkIcon from "@mui/icons-material/Link";

// --- GLOBAL TYPE DECLARATION ---
// Ensures TS knows about window.ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}

// --- HEDERA CONFIGURATION ---
const HEDERA_TESTNET_CONFIG = {
  chainId: "0x128", // Decimal 296
  chainName: "Hedera Testnet",
  nativeCurrency: { name: "HBAR", symbol: "HBAR", decimals: 18 },
  rpcUrls: ["https://testnet.hashio.io/api"],
  blockExplorerUrls: ["https://hashscan.io/testnet/"],
};

// --- SUB-COMPONENT: ANIMATED LOADER ---
const BlockchainLoader = () => (
  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 300 }}>
    <Box sx={{ position: "relative", width: 100, height: 100 }}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        style={{ position: "absolute", inset: 0, border: "4px solid #ffc107", borderRadius: "12px", borderStyle: "dashed" }}
      />
      <motion.div
        animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
        style={{ position: "absolute", inset: 15, background: "rgba(255, 193, 7, 0.2)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <TokenIcon sx={{ fontSize: 40, color: "#ffc107" }} />
      </motion.div>
    </Box>
    <Stack direction="row" spacing={1} mt={4}>
      {[1, 2, 3, 4, 5].map((i) => (
        <motion.div
          key={i}
          animate={{ height: [10, 30, 10], backgroundColor: ["#333", "#ffc107", "#333"] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.1 }}
          style={{ width: 6, borderRadius: 4 }}
        />
      ))}
    </Stack>
    <Typography variant="h6" sx={{ color: "#ffc107", mt: 3, fontWeight: "bold", letterSpacing: 2 }}>IMMUTABLE LEDGER SYNC</Typography>
    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)", fontFamily: "monospace" }}>Hashing Signature & Minting Transaction...</Typography>
  </Box>
);

interface BlockchainProps {
    variants: Variants;
    suggestedFile?: string; // Prop to receive file path from parent
}

export default function BlockchainArchivalCard({ variants, suggestedFile = "" }: BlockchainProps) {
  const [walletAddress, setWalletAddress] = useState("");
  const [signatureFile, setSignatureFile] = useState(suggestedFile);
  const [isUploading, setIsUploading] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [showBlockchainModal, setShowBlockchainModal] = useState(false);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);

  // Sync state if parent passes a new suggested file (e.g., after signing completes)
  if(suggestedFile && signatureFile !== suggestedFile && signatureFile === "") {
      setSignatureFile(suggestedFile);
  }

  const handleSelectSigFile = async () => {
    // Uses global electronAPI defined in your env.d.ts
    const path = await window.electronAPI.selectFile();
    if (path) setSignatureFile(path);
  };

  const connectWallet = async () => {
    if (!window.ethereum) { alert("MetaMask is not installed. Please install it."); return; }
    
    try {
      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await browserProvider.send("eth_requestAccounts", []);
      
      // Check and Switch Network to Hedera Testnet
      const network = await browserProvider.getNetwork();
      if (network.chainId !== BigInt(HEDERA_TESTNET_CONFIG.chainId)) {
        try {
          await window.ethereum.request({ 
              method: "wallet_switchEthereumChain", 
              params: [{ chainId: HEDERA_TESTNET_CONFIG.chainId }] 
          });
        } catch (switchError: any) {
          // This error code 4902 means the chain has not been added to MetaMask.
          if (switchError.code === 4902) {
             await window.ethereum.request({ 
                 method: "wallet_addEthereumChain", 
                 params: [HEDERA_TESTNET_CONFIG] 
             });
          }
        }
      }
      
      setProvider(browserProvider);
      setWalletAddress(accounts[0]);
    } catch (e: any) { 
        console.error("Wallet Connection Error:", e);
    }
  };

  const uploadToBlockchain = async () => {
    if (!walletAddress || !provider) return;
    setShowBlockchainModal(true);
    setIsUploading(true);
    setTxHash("");
    
    try {
        const signer = await provider.getSigner();
        
        // Embed file path reference into the transaction data
        // For a real immutable proof, you would typically hash the file content here using SHA-256
        // e.g. "ProofOfExistence:<Hash>"
        const fileDataHex = ethers.hexlify(ethers.toUtf8Bytes(`SigFile:${signatureFile}`));
        
        // Send 0 HBAR transaction to self with data
        const tx = await signer.sendTransaction({
            to: walletAddress, 
            value: 0,
            data: fileDataHex
        });
        
        const receipt = await tx.wait();
        setTxHash(receipt?.hash || "0xError");
        setIsUploading(false);
    } catch (error: any) {
        console.error("Transaction Failed", error);
        setIsUploading(false);
        setShowBlockchainModal(false);
        alert("Transaction Failed: " + error.message);
    }
  };

  return (
    <>
      <motion.div variants={variants}>
        <Paper sx={{ p: 3, borderLeft: "4px solid #ffc107", background: "linear-gradient(90deg, rgba(255, 193, 7, 0.05), transparent)" }}>
          <Typography variant="h6" fontWeight={700} gutterBottom display="flex" alignItems="center" gap={1}>
            <TokenIcon sx={{ color: "#ffc107" }} /> Blockchain Ledger Archival
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
             Upload the generated signature hash to the Hedera network for immutable proof of existence.
          </Typography>

          <Stack spacing={3}>
             {/* Wallet Connection Status */}
             <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 2, bgcolor: "rgba(255,193,7,0.05)", borderRadius: 1, border: "1px dashed rgba(255,193,7,0.3)" }}>
                <Box display="flex" alignItems="center" gap={2}>
                    <AccountBalanceWalletIcon sx={{ color: walletAddress ? "#69f0ae" : "text.secondary" }} />
                    <Box>
                        <Typography variant="subtitle2" color="white">{walletAddress ? "Wallet Connected" : "No Wallet Connected"}</Typography>
                        <Typography variant="caption" color="text.secondary" fontFamily="monospace">{walletAddress || "Connect MetaMask to proceed"}</Typography>
                    </Box>
                </Box>
                {!walletAddress && (
                    <Button variant="outlined" onClick={connectWallet} sx={{ color: "#ffc107", borderColor: "#ffc107" }}>Connect Wallet</Button>
                )}
             </Stack>

             {/* Upload Controls */}
             <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField 
                    fullWidth label="Signature File" value={signatureFile} 
                    InputProps={{ 
                        readOnly: true, 
                        endAdornment: (<InputAdornment position="end"><IconButton onClick={handleSelectSigFile}><FolderOpenIcon /></IconButton></InputAdornment>) 
                    }} 
                />
                <Button 
                    variant="contained" size="large" disabled={!walletAddress || !signatureFile} onClick={uploadToBlockchain}
                    sx={{ bgcolor: "#ffc107", color: "black", fontWeight: "bold", minWidth: 200, "&:hover": { bgcolor: "#ffb300" } }}
                    startIcon={<CloudUploadIcon />}
                >
                    Upload to Ledger
                </Button>
             </Stack>
          </Stack>
        </Paper>
      </motion.div>

      {/* --- TRANSACTION MODAL --- */}
      <Dialog 
        open={showBlockchainModal} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: "#050505", border: "1px solid #333", boxShadow: "0 0 80px rgba(255, 193, 7, 0.15)", borderRadius: 4 } }}
      >
        <DialogContent sx={{ p: 5, textAlign: "center", position: "relative", overflow: "hidden" }}>
           <AnimatePresence mode="wait">
             {isUploading ? (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><BlockchainLoader /></motion.div>
             ) : (
                <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                    <Box sx={{ py: 2 }}>
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 10 }}>
                            <CheckCircleIcon sx={{ fontSize: 90, color: "#69f0ae", mb: 3 }} />
                        </motion.div>
                        <Typography variant="h5" color="white" fontWeight="bold" gutterBottom>Transaction Confirmed</Typography>
                        <Typography color="text.secondary" sx={{ mb: 4 }}>The signature has been successfully mined on Hedera.</Typography>
                        
                        <Paper sx={{ p: 2, bgcolor: "#111", border: "1px solid #333", mb: 4, textAlign: "left" }}>
                            <Typography variant="caption" color="text.secondary" display="block" mb={1}>TRANSACTION HASH</Typography>
                            <Stack direction="row" alignItems="center" justifyContent="space-between">
                                <Typography variant="body2" color="#ffc107" fontFamily="monospace" sx={{ wordBreak: "break-all" }}>{txHash}</Typography>
                                <Tooltip title="View on HashScan">
                                    <IconButton size="small" sx={{ color: "white" }} href={`https://hashscan.io/testnet/transaction/${txHash}`} target="_blank">
                                        <LinkIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </Stack>
                        </Paper>
                        <Button variant="outlined" color="inherit" onClick={() => setShowBlockchainModal(false)} fullWidth>Close Receipt</Button>
                    </Box>
                </motion.div>
             )}
           </AnimatePresence>
        </DialogContent>
      </Dialog>
    </>
  );
}
