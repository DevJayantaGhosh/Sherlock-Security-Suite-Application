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
  Tooltip,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

import { useEffect, useState } from "react";

import { Project, RepoConfig } from "../../models/Project";
import { createProject, updateProject } from "../../services/projectService";
import { useUserStore } from "../../store/userStore";
import { getUsers } from "../../services/userService";

/* -----------------------------------------------------
   DEMO DATA
----------------------------------------------------- */

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
  "Kubernetes",
];

// ✅ SEMVER regex (no leading v)
const SEMVER_REGEX = /^(\d+)\.(\d+)\.(\d+)(-(alpha|beta|rc))?$/;

/* -----------------------------------------------------
   COMPONENT
----------------------------------------------------- */

type ProjectForm = Omit<
  Project,
  "id" | "createdAt" | "updatedAt" | "updatedBy" | "history"
>;

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
  const users = getUsers();

  /* -----------------------------------------------------
     FORM STATE
  ----------------------------------------------------- */

  const emptyForm: ProjectForm = {
    name: "",
    version: "",
    description: "",
    projectDirector: null,
    securityHead: null,
    releaseEngineers: [],
    repos: [{ repoUrl: "", branch: "", gpgKey: "" }],
    dependencies: [],
    createdBy: "",
    status: "Pending",
  };

  const [form, setForm] = useState<ProjectForm>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  /* -----------------------------------------------------
     LOAD DATA
  ----------------------------------------------------- */

  useEffect(() => {
    if (project) {
      const { id, createdAt, updatedAt, updatedBy, history, ...rest } =
        project;

      setForm({
        ...rest,
        repos: rest.repos.length
          ? rest.repos
          : [{ repoUrl: "", branch: "", gpgKey: "" }],
      });
    } else {
      setForm(emptyForm);
    }

    setErrors({});
  }, [project, open]);

  /* -----------------------------------------------------
     VALIDATION
  ----------------------------------------------------- */

  function validate(): boolean {
    const e: Record<string, string> = {};

    if (!form.name.trim())
      e.name = "Project name required";

    if (!form.version.trim())
      e.version = "Version required";
    else if (!SEMVER_REGEX.test(form.version))
      e.version = "Use format: 1.2.0 / 1.2.0-beta / 1.2.0-rc";

    if (!form.description?.trim())
      e.description = "Description required";

    if (!form.projectDirector)
      e.projectDirector = "Select project director";

    if (!form.securityHead)
      e.securityHead = "Select security head";

    if (!form.releaseEngineers.length)
      e.releaseEngineers = "Select at least 1 release engineer";

    if (!form.dependencies?.length)
      e.dependencies = "Select at least one dependency";

    form.repos.forEach((r, i) => {
      if (!r.repoUrl) e[`repo-${i}`] = "Repo required";
      if (!r.branch) e[`branch-${i}`] = "Branch required";
      if (!r.gpgKey) e[`gpg-${i}`] = "GPG key required";
    });

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  /* -----------------------------------------------------
     REPO EDIT
  ----------------------------------------------------- */

  function setRepoField<K extends keyof RepoConfig>(
    idx: number,
    key: K,
    value: string
  ) {
    const arr = [...form.repos];
    arr[idx] = { ...arr[idx], [key]: value };
    setForm({ ...form, repos: arr });
  }

  function addRepoRow() {
    setForm({
      ...form,
      repos: [...form.repos, { repoUrl: "", branch: "", gpgKey: "" }],
    });
  }

  function removeRepoRow(i: number) {
    setForm({
      ...form,
      repos: form.repos.filter((_, idx) => idx !== i),
    });
  }

  /* -----------------------------------------------------
     SUBMIT
  ----------------------------------------------------- */

  function submit() {
    if (!validate()) return;
    if (!user?.id) return;

    if (project) {
      updateProject({
        ...project,
        ...form,
        updatedBy: user.id,
      });
    } else {
      const payload: ProjectForm = {
        ...form,
        createdBy: user.id,
      };

      // ✅ SHOW ALERT BEFORE INSERT
      alert(
        "Creating project:\n\n" +
          JSON.stringify(payload, null, 2)
      );

      createProject(payload);
    }

    refresh();
    onClose();
  }

  /* -----------------------------------------------------
     CLIPBOARD
  ----------------------------------------------------- */

  function copy(text: string) {
    if (!text.trim()) return;
    navigator.clipboard.writeText(text);
  }

  /* -----------------------------------------------------
     RENDER
  ----------------------------------------------------- */

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        {mode === "view"
          ? "Project Details"
          : project
          ? "Edit Project"
          : "Create Project"}
      </DialogTitle>

      <DialogContent dividers>
        {/* BASIC INFO */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 2,
          }}
        >
          <TextField
            label="Name"
            value={form.name}
            error={!!errors.name}
            helperText={errors.name}
            disabled={isView}
            onChange={(e) =>
              setForm({ ...form, name: e.target.value })
            }
          />

          <TextField
            label="Version"
            value={form.version}
            error={!!errors.version}
            helperText={errors.version}
            disabled={isView}
            onChange={(e) =>
              setForm({ ...form, version: e.target.value })
            }
          />

          <TextField
            label="Description"
            value={form.description}
            error={!!errors.description}
            helperText={errors.description}
            disabled={isView}
            onChange={(e) =>
              setForm({ ...form, description: e.target.value })
            }
          />

          {/* Selects */}
          <TextField
            select
            label="Project Director"
            value={form.projectDirector ?? ""}
            error={!!errors.projectDirector}
            helperText={errors.projectDirector}
            disabled={isView}
            onChange={(e) =>
              setForm({
                ...form,
                projectDirector: e.target.value,
              })
            }
          >
            {users.map((u) => (
              <MenuItem key={u.id} value={u.id}>
                {u.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Security Head"
            value={form.securityHead ?? ""}
            error={!!errors.securityHead}
            helperText={errors.securityHead}
            disabled={isView}
            onChange={(e) =>
              setForm({
                ...form,
                securityHead: e.target.value,
              })
            }
          >
            {users.map((u) => (
              <MenuItem key={u.id} value={u.id}>
                {u.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Release Engineers"
            SelectProps={{ multiple: true }}
            value={form.releaseEngineers}
            error={!!errors.releaseEngineers}
            helperText={errors.releaseEngineers}
            disabled={isView}
            onChange={(e) =>
              setForm({
                ...form,
                releaseEngineers:
                  e.target.value as unknown as string[],
              })
            }
          >
            {users.map((u) => (
              <MenuItem key={u.id} value={u.id}>
                <Chip label={u.name} size="small" />
              </MenuItem>
            ))}
          </TextField>
        </Box>

        {/* REPOS */}
        <Box sx={{ mt: 3 }}>
          <Typography mb={1}>Repositories</Typography>

          {form.repos.map((r, i) => (
            <Box
              key={i}
              sx={{
                display: "grid",
                gridTemplateColumns:
                  "1.5fr .8fr 2fr auto",
                alignItems: "center",
                gap: 1,
                mb: 1,
              }}
            >
              <TextField
                select
                label="Repo"
                value={r.repoUrl}
                error={!!errors[`repo-${i}`]}
                helperText={errors[`repo-${i}`]}
                disabled={isView}
                onChange={(e) =>
                  setRepoField(
                    i,
                    "repoUrl",
                    e.target.value
                  )
                }
              >
                {REPOSITORIES.map((x) => (
                  <MenuItem key={x} value={x}>
                    {x}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Branch"
                value={r.branch}
                error={!!errors[`branch-${i}`]}
                helperText={errors[`branch-${i}`]}
                disabled={isView}
                onChange={(e) =>
                  setRepoField(
                    i,
                    "branch",
                    e.target.value
                  )
                }
              />

              <Box sx={{ display: "flex", gap: 0.5 }}>
                <TextField
                  fullWidth
                  label="GPG Key"
                  value={r.gpgKey}
                  error={!!errors[`gpg-${i}`]}
                  helperText={errors[`gpg-${i}`]}
                  disabled={isView}
                  onChange={(e) =>
                    setRepoField(
                      i,
                      "gpgKey",
                      e.target.value
                    )
                  }
                />

                <Tooltip title="Copy GPG key">
                  <IconButton
                    onClick={() =>
                      copy(r.gpgKey)
                    }
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>

              {!isView && (
                <IconButton
                  onClick={() =>
                    removeRepoRow(i)
                  }
                  disabled={
                    form.repos.length <= 1
                  }
                >
                  <RemoveIcon />
                </IconButton>
              )}
            </Box>
          ))}

          {!isView && (
            <Button
              onClick={addRepoRow}
              startIcon={<AddIcon />}
            >
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
            onChange={(e) =>
              setForm({
                ...form,
                dependencies:
                  e.target.value as unknown as string[],
              })
            }
          >
            {DEPENDENCIES.map((d) => (
              <MenuItem key={d} value={d}>
                <Chip label={d} size="small" />
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          Close
        </Button>

        {!isView && (
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
