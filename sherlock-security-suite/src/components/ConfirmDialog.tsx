import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from "@mui/material";

export default function ConfirmDialog({ open, title, description, onCancel, onConfirm }: { open: boolean; title: string; description?: string; onCancel: () => void; onConfirm: () => void; }) {
  return (
    <Dialog open={open} onClose={onCancel}>
      <DialogTitle>{title}</DialogTitle>
      {description && <DialogContent><Typography>{description}</Typography></DialogContent>}
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="contained" color="error" onClick={onConfirm}>Confirm</Button>
      </DialogActions>
    </Dialog>
  );
}
