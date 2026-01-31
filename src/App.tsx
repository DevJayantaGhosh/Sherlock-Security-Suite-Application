// src/App.tsx
import { HashRouter as Router, Routes, Route } from "react-router-dom";
import { Box } from "@mui/material";

import NavBar from "./components/NavBar";
import Footer from "./components/Footer";

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

export default function App() {
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
           <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />

          {/* Protected and layouted pages */}
          <Route
            path="/products"
            element={
              <ProtectedRoute>
                <ProductPage />
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
    </Router>
  );
}
