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
  Chip,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel,
  Divider,
  TableContainer,
  Pagination
} from "@mui/material";

import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";

import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import { useUserStore } from "../../store/userStore";
import {
  getReposPaginated,
  getOpenSourceReposPaginated,
  createRepo,
  updateRepo,
  deleteRepo
} from "../../services/repoService";
import { Repo } from "../../models/Repo";
import { AppUser } from "../../models/User";


export default function RepositoryManagement({ user }: { user: AppUser | null }) {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"all" | "opensource">("all");
  const [initialLoad, setInitialLoad] = useState(false);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteRepoId, setDeleteRepoId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingRepo, setEditingRepo] = useState<Repo | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    repoUrl: "",
    isOpenSource: false
  });

  const isAdmin = user?.role === 'Admin';
  const pageSize = 10;

  const loadRepos = useCallback(async (page: number = 1, mode: "all" | "opensource" = "all") => {
    setLoading(true);
    try {
      const result = mode === "opensource"
        ? await getOpenSourceReposPaginated(page - 1, pageSize)
        : await getReposPaginated(page - 1, pageSize);

      if (result?.error) {
        toast.error(result.error.message);
        setRepos([]);
        return;
      }

      setRepos(result?.data?.items || []);
      setTotalItems(result?.data?.totalItems || 0);
      setTotalPages(result?.data?.totalPages || 1);
      setCurrentPage((result?.data?.currentPage || 0) + 1);
    } catch (err: any) {
      toast.error("Failed to load repositories");
      setRepos([]);
    } finally {
      setLoading(false);
    }
  }, [pageSize]);


  // Run only once on mount to avoid double load in React 18 StrictMode
  useEffect(() => {
    if (!initialLoad) {
      loadRepos(1, "all");
      setInitialLoad(true);
    }
  }, [loadRepos, initialLoad]);


  const handleViewModeChange = (event: any) => {
    const newMode = event.target.value as "all" | "opensource";
    setViewMode(newMode);
    loadRepos(1, newMode);
  };


  const openModal = (repo?: Repo) => {
    if (repo) {
      setModalMode("edit");
      setEditingRepo(repo);
      setFormData({
        name: repo.name,
        repoUrl: repo.repoUrl,
        isOpenSource: repo.isOpenSource
      });
    } else {
      setModalMode("create");
      setEditingRepo(null);
      setFormData({ name: "", repoUrl: "", isOpenSource: false });
    }
    setModalOpen(true);
  };


  const closeModal = () => {
    setModalOpen(false);
    setEditingRepo(null);
    setFormData({ name: "", repoUrl: "", isOpenSource: false });
  };


  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.repoUrl.trim() || !isAdmin) {
      toast.error("Name, URL required and Admin access needed");
      return;
    }

    setLoading(true);
    try {
      let result;
      if (modalMode === "create") {
        result = await createRepo({
          name: formData.name.trim(),
          repoUrl: formData.repoUrl.trim(),
          isOpenSource: formData.isOpenSource
        });
        toast.success("Repository created successfully!");
      } else {
        if (!editingRepo?.id) return;
        result = await updateRepo(editingRepo.id, {
          name: formData.name.trim(),
          repoUrl: formData.repoUrl.trim(),
          isOpenSource: formData.isOpenSource
        });
        toast.success("Repository updated successfully!");
      }

      if (result?.error) {
        toast.error(result.error.message);
        return;
      }

      closeModal();
      loadRepos(1, viewMode);
    } catch (err: any) {
      toast.error(modalMode === "create" ? "Failed to create repository" : "Failed to update repository");
    } finally {
      setLoading(false);
    }
  };


  const confirmDelete = (repoId: string) => {
    setDeleteRepoId(repoId);
    setDeleteModalOpen(true);
  };


  const handleDelete = async () => {
    if (!deleteRepoId || !isAdmin) return;

    setLoading(true);
    try {
      const result = await deleteRepo(deleteRepoId);
      if (result?.error) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Repository deleted successfully!");
      setDeleteModalOpen(false);
      setDeleteRepoId(null);
      loadRepos(
        currentPage > 1 && repos.length === 1 ? currentPage - 1 : currentPage,
        viewMode
      );
    } catch (err: any) {
      toast.error("Failed to delete repository");
    } finally {
      setLoading(false);
    }
  };


  const filteredRepos = (repos || []).filter(repo =>
    repo.name.toLowerCase().includes(search.toLowerCase()) ||
    repo.repoUrl.toLowerCase().includes(search.toLowerCase())
  );


  return (
    <Paper sx={{ p: 3, flex: 1, bgcolor: "#0c1023", minHeight: "100%" }}>
      {/* TOP CONTROLS: view dropdown + search + Add Repo + Refresh */}
      <Box sx={{ display: "flex", gap: 2, alignItems: "center", mb: 3, flexWrap: "wrap" }}>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel sx={{ color: "white" }}>View</InputLabel>
          <Select
            value={viewMode}
            label="View"
            onChange={handleViewModeChange}
            sx={{
              color: "white",
              ".MuiOutlinedInput-notchedOutline": { borderColor: "#4b5563" },
              "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#7b5cff" }
            }}
          >
            <MenuItem value="all">All Repositories</MenuItem>
            <MenuItem value="opensource">Open Source</MenuItem>
          </Select>
        </FormControl>

        <TextField
          size="small"
          label="Search repositories"
          value={search}
          onChange={e => setSearch(e.target.value)}
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
                background: "linear-gradient(135deg,#7b5cff,#5ce1e6)",
                textTransform: 'none',
                px: 3,
                minWidth: 120
              }}
            >
              Add Repo
            </Button>

            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => loadRepos(currentPage, viewMode)}
              disabled={loading}
              sx={{
                color: "white",
                borderColor: "rgba(255,255,255,0.3)",
                "&:hover": {
                  borderColor: "white"
                }
              }}
            >
              Refresh
            </Button>
          </>
        )}
      </Box>

      {/* TABLE */}
      <Paper sx={{ overflow: "hidden", bgcolor: "#0c1023" }}>
        {loading ? (
          <Box sx={{ p: 8, display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
            <CircularProgress size={32} sx={{ color: "#7b5cff" }} />
            <Typography sx={{ ml: 2, color: "#9ca3af", mt: 1 }}>Loading repositories...</Typography>
          </Box>
        ) : filteredRepos.length === 0 ? (
          <Box sx={{ p: 8, textAlign: "center" }}>
            <Typography sx={{ color: "#9ca3af", mb: 1 }}>
              {search ? 'No matching repositories' : 'No repositories found'}
            </Typography>
          </Box>
        ) : (
          <>
            <TableContainer sx={{ bgcolor: "#0c1023" }}>
              <Table size="small" sx={{ minWidth: 650 }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: "#1e1e2e" }}>
                    <TableCell sx={{ color: "white", fontWeight: 600 }}>Name</TableCell>
                    <TableCell sx={{ color: "white", fontWeight: 600 }}>Repository URL</TableCell>
                    <TableCell sx={{ color: "white", fontWeight: 600, minWidth: 120 }}>Open Source</TableCell>
                    <TableCell sx={{ color: "white", fontWeight: 600, minWidth: 120 }}>Created</TableCell>
                    {isAdmin && (
                      <TableCell
                        align="right"
                        sx={{ color: "white", fontWeight: 600, minWidth: 100 }}
                      >
                        Actions
                      </TableCell>
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredRepos.map((repo) => (
                    <TableRow
                      key={repo.id}
                      hover
                      sx={{ '&:hover': { bgcolor: "#1e1e2e" } }}
                    >
                      <TableCell sx={{ color: "white", fontWeight: 500 }}>
                        {repo.name}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 300 }}>
                        <a
                          href={repo.repoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: "#7b5cff",
                            textDecoration: "none",
                            fontFamily: 'monospace',
                            fontSize: '0.875rem',
                            wordBreak: "break-all",
                            display: 'block'
                          }}
                        >
                          {repo.repoUrl}
                        </a>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={repo.isOpenSource ? "Yes" : "No"}
                          color={repo.isOpenSource ? "success" : "error"}
                          size="small"
                          sx={{ fontWeight: 600 }}
                        />
                      </TableCell>
                      <TableCell sx={{ color: "#9ca3af" }}>
                        {new Date(repo.createdAt).toLocaleDateString()}
                      </TableCell>
                      {isAdmin && (
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            onClick={() => openModal(repo)}
                            sx={{ color: "#f59e0b", mr: 0.5 }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => confirmDelete(repo.id)}
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
                  bgcolor: "#111827"
                }}
              >
                <Pagination
                  count={totalPages}
                  page={currentPage}
                  onChange={(_, page) => loadRepos(page, viewMode)}
                  color="primary"
                  size="small"
                  sx={{
                    '& .MuiPaginationItem-root': {
                      color: 'white'
                    }
                  }}
                />
              </Box>
            )}
          </>
        )}
      </Paper>

      {/* CREATE/EDIT MODAL */}
      <Dialog open={modalOpen} onClose={closeModal} fullWidth maxWidth="sm">
        <DialogTitle sx={{ bgcolor: "#1e1e2e", color: "white" }}>
          {modalMode === "create" ? "Add New Repository" : "Edit Repository"}
        </DialogTitle>
        <DialogContent sx={{ bgcolor: "#0c1023", maxHeight: "60vh", overflow: "auto" }}>
          <Box sx={{ pt: 2 }}>
            <Typography
              variant="subtitle2"
              fontWeight={700}
              mb={3}
              sx={{ color: "white" }}
            >
              Repository Information
            </Typography>

            {/* Repository Name */}
            <TextField
              label="Repository Name *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              size="small"
              sx={{ mb: 3 }}
            />

            {/* Repository URL */}
            <TextField
              label="Repository URL *"
              value={formData.repoUrl}
              onChange={(e) => setFormData({ ...formData, repoUrl: e.target.value })}
              fullWidth
              size="small"
              sx={{ mb: 3 }}
            />

            {/* Open Source Switch */}
            <Box sx={{ mb: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isOpenSource}
                    onChange={(e) => setFormData({ ...formData, isOpenSource: e.target.checked })}
                    sx={{ color: "#7b5cff" }}
                  />
                }
                label={
                  <Box>
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      sx={{ color: "white" }}
                    >
                      Open Source Repository
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: "#9ca3af" }}
                    >
                      Public repository access
                    </Typography>
                  </Box>
                }
                labelPlacement="end"
                sx={{ m: 0, width: "100%" }}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ bgcolor: "#1e1e2e", p: 3 }}>
          <Button onClick={closeModal} startIcon={<CloseIcon />}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!formData.name.trim() || !formData.repoUrl.trim() || loading}
            sx={{
              background: "linear-gradient(135deg,#7b5cff,#5ce1e6)",
              textTransform: 'none',
              px: 4
            }}
          >
            {loading ? (
              <>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                Saving...
              </>
            ) : modalMode === "create" ? "Create Repository" : "Update Repository"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* DELETE CONFIRMATION MODAL */}
      <Dialog open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)}>
        <DialogTitle sx={{ bgcolor: "#1e1e2e", color: "white" }}>
          Delete Repository
        </DialogTitle>
        <DialogContent sx={{ bgcolor: "#0c1023", p: 3 }}>
          <Typography sx={{ color: "white", mt: 1 }}>
            Are you sure you want to delete this repository?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ bgcolor: "#1e1e2e", p: 3 }}>
          <Button onClick={() => setDeleteModalOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleDelete}
            color="error"
            disabled={loading}
            sx={{
              background: "linear-gradient(135deg,#ef4444,#dc2626)",
              textTransform: 'none'
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
