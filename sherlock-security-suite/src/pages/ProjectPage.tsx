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
import { useNavigate } from "react-router-dom";

import ProjectCard from "../components/projects/ProjectCard";
import ProjectDialog from "../components/projects/ProjectDialog";
import ConfirmDialog from "../components/ConfirmDialog";

import {
  getProjects,
  deleteProject,
  authorizeApprove,
  authorizeRelease,
} from "../services/projectService";

import { Project } from "../models/Project";
import { useToast } from "../components/ToastProvider";

import AddIcon from "@mui/icons-material/Add";
import { useUserStore } from "../store/userStore";

const PAGE_SIZE = 6;

export default function ProjectPage() {

  const navigate = useNavigate();
  const toast = useToast();
  const user = useUserStore((s) => s.user);

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

  /* --------------------------------------------------- */

  function navigateToSecurityScan(projectId: string) {
    navigate(`/project/${projectId}/security-scan`);
  }

  function navigateToRelease(projectId: string) {
    alert("hi")
    navigate(`/project/${projectId}/releases`);
  }

  /* --------------------------------------------------- */

  function openSecurityScanClick(p: Project) {
    const canScan = authorizeApprove(user, p);
    // Case 1: Unauthorized user → show warning modal
    if (!canScan) {
      confirmAndExec(
        "Restricted Access",
        "You can view this page but are not authorized to run security scans or approve/reject. Security review actions can only be performed by Cyber-Security Head or an Admin.",
        () => {
          navigateToSecurityScan(p.id);
        }
      )
    } else {
      navigateToSecurityScan(p.id)
    }
  }
  function openReleaseWorkflowClick(p: Project) {
    const canRelease = authorizeRelease(user, p);
    if (p.status !== "Approved") {
      confirmAndExec(
        "Release Restricted",
        "Project is not yet Approved!",
        () => {
          return;
        }
      )
    }

    if (!canRelease) {
      confirmAndExec(
        "Restricted Access",
        "You can view this page but are not authorized to make release. Release activity can only be performed by assigned Release Engineer or an Admin.",
        () => {
          navigateToRelease(p.id);
        }
      )
    } else {
      navigateToRelease(p.id);
    }

  }

 /* --------------------------------------------------- */


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

          <TextField
            placeholder="Search projects..."
            fullWidth
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

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
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
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

              onSecurityScan={() =>openSecurityScanClick(p)}

              onRelease={() => openReleaseWorkflowClick(p)}
            />
          ))}
        </Box>

        {/* ---------------------------------------------------
             PAGINATION
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
            Page {page + 1} of{" "}
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
