// src/pages/ProjectSecurityScanPage.tsx
import  { useEffect, useState } from "react";
import { Box, Button, Container, Paper, Stack, Typography, Chip } from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";

import { getProjects } from "../services/projectService";
import { useUserStore } from "../store/userStore";
import { runRepoScan } from "../services/securityService";
import { useToast } from "../components/ToastProvider";
import RepoScanAccordion from "../components/security/RepoScanAccordion";
import DependencyAudit from "../components/security/DependencyAuditPanel";

export default function ProjectSecurityScanPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const user = useUserStore((s) => s.user);
  const [project, setProject] = useState<any>(null);

  useEffect(() => {
    const p = getProjects().find((x) => x.id === id);
    setProject(p ?? null);
    if (!p) {
      toast("Project not found", "error");
      navigate("/projects");
    }
  }, [id]);

  if (!project) return null;

  // Authorization: only Admin or the assigned security head
  const isAuthorized = user?.role === "Admin" || project.securityHead === user?.id;
  if (!isAuthorized) return <Box sx={{ pt: 8, p: 4 }}><Typography color="error">Unauthorized</Typography></Box>;

  // "Run full" example — runs the first repo
  async function runFullFirstRepo() {
    if (!project.gitRepo || project.gitRepo.length === 0) {
      toast("No repositories configured", "warning");
      return;
    }
    try {
      await runRepoScan(project.id, 0, project.gitRepo[0],project.gitBrances[0]);
      toast("Started scan for first repo", "info");
    } catch (e) {
      console.error(e);
      toast("Failed to start scan", "error");
    }
  }

  return (
    <Box sx={{ pt: 8, pb: 8 }}>
      <Container maxWidth="lg">
        {/* Header */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h4" fontWeight={800}>Security Scan — {project.name}</Typography>
              <Typography color="text.secondary" sx={{ mt: 1 }}>{project.description}</Typography>
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                Director: {project.projectDirector || "—"} &nbsp;&nbsp;
                Security Head: {project.securityHead || "—"} &nbsp;&nbsp;
                Release Engineers: {project.releaseEngineers?.length ?? 0}
              </Typography>
            </Box>

            <Stack direction="row" spacing={2}>
              <Chip label={`Dependencies: ${project.dependencies?.length ?? 0}`} color="primary" />
              <Button variant="contained" onClick={runFullFirstRepo} sx={{ background: "linear-gradient(135deg,#7b5cff,#5ce1e6)" }}>► Run full (first repo)</Button>
            </Stack>
          </Stack>
        </Paper>

        {/* For each repo render RepoAccordion */}
        <Stack spacing={3}>
          {project.gitRepo?.map((repo: string, idx: number) => (
            <RepoScanAccordion
              key={`${repo}-${idx}`}
              projectId={project.id}
              repoIndex={idx}
              repoUrl={repo}
              branch={project.gitBrances?.[idx] ?? "main"}
              gpg={project.gpgKey?.[idx] ?? ""}
              depsCount={project.dependencies?.length ?? 0}
            />
          ))}

          {/* Dependency Audit — interactive chat area (single area after repos) */}
          <Paper sx={{ p: 2 }}>
            <DependencyAudit dependencies={["node","jdk","dotnet"]}></DependencyAudit>
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
}
