import { Box, Container, Typography, Button } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";
import LoadingSpinner from "../components/LoadingSpinner";

import AdminCharts from "../components/admin/AdminCharts";
import UsersTable from "../components/admin/UsersTable";
import AdminStats from "../components/admin/AdminStats";
import RepositoryManagement from "../components/admin/RepositoryManagement";
import DependencyManagement from "../components/admin/DependencyManagement";
import { getUsers } from "../services/userService";
import { getProductStats } from "../services/productService";
import { AppUser } from "../models/User";
import EditUserDialog from "../components/admin/EditUserDialog";
import { ProductStatsResponse } from "../models/Product";

export default function AdminPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [stats, setStats] = useState<ProductStatsResponse>({
    total: 0, pending: 0, approved: 0, rejected: 0, released: 0, openSource: 0
  });
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState<AppUser | null>(null);

  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   *  LOAD DATA - SILENT ON INITIAL LOAD
   * ═══════════════════════════════════════════════════════════════════════════════
   */
  const loadData = useCallback(async (showToast = false) => {
    try {
      setLoading(true);
      
      // USERS
      setUsersLoading(true);
      const usersResult = await getUsers();
      if (usersResult.error) {
        toast.error("Failed to load users: " + usersResult.error.message);
        setUsers([]);
      } else {
        setUsers(usersResult.data);
      }

      // STATS
      setStatsLoading(true);
      const statsResult = await getProductStats();
      if (statsResult.error) {
        toast.error("Failed to load stats: " + statsResult.error.message);
        setStats({ total: 0, pending: 0, approved: 0, rejected: 0, released: 0, openSource: 0 });
      } else {
        setStats(statsResult.data);
      }
      
      //  TOAST ONLY ON MANUAL REFRESH
      if (showToast) {
        toast.success("Dashboard refreshed successfully!");
      }
    } catch (error) {
      toast.error("Failed to refresh dashboard");
      console.error("Load data error:", error);
    } finally {
      setUsersLoading(false);
      setStatsLoading(false);
      setLoading(false);
    }
  }, []);


  // Initial load - SILENT (runs ONCE)
  useEffect(() => {
    loadData(false); // false = no toast
  }, []); // Empty deps = ONCE only

  // Handlers
  const openEdit = useCallback((u: AppUser) => {
    setEditUser(u);
    setDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setEditUser(null);
  }, []);

  const onSaved = useCallback(() => {
    closeDialog();
    loadData(true); // true = show toast
  }, [closeDialog, loadData]);

  //  MANUAL REFRESH - WITH TOAST
  const handleRefresh = useCallback(() => {
    loadData(true); // true = show toast
  }, [loadData]);

  if (loading) {
    return <LoadingSpinner message="Loading Admin Dashboard..." />;
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, pt: { xs: 4, sm: 5, md: 6 }, minHeight: "100vh", bgcolor: "#060712" }}>
      <Container maxWidth="xl" sx={{ px: { xs: 1, sm: 2 } }}>
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: "easeOut" }}>
          
          {/* HEADER */}
          <Box sx={{ mb: 6 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, width: "100%" }}>
              <Typography
                variant="h4"
                textAlign="center"
                fontWeight={800}
                sx={{ flex: 1, color: "#ffffff" }}
              >
                Admin Dashboard
              </Typography>
              <Button
                onClick={handleRefresh}  // ✅ Fixed: Separate handler
                variant="contained"
                startIcon={<RefreshIcon />}
                sx={{
                  background: "linear-gradient(135deg, #7b5cff, #5ce1e6)",
                  color: "white",
                  fontWeight: 600,
                  px: 3,
                  py: 1.2,
                  borderRadius: 2,
                  boxShadow: "0 4px 20px rgba(123, 92, 255, 0.4)",
                  "&:hover": {
                    transform: "translateY(-2px)",
                    boxShadow: "0 6px 25px rgba(123, 92, 255, 0.6)",
                  },
                }}
              >
                Refresh
              </Button>
            </Box>
          </Box>

          {/* ROW 1: STATUS CARDS */}
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 3, width: "100%", px: 0, mx: 0 }}>
              <AdminStats title="Pending" value={stats.pending} color="#f59e0b" loading={statsLoading} />
              <AdminStats title="Approved" value={stats.approved} color="#10b981" loading={statsLoading} />
              <AdminStats title="Rejected" value={stats.rejected} color="#ef4444" loading={statsLoading} />
              <AdminStats title="Released" value={stats.released} color="#8b5cf6" loading={statsLoading} />
            </Box>
          </Box>

          {/* ROW 2: KEY METRICS */}
          <Box sx={{ mb: 6 }}>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 3, width: "100%", px: 0, mx: 0 }}>
              <AdminStats title="Total Products" value={stats.total} color="#7b5cff" loading={statsLoading} />
              <AdminStats title="Open Source" value={stats.openSource} color="#10b981" loading={statsLoading} />
              <AdminStats title="Total Users" value={users.length} color="#3b82f6" loading={usersLoading} />
              <AdminStats title="External Users" value={users.filter(u => !u.licenseValid).length} color="#ef4444" loading={usersLoading} />
            </Box>
          </Box>

          {/* Charts */}
          <Box sx={{ mb: 6 }}><AdminCharts productsStats={stats} users={users} /></Box>
          
          {/* Users Table */}
          <Box sx={{ mb: 6 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
              <Typography variant="h4" sx={{ fontWeight: 800, color: "#ffffff" }}>User Management</Typography>
              <Typography variant="body2" sx={{ opacity: 0.7, fontSize: "0.9rem" }}>{users.length} users</Typography>
            </Box>
            <UsersTable users={users} onEdit={openEdit} refresh={loadData} loading={usersLoading} />
          </Box>

          {/* Configuration */}
          <Box>
            <Typography variant="h4" sx={{ mb: 3, fontWeight: 800, color: "#ffffff" }}>Configuration Management</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" }, gap: 4, alignItems: "start" }}>
              <RepositoryManagement />
              <DependencyManagement />
            </Box>
          </Box>
        </motion.div>
      </Container>

      <EditUserDialog open={dialogOpen} user={editUser!} onClose={closeDialog} onSaved={onSaved} />
    </Box>
  );
}
