// src/components/AdminCharts.tsx
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

import { Project } from "../../models/project";
import { AppUser } from "../../models/User";

/* -------------------------------------------------
   COLORS
------------------------------------------------- */
const PROJECT_COLORS = {
    Pending: "#ffce56",
    Approved: "#5ce1e6",
    Rejected: "#ff6b6b",
    Released: "#7b5cff",
};

const USER_ROLE_COLORS = {
    Admin: "#7b5cff",
    SecurityHead: "#5ce1e6",
    Manager: "#ffb86b",
    Analyst: "#6ce59f",
    User: "#9ea4ff",
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
    projects: Project[];
    users: AppUser[];
}

export default function AdminCharts({ projects, users }: Props) {

    /* ------------ PROJECT STATUS COUNTS ----------- */
    const projectCounts = {
        Pending: projects.filter(p => p.status === "Pending").length,
        Approved: projects.filter(p => p.status === "Approved").length,
        Rejected: projects.filter(p => p.status === "Rejected").length,
        Released: projects.filter(p => p.status === "Released").length,
    };

    const projectPieData = Object.entries(projectCounts).map(
        ([name, value]) => ({
            name,
            value,
            color: PROJECT_COLORS[name as keyof typeof PROJECT_COLORS],
        })
    );

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
            {/* ========= PROJECT PIE CHART ========= */}
            <Box sx={{ ...chartCardStyle, height: 320 }}>
                <Typography variant="h6" sx={{ mb: 1, letterSpacing: 0.5 }}>
                    Project Status – Distribution
                </Typography>

                <ResponsiveContainer width="100%" height="85%">
                    <PieChart>
                        <Pie
                            data={projectPieData}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={60}
                            outerRadius={105}
                            paddingAngle={4}
                        >
                            {projectPieData.map((entry, i) => (
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

            {/* ========= PROJECT BAR CHART ========= */}
            <Box sx={{ ...chartCardStyle, height: 320 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>
                    Project Status – Totals
                </Typography>

                <ResponsiveContainer width="100%" height="85%">
                    <BarChart data={projectPieData}>
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
                            {projectPieData.map((entry, i) => (
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
