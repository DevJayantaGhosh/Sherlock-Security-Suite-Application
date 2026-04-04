/**
 * LLMConfigDialog — Dialog for LLM API configuration.
 * Opens from the settings icon in the NavBar or from the chat panel.
 * Config is stored in Zustand llmStore.
 */

import { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  TextField,
  MenuItem,
  Button,
  Stack,
  IconButton,
  InputAdornment,
  Alert,
  Chip,
  Box,
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloseIcon from "@mui/icons-material/Close";
import SmartToyIcon from "@mui/icons-material/SmartToy";

import {
  type LLMProviderConfig,
  PROVIDER_PRESETS,
  getProviderPreset,
  getModelsForProvider,
} from "../../config/llmConfig";
import { useLLMStore } from "../../store/llmStore";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function LLMConfigDialog({ open, onClose }: Props) {
  const { config: storeConfig, setConfig: saveToStore, resetConfig } = useLLMStore();

  const [showApiKey, setShowApiKey] = useState(false);
  const [saved, setSaved] = useState(false);

  // Local form state — copied from store when dialog opens
  const [config, setConfig] = useState<LLMProviderConfig>(storeConfig);

  useEffect(() => {
    if (open) {
      setConfig(storeConfig);
      setSaved(false);
    }
  }, [open, storeConfig]);

  const currentPreset = getProviderPreset(config.provider);
  const modelOptions = getModelsForProvider(config.provider);

  const handleProviderChange = useCallback((provider: string) => {
    const preset = getProviderPreset(provider);
    setConfig((prev) => ({
      ...prev,
      provider,
      model: preset.defaultModel || prev.model,
    }));
  }, []);

  const handleSave = useCallback(() => {
    saveToStore(config);
    setSaved(true);
    setTimeout(() => onClose(), 800);
  }, [config, saveToStore, onClose]);

  const handleReset = useCallback(() => {
    resetConfig();
    setConfig(useLLMStore.getState().config);
  }, [resetConfig]);

  const configured =
    config.provider === "ollama"
      ? !!config.baseURL
      : !!config.apiKey && !!config.baseURL;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <SmartToyIcon sx={{ color: "primary.main" }} />
          <Typography fontWeight={700} variant="h6">
            ⚙️ AI Configuration
          </Typography>
          {configured && (
            <Chip
              icon={<CheckCircleIcon />}
              label="Connected"
              size="small"
              color="success"
              variant="outlined"
            />
          )}
        </Stack>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          {/* Provider */}
          <TextField
            select
            label="API Provider"
            value={config.provider}
            onChange={(e) => handleProviderChange(e.target.value)}
            size="small"
            fullWidth
          >
            {PROVIDER_PRESETS.map((p) => (
              <MenuItem key={p.provider} value={p.provider}>
                {p.label}
              </MenuItem>
            ))}
          </TextField>

          {/* Base URL */}
          <TextField
            label="Base URL"
            placeholder="https://..."
            value={config.baseURL}
            onChange={(e) =>
              setConfig({ ...config, baseURL: e.target.value })
            }
            size="small"
            fullWidth
          />

          {/* API Key */}
          {currentPreset.requiresApiKey && (
            <TextField
              label="API Key"
              type={showApiKey ? "text" : "password"}
              placeholder="sk-... or your key"
              value={config.apiKey}
              onChange={(e) =>
                setConfig({ ...config, apiKey: e.target.value })
              }
              size="small"
              fullWidth
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? (
                        <VisibilityOffIcon fontSize="small" />
                      ) : (
                        <VisibilityIcon fontSize="small" />
                      )}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          )}

          {/* Model selector */}
          {modelOptions.length > 0 ? (
            <TextField
              select
              label="Model"
              value={config.model}
              onChange={(e) => setConfig({ ...config, model: e.target.value })}
              size="small"
              fullWidth
            >
              {modelOptions.map((m) => (
                <MenuItem key={m} value={m}>
                  {m}
                </MenuItem>
              ))}
            </TextField>
          ) : (
            <TextField
              label="Model"
              placeholder="e.g. gpt-4o"
              value={config.model}
              onChange={(e) => setConfig({ ...config, model: e.target.value })}
              size="small"
              fullWidth
            />
          )}

          {/* Description */}
          <Box sx={{ p: 1.5, bgcolor: "action.hover", borderRadius: 1 }}>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ lineHeight: 1.6 }}
            >
              {currentPreset.description}
            </Typography>
          </Box>

          {!configured && (
            <Alert severity="info" variant="outlined">
              Enter your API provider details to enable Sherlock AI security
              analysis.

            </Alert>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button variant="text" onClick={handleReset}>
          Reset to defaults
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          color={saved ? "success" : "primary"}
        >
          {saved ? "Saved ✓" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}