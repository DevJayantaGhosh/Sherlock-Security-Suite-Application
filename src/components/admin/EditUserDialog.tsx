import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem, Box, Switch, FormControlLabel, Alert, Divider, Typography,
} from "@mui/material";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useUserStore } from "../../store/userStore";
import { AppUser, UserRole, UpdateUserRequest } from "../../models/User";
import { updateUser } from "../../services/userService";
import { toast } from "react-hot-toast";

interface Props {
  open: boolean;
  onClose(): void;
  user: AppUser;
  onSaved(): void;
}

const roles: UserRole[] = ["Admin", "ProjectDirector", "SecurityHead", "ReleaseEngineer", "User"];

interface FormErrors {
  name: string;
  role: string;
  licenseActivatedBy: string;
  licenseActivatedOn: string;
  licenseExpiry: string;
}

export default function EditUserDialog({ open, onClose, user, onSaved }: Props) {
  const loggedUser = useUserStore().user;
  
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("User");
  const [isInternal, setIsInternal] = useState(false);
  const [licenseActivatedBy, setLicenseActivatedBy] = useState("");
  const [licenseActivatedOn, setLicenseActivatedOn] = useState("");
  const [licenseExpiry, setLicenseExpiry] = useState("");

  const [errors, setErrors] = useState<FormErrors>({
    name: "", role: "", licenseActivatedBy: "", licenseActivatedOn: "", licenseExpiry: "",
  });

  const validateField = useCallback((field: keyof FormErrors, value: string): string => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    switch (field) {
      case "name": 
        return value.trim().length < 2 ? "Name must be at least 2 characters long" : "";
      case "role": 
        return !value ? "Please select a valid role" : "";
      case "licenseActivatedBy":
        if (isInternal || role === "Admin") return "";
        return !value.trim() ? "License activator name is required" : "";
      case "licenseActivatedOn":
        if (isInternal || role === "Admin") return "";
        if (!value) return "License activation date is required";
        const activationDate = new Date(value);
        return activationDate < today ? "Activation date cannot be in the past" : "";
      case "licenseExpiry":
        if (isInternal || role === "Admin") return "";
        if (!value) return "License expiry date is required";
        const expiryDate = new Date(value);
        expiryDate.setHours(0, 0, 0, 0);
        const actDate = licenseActivatedOn || today.toISOString().split('T')[0];
        if (expiryDate <= new Date(actDate)) return "Expiry date must be after activation date";
        const maxExpiry = new Date(Date.now() + 5*365*24*60*60*1000);
        return expiryDate > maxExpiry ? "Expiry cannot exceed 5 years from now" : "";
      default: return "";
    }
  }, [isInternal, role, licenseActivatedOn]);

  // Define BEFORE handleRoleChange
  const handleFieldChange = useCallback((field: keyof FormErrors, value: string) => {
    const error = validateField(field, value);
    setErrors(prev => ({ ...prev, [field]: error }));
  }, [validateField]);

  // Uses handleFieldChange 
  const handleRoleChange = useCallback((newRole: UserRole) => {
    setRole(newRole);
    handleFieldChange("role", newRole);
    
    // Only "User" role can toggle internal/external
    if (newRole !== "User") {
      setIsInternal(true);
    }
  }, [handleFieldChange]);

  const isFormValid = useMemo(() => {
    const nameError = validateField("name", name);
    const roleError = validateField("role", role);
    const activatedByError = validateField("licenseActivatedBy", licenseActivatedBy);
    const activatedOnError = validateField("licenseActivatedOn", licenseActivatedOn);
    const expiryError = validateField("licenseExpiry", licenseExpiry);
    return !nameError && !roleError && !activatedByError && !activatedOnError && !expiryError;
  }, [name, role, licenseActivatedBy, licenseActivatedOn, licenseExpiry, isInternal, validateField]);

  const showLicenseFields = useMemo(() => !isInternal && role === "User", [isInternal, role]);
  const isToggleDisabled = role !== "User";

  useEffect(() => {
    if (open && user) {
      setName(user.name || "");
      setRole(user.role || "User");
      setIsInternal(!!user.isInternal);
      setLicenseActivatedBy(user.licenseActivatedBy || loggedUser?.email || "");
      setLicenseActivatedOn(user.licenseActivatedOn ? new Date(user.licenseActivatedOn).toISOString().split('T')[0] : "");
      setLicenseExpiry(user.licenseExpiredOn ? new Date(user.licenseExpiredOn).toISOString().split('T')[0] : "");
      setErrors({ name: "", role: "", licenseActivatedBy: "", licenseActivatedOn: "", licenseExpiry: "" });
    }
  }, [user, open, loggedUser]);

  const save = useCallback(async () => {
    if (!isFormValid) return toast.error("Please fix all validation errors");

    try {
      const data: UpdateUserRequest = { name, role, isInternal };
      if (!isInternal && role === "User") {
        data.licenseActivatedBy = licenseActivatedBy || loggedUser?.email || "";
        if (licenseActivatedOn) data.licenseActivatedOn = licenseActivatedOn;
        if (licenseExpiry) data.licenseExpiredOn = licenseExpiry;
      }

      const result = await updateUser(user.id, data);
      if (result?.error) {
        toast.error(result.error.message);
        return;
      } 
      
      toast.success("User updated successfully");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Failed to update user");
    }
  }, [user, name, role, isInternal, licenseActivatedBy, licenseActivatedOn, licenseExpiry, isFormValid, loggedUser, onSaved, onClose]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>Edit User</DialogTitle>
      
      <Divider sx={{ borderColor: "rgba(255,255,255,0.1)", mx: 3, my: 1 }} />
      
      <DialogContent sx={{ py: 3 }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {/* Email Field */}
          <TextField 
            label="Email Address"
            value={user?.email || ""}
            fullWidth
            disabled
            InputProps={{
              readOnly: true,
              sx: {
                color: "#ffffff !important",
                backgroundColor: "rgba(255, 255, 255, 0.08)",
                borderRadius: 1,
                height: 56,
                '& .MuiInputBase-input': { color: "#ffffff !important", paddingTop: "16px" }
              }
            }}
            InputLabelProps={{
              shrink: true,
              sx: { color: "rgba(255, 255, 255, 0.8) !important", fontSize: "0.875rem" }
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: "rgba(255, 255, 255, 0.3)", borderRadius: 1 },
                '&:hover fieldset': { borderColor: "rgba(255, 255, 255, 0.5)" }
              }
            }}
            helperText="Primary identifier (cannot be changed)"
          />

          <TextField
            label="Full Name *"
            value={name}
            onChange={e => { setName(e.target.value); handleFieldChange("name", e.target.value); }}
            error={!!errors.name}
            helperText={errors.name || "Enter user's full name"}
            fullWidth
            required
          />

          <TextField
            select
            label="Role *"
            value={role}
            onChange={e => handleRoleChange(e.target.value as UserRole)}
            error={!!errors.role}
            helperText={errors.role || "Select user role"}
            fullWidth
            required
          >
            {roles.map(r => (
              <MenuItem key={r} value={r}>
                {r} {r !== "User" ? "(Always Internal)" : ""}
              </MenuItem>
            ))}
          </TextField>

          <FormControlLabel
            control={
              <Switch 
                checked={isInternal} 
                onChange={e => !isToggleDisabled && setIsInternal(e.target.checked)}
                disabled={isToggleDisabled}
                sx={{ 
                  color: "rgba(255,255,255,0.6)", 
                  '&.Mui-checked': { color: "#7b5cff" },
                  '&.Mui-disabled': { color: "rgba(255,255,255,0.3)" }
                }}
              />
            }
            label={
              <Box>
                Internal User (No license required)
                {isToggleDisabled && (
                  <Typography variant="caption" sx={{ display: "block", color: "rgba(255,255,255,0.5)", ml: 1 }}>
                    Disabled for {role} role
                  </Typography>
                )}
              </Box>
            }
            sx={{ alignSelf: "flex-start", m: 0 }}
          />

          {showLicenseFields && (
            <Box sx={{ pt: 1 }}>
              <TextField
                label="License Activated By *"
                value={licenseActivatedBy || loggedUser?.email || ""}
                onChange={e => {
                  setLicenseActivatedBy(e.target.value);
                  handleFieldChange("licenseActivatedBy", e.target.value);
                }}
                error={!!errors.licenseActivatedBy}
                helperText={errors.licenseActivatedBy || "Who activated this license"}
                fullWidth
                required
                InputProps={{ readOnly: true }}
                sx={{ mb: 2.5 }}
              />
              
              <TextField
                label="Activation Date *"
                type="date"
                value={licenseActivatedOn}
                onChange={e => {
                  setLicenseActivatedOn(e.target.value);
                  handleFieldChange("licenseActivatedOn", e.target.value);
                }}
                error={!!errors.licenseActivatedOn}
                helperText={errors.licenseActivatedOn}
                fullWidth
                required
                InputLabelProps={{ shrink: true }}
                sx={{ mb: 2.5 }}
              />
              
              <TextField
                label="Expiry Date *"
                type="date"
                value={licenseExpiry}
                onChange={e => {
                  setLicenseExpiry(e.target.value);
                  handleFieldChange("licenseExpiry", e.target.value);
                }}
                error={!!errors.licenseExpiry}
                helperText={errors.licenseExpiry}
                fullWidth
                required
                InputLabelProps={{ shrink: true }}
              />
            </Box>
          )}

          {isInternal && (
            <Alert severity="success" sx={{ mt: 2 }}>
              ✅ Internal users - no license required
            </Alert>
          )}
          {showLicenseFields && (
            <Alert severity="info" sx={{ mt: 2 }}>
              📋 External users require complete license information
            </Alert>
          )}
          {role !== "User" && (
            <Alert severity="info" sx={{ mt: 2 }}>
              ℹ️ {role} roles are always internal by default
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3, pb: 2.5, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
        <Button onClick={onClose} variant="outlined" sx={{ mr: 2 }}>
          Cancel
        </Button>
        <Button 
          variant="contained" 
          onClick={save} 
          disabled={!isFormValid}
          sx={{ 
            background: "linear-gradient(135deg, #7b5cff 0%, #5ce1e6 100%)",
            '&:hover': { background: "linear-gradient(135deg, #6a4de0 0%, #4bc0c5 100%)" }
          }}
        >
          Update User
        </Button>
      </DialogActions>
    </Dialog>
  );
}
