// src/App.tsx
import { HashRouter  as Router, Routes, Route } from "react-router-dom";
import { Box } from "@mui/material";

import NavBar from "./components/NavBar";
import Footer from "./components/Footer";
import Home from "./pages/HomePage";
import About from "./pages/AboutPage";
import Projects from "./pages/ProjectPage";
import Login from "./pages/LoginPage";
import AdminPage from "./pages/AdminPage";
import ProjectReleasePage from "./pages/ProjectReleasePage";
import ProtectedRoute from "./auth/ProtectedRoute";
import ProjectSecurityScanPage from "./pages/ProjectSecurityScanPage";

export default function App() {
  return (
    <Router>
      <NavBar />

      <Box
        component="main"
        sx={{
          pt: "64px",
          minHeight: "calc(100vh - 128px)",
        }}
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/projects" element={<Projects />} />

          {/* ✅ Correct security scan route */}
          <Route
            path="/project/:id/security-scan"
            element={
                <ProjectSecurityScanPage />
            }
          />

          {/* ✅ Correct release route */}
          <Route
            path="/project/:id/releases"
            element={
                <ProjectReleasePage />
            }
          />

          <Route path="/login" element={<Login />} />

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
