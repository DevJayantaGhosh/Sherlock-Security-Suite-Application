// src/components/projects/ProjectDialog.tsx

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
  Typography,
  Tooltip
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

import { useEffect, useState } from "react";

import { Project } from "../../models/Project";
import { createProject, updateProject } from "../../services/projectService";
import { useUserStore } from "../../store/userStore";
import { getUsers } from "../../services/userService";

// =====================================================
// 🔮 COMMENTED FOR FUTURE API INTEGRATION
// import { getRepos } from "../../services/repoService";
// import { getDependencies } from "../../services/dependencyService";
// =====================================================

// -----------------------------------------------------
// DEMO DATA (replace via API later)
// -----------------------------------------------------

const REPOSITORIES = [
  "https://github.com/org/web-ui",
  "https://github.com/org/backend-api",
  "https://github.com/org/mobile-app",
];

const DEPENDENCIES = [
  "React",
  "Node",
  "Express",
  "Docker",
  "MongoDB",
  "Redis",
  "Kubernetes"
];

// ✅ SEMVER regex: 1.2.0 / 1.2.0-beta / 1.2.0-rc
const SEMVER_REGEX =
  /^(\d+)\.(\d+)\.(\d+)(-(alpha|beta|rc))?$/;

export default function ProjectDialog({
  open,
  onClose,
  project,
  refresh,
  mode = "create"
}: {
  open: boolean;
  onClose: () => void;
  project?: Project | null;
  refresh: () => void;
  mode?: "create" | "edit" | "view";
}) {

  const user = useUserStore(s => s.user);
  const isView = mode === "view";
  const users = getUsers();

  // -----------------------------------------------------
  // FORM STATE
  // -----------------------------------------------------

  const [form, setForm] = useState<Omit<Project,
    "id" | "createdAt" | "updatedAt" | "updatedBy"
  >>({
    name: "",
    version: "",
    description: "",
    projectDirector: null,
    securityHead: null,
    releaseEngineers: [],
    gitRepo: [""],
    gitBrances: [""],
    gpgKey: [""],
    dependencies: [],
    createdBy: "",
    status: "Pending"
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // -----------------------------------------------------
  // LOAD DATA
  // -----------------------------------------------------

  useEffect(() => {
    if (project) {
      setForm({
        ...project,
        gitRepo: project.gitRepo?.length ? project.gitRepo : [""],
        gitBrances: project.gitBrances?.length ? project.gitBrances : [""],
        gpgKey: project.gpgKey?.length ? project.gpgKey : [""],
      } as any);
    } else {
      setForm({
        name: "",
        version: "",
        description: "",
        projectDirector: null,
        securityHead: null,
        releaseEngineers: [],
        gitRepo: [""],
        gitBrances: [""],
        gpgKey: [""],
        dependencies: [],
        createdBy: "",
        status: "Pending",
      });
    }

    setErrors({});
  }, [project, open]);

  // -----------------------------------------------------
  // VALIDATION
  // -----------------------------------------------------

  function validate() {

    const e: Record<string, string> = {};

    if (!form.name?.trim())
      e.name = "Project name required";

    if (!form.version?.trim())
      e.version = "Version required";

    if (!SEMVER_REGEX.test(form.version))
      e.version = "Use semantic version: 1.2.0 / 1.2.0-beta / 1.2.0-rc";

    if (!form.description?.trim())
      e.description = "Description required";

    if (!form.projectDirector)
      e.projectDirector = "Select project director";

    if (!form.securityHead)
      e.securityHead = "Select security head";

    if (!form.releaseEngineers.length)
      e.releaseEngineers = "Select at least one Release Engineer";

    if (!form.dependencies?.length)
      e.dependencies = "Select at least one dependency";

    (form.gitRepo ?? []).forEach((v, i) => {
      if (!v?.trim()) e[`repo-${i}`] = "Repo required";
    });

    (form.gitBrances ?? []).forEach((v, i) => {
      if (!v?.trim()) e[`branch-${i}`] = "Branch required";
    });

    (form.gpgKey ?? []).forEach((v, i) => {
      if (!v?.trim()) e[`gpg-${i}`] = "GPG key required";
    });

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // -----------------------------------------------------
  // ROW MANIPULATION
  // -----------------------------------------------------

  function setAt<K extends keyof typeof form>(
    key: K,
    idx: number,
    val: string
  ) {
    const arr = [...(form[key] as string[])];
    arr[idx] = val;
    setForm({ ...form, [key]: arr });
  }

  function addRepoRow() {
    setForm({
      ...form,
      gitRepo: [...(form.gitRepo ?? []), ""],
      gitBrances: [...(form.gitBrances ?? []), ""],
      gpgKey: [...(form.gpgKey ?? []), ""]
    });
  }

  function removeRepoRow(i: number) {
    const r = [...(form.gitRepo ?? [])];
    const b = [...(form.gitBrances ?? [])];
    const g = [...(form.gpgKey ?? [])];

    r.splice(i, 1);
    b.splice(i, 1);
    g.splice(i, 1);

    setForm({ ...form, gitRepo: r, gitBrances: b, gpgKey: g });
  }

  // -----------------------------------------------------
  // SUBMIT ✅ createdBy FIX
  // -----------------------------------------------------

  function submit() {
    if (!validate()) return;

    if (!user?.id) {
      console.error("User session missing");
      return;
    }

    if (project) {
      updateProject({
        ...(project as Project),
        ...form,
        updatedBy: user.id
      });
    } else {
      createProject({
        ...(form as Project),
        createdBy: user.id
      });
    }

    refresh();
    onClose();
  }

  // -----------------------------------------------------
  // CLIPBOARD
  // -----------------------------------------------------

  function copy(text: string) {
    if (!text) return;
    navigator.clipboard.writeText(text);
  }

  // -----------------------------------------------------
  // RENDER
  // -----------------------------------------------------

  return (

    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
    >

      <DialogTitle>
        {mode === "view"
          ? "Project Details"
          : project ? "Edit Project" : "Create Project"}
      </DialogTitle>

      <DialogContent dividers>

        {/* BASIC INFO */}
        <Box sx={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 2,
        }}>

          <TextField
            label="Name"
            value={form.name}
            error={!!errors.name}
            helperText={errors.name}
            disabled={isView}
            onChange={e => setForm({ ...form, name: e.target.value })}
          />

          <TextField
            label="Version"
            value={form.version}
            error={!!errors.version}
            helperText={errors.version}
            disabled={isView}
            onChange={e => setForm({ ...form, version: e.target.value })}
          />

          <TextField
            label="Description"
            value={form.description}
            multiline
            rows={1}
            error={!!errors.description}
            helperText={errors.description}
            disabled={isView}
            onChange={e => setForm({ ...form, description: e.target.value })}
          />

          <TextField
            select
            label="Project Director"
            value={form.projectDirector ?? ""}
            error={!!errors.projectDirector}
            helperText={errors.projectDirector}
            disabled={isView}
            onChange={e => setForm({ ...form, projectDirector: e.target.value })}
          >
            {users.map(u =>
              <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>
            )}
          </TextField>

          <TextField
            select
            label="Security Head"
            value={form.securityHead ?? ""}
            error={!!errors.securityHead}
            helperText={errors.securityHead}
            disabled={isView}
            onChange={e => setForm({ ...form, securityHead: e.target.value })}
          >
            {users.map(u =>
              <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>
            )}
          </TextField>

          <TextField
            select
            label="Release Engineers"
            SelectProps={{ multiple: true }}
            value={form.releaseEngineers}
            error={!!errors.releaseEngineers}
            helperText={errors.releaseEngineers}
            disabled={isView}
            onChange={e =>
              setForm({ ...form, releaseEngineers: e.target.value as unknown as string[] })
            }
          >
            {users.map(u =>
              <MenuItem key={u.id} value={u.id}>
                <Chip label={u.name} size="small" />
              </MenuItem>
            )}
          </TextField>

        </Box>

        {/* REPOS */}
        <Box sx={{ mt: 3 }}>

          <Typography mb={1}>Repositories</Typography>

          {(form.gitRepo ?? []).map((_, i) => (

            <Box key={i} sx={{
              display: "grid",
              gridTemplateColumns: "1.5fr .8fr 2fr auto auto",
              alignItems: "center",
              gap: 1,
              mb: 1
            }}>

              <TextField
                select
                label="Repo"
                value={(form.gitRepo?.[i] ?? "")}
                error={!!errors[`repo-${i}`]}
                helperText={errors[`repo-${i}`]}
                disabled={isView}
                onChange={e => setAt("gitRepo", i, e.target.value)}
              >
                {REPOSITORIES.map(r =>
                  <MenuItem key={r} value={r}>{r}</MenuItem>
                )}
              </TextField>

              <TextField
                label="Branch"
                value={(form.gitBrances?.[i] ?? "")}
                error={!!errors[`branch-${i}`]}
                helperText={errors[`branch-${i}`]}
                disabled={isView}
                onChange={e => setAt("gitBrances", i, e.target.value)}
              />

              {/* GPG + COPY INLINE */}
              <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
                <TextField
                  fullWidth
                  label="GPG Key"
                  value={(form.gpgKey?.[i] ?? "")}
                  error={!!errors[`gpg-${i}`]}
                  helperText={errors[`gpg-${i}`]}
                  disabled={isView}
                  onChange={e => setAt("gpgKey", i, e.target.value)}
                />

                <Tooltip title="Copy GPG key">
                  <IconButton
                    onClick={() => copy(form.gpgKey?.[i] ?? "")}
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>

              {!isView && (

                <IconButton
                  onClick={() => removeRepoRow(i)}
                  disabled={(form.gitRepo?.length || 1) <= 1}
                >
                  <RemoveIcon />
                </IconButton>

              )}

            </Box>

          ))}

          {!isView && (
            <Button onClick={addRepoRow} startIcon={<AddIcon />}>
              Add Repo
            </Button>
          )}

        </Box>

        {/* DEPENDENCIES */}
        <Box sx={{ mt: 3 }}>

          <TextField
            select
            label="Dependencies"
            fullWidth
            SelectProps={{ multiple: true }}
            value={form.dependencies}
            error={!!errors.dependencies}
            helperText={errors.dependencies}
            disabled={isView}
            onChange={e =>
              setForm({
                ...form,
                dependencies: e.target.value as unknown as string[]
              })
            }
          >
            {DEPENDENCIES.map(d =>
              <MenuItem key={d} value={d}>
                <Chip label={d} size="small" />
              </MenuItem>
            )}
          </TextField>

        </Box>

      </DialogContent>

      <DialogActions>

        <Button onClick={onClose}>Close</Button>

        {!isView && (
          <Button
            variant="contained"
            onClick={submit}
            sx={{
              background: "linear-gradient(135deg,#7b5cff,#5ce1e6)"
            }}
          >
            {project ? "Save" : "Create"}
          </Button>
        )}

      </DialogActions>

    </Dialog>
  );
}
