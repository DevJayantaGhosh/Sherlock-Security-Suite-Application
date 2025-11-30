import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Box,
} from "@mui/material";
import { useEffect, useState } from "react";
import { AppUser } from "../models/User";
import { createUser, updateUser } from "../services/userService";

type UserRole =
  | "Admin"
  | "ProjectDirector"
  | "SecurityHead"
  | "ReleaseEngineer"
  | "User";

interface Props {
  open: boolean;
  onClose(): void;
  user?: AppUser | null;
  onSaved(): void;
}

const roles: UserRole[] = [
  "Admin",
  "ProjectDirector",
  "SecurityHead",
  "ReleaseEngineer",
  "User",
];

export default function AddEditUserDialog({
  open,
  onClose,
  user,
  onSaved,
}: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("User");
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setRole(user.role);
    } else {
      setName("");
      setEmail("");
      setRole("User");
    }
    setError("");
  }, [user, open]);

  function validate() {
    if (!name.trim()) return "Name required";
    if (!email.trim()) return "Email required";
    if (!email.includes("@")) return "Invalid email";
    return "";
  }

  function save() {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }

    try {
      user
        ? updateUser(user.id, { name, email, role })
        : createUser(name, email, role);

      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{user ? "Edit User" : "Create User"}</DialogTitle>

      <DialogContent>
        <Box display="flex" flexDirection="column" gap={2} mt={1}>
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
          />

          <TextField
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
          />

          <TextField
            select
            label="Role"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
          >
            {roles.map((r) => (
              <MenuItem key={r} value={r}>
                {r}
              </MenuItem>
            ))}
          </TextField>

          {error && <Box color="error.main">{error}</Box>}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save}>
          {user ? "Update" : "Create"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
