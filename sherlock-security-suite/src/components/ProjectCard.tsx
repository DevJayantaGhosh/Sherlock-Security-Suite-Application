import { motion } from "framer-motion";
import {
  Box,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";

import VisibilityIcon from "@mui/icons-material/Visibility";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";

import { Project, ProjectStatus } from "../models/Project";
import {
  authorizeApprove,
  authorizeEdit,
  authorizeRelease,
} from "../services/projectService";
import { useUserStore } from "../store/userStore";

/* ✅ FIXED TYPES */
const STATUS: Record<ProjectStatus, string> = {
  Pending: "#ffb020",
  Approved: "#4dd0e1",
  Rejected: "#ff6b6b",
  Released: "#7b5cff",
};

interface Props {
  project: Project;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onApprove: () => void;
  onReject: () => void;
  onRelease: () => void;
}

export default function ProjectCard({
  project,
  onView,
  onEdit,
  onDelete,
  onApprove,
  onReject,
  onRelease,
}: Props) {
  const user = useUserStore((s) => s.user);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -8, scale: 1.02 }}
      transition={{ duration: 0.3 }}
    >
      <Box
        sx={{
          p: 3,
          height: "100%",
          borderRadius: 3,
          position: "relative",
          background:
            "linear-gradient(180deg,#0b0f20,#060712)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow:
            "0 10px 32px rgba(123,92,255,0.15)",
        }}
      >
        {/* STATUS TAG */}
        <Chip
          label={project.status}
          sx={{
            position: "absolute",
            right: 12,
            top: 12,
            bgcolor: STATUS[project.status],
            fontWeight: 800,
          }}
        />

        <Typography variant="h6" fontWeight={800}>
          {project.name}
        </Typography>

        <Typography color="text.secondary" mt={1}>
          {project.description}
        </Typography>

        {/* ACTIONS */}
        <Stack direction="row" mt={3} gap={1}>
          <Tooltip title="View">
            <IconButton onClick={onView}>
              <VisibilityIcon />
            </IconButton>
          </Tooltip>

          {authorizeEdit(user, project) && (
            <>
              <Tooltip title="Edit">
                <IconButton onClick={onEdit}>
                  <EditIcon />
                </IconButton>
              </Tooltip>

              <Tooltip title="Delete">
                <IconButton onClick={onDelete}>
                  <DeleteIcon />
                </IconButton>
              </Tooltip>
            </>
          )}

          {authorizeApprove(user, project) && (
            <>
              <Tooltip title="Approve">
                <IconButton color="success" onClick={onApprove}>
                  <CheckIcon />
                </IconButton>
              </Tooltip>

              <Tooltip title="Reject">
                <IconButton color="error" onClick={onReject}>
                  <CloseIcon />
                </IconButton>
              </Tooltip>
            </>
          )}

          {authorizeRelease(user, project) && (
            <Tooltip title="Release">
              <IconButton
                sx={{ color: "#7b5cff" }}
                onClick={onRelease}
              >
                <RocketLaunchIcon />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </Box>
    </motion.div>
  );
}
