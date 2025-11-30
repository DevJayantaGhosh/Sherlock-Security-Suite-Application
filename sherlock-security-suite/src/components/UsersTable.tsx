// src/components/UsersTable.tsx
import { Box, Typography, IconButton } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { AppUser } from "../models/User";
import { deleteUser } from "../services/userService";

interface Props {
  users: AppUser[];
  onEdit: (u: AppUser) => void;
  refresh: () => void;
}

export default function UsersTable({ users, onEdit, refresh }: Props) {
  return (
    <Box>
      {users.map(u => (
        <Box key={u.id} sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          p: 1.5,
          borderBottom: "1px solid rgba(255,255,255,0.04)"
        }}>
          <Box>
            <Typography fontWeight={700}>{u.name}</Typography>
            <Typography color="text.secondary">{u.email}</Typography>
          </Box>

          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <Typography color="secondary.main" sx={{mr:2}}>{u.role}</Typography>
            <IconButton onClick={() => onEdit(u)}><EditIcon /></IconButton>
            <IconButton onClick={() => { deleteUser(u.id); refresh(); }}><DeleteIcon /></IconButton>
          </Box>
        </Box>
      ))}
    </Box>
  );
}
