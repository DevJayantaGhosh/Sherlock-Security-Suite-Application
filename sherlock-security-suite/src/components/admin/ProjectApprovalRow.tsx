import { Box, Chip, Button } from "@mui/material";
import { Project } from "../../models/Project";
import {
  authorizeApprove,
  updateProject,
} from "../../services/projectService";
import { useUserStore } from "../../store/userStore";

interface Props {
  project: Project;
  refresh(): void;
}

export default function ProjectApprovalRow({
  project,
  refresh,
}: Props) {
  const user = useUserStore((s) => s.user);

  if (!authorizeApprove(user, project)) return null;
  if (project.status !== "Pending") return null;

  function update(status: "Approved" | "Rejected") {
    updateProject({ ...project, status });
    refresh();
  }

  return (
    <Box display="flex" alignItems="center" gap={2}>
      <Chip label={project.status} size="small" />

      <Button
        size="small"
        color="success"
        onClick={() => update("Approved")}
      >
        Approve
      </Button>

      <Button
        size="small"
        color="error"
        onClick={() => update("Rejected")}
      >
        Reject
      </Button>
    </Box>
  );
}
