// src/components/admin/RepositoryManagement.tsx

import {
    Box,
    Typography,
    IconButton,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    TextField,
    Button,
    Paper,
    Chip
} from "@mui/material";

import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import CloseIcon from "@mui/icons-material/Close";

import { useEffect, useState } from "react";
import {
    Repo,
    getRepos,
    createRepo,
    deleteRepo
} from "../../services/repoService";

export default function RepositoryManagement() {

    const [repos, setRepos] = useState<Repo[]>([]);
    const [search, setSearch] = useState("");

    const [newName, setNewName] = useState("");
    const [newUrl, setNewUrl] = useState("");

    const [editId, setEditId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [editUrl, setEditUrl] = useState("");

    // -----------------------
    // LOAD
    // -----------------------

    const load = () => setRepos(getRepos());

    useEffect(() => {
        load();
    }, []);

    // -----------------------
    // ADD
    // -----------------------

    function addRepo() {
        if (!newName.trim() || !newUrl.trim()) return;

        createRepo(newName, newUrl);

        setNewName("");
        setNewUrl("");

        load();
    }

    // -----------------------
    // DELETE
    // -----------------------

    function remove(id: string) {
        deleteRepo(id);
        load();
    }

    // -----------------------
    // EDIT
    // -----------------------

    function startEdit(repo: Repo) {
        setEditId(repo.id);
        setEditName(repo.name);
        setEditUrl(repo.url);
    }

    function cancelEdit() {
        setEditId(null);
    }

    function saveEdit(id: string) {
        // temporary until API editing exists
        const copy = getRepos();
        const index = copy.findIndex(r => r.id === id);

        if (index !== -1) {
            copy[index].name = editName;
            copy[index].url = editUrl;
        }

        // REPLACE IN-MEMORY DB (simulate API update)
        // ⚠️ remove once backend exists
        (window as any).__repos = copy;

        setEditId(null);
        load();
    }

    // -----------------------
    // FILTER
    // -----------------------

    const filtered = repos.filter(r =>
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.url.toLowerCase().includes(search.toLowerCase())
    );

    // -----------------------
    // UI
    // -----------------------

    return (
        <Paper sx={{ p: 3, flex: 1, bgcolor: "#0c1023" }}>

            {/* HEADER */}
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
                <Typography variant="h6">
                    Repository Management
                </Typography>

                <Chip color="primary" label={`Active Repos: ${repos.length}`} />
            </Box>

            {/* SEARCH */}
            <TextField
                size="small"
                fullWidth
                label="Search repositories"
                value={search}
                sx={{ mb: 2 }}
                onChange={e => setSearch(e.target.value)}
            />

            {/* ADD */}
            <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
                <TextField
                    size="small"
                    label="Repo Name"
                    fullWidth
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                />

                <TextField
                    size="small"
                    label="Repo URL"
                    fullWidth
                    value={newUrl}
                    onChange={e => setNewUrl(e.target.value)}
                />

                <Button
                    variant="contained"
                    onClick={addRepo}
                    sx={{
                        background: "linear-gradient(135deg,#7b5cff,#5ce1e6)"
                    }}
                >
                    Add
                </Button>




            </Box>

            {/* TABLE */}
            <Table size="small">

                <TableHead>
                    <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>URL</TableCell>
                        <TableCell width={120} align="right">Actions</TableCell>
                    </TableRow>
                </TableHead>

                <TableBody>

                    {filtered.map(repo => {

                        const editing = editId === repo.id;

                        return (
                            <TableRow key={repo.id}>

                                {/* NAME */}
                                <TableCell>
                                    {editing ? (
                                        <TextField
                                            size="small"
                                            value={editName}
                                            onChange={e => setEditName(e.target.value)}
                                        />
                                    ) : (
                                        repo.name
                                    )}
                                </TableCell>

                                {/* URL */}
                                <TableCell>
                                    {editing ? (
                                        <TextField
                                            size="small"
                                            fullWidth
                                            value={editUrl}
                                            onChange={e => setEditUrl(e.target.value)}
                                        />
                                    ) : (
                                        repo.url
                                    )}
                                </TableCell>

                                {/* ACTIONS */}
                                <TableCell align="right">

                                    {editing ? (
                                        <>
                                            <IconButton
                                                size="small"
                                                onClick={() => saveEdit(repo.id)}
                                            >
                                                <SaveIcon fontSize="small" />
                                            </IconButton>

                                            <IconButton
                                                size="small"
                                                onClick={cancelEdit}
                                            >
                                                <CloseIcon fontSize="small" />
                                            </IconButton>
                                        </>
                                    ) : (
                                        <>
                                            <IconButton
                                                size="small"
                                                onClick={() => startEdit(repo)}
                                            >
                                                <EditIcon fontSize="small" />
                                            </IconButton>

                                            <IconButton
                                                size="small"
                                                onClick={() => remove(repo.id)}
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </>
                                    )}

                                </TableCell>

                            </TableRow>
                        );
                    })}

                    {!filtered.length && (
                        <TableRow>
                            <TableCell colSpan={3} align="center">
                                No results found
                            </TableCell>
                        </TableRow>
                    )}

                </TableBody>

            </Table>

        </Paper>
    );
}
