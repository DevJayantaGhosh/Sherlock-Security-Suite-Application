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
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import SecurityIcon from "@mui/icons-material/Security";


import { Project } from "../../models/Project";
import {
  authorizeEdit,
} from "../../services/projectService";
import { useUserStore } from "../../store/userStore";

const STATUS: Record<Project["status"], string> = {
  Pending: "#ffe920ff",
  Approved: "#1ca153ff",
  Rejected: "#c22020ff",
  Released: "#7b5cff"
};

interface Props {
  project: Project;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSecurityScan: () => void;
  onRelease: () => void;
}

export default function ProjectCard({
  project,
  onView,
  onEdit,
  onDelete,
  onSecurityScan,
  onRelease
}: Props) {

  const user = useUserStore(s => s.user);

  return (
    <motion.div
      layout
      whileHover={{ y: -6, scale: 1.03 }}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 220 }}
      style={{ height: "100%" }}
    >
      <Box
        sx={{
          height: "100%",
          p: 3,
          borderRadius: 3,
          position: "relative",
          background: "linear-gradient(140deg,#0c1023,#090c1c,#060712)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 12px 40px rgba(123,92,255,0.18)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between"
        }}
      >

        <Chip
          label={project.status}
          sx={{
            position: "absolute",
            right: 14,
            top: 14,
            bgcolor: STATUS[project.status],
            fontWeight: 800,
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

        <Stack direction="row" spacing={1} mt={2}>
          <Tooltip title="View">
            <IconButton onClick={onView}><VisibilityIcon /></IconButton>
          </Tooltip>

          {authorizeEdit(user, project) && (
            <>
              <Tooltip title="Edit">
                <IconButton onClick={onEdit}><EditIcon /></IconButton>
              </Tooltip>
              <Tooltip title="Delete">
                <IconButton onClick={onDelete}><DeleteIcon /></IconButton>
              </Tooltip>
            </>
          )}

          {/* -----------------------------------------
    SECURITY SCAN ACTION
------------------------------------------ */}


            <Tooltip title="Run Security Scan">
              <IconButton
                color="warning"
                onClick={onSecurityScan}
              >
                <SecurityIcon />
              </IconButton>
            </Tooltip>



            <Tooltip title="Release workflow">
              <IconButton sx={{ color: "#7b5cff" }} onClick={onRelease}>
                <RocketLaunchIcon />
              </IconButton>
            </Tooltip>

        </Stack>

      </Box>
    </motion.div>
  );
}
