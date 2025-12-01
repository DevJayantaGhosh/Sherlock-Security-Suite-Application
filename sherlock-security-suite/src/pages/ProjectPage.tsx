import {
  Box,
  Button,
  Container,
  Typography,
  TextField,
  MenuItem,
  Stack
} from "@mui/material";
import { useEffect, useState } from "react";

import ProjectCard from "../components/projects/ProjectCard";
import ProjectDialog from "../components/projects/ProjectDialog";
import ConfirmDialog from "../components/ConfirmDialog";

import {
  getProjects,
  deleteProject,
  updateStatus,
} from "../services/projectService";

import { Project } from "../models/Project";
import { useToast } from "../components/ToastProvider";
import AddIcon from "@mui/icons-material/Add";

const PAGE_SIZE = 6;

export default function ProjectPage() {

  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"All" | Project["status"]>("All");
  const [page, setPage] = useState(0);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] =
    useState<"view" | "edit" | "create">("create");
  const [selected, setSelected] = useState<Project | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | (() => void)>(null);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmDesc, setConfirmDesc] = useState("");

  const toast = useToast();

  function load() {
    setProjects(getProjects());
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = projects.filter(
    p =>
      (filter === "All" || p.status === filter) &&
      p.name.toLowerCase().includes(search.toLowerCase())
  );

  const pageData = filtered.slice(
    page * PAGE_SIZE,
    (page + 1) * PAGE_SIZE
  );

  /* ---------- Dialog handlers ---------- */

  function openCreate() {
    setDialogMode("create");
    setSelected(null);
    setDialogOpen(true);
  }

  function openView(p: Project) {
    setDialogMode("view");
    setSelected(p);
    setDialogOpen(true);
  }

  function openEdit(p: Project) {
    setDialogMode("edit");
    setSelected(p);
    setDialogOpen(true);
  }

  function confirmAndExec(title: string, desc: string, fn: () => void) {
    setConfirmTitle(title);
    setConfirmDesc(desc);
    setConfirmAction(() => () => {
      fn();
      setConfirmOpen(false);
    });
    setConfirmOpen(true);
  }

  return (
    <Box sx={{ pt: 8, pb: 6, minHeight: "80vh" }}>
      <Container maxWidth="xl">

        {/* ---------------------------------------------------
             HEADING (CENTERED)
        ---------------------------------------------------- */}
        <Typography
          variant="h4"
          textAlign="center"
          fontWeight={800}
          mb={3}
        >
          Project Dashboard
        </Typography>

        {/* ---------------------------------------------------
             FILTER + SEARCH + ADD BUTTON ROW
        ---------------------------------------------------- */}
        <Stack
          direction="row"
          spacing={2}
          mb={4}
          alignItems="center"
        >
          {/* Status filter */}
          <TextField
            select
            sx={{ width: 160 }}
            label="Status"
            value={filter}
            onChange={e => setFilter(e.target.value as any)}
          >
            <MenuItem value="All">All</MenuItem>
            <MenuItem value="Pending">Pending</MenuItem>
            <MenuItem value="Approved">Approved</MenuItem>
            <MenuItem value="Rejected">Rejected</MenuItem>
            <MenuItem value="Released">Released</MenuItem>
          </TextField>

          {/* Search */}
          <TextField
            placeholder="Search projects..."
            fullWidth
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          {/* Add project */}
          <Button
            startIcon={<AddIcon />}
            variant="contained"
            onClick={openCreate}
            sx={{
              minWidth: 180,
              background: "linear-gradient(135deg,#7b5cff,#5ce1e6)"
            }}
          >
            Add Project
          </Button>
        </Stack>

        {/* ---------------------------------------------------
             PROJECT GRID — 3 CARDS PER ROW
        ---------------------------------------------------- */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns:
              "repeat(3, minmax(0, 1fr))",
            gap: 3
          }}
        >
          {pageData.map(p => (
            <ProjectCard
              key={p.id}
              project={p}

              onView={() => openView(p)}

              onEdit={() => openEdit(p)}

              onDelete={() =>
                confirmAndExec(
                  "Delete project",
                  "Are you sure you want to remove this project?",
                  () => {
                    deleteProject(p.id);
                    toast("Deleted", "info");
                    load();
                  }
                )
              }

              onApprove={() =>
                confirmAndExec(
                  "Approve project",
                  "Approve this project?",
                  () => {
                    updateStatus(p.id, "Approved", "system");
                    toast("Approved", "success");
                    load();
                  }
                )
              }

              onReject={() =>
                confirmAndExec(
                  "Reject project",
                  "Reject this project?",
                  () => {
                    updateStatus(p.id, "Rejected", "system");
                    toast("Rejected", "warning");
                    load();
                  }
                )
              }

              onRelease={() =>
                confirmAndExec(
                  "Release project",
                  "Mark this project as released?",
                  () => {
                    updateStatus(p.id, "Released", "system");
                    toast("Released", "success");
                    load();
                  }
                )
              }
            />
          ))}
        </Box>

        {/* ---------------------------------------------------
             PAGINATION (INLINE — SAME FILE)
        ---------------------------------------------------- */}
        <Stack
          direction="row"
          justifyContent="center"
          spacing={2}
          mt={4}
        >
          <Button
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
          >
            Prev
          </Button>

          <Typography sx={{ pt: 1 }}>
            Page {page + 1} of
            {" "}
            {Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))}
          </Typography>

          <Button
            disabled={(page + 1) * PAGE_SIZE >= filtered.length}
            onClick={() => setPage(p => p + 1)}
          >
            Next
          </Button>
        </Stack>

      </Container>

      {/* ---------------------------------------------------
           MODALS
      ---------------------------------------------------- */}

      <ProjectDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        project={selected ?? undefined}
        mode={dialogMode}
        refresh={load}
      />

      <ConfirmDialog
        open={confirmOpen}
        title={confirmTitle}
        description={confirmDesc}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          if (confirmAction) confirmAction();
        }}
      />

    </Box>
  );
}
