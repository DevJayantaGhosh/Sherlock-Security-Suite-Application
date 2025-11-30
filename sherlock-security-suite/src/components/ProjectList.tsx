import { useEffect, useState } from "react";

import { Project } from "../models/project";
import ProjectFormDialog from "./ProjectFormDialog";
import { AppUser } from "../models/User";
import {
  Box,
  Button,
  TextField,
  Chip,
  IconButton,
  Typography,
  Card,
} from "@mui/material";

import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/CheckCircle";
import CloseIcon from "@mui/icons-material/Cancel";
import AddIcon from "@mui/icons-material/Add";
import VisibilityIcon from "@mui/icons-material/Visibility";

import { getProjects, updateProject } from "../services/projectService.ts";

interface Props {
  users: AppUser[];
}

export default function ProjectList({ users }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Project | null>(null);
  const [readOnly, setReadOnly] = useState(false);

  useEffect(() => {
    setProjects(getProjects());
  }, []);

  function refresh() {
    setProjects(getProjects());
  }

  function handleApprove(p: Project) {
    updateProject({ ...p, status: "Approved" });
    refresh();
  }

  function handleReject(p: Project) {
    updateProject({ ...p, status: "Rejected" });
    refresh();
  }

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.description || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      {/* Top Search + Add */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <TextField
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: "92%" }}
        />

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setEdit(null);
            setReadOnly(false);
            setOpen(true);
          }}
          sx={{ height: 56 ,m:1}}
        >
          Add
        </Button>
      </Box>

      {/* Cards */}
      <Box display="flex" flexWrap="wrap" gap={2}>
        {filtered.map((p) => (
          <Card
            key={p.id}
            sx={{
              width: 330,
              padding: 3,
              marginRight:2,
              position: "relative",
              background: "#0d0d0d",
              color: "white",
              boxShadow: "0 0 15px #00eaff88",
              transition: "0.2s",
              "&:hover": { boxShadow: "0 0 25px #00eaff" },
            }}
          >
            {/* Status badge */}
            <Chip
              label={p.status}
              color={
                p.status === "Approved"
                  ? "success"
                  : p.status === "Rejected"
                  ? "error"
                  : "warning"
              }
              sx={{ position: "absolute", right: 10, top: 10 }}
            />

            <Typography variant="h6" sx={{ fontWeight: "bold", m:2 }}>
              {p.name}
            </Typography>

            {p.description && (
              <Typography variant="body2" sx={{ opacity: 0.8, mb: 2 }}>
                {p.description}
              </Typography>
            )}

            <Box display="flex" gap={1} mt={2}>
              {/* VIEW */}
              <IconButton
                onClick={() => {
                  setEdit(p);
                  setReadOnly(true);
                  setOpen(true);
                }}
                color="info"
              >
                <VisibilityIcon />
              </IconButton>

              {/* EDIT */}
              <IconButton
                onClick={() => {
                  setEdit(p);
                  setReadOnly(false);
                  setOpen(true);
                }}
                color="primary"
              >
                <EditIcon />
              </IconButton>

              {/* APPROVE */}
              <IconButton onClick={() => handleApprove(p)} color="success">
                <CheckIcon />
              </IconButton>

              {/* REJECT */}
              <IconButton onClick={() => handleReject(p)} color="error">
                <CloseIcon />
              </IconButton>
            </Box>
          </Card>
        ))}
      </Box>

      {/* Dialog */}
      <ProjectFormDialog
        open={open}
        onClose={() => setOpen(false)}
        onSaved={() => {
          setOpen(false);
          refresh();
        }}
        users={users}
        edit={edit}
        readOnly={readOnly}
      />
    </>
  );
}
