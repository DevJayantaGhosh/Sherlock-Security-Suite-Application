// src/pages/AdminPage.tsx
import { Box, Container, Typography, Fab } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import AdminCharts from "../components/admin/AdminCharts";
import UsersTable from "../components/admin/UsersTable";
import AdminStats from "../components/admin/AdminStats";
import AddEditUserDialog from "../components/admin/AddEditUserDialog";

import { getUsers } from "../services/userService";
import { getProjects } from "../services/projectService";

import { AppUser } from "../models/User";
import { Project } from "../models/project";

export default function AdminPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  // dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState<AppUser | null>(null);

  /* ---------------------------
        LOAD DATA
  ---------------------------- */
  const loadData = async () => {
    setUsers(await getUsers());
    setProjects(await getProjects());
  };

  useEffect(() => {
    loadData();
  }, []);

  /* ---------------------------
        HANDLERS
  ---------------------------- */
  const openAdd = () => {
    setEditUser(null);       // new user
    setDialogOpen(true);
  };

  const openEdit = (u: AppUser) => {
    setEditUser(u);         // edit mode
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditUser(null);
  };

  const onSaved = () => {
    closeDialog();
    loadData();
  };

  /* ---------------------------
            UI
  ---------------------------- */
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
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          {/* PAGE HEADER */}
          <Typography
            variant="h3"
            sx={{
              mb: 4,
              fontWeight: 800,
              textAlign: "center",
              letterSpacing: 1,
            }}
          >
            Admin Dashboard
          </Typography>

          {/* STATS */}
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 4 }}>
            <AdminStats title="Total Projects" value={projects.length} />
            <AdminStats title="Approved" value={projects.filter(p => p.status === "Approved").length} />
            <AdminStats title="Pending" value={projects.filter(p => p.status === "Pending").length} />
            <AdminStats title="Rejected" value={projects.filter(p => p.status === "Rejected").length} />
            <AdminStats title="Total Users" value={users.length} />
          </Box>

          {/* CHARTS */}
          <AdminCharts projects={projects} users={users} />

          {/* USERS TABLE */}
          <Box sx={{ mt: 4 }}>
            <Typography variant="h5" sx={{ mb: 2 }}>
              User Management
            </Typography>

            <UsersTable
              users={users}
              onEdit={openEdit}   
              refresh={loadData}
            />
          </Box>
        </motion.div>
      </Container>

      {/* + ADD USER FAB */}
      <Fab
        color="primary"
        sx={{
          position: "fixed",
          bottom: 28,
          right: 28,
        }}
        onClick={openAdd}
      >
        <AddIcon />
      </Fab>

      {/* ADD/EDIT USER DIALOG */}
      <AddEditUserDialog
        open={dialogOpen}
        user={editUser}
        onClose={closeDialog}
        onSaved={onSaved}
      />
    </Box>
  );
}
