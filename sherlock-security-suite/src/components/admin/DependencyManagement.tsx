// src/components/admin/DependencyManagement.tsx

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
    Dependency,
    getDependencies,
    createDependency,
    deleteDependency
} from "../../services/dependencyService";

export default function DependencyManagement() {

    const [deps, setDeps] = useState<Dependency[]>([]);
    const [search, setSearch] = useState("");

    const [newName, setNewName] = useState("");

    const [editId, setEditId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");

    const load = () => setDeps(getDependencies());

    useEffect(() => {
        load();
    }, []);

    // -----------------------
    // ADD
    // -----------------------

    function add() {
        if (!newName.trim()) return;

        createDependency(newName);
        setNewName("");
        load();
    }

    // -----------------------
    // DELETE
    // -----------------------

    function remove(id: string) {
        deleteDependency(id);
        load();
    }

    // -----------------------
    // EDIT (Simulated)
    // -----------------------

    function startEdit(dep: Dependency) {
        setEditId(dep.id);
        setEditName(dep.name);
    }

    function cancelEdit() {
        setEditId(null);
    }

    function save(id: string) {
        const copy = getDependencies();
        const idx = copy.findIndex(d => d.id === id);

        if (idx !== -1) {
            copy[idx].name = editName;
        }

        // ⚠️ remove once backend exists
        (window as any).__deps = copy;

        setEditId(null);
        load();
    }

    // -----------------------
    // FILTER
    // -----------------------

    const filtered = deps.filter(d =>
        d.name.toLowerCase().includes(search.toLowerCase())
    );

    // -----------------------
    // UI
    // -----------------------

    return (
        <Paper sx={{ p: 3, flex: 1, bgcolor: "#0c1023" }}>

            {/* HEADER */}
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
                <Typography variant="h6">
                    Dependency Management
                </Typography>

                <Chip color="secondary" label={`Dependencies: ${deps.length}`} />
            </Box>

            {/* SEARCH */}
            <TextField
                size="small"
                fullWidth
                label="Search dependencies"
                value={search}
                sx={{ mb: 2 }}
                onChange={e => setSearch(e.target.value)}
            />

            {/* ADD */}
            <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
                <TextField
                    size="small"
                    label="Dependency name"
                    fullWidth
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                />

                <Button
                    variant="contained"
                    onClick={add}
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
                        <TableCell width={120} align="right">Actions</TableCell>
                    </TableRow>
                </TableHead>

                <TableBody>

                    {filtered.map(dep => {

                        const editing = editId === dep.id;

                        return (
                            <TableRow key={dep.id}>

                                <TableCell>
                                    {editing ? (
                                        <TextField
                                            size="small"
                                            value={editName}
                                            onChange={e => setEditName(e.target.value)}
                                        />
                                    ) : (
                                        dep.name
                                    )}
                                </TableCell>

                                <TableCell align="right">

                                    {editing ? (
                                        <>
                                            <IconButton
                                                size="small"
                                                onClick={() => save(dep.id)}
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
                                                onClick={() => startEdit(dep)}
                                            >
                                                <EditIcon fontSize="small" />
                                            </IconButton>

                                            <IconButton
                                                size="small"
                                                onClick={() => remove(dep.id)}
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
                            <TableCell colSpan={2} align="center">
                                No results found
                            </TableCell>
                        </TableRow>
                    )}

                </TableBody>

            </Table>

        </Paper>
    );
}
