import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from "@mui/material";

export default function ConfirmDialog({
  open,
  title,
  description,
  onCancel,
  onConfirm,
  hideConfirm = false,
}: {
  open: boolean;
  title: string;
  description?: string;
  onCancel: () => void;
  onConfirm: () => void;
  hideConfirm?: boolean;
}) {
  return (
    <Dialog open={open} onClose={onCancel}>
      <DialogTitle>{title}</DialogTitle>

      {description && (
        <DialogContent>
          <Typography>{description}</Typography>
        </DialogContent>
      )}

      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>

        {!hideConfirm && (
          <Button variant="contained" color="error" onClick={onConfirm}>
            OK
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
