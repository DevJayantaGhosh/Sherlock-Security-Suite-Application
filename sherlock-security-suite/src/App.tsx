// src/App.tsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Box } from "@mui/material";

import NavBar from "./components/NavBar";
import Footer from "./components/Footer";
import Home from "./pages/HomePage";
import About from "./pages/AboutPage";
import Projects from "./pages/ProjectPage";
import Login from "./pages/LoginPage";
import AdminPage from "./pages/AdminPage";
import ProtectedRoute from "./auth/ProtectedRoute";

export default function App() {
  return (
    <Router>
      <NavBar />

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          pt: "64px",                  // navbar height
          minHeight: "calc(100vh - 128px)", // 64 navbar + 64 footer
        }}
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/projects" element={<Projects />} />
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
