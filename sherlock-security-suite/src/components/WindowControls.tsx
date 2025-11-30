import { Box, IconButton, Tooltip } from "@mui/material";
import RemoveIcon from "@mui/icons-material/Remove";
import CropSquareIcon from "@mui/icons-material/CropSquare";
import CloseIcon from "@mui/icons-material/Close";
import { motion } from "framer-motion";

export default function WindowsControls() {
  const minimize = () => window.electronWindow?.minimize();
  const maximize = () => window.electronWindow?.maximize();
  const close = () => window.electronWindow?.close();

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        WebkitAppRegion: "no-drag", // ✅ makes buttons clickable in draggable title bar
      }}
    >
      <Tooltip title="Minimize">
        <motion.div whileHover={{ scale: 1.1 }}>
          <IconButton onClick={minimize} size="small">
            <RemoveIcon fontSize="small" />
          </IconButton>
        </motion.div>
      </Tooltip>

      <Tooltip title="Maximize">
        <motion.div whileHover={{ scale: 1.1 }}>
          <IconButton onClick={maximize} size="small">
            <CropSquareIcon fontSize="small" />
          </IconButton>
        </motion.div>
      </Tooltip>

      <Tooltip title="Close">
        <motion.div whileHover={{ scale: 1.1 }}>
          <IconButton
            onClick={close}
            size="small"
            sx={{
              "&:hover": {
                bgcolor: "error.main",
                color: "white",
              },
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </motion.div>
      </Tooltip>
    </Box>
  );
}
