import {
  Box,
  Button,
  Container,
  Typography,
  TextField,
  MenuItem,
  Grid,
  Stack
} from "@mui/material";
import { useEffect, useState } from "react";
import { getProjects, deleteProject, updateStatus } from "../services/projectService";
import { Project, ProjectStatus } from "../models/Project";
import ProjectCard from "../components/ProjectCard";
import ProjectDialog from "../components/ProjectDialog";

import AddIcon from "@mui/icons-material/Add";

import {
  toastAdd,
  toastApprove,
  toastReject,
  toastDelete,
  toastRelease
} from "../utils/toast";

const PAGE_SIZE = 6;

export default function ProjectDashboard() {

  const [projects,setProjects] = useState<Project[]>([]);
  const [search,setSearch] = useState("");
  const [filter,setFilter] = useState<ProjectStatus | "All">("All");

  const [page,setPage]=useState(0);
  const [dlg,setDlg]=useState(false);
  const [edit,setEdit]=useState<Project|null>(null);

  const load = ()=> setProjects(getProjects());

  useEffect(load,[]);

  const filtered = projects.filter(p=>{
    const s=p.name.toLowerCase().includes(search.toLowerCase());
    const f=filter==="All" || p.status===filter;
    return s && f;
  });

  const pageData = filtered.slice(
    page*PAGE_SIZE,
    (page+1)*PAGE_SIZE
  );

  const openCreate = ()=>{
    setEdit(null);
    setDlg(true);
  };

  const openEdit = (p:Project)=>{
    setEdit(p);
    setDlg(true);
  };

  return (
    <Box sx={{minHeight:"100vh",bgcolor:"#060712",pb:5}}>
      <Container maxWidth="lg">
               <Typography
                    variant="h4"
                    sx={{
                      mb: 4,
                      mt:4,
                      fontWeight: 800,
                      textAlign: "center",
                      letterSpacing: 1,
                    }}
                  >
                    Project Configurations
                  </Typography>

        {/* ==== TOP BAR ==== */}
        <Stack direction="row" gap={2} mb={4} alignItems="center">

          <TextField
            select
            label="Status"
            sx={{ width: 180 }}
            value={filter}
            onChange={e=>setFilter(e.target.value as any)}
          >
            <MenuItem value="All">All</MenuItem>
            <MenuItem value="Pending">Pending</MenuItem>
            <MenuItem value="Approved">Approved</MenuItem>
            <MenuItem value="Rejected">Rejected</MenuItem>
            <MenuItem value="Released">Released</MenuItem>
          </TextField>

          <TextField
            fullWidth
            placeholder="Search project..."
            value={search}
            onChange={e=>setSearch(e.target.value)}
          />

          <Button
            variant="contained"
            startIcon={<AddIcon/>}
            onClick={openCreate}
            sx={{
              px:4,
              fontWeight:800,
              background:"linear-gradient(135deg,#7b5cff,#5ce1e6)"
            }}
          >
            Add Project
          </Button>
        </Stack>

        {/* ==== CARDS ==== */}
        <Grid container spacing={3}>
          {pageData.map(p=>(
            <Grid key={p.id} size={4}>
              <ProjectCard
                project={p}
                onView={()=>{}}
                onEdit={()=>openEdit(p)}
                onDelete={()=>{
                  deleteProject(p.id);
                  toastDelete();
                  load();
                }}
                onApprove={()=>{
                  updateStatus(p.id,"Approved")
                  toastApprove();
                  load();
                }}
                onReject={()=>{
                  updateStatus(p.id,"Rejected")
                  toastReject();
                  load();
                }}
                onRelease={()=>{
                  updateStatus(p.id,"Released")
                  toastRelease();
                  load();
                }}
              />
            </Grid>
          ))}
        </Grid>

        {/* ==== PAGINATION ==== */}
        <Stack direction="row" justifyContent="center" mt={4} gap={2}>
          <Button disabled={page===0} onClick={()=>setPage(p=>p-1)}>
            Previous
          </Button>
          <Button
            disabled={(page+1)*PAGE_SIZE>=filtered.length}
            onClick={()=>setPage(p=>p+1)}
          >
            Next
          </Button>
        </Stack>

      </Container>

      {/* ----- DIALOG ----- */}
      <ProjectDialog
        open={dlg}
        onClose={()=>setDlg(false)}
        project={edit}
        refresh={load}
      />

    </Box>
  );
}
