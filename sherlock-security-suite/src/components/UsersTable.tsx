// src/components/UsersTable.tsx
import { useMemo, useState } from "react";
import {
  Box,
  Typography,
  IconButton,
  TextField,
  InputAdornment,
  Checkbox,
  Pagination,
  Chip,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SwapVertIcon from "@mui/icons-material/SwapVert";

import { AppUser } from "../models/User";
import { deleteUser } from "../services/userService";

const PAGE_SIZE = 6;

interface Props {
  users: AppUser[];
  onEdit: (u: AppUser) => void;
  refresh: () => void;
}

type SortKey = "name" | "email" | "role";
type SortDir = "asc" | "desc";

export default function UsersTable({ users, onEdit, refresh }: Props) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [selected, setSelected] = useState<string[]>([]);

  // ✅ Filter + sort in one memo
  const processedUsers = useMemo(() => {
    const q = search.toLowerCase();

    let filtered = users.filter((u) =>
      `${u.name}${u.email}${u.role}`.toLowerCase().includes(q)
    );

    filtered.sort((a, b) => {
      const A = a[sortKey].toLowerCase();
      const B = b[sortKey].toLowerCase();
      return sortDir === "asc" ? A.localeCompare(B) : B.localeCompare(A);
    });

    return filtered;
  }, [users, search, sortKey, sortDir]);

  const pageCount = Math.ceil(processedUsers.length / PAGE_SIZE);
  const pagedUsers = processedUsers.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  function handleSort(col: SortKey) {
    if (sortKey === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(col);
      setSortDir("asc");
    }
  }

  function toggleUser(id: string) {
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
    );
  }

  function bulkDelete() {
    selected.forEach(deleteUser);
    setSelected([]);
    refresh();
  }

  function roleColor(role: string) {
    switch (role) {
      case "Admin":
        return "error";
      case "SecurityTechHead":
        return "warning";
      case "ProjectDirector":
        return "info";
      case "ReleaseEngineer":
        return "success";
      default:
        return "default";
    }
  }

  return (
    <Box
      sx={{
        mt: 3,
        borderRadius: 3,
        overflow: "hidden",
        background: "linear-gradient(180deg,#090b17,#0b0f2d)",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 0 40px rgba(124,92,255,0.12)",
      }}
    >
      {/* SEARCH + BULK */}
      <Box
        sx={{
          px: 2,
          py: 2,
          display: "flex",
          gap: 2,
          alignItems: "center",
        }}
      >
        <TextField
          size="small"
          fullWidth
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ opacity: 0.6 }} />
              </InputAdornment>
            ),
            sx: {
              background: "#050710",
              borderRadius: 2,
            },
          }}
        />

        {selected.length > 0 && (
          <IconButton
            sx={{ color: "#ff6b6b" }}
            onClick={bulkDelete}
            title="Delete Selected"
          >
            <DeleteIcon />
          </IconButton>
        )}
      </Box>

      {/* HEADER */}
      <Box
        sx={{
          px: 3,
          py: 1,
          display: "grid",
          gridTemplateColumns: "40px 2fr 2fr 2fr 1fr",
          background: "rgba(255,255,255,0.04)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          fontSize: 12,
        }}
      >
        <Checkbox
          checked={
            selected.length > 0 && selected.length === pagedUsers.length
          }
          indeterminate={
            selected.length > 0 && selected.length < pagedUsers.length
          }
          onChange={(e) =>
            setSelected(
              e.target.checked ? pagedUsers.map((u) => u.id) : []
            )
          }
        />

        <SortableHead label="NAME" active={sortKey} col="name" onSort={handleSort} />
        <SortableHead label="EMAIL" active={sortKey} col="email" onSort={handleSort} />
        <SortableHead label="ROLE" active={sortKey} col="role" onSort={handleSort} />

        <Typography textAlign="right">ACTIONS</Typography>
      </Box>

      {/* ROWS */}
      {pagedUsers.map((u) => (
        <Box
          key={u.id}
          sx={{
            px: 3,
            py: 1.4,
            display: "grid",
            gridTemplateColumns: "40px 2fr 2fr 2fr 1fr",
            alignItems: "center",
            borderBottom: "1px solid rgba(255,255,255,0.04)",
            "&:hover": {
              background: "rgba(124,92,255,0.08)",
            },
          }}
        >
          <Checkbox
            checked={selected.includes(u.id)}
            onChange={() => toggleUser(u.id)}
          />

          <Typography fontWeight={700}>{u.name}</Typography>
          <Typography variant="body2">{u.email}</Typography>

          <Chip
            size="small"
            label={u.role}
            color={roleColor(u.role)}
            variant="outlined"
          />

          <Box sx={{ textAlign: "right" }}>
            <IconButton size="small" sx={{ color: "#7b5cff" }} onClick={() => onEdit(u)}>
              <EditIcon fontSize="small" />
            </IconButton>

            <IconButton
              size="small"
              sx={{ color: "#ff6b6b" }}
              onClick={() => {
                deleteUser(u.id);
                refresh();
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      ))}

      {/* PAGINATION */}
      {pageCount > 1 && (
        <Box
          sx={{
            py: 2,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <Pagination
            count={pageCount}
            page={page}
            onChange={(_, v) => setPage(v)}
            color="primary"
          />
        </Box>
      )}

      {!processedUsers.length && (
        <Typography textAlign="center" sx={{ py: 3, opacity: 0.6 }}>
          No users found
        </Typography>
      )}
    </Box>
  );
}

/* =========================
   SORTABLE HEADER CELL
   =========================*/

function SortableHead({
  label,
  col,
  active,
  onSort
}: {
  label: string;
  col: SortKey;
  active: SortKey;
  onSort: (c: SortKey) => void;
}) {
  return (
    <Box
      onClick={() => onSort(col)}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        userSelect: "none",
        cursor: "pointer",
      }}
    >
      <Typography
        fontSize={12}
        color={active === col ? "primary.main" : "text.secondary"}
      >
        {label}
      </Typography>
      <SwapVertIcon
        fontSize="inherit"
        sx={{
          opacity: active === col ? 1 : 0.3,
        }}
      />
    </Box>
  );
}
