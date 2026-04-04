// src/App.tsx
import { useState } from "react";
import { HashRouter as Router, Routes, Route } from "react-router-dom";
import { Box, Fab, Drawer, IconButton, Typography, Stack } from "@mui/material";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import CloseIcon from "@mui/icons-material/Close";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";

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
import SecurityDiscussionPage from "./pages/SecurityDiscussionPage";

export default function App() {
  const [chatOpen, setChatOpen] = useState(false);
  const user = useUserStore((s) => s.user);

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
            path="/security-discussion"
            element={
              <ProtectedRoute>
                <SecurityDiscussionPage />
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
        onClose={() => setChatOpen(false)}
        PaperProps={{
          sx: { width: { xs: "100%", sm: 460 }, p: 0 },
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
            <IconButton
              size="small"
              title="Expand to full page"
              onClick={() => {
                setChatOpen(false);
                window.location.hash = "#/security-discussion";
              }}
            >
              <OpenInFullIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={() => setChatOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </Stack>
        <Box sx={{ flex: 1, overflow: "hidden" }}>
          <LLMChatPanel height="calc(100vh - 56px)" hideSidebar />
        </Box>
      </Drawer>
    </Router>
  );
}
