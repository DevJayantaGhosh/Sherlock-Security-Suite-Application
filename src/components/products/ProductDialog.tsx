import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  TextField,
  IconButton,
  MenuItem,
  Chip,
  Typography,
  Divider,
  Paper,
  FormControlLabel,
  Switch,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

import { useEffect, useState } from "react";

import {
  Product,
  RepoDetails,
} from "../../models/Product";
import { createProduct, updateProduct } from "../../services/productService";
import { useUserStore } from "../../store/userStore";
import { getInternalUsers } from "../../services/userService"; 
import { AppUser } from "../../models/User";
import toast from "react-hot-toast";

const REPOSITORIES = [
  "https://github.com/org/web-ui",
  "https://github.com/org/backend-api",
  "https://github.com/org/mobile-app",
  "https://github.com/DevJayantaGhosh/Sherlock-Security-Suite-Services.git",
  "https://github.com/DevJayantaGhosh/large-fileupload-poc.git",
];

const DEPENDENCIES = [
  "React",
  "Node",
  "Express",
  "Docker",
  "MongoDB",
  "Redis",
  "Kubernetes",
  "Spring Boot",
  "PostgreSQL",
];

const SEMVER_REGEX = /^(\d+)\.(\d+)\.(\d+)(-(alpha|beta|rc))?$/;

type ProductForm = Omit<Product, "id" | "createdAt" | "updatedAt" | "updatedBy">;

export default function ProductDialog({
  open,
  onClose,
  product,
  refresh,
  mode = "create",
}: {
  open: boolean;
  onClose: () => void;
  product?: Product | null;
  refresh: () => void;
  mode?: "create" | "edit" | "view";
}) {
  const user = useUserStore((s) => s.user);
  const isView = mode === "view";

  const [users, setUsers] = useState<AppUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);

  const emptyForm: ProductForm = {
    name: "",
    version: "",
    isOpenSource: false,
    description: "",
    productDirector: null,
    securityHead: null,
    releaseEngineers: [],
    repos: [
      {
        repoUrl: "",
        branch: "",
      },
    ],
    dependencies: [],
    createdBy: "",
    status: "Pending",
  };

  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});


useEffect(() => {
  let mounted = true;
  
  const loadInternalUsers = async () => {
    try {
      setUsersLoading(true);
      const internalUsersResult = await getInternalUsers(); 
      
      if (mounted) {
        if (internalUsersResult.error) {
          console.error("Failed to load internal users:", internalUsersResult.error.message);
          toast.error(internalUsersResult.error.message);
          setUsers([]); 
        } else {
          setUsers(internalUsersResult.data); 
        }
      }
    } catch (error) {
      console.error("Failed to load internal users:", error);
    } finally {
      if (mounted) {
        setUsersLoading(false);
      }
    }
  };

  loadInternalUsers(); //  Only internal users (Admin, Director, SecHead, Eng)

  return () => {
    mounted = false;
  };
}, []);


 
  useEffect(() => {
    if (product) {
      const { id, createdAt, updatedAt, updatedBy, ...rest } = product;
      setForm({
        ...rest,
        repos:
          rest.repos.length > 0
            ? rest.repos.map((r) => ({
                ...r,
              }))
            : [
                {
                  repoUrl: "",
                  branch: "",
                },
              ],
      });
    } else {
      setForm(emptyForm);
    }
    setErrors({});
  }, [product, open]);

  function validate(): boolean {
    const e: Record<string, string> = {};

    if (!form.name.trim()) e.name = "Product name required";

    if (!form.version.trim()) e.version = "Version required";
    else if (!SEMVER_REGEX.test(form.version))
      e.version = "Use format: 1.2.0 / 1.2.0-beta / 1.2.0-rc";

    if (!form.description?.trim()) e.description = "Description required";

    if (!form.productDirector) e.productDirector = "Select product director";

    if (!form.securityHead) e.securityHead = "Select security head";

    if (!form.releaseEngineers.length)
      e.releaseEngineers = "Select at least 1 release engineer";

    if (!form.dependencies?.length)
      e.dependencies = "Select at least one dependency";

    form.repos.forEach((repo, repoIdx) => {
      if (!repo.repoUrl) e[`repo-${repoIdx}-url`] = "Repo URL required";
      if (!repo.branch) e[`repo-${repoIdx}-branch`] = "Branch required";
    });

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function setRepoField<K extends keyof RepoDetails>(
    repoIdx: number,
    key: K,
    value: any
  ) {
    const arr = [...form.repos];
    arr[repoIdx] = { ...arr[repoIdx], [key]: value };
    setForm({ ...form, repos: arr });
  }

  function addRepo() {
    setForm({
      ...form,
      repos: [
        ...form.repos,
        {
          repoUrl: "",
          branch: "",
        },
      ],
    });
  }

  function removeRepo(repoIdx: number) {
    setForm({
      ...form,
      repos: form.repos.filter((_, idx) => idx !== repoIdx),
    });
  }

  async function submit() {
    if (!validate()) return;
    if (!user?.id) return;

    try {
      if (product) {
        await updateProduct({
          ...product,
          ...form,
          updatedBy: user.id,
        });
      } else {
        const payload: ProductForm = {
          ...form,
          createdBy: user.id,
        };
        await createProduct(payload);
      }
      refresh();
      onClose();
    } catch (error) {
      console.error("Submit error:", error);
    }
  }

  if (usersLoading) {
    return (
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
        <DialogTitle>Loading users...</DialogTitle>
        <DialogContent>Loading team members...</DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        {mode === "view"
          ? "Product Details"
          : product
          ? "Edit Product"
          : "Create Product"}
      </DialogTitle>

      <DialogContent dividers sx={{ maxHeight: "60vh" }}>
        {/* BASIC INFO */}
        <Typography variant="subtitle2" fontWeight={700} mb={2}>
          Basic Information
        </Typography>

        {/* FIRST ROW: Name, Version, OpenSource Toggle */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" },
            gap: 2,
            mb: 3,
          }}
        >
          {/* Name */}
          <TextField
            label="Name"
            value={form.name}
            error={!!errors.name}
            helperText={errors.name}
            disabled={isView}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />

          {/* Version */}
          <TextField
            label="Version"
            value={form.version}
            error={!!errors.version}
            helperText={errors.version}
            disabled={isView}
            onChange={(e) => setForm({ ...form, version: e.target.value })}
          />

          {/* OpenSource Toggle */}
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <FormControlLabel
              control={
                <Switch
                  checked={form.isOpenSource}
                  onChange={(e) =>
                    setForm({ ...form, isOpenSource: e.target.checked })
                  }
                  disabled={isView}
                  color="secondary"
                />
              }
              label={
                <Box>
                  <Typography variant="body2" fontWeight={600}>
                    Open Source Project
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Public repository access
                  </Typography>
                </Box>
              }
              labelPlacement="start"
              sx={{ m: 0, width: "100%" }}
            />
          </Box>
        </Box>

        {/* Description */}
        <TextField
          label="Description"
          value={form.description}
          error={!!errors.description}
          helperText={errors.description}
          disabled={isView}
          fullWidth
          multiline
          rows={2}
          sx={{ mb: 3 }}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />

        {/* STAKEHOLDERS */}
        <Typography variant="subtitle2" fontWeight={700} mb={2}>
          Stakeholders
        </Typography>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" },
            gap: 2,
            mb: 3,
          }}
        >
          <TextField
            select
            label="Product Director"
            value={form.productDirector ?? ""}
            error={!!errors.productDirector}
            helperText={errors.productDirector}
            disabled={isView}
            onChange={(e) =>
              setForm({
                ...form,
                productDirector: e.target.value || null,
              })
            }
          >
            {users.map((u) => (
              <MenuItem key={u.id} value={u.id}>
                {u.name} ({u.role})
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Security Head"
            value={form.securityHead ?? ""}
            error={!!errors.securityHead}
            helperText={errors.securityHead}
            disabled={isView}
            onChange={(e) =>
              setForm({
                ...form,
                securityHead: e.target.value || null,
              })
            }
          >
            {users.map((u) => (
              <MenuItem key={u.id} value={u.id}>
                {u.name} ({u.role})
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Release Engineers"
            SelectProps={{ multiple: true }}
            value={form.releaseEngineers}
            error={!!errors.releaseEngineers}
            helperText={errors.releaseEngineers}
            disabled={isView}
            onChange={(e) =>
              setForm({
                ...form,
                releaseEngineers: e.target.value as unknown as string[],
              })
            }
          >
            {users.map((u) => (
              <MenuItem key={u.id} value={u.id}>
                <Chip label={u.name} size="small" />
              </MenuItem>
            ))}
          </TextField>
        </Box>

        {/* REPOSITORIES */}
        <Divider sx={{ my: 3 }} />

        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 2,
          }}
        >
          <Typography variant="subtitle2" fontWeight={700}>
            Repositories & Components
          </Typography>

          {!isView && (
            <Button
              startIcon={<AddIcon />}
              onClick={addRepo}
              variant="outlined"
              size="small"
            >
              Add Repository
            </Button>
          )}
        </Box>

        {form.repos.map((repo, repoIdx) => (
          <Paper
            key={repoIdx}
            elevation={2}
            sx={{
              p: 2,
              mb: 3,
              border: "1px solid rgba(123,92,255,0.3)",
              background: "rgba(123,92,255,0.05)",
            }}
          >
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 2,
              }}
            >
              <Typography variant="body2" fontWeight={700}>
                Repository {repoIdx + 1}
              </Typography>

              {!isView && form.repos.length > 1 && (
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => removeRepo(repoIdx)}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              )}
            </Box>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "2fr 1fr" },
                gap: 2,
              }}
            >
              <TextField
                select
                label="Repository URL"
                value={repo.repoUrl}
                error={!!errors[`repo-${repoIdx}-url`]}
                helperText={errors[`repo-${repoIdx}-url`]}
                disabled={isView}
                onChange={(e) =>
                  setRepoField(repoIdx, "repoUrl" as keyof RepoDetails, e.target.value)
                }
              >
                {REPOSITORIES.map((url) => (
                  <MenuItem key={url} value={url}>
                    {url}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Branch"
                value={repo.branch}
                error={!!errors[`repo-${repoIdx}-branch`]}
                helperText={errors[`repo-${repoIdx}-branch`]}
                disabled={isView}
                onChange={(e) =>
                  setRepoField(repoIdx, "branch" as keyof RepoDetails, e.target.value)
                }
              />
            </Box>
          </Paper>
        ))}

        {/* DEPENDENCIES */}
        <Divider sx={{ my: 3 }} />

        <Typography variant="subtitle2" fontWeight={700} mb={2}>
          Dependencies
        </Typography>

        <TextField
          select
          label="Dependencies"
          fullWidth
          SelectProps={{ multiple: true }}
          value={form.dependencies}
          error={!!errors.dependencies}
          helperText={errors.dependencies}
          disabled={isView}
          onChange={(e) =>
            setForm({
              ...form,
              dependencies: e.target.value as unknown as string[],
            })
          }
        >
          {DEPENDENCIES.map((d) => (
            <MenuItem key={d} value={d}>
              <Chip label={d} size="small" />
            </MenuItem>
          ))}
        </TextField>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>

        {!isView && (
          <Button
            variant="contained"
            onClick={submit}
            sx={{
              background: "linear-gradient(135deg,#7b5cff,#5ce1e6)",
            }}
          >
            {product ? "Save" : "Create"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
