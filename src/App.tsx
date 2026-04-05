// src/App.tsx
import { useState, useEffect, useCallback } from "react";
import { HashRouter as Router, Routes, Route } from "react-router-dom";
import { Box, Fab, Drawer, IconButton, Typography, Stack } from "@mui/material";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import CloseIcon from "@mui/icons-material/Close";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import MinimizeIcon from "@mui/icons-material/Minimize";

import NavBar from "./components/NavBar";
import Footer from "./components/Footer";
import LLMChatPanel from "./components/llm/LLMChatPanel";
import { useUserStore } from "./store/userStore";

import Home from "./pages/HomePage";
import About from "./pages/AboutPage";
import Login from "./pages/LoginPage";
import AdminPage from "./pages/AdminPage";
import ProtectedRoute from "./auth/ProtectedRoute";
import RegisterPage from "./pages/RegisterPage";
import ProductPage from "./pages/ProductPage";
import ProductReleasePage from "./pages/ProductReleasePage";
import ProductSecurityScanPage from "./pages/ProductSecurityScanPage";
import ProductCryptoSigningPage from "./pages/ProductCryptoSigningPage";
import ProductSignatureVerificationPage from "./pages/ProductSignatureVerificationPage";
import ForgotPassword from "./pages/ForgotPassword";
import LicenseActivationPage from "./pages/LicenseActivationPage";
import QuickSecurityScanPage from "./pages/QuickSecurityScanPage";
import QuickCryptoSigningPage from "./pages/QuickCryptoSigningPage";
import QuickSignatureVerificationPage from "./pages/QuickSignatureVerificationPage";
import QuickReleasePage from "./pages/QuickReleasePage";
import UserGuidePage from "./pages/UserGuidePage";

export default function App() {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(false);
  const user = useUserStore((s) => s.user);

  // Listen for "analyze-with-sherlock" events dispatched by AnalyzeLogButton
  const openChat = useCallback(() => setChatOpen(true), []);
  useEffect(() => {
    window.addEventListener("analyze-with-sherlock", openChat);
    return () => window.removeEventListener("analyze-with-sherlock", openChat);
  }, [openChat]);

  return (
    <Router>
      <NavBar />

      {/* Main content wrapper for pages except login */}
      <Box
        component="main"
        sx={{
          pt: "64px",
          minHeight: "calc(100vh - 128px)",
        }}
      >
        <Routes>
          {/* Public pages without layout interference */}
          <Route path="/user-guide" element={<UserGuidePage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />

          {/* Protected and layouted pages */}
          <Route
            path="/license-activation"
            element={
              <ProtectedRoute>
                <LicenseActivationPage />
              </ProtectedRoute>
            } />
          <Route
            path="/products"
            element={
              <ProtectedRoute>
                <ProductPage />
              </ProtectedRoute>
            }
          />
            <Route
            path="/quick-security-scan"
            element={
              <ProtectedRoute>
                <QuickSecurityScanPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quick-crypto-sign"
            element={
              <ProtectedRoute>
                <QuickCryptoSigningPage />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/quick-sign-verify"
            element={
              <ProtectedRoute>
                <QuickSignatureVerificationPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quick-release"
            element={
              <ProtectedRoute>
                <QuickReleasePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/product/:id/security-scan"
            element={
              <ProtectedRoute>
                <ProductSecurityScanPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/product/:id/cryptographic-signing"
            element={
              <ProtectedRoute>
                <ProductCryptoSigningPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/product/:id/releases"
            element={
              <ProtectedRoute>
                <ProductReleasePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/product/:id/signature-verify"
            element={
              <ProtectedRoute>
                <ProductSignatureVerificationPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={["Admin"]}>
                <AdminPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Box>

      <Footer />

      {/* Floating AI Chat Button — only when logged in */}
      {user && (
        <Fab
          color="primary"
          onClick={() => setChatOpen(true)}
          sx={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 1200,
            background: "linear-gradient(135deg,#7b5cff,#5ce1e6)",
            "&:hover": { background: "linear-gradient(135deg,#6a4cee,#4cd1d6)" },
          }}
          title="Sherlock AI Chat"
        >
          <SmartToyIcon />
        </Fab>
      )}

      {/* AI Chat Drawer */}
      <Drawer
        anchor="right"
        open={chatOpen}
        onClose={() => { setChatOpen(false); setChatExpanded(false); }}
        ModalProps={{ keepMounted: true }}
        PaperProps={{
          sx: {
            width: chatExpanded
              ? { xs: "100%", sm: "90vw" }
              : { xs: "100%", sm: 460 },
            maxWidth: "100vw",
            transition: "width 0.3s ease",
            p: 0,
          },
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ px: 2, py: 1.5, borderBottom: "1px solid", borderColor: "divider" }}
        >
          <Typography fontWeight={700} variant="subtitle1">
            🔍 Sherlock AI
          </Typography>
          <Stack direction="row" spacing={0.5}>
            {/* Expand to full */}
            <IconButton
              size="small"
              title="Expand panel"
              onClick={() => setChatExpanded(true)}
            >
              <OpenInFullIcon fontSize="small" />
            </IconButton>
            {/* Minimize — shrink back to small drawer */}
            <IconButton
              size="small"
              title="Minimize panel"
              onClick={() => setChatExpanded(false)}
            >
              <MinimizeIcon fontSize="small" />
            </IconButton>
            {/* Close */}
            <IconButton
              size="small"
              title="Close chat"
              onClick={() => { setChatOpen(false); setChatExpanded(false); }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>
        <Box sx={{ flex: 1, overflow: "hidden" }}>
          <LLMChatPanel height="calc(100vh - 56px)" hideSidebar={!chatExpanded} />
        </Box>
      </Drawer>
    </Router>
  );
}
