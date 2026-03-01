import { Box, Typography } from "@mui/material";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";


import { AppUser } from "../../models/User";
import { ProductStatsResponse } from "../../models/Product";

/* -------------------------------------------------
   COLORS
------------------------------------------------- */
const PRODUCT_COLORS = {
  Pending: "#ffce56",
  Approved: "#5ce1e6", 
  Rejected: "#ff6b6b",
  Signed: "#00e5ff",
  Released: "#7b5cff",
};

const USER_ROLE_COLORS = {
  Admin: "#7b5cff",
  SecurityHead: "#5ce1e6",
  ProjectDirector: "#ffb86b",
  ReleaseEngineer: "#6ce59f",
};

/* -------------------------------------------------
   GLASS CARD STYLE
------------------------------------------------- */
const chartCardStyle = {
  p: 3,
  borderRadius: 3,
  bgcolor: "rgba(11,15,32,0.85)",
  border: "1px solid rgba(255,255,255,0.06)",
  boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
  backdropFilter: "blur(10px)",
};

/* -------------------------------------------------
   MAIN COMPONENT
------------------------------------------------- */
interface Props {
  productsStats: ProductStatsResponse;
  users: AppUser[];
}

export default function AdminCharts({ productsStats, users }: Props) {
  /* ------------ PRODUCT STATUS COUNTS ----------- */
  const productCounts = {
    Pending: productsStats.pending,
    Approved: productsStats.approved,
    Rejected: productsStats.rejected,
    Signed: productsStats.signed,
    Released: productsStats.released,
  };

  const productPieData = Object.entries(productCounts).map(([name, value]) => ({
    name,
    value,
    color: PRODUCT_COLORS[name as keyof typeof PRODUCT_COLORS],
  }));

  /* ------------ USER ROLE DISTRIBUTION ----------- */
  const roleCounts = users.reduce((acc: any, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {});

  const userPieData = Object.entries(roleCounts).map(([name, value]) => ({
    name,
    value,
    color: USER_ROLE_COLORS[name as keyof typeof USER_ROLE_COLORS] || "#aaa",
  }));

  /* -------------------------------------------------
     RENDER
  ------------------------------------------------- */
  return (
    <Box
      sx={{
        mt: 3,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
        gap: 3,
      }}
    >
      {/* ========= PRODUCT PIE CHART ========= */}
      <Box sx={{ ...chartCardStyle, height: 320 }}>
        <Typography variant="h6" sx={{ mb: 1, letterSpacing: 0.5 }}>
          Product Status – Distribution
        </Typography>

        <ResponsiveContainer width="100%" height="85%">
          <PieChart>
            <Pie
              data={productPieData}
              dataKey="value"
              nameKey="name"
              innerRadius={60}
              outerRadius={105}
              paddingAngle={4}
            >
              {productPieData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>

            <Tooltip
              contentStyle={{
                background: "#060712",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 8,
                color: "#fff",
              }}
              itemStyle={{ color: "#fff" }}
              labelStyle={{ color: "#ffffffcc" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </Box>

      {/* ========= PRODUCT BAR CHART ========= */}
      <Box sx={{ ...chartCardStyle, height: 320 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Product Status – Totals
        </Typography>

        <ResponsiveContainer width="100%" height="85%">
          <BarChart data={productPieData}>
            <XAxis dataKey="name" />
            <YAxis allowDecimals={false} />
            <CartesianGrid
              strokeDasharray="2 4"
              stroke="rgba(255,255,255,0.04)"
            />
            <Tooltip
              contentStyle={{
                background: "#060712",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 8,
                color: "#fff",
              }}
              itemStyle={{ color: "#fff" }}
              labelStyle={{ color: "#ffffffcc" }}
            />

            <Legend />

            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
              {productPieData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Box>

      {/* ========= USER ROLE PIE ========= */}
      <Box sx={{ ...chartCardStyle, height: 320 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Users by Role
        </Typography>

        <ResponsiveContainer width="100%" height="85%">
          <PieChart>
            <Pie
              data={userPieData}
              dataKey="value"
              nameKey="name"
              innerRadius={60}
              outerRadius={105}
              paddingAngle={4}
            >
              {userPieData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>

            <Tooltip
              contentStyle={{
                background: "#060712",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 8,
                color: "#fff",
              }}
              itemStyle={{ color: "#fff" }}
              labelStyle={{ color: "#ffffffcc" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
}
