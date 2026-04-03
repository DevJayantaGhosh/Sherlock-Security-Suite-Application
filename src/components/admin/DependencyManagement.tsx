import {
  Box,
  Typography,
  IconButton,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TextField,
  Button,
  Paper,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TableContainer,
  Pagination,
  useTheme,
} from "@mui/material";

import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";

import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import {
  getDependenciesPaginated,
  createDependency,
  updateDependency,
  deleteDependency,
} from "../../services/dependencyService";
import { Dependency } from "../../models/Dependency";
import { AppUser } from "../../models/User";

export default function DependencyManagement({ user }: { user: AppUser | null }) {
  const theme = useTheme();
  const isAdmin = user?.role === "Admin";

  const [deps, setDeps] = useState<Dependency[]>([]);
  const [, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const [initialLoad, setInitialLoad] = useState(false);

  const pageSize = 10;

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteDepId, setDeleteDepId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingDep, setEditingDep] = useState<Dependency | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });

  // Load deps from backend
  const loadDeps = useCallback(
    async (page: number = 1) => {
      setLoading(true);
      try {
        const result = await getDependenciesPaginated(page - 1, pageSize);
        if (result.error) {
          toast.error(result.error.message);
          setDeps([]);
          return;
        }

        setDeps(result.data.items);
        setTotalItems(result.data.totalItems);
        setTotalPages(result.data.totalPages);
        setCurrentPage((result.data.currentPage || 0) + 1);
      } catch (err: any) {
        toast.error("Failed to load dependencies");
        setDeps([]);
      } finally {
        setLoading(false);
      }
    },
    [pageSize]
  );

  // Run only once on mount to avoid double loading in dev StrictMode
  useEffect(() => {
    if (!initialLoad) {
      loadDeps(1);
      setInitialLoad(true);
    }
  }, [initialLoad, loadDeps]);

  // -----------------------
  // Modal actions
  // -----------------------

  const openModal = (dep?: Dependency) => {
    if (dep) {
      setModalMode("edit");
      setEditingDep(dep);
      setFormData({
        name: dep.name,
        description: dep.description || "",
      });
    } else {
      setModalMode("create");
      setEditingDep(null);
      setFormData({ name: "", description: "" });
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingDep(null);
    setFormData({ name: "", description: "" });
  };

  const handleSubmit = async () => {
    const name = formData.name.trim();
    if (!name || !isAdmin) {
      toast.error("Name required and Admin access needed");
      return;
    }

    setLoading(true);
    try {
      let result;
      if (modalMode === "create") {
        result = await createDependency({
          name,
          description: formData.description || undefined,
        });
        toast.success("Dependency created successfully!");
      } else {
        if (!editingDep?.id) return;
        result = await updateDependency(editingDep.id, {
          name,
          description: formData.description || undefined,
        });
        toast.success("Dependency updated successfully!");
      }

      if (result.error) {
        toast.error(result.error.message);
        return;
      }

      closeModal();
      loadDeps(currentPage);
    } catch (err: any) {
      toast.error(modalMode === "create" ? "Failed to create dependency" : "Failed to update dependency");
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = (depId: string) => {
    setDeleteDepId(depId);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteDepId || !isAdmin) return;

    setLoading(true);
    try {
      const result = await deleteDependency(deleteDepId);
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Dependency deleted successfully!");
      setDeleteModalOpen(false);
      setDeleteDepId(null);
      loadDeps(currentPage > 1 && deps.length === 1 ? currentPage - 1 : currentPage);
    } catch (err: any) {
      toast.error("Failed to delete dependency");
    } finally {
      setLoading(false);
    }
  };

  const filtered = deps.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      (d.description || "").toLowerCase().includes(search.toLowerCase())
  );

  // -----------------------
  // UI
  // -----------------------
  return (
    <Paper
      sx={{
        p: 3,
        flex: 1,
        bgcolor: theme.palette.mode === "dark" ? "#0c1023" : "#fff",
        minHeight: "100%",
      }}
    >
      {/* TOP CONTROLS: search + Add Dependency + Refresh */}
      <Box
        sx={{
          display: "flex",
          gap: 2,
          alignItems: "center",
          mb: 3,
          flexWrap: "wrap",
        }}
      >
        <TextField
          size="small"
          label="Search dependencies"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ flex: 1, minWidth: 300 }}
        />

        {isAdmin && (
          <>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => openModal()}
              disabled={loading}
              sx={{
                background: "linear-gradient(135deg, #7b5cff, #5ce1e6)",
                textTransform: "none",
                px: 3,
                minWidth: 120,
              }}
            >
              Add Dependency
            </Button>

            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => loadDeps(currentPage)}
              disabled={loading}
              sx={{
                color: "white",
                borderColor: "rgba(255,255,255,0.3)",
                "&:hover": {
                  borderColor: "white",
                },
              }}
            >
              Refresh
            </Button>
          </>
        )}
      </Box>

      {/* DEPENDENCIES TABLE */}
      <Paper
        sx={{
          overflow: "hidden",
          bgcolor: theme.palette.mode === "dark" ? "#0c1023" : "#fff",
        }}
      >
        {loading ? (
          <Box
            sx={{
              p: 8,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              flexDirection: "column",
            }}
          >
            <CircularProgress size={32} sx={{ color: "#7b5cff" }} />
            <Typography sx={{ ml: 2, color: "#9ca3af", mt: 1 }}>
              Loading dependencies...
            </Typography>
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ p: 8, textAlign: "center" }}>
            <Typography sx={{ color: "#9ca3af" }}>
              {search ? "No matching dependencies" : "No dependencies found"}
            </Typography>
          </Box>
        ) : (
          <>
            <TableContainer
              sx={{
                bgcolor: theme.palette.mode === "dark" ? "#0c1023" : "#fff",
              }}
            >
              <Table size="small" sx={{ minWidth: 650 }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: "#1e1e2e" }}>
                    <TableCell sx={{ color: "white", fontWeight: 600 }}>
                      Name
                    </TableCell>
                    <TableCell sx={{ color: "white", fontWeight: 600 }}>
                      Description
                    </TableCell>
                    <TableCell
                      sx={{
                        color: "white",
                        fontWeight: 600,
                        minWidth: 120,
                      }}
                    >
                      Created
                    </TableCell>
                    <TableCell
                      sx={{
                        color: "white",
                        fontWeight: 600,
                        minWidth: 120,
                      }}
                    >
                      Updated
                    </TableCell>
                    {isAdmin && (
                      <TableCell
                        align="right"
                        sx={{
                          color: "white",
                          fontWeight: 600,
                          minWidth: 100,
                        }}
                      >
                        Actions
                      </TableCell>
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map((dep) => (
                    <TableRow
                      key={dep.id}
                      hover
                      sx={{ "&:hover": { bgcolor: "#1e1e2e" } }}
                    >
                      <TableCell sx={{ color: "white", fontWeight: 500 }}>
                        {dep.name}
                      </TableCell>
                      <TableCell sx={{ color: "white" }}>
                        {dep.description || (
                          <span
                            style={{ color: "rgba(255,255,255,0.5)" }}
                          >
                            –
                          </span>
                        )}
                      </TableCell>
                      <TableCell sx={{ color: "#9ca3af" }}>
                        {new Date(dep.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell sx={{ color: "#9ca3af" }}>
                        {new Date(dep.updatedAt).toLocaleString()}
                      </TableCell>
                      {isAdmin && (
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            onClick={() => openModal(dep)}
                            sx={{ color: "#f59e0b", mr: 0.5 }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => confirmDelete(dep.id)}
                            sx={{ color: "#ef4444" }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {totalPages > 1 && (
              <Box
                sx={{
                  p: 2,
                  display: "flex",
                  justifyContent: "center",
                  bgcolor: "#111827",
                }}
              >
                <Pagination
                  count={totalPages}
                  page={currentPage}
                  onChange={(_, page) => loadDeps(page)}
                  color="primary"
                  size="small"
                  sx={{
                    "& .MuiPaginationItem-root": {
                      color: "white",
                    },
                  }}
                />
              </Box>
            )}
          </>
        )}
      </Paper>

      {/* CREATE/EDIT MODAL */}
      <Dialog
        open={modalOpen}
        onClose={closeModal}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle
          sx={{ bgcolor: "#1e1e2e", color: "white" }}
        >
          {modalMode === "create" ? "Add New Dependency" : "Edit Dependency"}
        </DialogTitle>
        <DialogContent
          sx={{
            bgcolor: theme.palette.mode === "dark" ? "#0c1023" : "#fff",
            maxHeight: "60vh",
            overflow: "auto",
            p: 3,
          }}
        >
          <Typography
            variant="subtitle2"
            fontWeight={700}
            mb={3}
            sx={{ color: "white" }}
          >
            Dependency Information
          </Typography>

          {/* NAME */}
          <TextField
            label="Name *"
            value={formData.name}
            onChange={(e) =>
              setFormData({ ...formData, name: e.target.value })
            }
            fullWidth
            size="small"
            sx={{ mb: 3 }}
          />

          {/* DESCRIPTION */}
          <TextField
            label="Description"
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            fullWidth
            size="small"
            multiline
            rows={3}
            sx={{ mb: 3 }}
          />
        </DialogContent>
        <DialogActions
          sx={{ bgcolor: "#1e1e2e", p: 3 }}
        >
          <Button onClick={closeModal} startIcon={<CloseIcon />}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!formData.name.trim() || loading || !isAdmin}
            sx={{
              background: "linear-gradient(135deg, #7b5cff, #5ce1e6)",
              textTransform: "none",
              px: 4,
            }}
          >
            {loading ? (
              <>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                Saving...
              </>
            ) : modalMode === "create" ? "Create Dependency" : "Update Dependency"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* DELETE CONFIRMATION MODAL */}
      <Dialog
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
      >
        <DialogTitle
          sx={{ bgcolor: "#1e1e2e", color: "white" }}
        >
          Delete Dependency
        </DialogTitle>
        <DialogContent
          sx={{
            bgcolor: theme.palette.mode === "dark" ? "#0c1023" : "#fff",
            p: 3,
          }}
        >
          <Typography sx={{ color: "white" }}>
            Are you sure you want to delete this dependency?
          </Typography>
        </DialogContent>
        <DialogActions
          sx={{ bgcolor: "#1e1e2e", p: 3 }}
        >
          <Button onClick={() => setDeleteModalOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleDelete}
            color="error"
            disabled={loading}
            sx={{
              background: "linear-gradient(135deg, #ef4444, #dc2626)",
              textTransform: "none",
            }}
          >
            {loading ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              "Delete"
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
