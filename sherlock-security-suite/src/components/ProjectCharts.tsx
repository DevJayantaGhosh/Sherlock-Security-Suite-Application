// src/components/ProjectCharts.tsx
import { Box, Typography } from "@mui/material";
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { Project } from "../models/project";

const COLORS = ["#7b5cff", "#5ce1e6", "#ffb86b", "#ff6b6b"];

export default function ProjectCharts({ projects }: { projects: Project[] }) {
  const counts = {
    Pending: projects.filter(p => p.status === "Pending").length,
    Approved: projects.filter(p => p.status === "Approved").length,
    Rejected: projects.filter(p => p.status === "Rejected").length,
    Released: projects.filter(p => p.status === "Released").length,
  };

  const pieData = [
    { name: "Pending", value: counts.Pending },
    { name: "Approved", value: counts.Approved },
    { name: "Rejected", value: counts.Rejected },
    { name: "Released", value: counts.Released },
  ];

  const barData = Object.keys(counts).map(k => ({ name: k, value: (counts as any)[k] }));

  return (
    <Box display="flex" gap={3} flexWrap="wrap" mb={3}>
      <Box sx={{ width: 360, height: 260, p:2, background: "rgba(255,255,255,0.02)", borderRadius:2 }}>
        <Typography variant="h6" mb={1}>Status Distribution</Typography>
        <ResponsiveContainer width="100%" height="85%">
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={80} innerRadius={30}>
              {pieData.map((_entry, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </Box>

      <Box sx={{ width: 520, height: 260, p:2, background: "rgba(255,255,255,0.02)", borderRadius:2 }}>
        <Typography variant="h6" mb={1}>Projects by Status</Typography>
        <ResponsiveContainer width="100%" height="85%">
          <BarChart data={barData}>
            <XAxis dataKey="name" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey="value" fill="#7b5cff" />
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
}
