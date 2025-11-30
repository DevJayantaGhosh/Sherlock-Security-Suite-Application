import { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  MenuItem,
  Box,
  Chip,
  Select,
} from "@mui/material";

import { createProject, updateProject } from "../services/projectService.ts";
import { Project } from "../models/Project";
import { AppUser } from "../models/User.ts";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (p: Project) => void;
  users: AppUser[];
  edit?: Project | null;
  readOnly?: boolean;
}

export default function ProjectFormDialog({
  open,
  onClose,
  onSaved,
  users,
  edit,
  readOnly = false,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [projectDirector, setProjectDirector] = useState<string | null>(null);
  const [securityHead, setSecurityHead] = useState<string | null>(null);
  const [releaseEngineer, setReleaseEngineer] = useState<string | null>(null);
  const [gitRepo, setGitRepo] = useState("");
  const [gpgKey, setGpgKey] = useState("");
  const [dependencies, setDependencies] = useState<string[]>([]);

  const pds = users.filter((u) => u.role === "ProjectDirector");
  const shs = users.filter((u) => u.role === "SecurityHead");
  const res = users.filter((u) => u.role === "ReleaseEngineer");

  useEffect(() => {
    if (edit) {
      setName(edit.name);
      setDescription(edit.description || "");
      setProjectDirector(edit.projectDirector || null);
      setSecurityHead(edit.securityHead || null);
      setReleaseEngineer(edit.releaseEngineers[0] || null);
      setGitRepo(edit.gitRepo || "");
      setGpgKey(edit.gpgKey || "");
      setDependencies(edit.dependencies || []);
    } else {
      setName("");
      setDescription("");
      setProjectDirector(null);
      setSecurityHead(null);
      setReleaseEngineer(null);
      setGitRepo("");
      setGpgKey("");
      setDependencies([]);
    }
  }, [edit, open]);

  function save() {
    if (readOnly) return;

    const payload = {
      name,
      description,
      projectDirector,
      securityHead,
      releaseEngineers: releaseEngineer? [releaseEngineer] : [],
      gitRepo,
      gpgKey,
      dependencies,
      status: edit ? edit.status : "Pending",
    } as any;

    let project: Project;
    if (edit) {
      project = updateProject({ ...edit, ...payload });
    } else {
      project = createProject(payload);
    }

    onSaved(project);
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {readOnly ? "View Project" : edit ? "Edit Project" : "Add Project"}
      </DialogTitle>

      <DialogContent>
        <Box display="flex" flexWrap="wrap" gap={2} mt={1}>
          <TextField
            label="Project Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={readOnly}
            sx={{ flex: "1 1 48%" }}
          />

          <TextField
            label="Project Director"
            select
            value={projectDirector ?? ""}
            disabled={readOnly}
            onChange={(e) => setProjectDirector(e.target.value || null)}
            sx={{ flex: "1 1 48%" }}
          >
            <MenuItem value="">None</MenuItem>
            {pds.map((u) => (
              <MenuItem key={u.id} value={u.id}>
                {u.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Security Head"
            select
            value={securityHead ?? ""}
            disabled={readOnly}
            onChange={(e) => setSecurityHead(e.target.value || null)}
            sx={{ flex: "1 1 48%" }}
          >
            <MenuItem value="">None</MenuItem>
            {shs.map((u) => (
              <MenuItem key={u.id} value={u.id}>
                {u.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Release Engineer"
            select
            value={releaseEngineer ?? ""}
            disabled={readOnly}
            onChange={(e) => setReleaseEngineer(e.target.value || null)}
            sx={{ flex: "1 1 48%" }}
          >
            <MenuItem value="">None</MenuItem>
            {res.map((u) => (
              <MenuItem key={u.id} value={u.id}>
                {u.name}
              </MenuItem>
            ))}
          </TextField>
        </Box>

        <TextField
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          multiline
          rows={2}
          disabled={readOnly}
          fullWidth
          sx={{ mt: 2 }}
        />

        <TextField
          label="Git Repo"
          value={gitRepo}
          onChange={(e) => setGitRepo(e.target.value)}
          disabled={readOnly}
          fullWidth
          sx={{ mt: 2 }}
        />

        <TextField
          label="GPG Key"
          value={gpgKey}
          onChange={(e) => setGpgKey(e.target.value)}
          disabled={readOnly}
          fullWidth
          sx={{ mt: 2 }}
        />

        <Select
          multiple
          value={dependencies}
          onChange={(e) => setDependencies(e.target.value as string[])}
          fullWidth
          disabled={readOnly}
          displayEmpty
          sx={{ mt: 2 }}
          renderValue={(selected) =>
            selected.length === 0 ? (
              "Select Dependencies"
            ) : (
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                {selected.map((s) => (
                  <Chip key={s} label={s} />
                ))}
              </Box>
            )
          }
        >
          {[
            "React",
            "Node",
            "Express",
            "MongoDB",
            "Docker",
            "Redis",
            "Kubernetes",
          ].map((dep) => (
            <MenuItem key={dep} value={dep}>
              {dep}
            </MenuItem>
          ))}
        </Select>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        {!readOnly && (
          <Button variant="contained" onClick={save}>
            {edit ? "Save" : "Create"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
