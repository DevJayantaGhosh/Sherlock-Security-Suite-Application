// src/pages/AdminPage.tsx
import { Box, Container, Typography, Fab } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { useEffect, useState } from "react";

import AdminStats from "../components/AdminStats";
import ProjectCharts from "../components/ProjectCharts";
import UsersTable from "../components/UsersTable";
import UserDialog from "../components/UserDialog";
import ProjectApprovalRow from "../components/ProjectApprovalRow";

import { getUsers } from "../services/userService";
import { getProjects } from "../services/projectService";
import { AppUser } from "../models/User";
import { Project } from "../models/project";

export default function AdminPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState<AppUser | null>(null);

  function refresh() {
    setUsers(getUsers());
    setProjects(getProjects());
  }

  useEffect(() => { refresh(); }, []);

  const stats = {
    total: projects.length,
    approved: projects.filter(p => p.status === "Approved").length,
    pending: projects.filter(p => p.status === "Pending").length,
    rejected: projects.filter(p => p.status === "Rejected").length,
  };

  return (
    <Box sx={{ pt: 6, pb: 12 }}>
      <Container maxWidth="xl">
        <Typography variant="h4" fontWeight={800} mb={3} textAlign="center">Admin Dashboard</Typography>

        <Box display="flex" gap={2} flexWrap="wrap" justifyContent="center" mb={4}>
          <AdminStats title="Total Projects" value={stats.total} />
          <AdminStats title="Approved" value={stats.approved} />
          <AdminStats title="Pending" value={stats.pending} />
          <AdminStats title="Rejected" value={stats.rejected} />
        </Box>

        <Typography variant="h5" mb={1}>Project Insights</Typography>
        <ProjectCharts projects={projects} />

        <Typography variant="h6" mt={4} mb={1}>Pending Approvals</Typography>
        {projects.map(p => <ProjectApprovalRow key={p.id} project={p} refresh={refresh} />)}

        <Typography variant="h6" mt={4} mb={2}>User Management</Typography>
        <Box sx={{ background: "rgba(255,255,255,0.01)", borderRadius: 2 }}>
          <UsersTable users={users} onEdit={(u)=>{ setEditUser(u); setDialogOpen(true); }} refresh={refresh} />
        </Box>

        <Fab color="primary" sx={{ position: "fixed", bottom: 80, right: 30 }} onClick={() => { setEditUser(null); setDialogOpen(true); }}>
          <AddIcon />
        </Fab>

        <UserDialog open={dialogOpen} onClose={() => setDialogOpen(false)} user={editUser} onSaved={refresh} />
      </Container>
    </Box>
  );
}
