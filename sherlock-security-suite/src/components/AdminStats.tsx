// src/components/AdminStats.tsx
import { Card, Typography } from "@mui/material";

interface Props { title: string; value: number; }

export default function AdminStats({ title, value }: Props) {
  return (
    <Card sx={{
      p: 3, width: 220, textAlign: "center", borderRadius: 2,
      background: "linear-gradient(180deg, rgba(255,255,255,0.01), rgba(255,255,255,0.02))",
      boxShadow: "0 10px 30px rgba(123,92,255,0.06)"
    }}>
      <Typography color="text.secondary">{title}</Typography>
      <Typography variant="h4" sx={{ fontWeight: 800, mt: 1 }}>{value}</Typography>
    </Card>
  );
}
