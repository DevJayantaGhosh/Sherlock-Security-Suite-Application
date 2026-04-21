// src/pages/UnauthorizedPage.tsx
import { Box, Typography, Button } from "@mui/material";
import LockPersonIcon from "@mui/icons-material/LockPerson";
import { useNavigate } from "react-router-dom";

export default function UnauthorizedPage() {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        height: "70vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
      }}
    >
      <LockPersonIcon sx={{ fontSize: 120, color: "error.main", mb: 2 }} />

      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Unauthorized
      </Typography>

      <Typography variant="body1" sx={{ mb: 3, opacity: 0.8 }}>
        You don’t have permission to access this page.
      </Typography>

      <Button
        variant="contained"
        color="primary"
        onClick={() => navigate("/home")}
      >
        Go to Home
      </Button>
    </Box>
  );
}
