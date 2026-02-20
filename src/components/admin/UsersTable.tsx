import { useMemo, useState, useCallback } from "react";
import {
  Box,
  Typography,
  IconButton,
  TextField,
  InputAdornment,
  Pagination,
  Checkbox,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

import { AppUser } from "../../models/User";
import { deleteUser } from "../../services/userService";
import { toast } from "react-hot-toast";
import ConfirmDialog from "../ConfirmDialog";

const PAGE_SIZE = 4;

interface Props {
  users: AppUser[];
  onEdit: (u: AppUser) => void;
  refresh: () => void;
  loading?: boolean;
}

export default function UsersTable({ users, onEdit, refresh, loading = false }: Props) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);

  //  ConfirmDialog state 
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | (() => void)>(null);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmDesc, setConfirmDesc] = useState("");

  // Filter + pagination
  const processedUsers = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter((u) =>
      `${u.name}${u.email}${u.role}`.toLowerCase().includes(q)
    );
  }, [users, search]);

  const pageCount = Math.ceil(processedUsers.length / PAGE_SIZE);
  const pagedUsers = processedUsers.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  //  SELECT ALL LOGIC
  const allSelected = pagedUsers.length > 0 && 
    pagedUsers.every(u => selected.includes(u.id));
  const someSelected = selected.length > 0 && !allSelected;

  const handleSelectAll = () => {
    if (allSelected || someSelected) {
      setSelected([]);
    } else {
      setSelected(pagedUsers.map(u => u.id));
    }
  };

  const toggleUser = useCallback((id: string) => {
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
    );
  }, []);

  // confirmAndExec FUNCTION 
  function confirmAndExec(title: string, desc: string, fn: () => void) {
    setConfirmTitle(title);
    setConfirmDesc(desc);
    setConfirmAction(() => () => {
      fn();
      setConfirmOpen(false);
    });
    setConfirmOpen(true);
  }

  //  SINGLE DELETE 
  const handleDeleteClick = useCallback((userId: string) => {
    confirmAndExec(
    "⚠️ Delete User",
    "This user will be permanently deleted from the system. This action cannot be reversed.",
      async () => {
        try {
          const result = await deleteUser(userId);
          if (result.success) {
            toast.success("User deleted successfully!");
            refresh();
          } else {
            toast.error(result.error?.message || "Delete failed");
          }
        } catch (error) {
          toast.error("Delete operation failed");
        }
      }
    );
  }, [refresh]);

  // BULK DELETE 
  const handleBulkDelete = useCallback(() => {
    if (selected.length === 0) return;
    
    confirmAndExec(
      "⚠️ Delete Multiple Users",
      `${selected.length} users will be permanently deleted from the system. This action cannot be reversed.`,
      async () => {
        try {
          const promises = selected.map(id => deleteUser(id));
          const results = await Promise.all(promises);
          
          const successes = results.filter(r => r.success).length;
          setSelected([]);
          
          if (successes === selected.length) {
            toast.success(`${successes} users deleted successfully!`);
          } else {
            toast.error(`Deleted ${successes}/${selected.length} users`);
          }
          refresh();
        } catch (error) {
          toast.error("Bulk delete operation failed");
          setSelected([]);
        }
      }
    );
  }, [selected, refresh]);

  const getLicenseStatus = (user: AppUser) => {
    if (user.isInternal) {
      return { text: "Internal", color: "#10b981" };
    }
    
    if (!user.licenseExpiredOn) {
      return { text: "No License", color: "#ef4444" };
    }
    
    const daysLeft = Math.floor(
      (new Date(user.licenseExpiredOn).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysLeft > 30) {
      return { text: `${daysLeft} Days Left`, color: "#10b981" };
    } else if (daysLeft > 0) {
      return { text: `${daysLeft}d`, color: "#f59e0b" };
    } else {
      return { text: "Expired", color: "#ef4444" };
    }
  };

  return (
    <Box sx={{
      borderRadius: 3,
      overflow: "hidden",
      background: "linear-gradient(180deg,#090b17,#0b0f2d)",
      border: "1px solid rgba(255,255,255,0.06)",
      boxShadow: "0 0 40px rgba(124,92,255,0.12)",
    }}>
      {/* SEARCH + BULK DELETE */}
      <Box sx={{ px: 3, py: 2 }}>
        <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
          <TextField
            size="small"
            sx={{ flex: 1 }}
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ opacity: 0.6 }} />
                </InputAdornment>
              ),
              sx: { background: "#050710", borderRadius: 2 },
            }}
          />
          {selected.length > 0 && (
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <Typography variant="body2" sx={{ color: "#ef4444" }}>
                {selected.length} selected
              </Typography>
              <IconButton 
                size="small"
                sx={{ color: "#ef4444" }}
                onClick={handleBulkDelete}
                title="Delete Selected"
              >
                <DeleteIcon />
              </IconButton>
            </Box>
          )}
        </Box>
      </Box>

      {/* HEADER */}
      <Box sx={{
        px: 3,
        py: 2,
        display: "grid",
        gridTemplateColumns: "40px 2fr 2.2fr 1.8fr 1.2fr 1.6fr 0.5fr 1.6fr 1.4fr 1.4fr",
        background: "rgba(255,255,255,0.04)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        fontSize: 11,
        lineHeight: 1.2,
        fontWeight: 600,
        color: "text.secondary"
      }}>
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
          <Checkbox
            size="small"
            checked={allSelected}
            indeterminate={someSelected}
            onChange={handleSelectAll}
          />
        </Box>
        <Typography sx={{ whiteSpace: "nowrap" }}>Name</Typography>
        <Typography sx={{ whiteSpace: "nowrap" }}>Email</Typography>
        <Typography sx={{ whiteSpace: "nowrap" }}>Role</Typography>
        <Typography sx={{ whiteSpace: "nowrap" }}>Internal</Typography>
        <Typography sx={{ whiteSpace: "nowrap" }}>License Activation</Typography>
        <Box sx={{ borderRight: "1px solid rgba(255,255,255,0.08)" }} />
        <Typography sx={{ whiteSpace: "nowrap" }}>License Expiry</Typography>
        <Typography sx={{ whiteSpace: "nowrap" }}>Status</Typography>
        <Typography sx={{ textAlign: "right", whiteSpace: "nowrap" }}>Actions</Typography>
      </Box>

      {/* ROWS */}
      {loading ? (
        <Box sx={{ py: 12, textAlign: "center", opacity: 0.6 }}>
          <Typography>Loading users...</Typography>
        </Box>
      ) : pagedUsers.length > 0 ? (
        pagedUsers.map((u) => (
          <Box key={u.id} sx={{
            px: 3,
            py: 2.5,
            display: "grid",
            gridTemplateColumns: "40px 2fr 2.2fr 1.8fr 1.2fr 1.6fr 0.5fr 1.6fr 1.4fr 1.4fr",
            alignItems: "center",
            borderBottom: "1px solid rgba(255,255,255,0.04)",
            "&:hover": { background: "rgba(124,92,255,0.08)" },
          }}>
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
              <Checkbox
                size="small"
                checked={selected.includes(u.id)}
                onChange={() => toggleUser(u.id)}
              />
            </Box>

            <Typography fontWeight={700} sx={{ fontSize: "1rem" }}>
              {u.name}
            </Typography>

            <Typography variant="body2" sx={{ wordBreak: "break-all", opacity: 0.9 }}>
              {u.email}
            </Typography>

            <Typography sx={{ fontWeight: 500, fontSize: "0.9rem" }}>
              {u.role}
            </Typography>

            <Typography 
              variant="body2" 
              sx={{ 
                fontSize: "0.85rem", 
                fontWeight: 600,
                color: u.isInternal ? "#10b981" : "#ef4444"
              }}
            >
              {u.isInternal ? "Yes" : "No"}
            </Typography>

            <Typography variant="body2" sx={{ fontSize: "0.85rem", opacity: 0.8 }}>
              {u.licenseActivatedOn ? new Date(u.licenseActivatedOn).toLocaleDateString() : "N/A"}
            </Typography>

            <Box sx={{ 
              borderLeft: "1px solid rgba(255,255,255,0.12)", 
              borderRight: "1px solid rgba(255,255,255,0.12)",
              height: "24px",
              mx: 0.5
            }} />

            <Typography variant="body2" sx={{ fontSize: "0.85rem", opacity: 0.8 }}>
              {u.licenseExpiredOn ? new Date(u.licenseExpiredOn).toLocaleDateString() : "N/A"}
            </Typography>

            <Typography 
              variant="body2" 
              sx={{ 
                fontSize: "0.85rem", 
                fontWeight: 600,
                color: getLicenseStatus(u).color
              }}
            >
              {getLicenseStatus(u).text}
            </Typography>

            <Box sx={{ textAlign: "right", display: "flex", gap: 0.5 }}>
              <IconButton 
                size="small" 
                sx={{ color: "#7b5cff" }} 
                onClick={() => onEdit(u)}
                title="Edit"
              >
                <EditIcon fontSize="small" />
              </IconButton>
              <IconButton 
                size="small" 
                sx={{ color: "#ff6b6b" }} 
                onClick={() => handleDeleteClick(u.id)}
                title="Delete"
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
        ))
      ) : (
        <Box sx={{ py: 12, textAlign: "center", opacity: 0.6 }}>
          <Typography>{search ? "No users found" : "No users"}</Typography>
        </Box>
      )}

      {/* PAGINATION */}
      {pageCount > 1 && (
        <Box sx={{ py: 3, display: "flex", justifyContent: "center" }}>
          <Pagination 
            count={pageCount} 
            page={page} 
            onChange={(_, v) => setPage(v)} 
            color="primary"
            size="small"
          />
        </Box>
      )}

      {/*  ConfirmDialog - EXACTLY like ProductPage */}
      <ConfirmDialog
        open={confirmOpen}
        title={confirmTitle}
        description={confirmDesc}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          if (confirmAction) confirmAction();
        }}
      />
    </Box>
  );
}
