// src/pages/AdminPage.tsx
import { Box, Container, Typography } from "@mui/material";
import { useEffect, useState } from "react";

import AdminCharts from "../components/AdminCharts";
import UsersTable from "../components/UsersTable";
import AdminStats from "../components/AdminStats";

import { getUsers } from "../services/userService";
import { getProjects } from "../services/projectService";

import { AppUser } from "../models/User";
import { Project } from "../models/project";
import { motion } from "framer-motion";

export default function AdminPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const loadData = async () => {
    setUsers(await getUsers());
    setProjects(await getProjects());
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <Box
      sx={{
        p: 4,
        pt: 6,
        minHeight: "100vh",
        bgcolor: "#060712",
      }}
    >
      <Container maxWidth="xl">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        >
          <Typography
            variant="h3"
            sx={{
              mb: 3,
              fontWeight: 800,
              textAlign: "center",
              letterSpacing: 1,
            }}
          >
            Admin Dashboard
          </Typography>


          {/* -------- STATS CARDS -------- */}
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 3 }}>
            <AdminStats title="Total Projects" value={projects.length} />
            <AdminStats
              title="Approved"
              value={projects.filter(p => p.status === "Approved").length}
            />
            <AdminStats
              title="Pending"
              value={projects.filter(p => p.status === "Pending").length}
            />
            <AdminStats
              title="Rejectd"
              value={projects.filter(p => p.status === "Rejected").length}
            />
            <AdminStats title="Total Users" value={users.length} />
          </Box>

          {/* -------- CHARTS -------- */}
          <AdminCharts projects={projects} users={users} />

          {/* -------- USERS TABLE -------- */}
          <Box sx={{ mt: 4 }}>
            <Typography variant="h5" sx={{ mb: 2 }}>
              User Management
            </Typography>

            <UsersTable
              users={users}
              onEdit={() => { }}
              refresh={loadData}
            />



          </Box>
        </motion.div>
      </Container>

    </Box>
  );
}
