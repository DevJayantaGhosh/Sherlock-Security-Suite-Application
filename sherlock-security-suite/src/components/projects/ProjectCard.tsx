// src/components/ProjectCard.tsx

import { motion } from "framer-motion";
import {
  Box,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  Typography
} from "@mui/material";

import VisibilityIcon from "@mui/icons-material/Visibility";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";

import { Project } from "../../models/Project";
import {
  authorizeApprove,
  authorizeEdit,
  authorizeRelease
} from "../../services/projectService";
import { useUserStore } from "../../store/userStore";

/* ------------------------------------------------------- */
/* Color typing fix */
/* ------------------------------------------------------- */
const STATUS: Record<Project["status"], string> = {
  Pending: "#ffb020",
  Approved: "#4dd0e1",
  Rejected: "#ff6b6b",
  Released: "#7b5cff"
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
  onRelease
}: Props) {

  const user = useUserStore(s => s.user);

  return (
    <motion.div
      layout
      whileHover={{ y: -6, scale: 1.03 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 200 }}
      style={{ height: "100%" }}
    >
      <Box
        sx={{
          height: "100%",
          p: 3,
          borderRadius: 3,
          position: "relative",
          background:
            "linear-gradient(140deg,#0c1023,#090c1c,#060712)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow:
            "0 12px 40px rgba(123,92,255,0.18)",

          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between"
        }}
      >

        {/* STATUS CHIP */}
        <Chip
          label={project.status}
          sx={{
            position: "absolute",
            right: 14,
            top: 14,
            bgcolor: STATUS[project.status],
            fontWeight: 800,
            textTransform: "uppercase",
            px: 1,
            color: "#000"
          }}
        />

        <Box>
          <Typography variant="h6" fontWeight={800}>
            {project.name}
          </Typography>

          <Typography color="text.secondary" mt={1} noWrap>
            {project.description}
          </Typography>
        </Box>

        {/* ACTION BUTTONS */}
        <Stack direction="row" spacing={1} mt={2}>

          <Tooltip title="View details">
            <IconButton onClick={onView}>
              <VisibilityIcon />
            </IconButton>
          </Tooltip>

          {authorizeEdit(user, project) && (
            <>
              <Tooltip title="Edit Project">
                <IconButton onClick={onEdit}>
                  <EditIcon />
                </IconButton>
              </Tooltip>

              <Tooltip title="Delete Project">
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
              <IconButton sx={{ color: "#7b5cff" }} onClick={onRelease}>
                <RocketLaunchIcon />
              </IconButton>
            </Tooltip>
          )}

        </Stack>

      </Box>
    </motion.div>
  );
}
