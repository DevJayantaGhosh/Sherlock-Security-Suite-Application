import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  TextField,
  IconButton,
  MenuItem,
  Chip,
  Stack,
  Typography,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import { useEffect, useState } from "react";

import { Project } from "../../models/Project";
import { createProject, updateProject } from "../../services/projectService";
import { useUserStore } from "../../store/userStore";

const DEP_OPTIONS = [
  "React",
  "Node",
  "Express",
  "Docker",
  "MongoDB",
  "Redis",
  "Kubernetes",
];

// ✅ demo users for dropdowns
const USERS = [
  { id: "u1", name: "Alice" },
  { id: "u2", name: "Bob" },
  { id: "u3", name: "Charlie" },
  { id: "u4", name: "Daisy" },
];

export default function ProjectDialog({
  open,
  onClose,
  project,
  refresh,
  mode = "create",
}: {
  open: boolean;
  onClose: () => void;
  project?: Project | null;
  refresh: () => void;
  mode?: "create" | "edit" | "view";
}) {
  const user = useUserStore((s) => s.user);

  const isView = mode === "view";

  const [form, setForm] = useState<
    Omit<Project, "id" | "createdAt" | "updatedAt"> &
      Partial<Pick<Project, "createdAt" | "updatedAt" | "id">>
  >({
    name: "",
    description: "",
    projectDirector: null,
    securityHead: null,
    releaseEngineers: [],
    gitRepo: [""],
    gpgKey: [""],
    dependencies: [],
    createdBy: user?.id || "",
    status: "Pending",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (project) {
      setForm({
        ...project,
        gitRepo: project.gitRepo?.length ? project.gitRepo : [""],
        gpgKey: project.gpgKey?.length ? project.gpgKey : [""],
      } as any);
    } else {
      setForm({
        name: "",
        description: "",
        projectDirector: null,
        securityHead: null,
        releaseEngineers: [],
        gitRepo: [""],
        gpgKey: [""],
        dependencies: [],
        createdBy: user?.id || "",
        status: "Pending",
      });
    }

    setErrors({});
  }, [project, open]);

  // =====================
  // Validation
  // =====================
  function validate() {
    const e: Record<string, string> = {};

    if (!form.name?.trim()) e.name = "Project name required";
    if (!form.description?.trim()) e.description = "Description required";
    if (!form.projectDirector) e.projectDirector = "Select director";
    if (!form.securityHead) e.securityHead = "Select security head";

    if (!form.releaseEngineers || form.releaseEngineers.length === 0)
      e.releaseEngineers = "Select at least one engineer";

    if (!form.dependencies || form.dependencies.length === 0)
      e.dependencies = "Select at least one dependency";

    (form.gitRepo || []).forEach((v, i) => {
      if (!v?.trim()) e[`repo-${i}`] = "Repo required";
    });

    (form.gpgKey || []).forEach((v, i) => {
      if (!v?.trim()) e[`gpg-${i}`] = "GPG required";
    });

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // =====================
  // Repo helpers
  // =====================
  function setRepoAt(i: number, v: string) {
    const arr = [...(form.gitRepo || [])];
    arr[i] = v;
    setForm({ ...form, gitRepo: arr });
  }

  function setGpgAt(i: number, v: string) {
    const arr = [...(form.gpgKey || [])];
    arr[i] = v;
    setForm({ ...form, gpgKey: arr });
  }

  function addRepoRow() {
    setForm({
      ...form,
      gitRepo: [...(form.gitRepo || []), ""],
      gpgKey: [...(form.gpgKey || []), ""],
    });
  }

  function removeRepoRow(i: number) {
    const rg = [...(form.gitRepo || [])];
    const gk = [...(form.gpgKey || [])];
    rg.splice(i, 1);
    gk.splice(i, 1);
    setForm({ ...form, gitRepo: rg, gpgKey: gk });
  }

  // =====================
  // Submit
  // =====================
  function submit() {
    if (!validate()) return;

    if (project) {
      updateProject({
        ...(project as Project),
        ...form,
        updatedBy: user?.id,
      });
    } else {
      createProject({
        ...(form as any),
        createdBy: user?.id,
      });
    }

    refresh();
    onClose();
  }

  // =====================
  // Render
  // =====================
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      scroll="paper"
      sx={{
        "& .MuiDialog-paper": {
          mt: 5,
        },
      }}
    >
      {/* ✅ FIXED heading clipping */}
      <DialogTitle sx={{ pb: 1 }}>
        {mode === "view"
          ? "Project Details"
          : project
          ? "Edit Project"
          : "Create Project"}
      </DialogTitle>

      <DialogContent dividers>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 2,
          }}
        >
          <TextField
            label="Project Name"
            value={form.name}
            error={!!errors.name}
            helperText={errors.name}
            fullWidth
            disabled={isView}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />

          <TextField
            label="Project Director"
            select
            value={form.projectDirector ?? ""}
            error={!!errors.projectDirector}
            helperText={errors.projectDirector}
            fullWidth
            disabled={isView}
            onChange={(e) =>
              setForm({
                ...form,
                projectDirector: e.target.value || null,
              })
            }
          >
            {USERS.map((u) => (
              <MenuItem key={u.id} value={u.id}>
                {u.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Security Head"
            select
            value={form.securityHead ?? ""}
            error={!!errors.securityHead}
            helperText={errors.securityHead}
            fullWidth
            disabled={isView}
            onChange={(e) =>
              setForm({ ...form, securityHead: e.target.value || null })
            }
          >
            {USERS.map((u) => (
              <MenuItem key={u.id} value={u.id}>
                {u.name}
              </MenuItem>
            ))}
          </TextField>

          {/* ✅ MULTI-SELECT FIX */}
          <TextField
            label="Release Engineers"
            select
            SelectProps={{
              multiple: true,
            }}
            value={form.releaseEngineers || []}
            error={!!errors.releaseEngineers}
            helperText={errors.releaseEngineers}
            fullWidth
            disabled={isView}
            onChange={(e) =>
              setForm({
                ...form,
                releaseEngineers: e.target.value as unknown as string[],
              })
            }
          >
            {USERS.map((u) => (
              <MenuItem key={u.id} value={u.id}>
                <Chip size="small" label={u.name} />
              </MenuItem>
            ))}
          </TextField>

          {/* Repositories */}
          <Box sx={{ gridColumn: "1 / span 2" }}>
            <Typography sx={{ mb: 1 }}>
              Repositories (repo & GPG)
            </Typography>

            {(form.gitRepo || []).map((r, i) => (
              <Box key={i} sx={{ display: "flex", gap: 1, mb: 1 }}>
                <TextField
                  fullWidth
                  label={`Repo ${i + 1}`}
                  value={r}
                  error={!!errors[`repo-${i}`]}
                  helperText={errors[`repo-${i}`]}
                  disabled={isView}
                  onChange={(e) => setRepoAt(i, e.target.value)}
                />

                <TextField
                  sx={{ width: 250 }}
                  label={`GPG ${i + 1}`}
                  value={(form.gpgKey || [])[i] || ""}
                  error={!!errors[`gpg-${i}`]}
                  helperText={errors[`gpg-${i}`]}
                  disabled={isView}
                  onChange={(e) => setGpgAt(i, e.target.value)}
                />

                {!isView && (
                  <IconButton
                    onClick={() => removeRepoRow(i)}
                    disabled={(form.gitRepo?.length || 0) <= 1}
                  >
                    <RemoveIcon />
                  </IconButton>
                )}
              </Box>
            ))}

            {!isView && (
              <Button startIcon={<AddIcon />} onClick={addRepoRow}>
                Add repo
              </Button>
            )}
          </Box>

          <Box sx={{ gridColumn: "1 / span 2" }}>
            <TextField
              label="Description"
              multiline
              rows={3}
              fullWidth
              value={form.description}
              error={!!errors.description}
              helperText={errors.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              disabled={isView}
            />
          </Box>

          <Box sx={{ gridColumn: "1 / span 2" }}>
            <TextField
              select
              label="Dependencies"
              SelectProps={{
                multiple: true,
                value: form.dependencies || [],
                onChange: (e) =>
                  setForm({
                    ...form,
                    dependencies: e.target.value as string[],
                  }),
              }}
              error={!!errors.dependencies}
              helperText={errors.dependencies}
              fullWidth
              disabled={isView}
            >
              {DEP_OPTIONS.map((d) => (
                <MenuItem key={d} value={d}>
                  <Chip label={d} />
                </MenuItem>
              ))}
            </TextField>
          </Box>
        </Box>

        {/* STATUS HISTORY */}
        {project?.history && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Status History
            </Typography>
            <Stack spacing={1}>
              {project.history
                .slice()
                .reverse()
                .map((h, idx) => (
                  <Box
                    key={idx}
                    sx={{
                      p: 1,
                      borderRadius: 1,
                      background: "rgba(255,255,255,0.04)",
                    }}
                  >
                    <Typography sx={{ fontSize: 13 }}>
                      {h.status} — by {h.by} at{" "}
                      {new Date(h.at).toLocaleString()}
                    </Typography>
                    {h.note && (
                      <Typography
                        sx={{ fontSize: 12 }}
                        color="text.secondary"
                      >
                        {h.note}
                      </Typography>
                    )}
                  </Box>
                ))}
            </Stack>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>

        {mode !== "view" && (
          <Button
            variant="contained"
            onClick={submit}
            sx={{
              background:
                "linear-gradient(135deg,#7b5cff,#5ce1e6)",
            }}
          >
            {project ? "Save" : "Create"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
