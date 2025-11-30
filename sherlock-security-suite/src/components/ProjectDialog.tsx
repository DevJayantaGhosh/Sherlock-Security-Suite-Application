import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  TextField,
  Box,
  MenuItem,
  Autocomplete,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";

import { useEffect, useState } from "react";
import { Project } from "../models/Project";
import {
  createProject,
  updateProject
} from "../services/projectService";

import { useUserStore } from "../store/userStore";
import { getUsers } from "../services/userService";

const DEPENDENCIES = [
  "React",
  "Node",
  ".NET",
  "SSL",
  "Docker",
  "MongoDB",
  "Postgres"
];

const emptyProject: Project = {
  id: "",
  name: "",
  description: "",
  projectDirector: null,
  securityHead: null,
  releaseEngineers: [],
  gitRepo: [""],
  gpgKey: [""],
  dependencies: [],
  remark: "",
  createdBy: "",
  updatedBy: "",
  createdAt: "",
  status: "Pending",
};

interface Props {
  open: boolean;
  onClose: () => void;
  project?: Project | null;
  refresh: () => void;
}

export default function ProjectDialog({
  open,
  onClose,
  project,
  refresh,
}: Props) {

  const user = useUserStore((s) => s.user);
  const [users, setUsers] = useState<any[]>([]);
  const [form, setForm] = useState<Project>(emptyProject);

  useEffect(() => {
    setUsers(getUsers());

    if (project) {
      setForm(project);
    } else {
      setForm(emptyProject);
    }
  }, [project, open]);

  // -------------------------
  // Repo + GPG handlers
  // -------------------------
  const addRepoRow = () => {
    setForm({
      ...form,
      gitRepo: [...(form.gitRepo || []), ""],
      gpgKey: [...(form.gpgKey || []), ""],
    });
  };

  const removeRepoRow = (idx: number) => {
    setForm({
      ...form,
      gitRepo: form.gitRepo!.filter((_, i) => i !== idx),
      gpgKey: form.gpgKey!.filter((_, i) => i !== idx),
    });
  };

  const updateRepoRow = (
    idx: number,
    field: "gitRepo" | "gpgKey",
    value: string
  ) => {
    const list = [...(form[field] || [])];
    list[idx] = value;

    setForm({
      ...form,
      [field]: list,
    });
  };

  // -------------------------
  // SUBMIT
  // -------------------------
  const submit = () => {
    if (!user) return;

    if (project) {
      updateProject({
        ...form,
        updatedBy: user.id,
      });
    } else {
      createProject({
        ...form,
        createdBy: user.id,
        updatedBy: user.id,
      });
    }

    refresh();
    onClose();
  };

  // -------------------------
  // UI
  // -------------------------
  return (
    <Dialog
      open={open}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          background: "linear-gradient(180deg,#0b0f20,#060712)",
          borderRadius: 3,
          border: "1px solid rgba(255,255,255,0.08)",
        },
      }}
    >
      <DialogTitle sx={{ fontWeight: 800 }}>
        {project ? "Edit Project" : "Create Project"}
      </DialogTitle>

      <DialogContent>
        <Box mt={1}>
          <Grid container spacing={2}>

            {/* ---------- ROW 1 ---------- */}
            <Grid size={4}>
              <TextField
                fullWidth
                label="Project Name"
                value={form.name}
                onChange={(e)=>setForm({...form,name:e.target.value})}
              />
            </Grid>

            <Grid size={4}>
              <TextField
                select
                fullWidth
                label="Project Director"
                value={form.projectDirector || ""}
                onChange={(e)=>setForm({...form,projectDirector:e.target.value})}
              >
                {users.map(u=>(
                  <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid size={4}>
              <TextField
                select
                fullWidth
                label="Security Head"
                value={form.securityHead || ""}
                onChange={(e)=>setForm({...form,securityHead:e.target.value})}
              >
                {users.map(u=>(
                  <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* ---------- ROW 2 ---------- */}
            <Grid size={4}>
              <Autocomplete
                multiple
                options={users.map(u=>({label:u.name,value:u.id}))}
                value={form.releaseEngineers.map(id => {
                  const u = users.find(x=>x.id===id);
                  return {label:u?.name || id, value:id};
                })}
                onChange={(_,v)=>setForm({
                  ...form,
                  releaseEngineers:v.map(x=>x.value)
                })}
                renderInput={(params)=>(
                  <TextField {...params} label="Release Engineers" />
                )}
              />
            </Grid>

            <Grid size={8}>
              <Autocomplete
                multiple
                options={DEPENDENCIES}
                value={form.dependencies || []}
                onChange={(_,v)=>setForm({
                  ...form,
                  dependencies:v
                })}
                renderInput={(params)=>(
                  <TextField {...params} label="Dependencies" />
                )}
              />
            </Grid>

            {/* ---------- DESCRIPTION ---------- */}
            <Grid size={12}>
              <TextField
                fullWidth
                multiline
                minRows={3}
                label="Description"
                value={form.description || ""}
                onChange={(e)=>setForm({...form,description:e.target.value})}
              />
            </Grid>

            {/* ---------- REPOS ---------- */}
            <Grid size={12}>
              <Stack spacing={1}>
                <Typography fontWeight={700}>
                  Repositories
                </Typography>

                {(form.gitRepo || []).map((_,idx)=>(
                  <Stack key={idx} direction="row" gap={1}>
                    <TextField
                      fullWidth
                      label={`Git Repo ${idx+1}`}
                      value={form.gitRepo![idx]}
                      onChange={(e)=>updateRepoRow(idx,"gitRepo",e.target.value)}
                    />
                    <TextField
                      fullWidth
                      label={`GPG Key ${idx+1}`}
                      value={form.gpgKey![idx]}
                      onChange={(e)=>updateRepoRow(idx,"gpgKey",e.target.value)}
                    />
                    <IconButton
                      onClick={()=>removeRepoRow(idx)}
                      disabled={form.gitRepo!.length === 1}
                    >
                      <DeleteIcon/>
                    </IconButton>
                  </Stack>
                ))}

                <Button startIcon={<AddIcon/>} onClick={addRepoRow}>
                  Add Repo
                </Button>
              </Stack>
            </Grid>

            {/* ---------- REMARK ---------- */}
            <Grid size={12}>
              <TextField
                fullWidth
                label="Remark"
                value={form.remark || ""}
                onChange={(e)=>setForm({...form,remark:e.target.value})}
              />
            </Grid>

          </Grid>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="outlined">
          Cancel
        </Button>

        <Button
          onClick={submit}
          variant="contained"
          sx={{
            fontWeight:800,
            background:
              "linear-gradient(135deg,#7b5cff,#5ce1e6)"
          }}
        >
          {project ? "Save Changes" : "Create Project"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
