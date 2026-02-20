import { Box, Container, Typography } from "@mui/material";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";

import AdminCharts from "../components/admin/AdminCharts";
import UsersTable from "../components/admin/UsersTable";
import AdminStats from "../components/admin/AdminStats";

import RepositoryManagement from "../components/admin/RepositoryManagement";
import DependencyManagement from "../components/admin/DependencyManagement";

import { getUsers } from "../services/userService";
import { getProducts } from "../services/productService";

import { AppUser } from "../models/User";
import { Product } from "../models/Product";
import EditUserDialog from "../components/admin/EditUserDialog";

export default function AdminPage() {

  const [users, setUsers] = useState<AppUser[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);

  // EDIT-ONLY dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState<AppUser | null>(null);

  /* ---------------------------
       LOAD DATA
  ---------------------------- */
  const loadData = useCallback(async () => {
    try {
      setUsersLoading(true);
      const usersResult = await getUsers();
      if (usersResult.error) {
        toast.error(usersResult.error.message);
        setUsers([]);
      } else {
        setUsers(usersResult.data);
      }

      // ✅ TODO-PRODUCTS with proper error handling
      setProductsLoading(true);
      const productsResult = await getProducts();
      if (productsResult.length==0) {
        toast.error("error");
        setProducts([]);
      } else {
        setProducts(productsResult || []);
      }
    } catch (error) {
      toast.error("Failed to load dashboard data");
      console.error("Load data error:", error);
    } finally {
      setUsersLoading(false);
      setProductsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ---------------------------
       HANDLERS - EDIT ONLY
  ---------------------------- */
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
    loadData(); // AUTO REFRESH TABLE
  }, [closeDialog, loadData]);

  /* ---------------------------
       UI
  ---------------------------- */
  return (
    <Box
      sx={{
        p: { xs: 2, sm: 3, md: 4 },
        pt: { xs: 4, sm: 5, md: 6 },
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
              mb: 5,
              fontWeight: 900,
              textAlign: "center",
              letterSpacing: { xs: 0, md: 1 },
              background: "linear-gradient(135deg, #7b5cff 0%, #5ce1e6 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Admin Dashboard
          </Typography>

          {/* STATS - PERFECT ALIGNMENT */}
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 5, justifyContent: "center" }}>
            <AdminStats 
              title="Total Products" 
              value={products.length} 
            />
            <AdminStats
              title="Approved"
              value={products.filter((p) => p.status === "Approved").length}
            />
            <AdminStats
              title="Pending"
              value={products.filter((p) => p.status === "Pending").length}
            />
            <AdminStats
              title="Rejected"
              value={products.filter((p) => p.status === "Rejected").length}
            />
            <AdminStats 
              title="Total Users" 
              value={users.length} 
            />
          </Box>

          {/* CHARTS */}
          <Box sx={{ mb: 6 }}>
            <AdminCharts products={products} users={users} />
          </Box>

          {/* USERS TABLE - PERFECT SPACING */}
          <Box sx={{ mb: 6 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
              <Typography variant="h4" sx={{ fontWeight: 800, color: "#ffffff" }}>
                User Management
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.7, fontSize: "0.9rem" }}>
                {users.length} users
              </Typography>
            </Box>
            <UsersTable 
              users={users} 
              onEdit={openEdit} 
              refresh={loadData} 
              loading={usersLoading} 
            />
          </Box>

          {/* CONFIGURATION MANAGEMENT - PERFECT GRID */}
          <Box>
            <Typography variant="h4" sx={{ mb: 3, fontWeight: 800, color: "#ffffff" }}>
              Configuration Management
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" },
                gap: 4,
                alignItems: "start",
              }}
            >
              <RepositoryManagement />
              <DependencyManagement />
            </Box>
          </Box>
        </motion.div>
      </Container>

      {/* EDIT-ONLY USER DIALOG */}
      <EditUserDialog
        open={dialogOpen}
        user={editUser!}
        onClose={closeDialog}
        onSaved={onSaved}
      />
    </Box>
  );
}
