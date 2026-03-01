import {
  Box,
  Button,
  Container,
  Typography,
  Divider,
  Chip,
  Paper,
  Stack,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  TableHead,
  Stepper,
  Step,
  StepLabel,
  Alert,
  AlertTitle,
} from "@mui/material";
import {
  Home as HomeIcon,
  Security as SecurityIcon,
  Key as KeyIcon,
  Publish as PublishIcon,
  Verified as VerifiedIcon,
  AdminPanelSettings as AdminIcon,
  Engineering as EngineeringIcon,
  Fingerprint as FingerprintIcon,
  RocketLaunch as RocketLaunchIcon,
  ReceiptLong as ReceiptLongIcon,
  Close as CloseIcon,
  KeyboardArrowRight as ArrowRightIcon,
} from "@mui/icons-material";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

export default function UserGuidePage() {
  const navigate = useNavigate();

  /**
   * PIPELINE STEPS CONFIG - 5-step complete workflow
   */
  const PIPELINE_STEPS = [
    { label: "Onboard Product", icon: EngineeringIcon, color: "#ffe920" },
    { label: "Security Scan", icon: SecurityIcon, color: "#ff9800" },
    { label: "Cryptographic Sign", icon: FingerprintIcon, color: "#00e5ff" },
    { label: "Release", icon: RocketLaunchIcon, color: "#7b5cff" },
    { label: "Verify Signature", icon: ReceiptLongIcon, color: "#4caf50" },
  ];

  return (
    <Box
      sx={{
        p: 4,
        pt: 8,
        minHeight: "100vh",
        bgcolor: "#060712",
      }}
    >
      <Container maxWidth="xl">
        {/* MAIN HEADING */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        >
          <Typography
            variant="h4"
            fontWeight={800}
            mb={2}
            sx={{ 
              lineHeight: 1.1, 
              textAlign: "center",
              background: "linear-gradient(135deg, #7b5cff 0%, #5ce1e6 100%)",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Sherlock Security Suite
          </Typography>
          
          <Typography
            variant="h5"
            fontWeight={700}
            mb={3}
            sx={{ lineHeight: 1.2, textAlign: "center", color: "white" }}
          >
            User Guide - Product Distribution Pipeline
          </Typography>
        </motion.div>

        {/* LICENSE WARNING */}
        <Paper
          elevation={0}
          sx={{
            mt: 6,
            p: 5,
            bgcolor: "rgba(255,255,255,0.03)",
            borderRadius: 3,
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <Box sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            mb: 4,
            p: 4,
            bgcolor: "rgba(255,152,0,0.1)",
            border: "2px solid rgba(255,152,0,0.3)",
            borderRadius: 3,
          }}>
            <Typography variant="h6" fontWeight={600} color="warning.main" gutterBottom>
              ⚠️ License Required
            </Typography>
            <Typography variant="body1" color="warning.dark" mb={3} sx={{ maxWidth: 500 }}>
              License activation required for proprietary product distribution pipeline. 
              Open source products remain fully accessible.
            </Typography>
            <Stack direction="row" spacing={4} sx={{ maxWidth: 600 }}>
              <Box sx={{ flex: 1 }}>
                <Chip label="Open Source" color="success" sx={{ mb: 2, fontSize: "0.875rem" }} />
                <Typography color="success.main">MIT/Apache - Fully accessible</Typography>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Chip label="Proprietary" color="warning" sx={{ mb: 2, fontSize: "0.875rem" }} />
                <Typography color="warning.main">License required</Typography>
              </Box>
            </Stack>
          </Box>
        </Paper>

        {/* PIPELINE STEPPER */}
        <Paper
          elevation={0}
          sx={{
            mt: 8,
            p: 5,
            bgcolor: "rgba(255,255,255,0.03)",
            borderRadius: 3,
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <Typography variant="h6" fontWeight={700} mb={4} color="white">
            Product Distribution Pipeline
          </Typography>
          
          <Box sx={{ maxWidth: 900, mx: "auto" }}>
            <Stepper
              activeStep={-1}
              alternativeLabel
              orientation="horizontal"
              sx={{
                py: 2,
                gap: 1,
                "& .MuiStepper-horizontal": { minHeight: 80, alignItems: "center" },
                "& .MuiStep-root": { flex: 1, minWidth: 0, p: "8px 12px" },
                "& .MuiStepConnector-lineHorizontal": {
                  borderTopWidth: 4,
                  minHeight: 6,
                  margin: "0 16px",
                  borderTopColor: "rgba(255,255,255,0.3)",
                },
              }}
            >
              {PIPELINE_STEPS.map((step, index) => {
                const IconComponent = step.icon;
                return (
                  <Step key={step.label}>
                    <StepLabel
                      sx={{
                        "& .MuiStepLabel-root": { alignItems: "center" },
                        "& .MuiStepLabel-labelContainer": {
                          marginTop: 0,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 1,
                        },
                        "& .MuiStepLabel-label": {
                          marginTop: 0,
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          lineHeight: 1.4,
                        },
                      }}
                      StepIconComponent={(props) => (
                        <Box
                          component={motion.div}
                          whileHover={{ scale: 1.1, y: -2 }}
                          sx={{
                            bgcolor: `${step.color}20`,
                            color: step.color,
                            borderRadius: "50%",
                            width: 44,
                            height: 44,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 18,
                            fontWeight: 800,
                            border: `3px solid ${step.color}40`,
                            boxShadow: `0 6px 20px ${step.color}30`,
                            cursor: "default",
                            transition: "all 0.3s ease",
                          }}
                        >
                          <IconComponent sx={{ fontSize: 20 }} />
                        </Box>
                      )}
                    >
                      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
                        <IconComponent
                          sx={{
                            fontSize: 20,
                            color: step.color,
                          }}
                        />
                        <Typography
                          variant="caption"
                          fontWeight={700}
                          sx={{
                            lineHeight: 1.2,
                            color: step.color,
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                          }}
                        >
                          {step.label}
                        </Typography>
                      </Box>
                    </StepLabel>
                  </Step>
                );
              })}
            </Stepper>
          </Box>
        </Paper>

        {/* WORKFLOW STEPS */}
        <Paper
          elevation={0}
          sx={{
            mt: 6,
            p: 5,
            bgcolor: "rgba(255,255,255,0.03)",
            borderRadius: 3,
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <Typography variant="h6" fontWeight={700} mb={4} color="white">
            📋 Step-by-Step Workflow
          </Typography>

          <Stack spacing={4}>
            {[
              {
                step: 1,
                title: "Onboard Product",
                desc: "Admins & Project Directors create new products (Pending status)",
                roles: ["Admin", "ProjectDirector"],
                icon: EngineeringIcon,
                color: "#ffe920",
              },
              {
                step: 2,
                title: "Security Scan",
                desc: "Security Head runs SAST scans. Can APPROVE (→ Cryptographic Sign) or REJECT",
                roles: ["SecurityHead"],
                icon: SecurityIcon,
                color: "#ff9800",
              },
              {
                step: 3,
                title: "Cryptographic Sign",
                desc: "Release Engineers digitally sign artifacts (requires Approved status)",
                roles: ["ReleaseEngineer"],
                icon: FingerprintIcon,
                color: "#00e5ff",
              },
              {
                step: 4,
                title: "Release",
                desc: "Release Engineers publish signed artifacts (requires Signed status)",
                roles: ["ReleaseEngineer"],
                icon: RocketLaunchIcon,
                color: "#7b5cff",
              },
              {
                step: 5,
                title: "Signature Verification",
                desc: "All users verify cryptographic signatures (requires Released status)",
                roles: ["All Roles"],
                icon: ReceiptLongIcon,
                color: "#4caf50",
              },
            ].map((phase) => (
              <Box key={phase.step} sx={{ display: "flex", gap: 3, alignItems: "flex-start" }}>
                <Chip
                  label={`${phase.step}`}
                  sx={{ 
                    width: 56, 
                    height: 56, 
                    fontWeight: 700,
                    bgcolor: `${phase.color}20`,
                    color: phase.color,
                    border: `2px solid ${phase.color}40`,
                  }}
                  icon={<phase.icon sx={{ fontSize: 20 }} />}
                />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" fontWeight={600} mb={1} color="white">
                    {phase.title}
                  </Typography>
                  <Typography color="text.secondary" sx={{ fontSize: "1rem", mb: 2 }}>
                    {phase.desc}
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {phase.roles.map((role) => (
                      <Chip
                        key={role}
                        label={role}
                        size="small"
                        sx={{
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          bgcolor: "rgba(123,92,255,0.2)",
                          color: "white",
                        }}
                      />
                    ))}
                  </Stack>
                </Box>
              </Box>
            ))}
          </Stack>
        </Paper>

        {/* STATUS FLOW DIAGRAM - FIXED */}
        <Paper
          elevation={0}
          sx={{
            mt: 6,
            p: 5,
            bgcolor: "rgba(255,255,255,0.03)",
            borderRadius: 3,
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <Typography variant="h6" fontWeight={700} mb={4} color="white">
            ⏳ Status Flow Diagram
          </Typography>
          
          <Box sx={{ maxWidth: 800, mx: "auto" }}>
            <Stack spacing={3} divider={<Divider sx={{ borderColor: "rgba(255,255,255,0.1)" }} />}>
              {/* PENDING → SCAN */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 3, p: 3, bgcolor: "rgba(255,233,32,0.1)", borderRadius: 2 }}>
                <Chip label="PENDING" sx={{ bgcolor: "#ffe920", color: "#000", fontWeight: 700 }} />
                <Box sx={{ flex: 1, height: 3, bgcolor: "rgba(255,255,255,0.2)", borderRadius: 2 }} />
                <SecurityIcon sx={{ color: "#ff9800", fontSize: 28 }} />
                <Typography color="warning.main" fontWeight={600}>Security Scan</Typography>
              </Box>

              {/* SCAN → APPROVED / REJECTED */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 2, p: 3, bgcolor: "rgba(255,152,0,0.1)", borderRadius: 2 }}>
                <SecurityIcon sx={{ color: "#ff9800", fontSize: 28 }} />
                <Typography color="warning.main" fontWeight={600} sx={{ flex: 1 }}>Security Head Decision</Typography>
                <Box sx={{ display: "flex", gap: 4 }}>
                  <Box sx={{ textAlign: "center" }}>
                    <Chip label="✅ APPROVED" sx={{ bgcolor: "#1ca153", color: "white", mb: 1 }} size="small" />
                    <ArrowRightIcon sx={{ color: "#00e5ff", fontSize: 24 }} />
                    <Typography variant="caption" color="text.secondary">→ Sign</Typography>
                  </Box>
                  <Box sx={{ textAlign: "center" }}>
                    <CloseIcon sx={{ color: "#f44336", fontSize: 24 }} />
                    <Chip label="❌ REJECTED" sx={{ bgcolor: "#f44336", color: "white", mt: 1 }} size="small" />
                  </Box>
                </Box>
              </Box>

              {/* APPROVED → SIGN → RELEASE → VERIFY */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 2, p: 3, bgcolor: "rgba(0,229,255,0.1)", borderRadius: 2, flexWrap: "wrap" }}>
                <Chip label="APPROVED" sx={{ bgcolor: "#1ca153", color: "white", fontWeight: 700 }} />
                <ArrowRightIcon sx={{ color: "#00e5ff" }} />
                <FingerprintIcon sx={{ color: "#00e5ff", fontSize: 24 }} />
                <ArrowRightIcon sx={{ color: "#7b5cff" }} />
                <RocketLaunchIcon sx={{ color: "#7b5cff", fontSize: 24 }} />
                <ArrowRightIcon sx={{ color: "#4caf50" }} />
                <ReceiptLongIcon sx={{ color: "#4caf50", fontSize: 24 }} />
                <Chip label="RELEASED ✓" sx={{ bgcolor: "#4caf50", color: "white", fontWeight: 700, ml: "auto" }} />
              </Box>

              <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", fontStyle: "italic", mt: 2 }}>
                🔒 Edit/Delete only available for PENDING products
              </Typography>
            </Stack>
          </Box>
        </Paper>

        {/* RBAC TABLE - CHIPS REMOVED */}
        <Paper
          elevation={0}
          sx={{
            mt: 6,
            p: 5,
            bgcolor: "rgba(255,255,255,0.03)",
            borderRadius: 3,
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <Typography variant="h5" fontWeight={700} mb={4} color="white">
            🔐 Role-Based Permissions
          </Typography>
          
          <TableContainer sx={{ borderRadius: 2, overflow: "hidden" }}>
            <Table sx={{ minWidth: 800 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: "rgba(255,255,255,0.05)" }}>
                  <TableCell sx={{ color: "white", fontWeight: 700, py: 2, borderBottom: "none", minWidth: 120 }}>Role</TableCell>
                  <TableCell align="center" sx={{ color: "white", fontWeight: 700, py: 2, borderBottom: "none", minWidth: 90 }}>Onboard</TableCell>
                  <TableCell align="center" sx={{ color: "white", fontWeight: 700, py: 2, borderBottom: "none", minWidth: 70 }}>Edit</TableCell>
                  <TableCell align="center" sx={{ color: "white", fontWeight: 700, py: 2, borderBottom: "none", minWidth: 80 }}>Delete</TableCell>
                  <TableCell align="center" sx={{ color: "warning.main", fontWeight: 700, py: 2, borderBottom: "none", minWidth: 80 }}>Scan</TableCell>
                  <TableCell align="center" sx={{ color: "info.main", fontWeight: 700, py: 2, borderBottom: "none", minWidth: 110 }}>Cryptographic Sign</TableCell>
                  <TableCell align="center" sx={{ color: "primary.main", fontWeight: 700, py: 2, borderBottom: "none", minWidth: 80 }}>Release</TableCell>
                  <TableCell align="center" sx={{ color: "success.main", fontWeight: 700, py: 2, borderBottom: "none", minWidth: 100 }}>Verify</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[
                  {
                    role: "Admin",
                    onboard: "✅", edit: "✅", delete: "✅",
                    scan: "✅", sign: "✅", release: "✅", verify: "✅"
                  },
                  {
                    role: "ProjectDirector",
                    onboard: "✅*", edit: "✅*", delete: "✅*",
                    scan: "❌", sign: "❌", release: "❌", verify: "✅"
                  },
                  {
                    role: "SecurityHead",
                    onboard: "❌", edit: "❌", delete: "❌", 
                    scan: "✅", sign: "❌", release: "❌", verify: "✅"
                  },
                  {
                    role: "ReleaseEngineer",
                    onboard: "❌", edit: "❌", delete: "❌",
                    scan: "❌", sign: "✅", release: "✅", verify: "✅"
                  },
                  {
                    role: "User",
                    onboard: "❌", edit: "❌", delete: "❌",
                    scan: "❌", sign: "❌", release: "❌", verify: "✅"
                  },
                ].map((row) => (
                  <TableRow
                    key={row.role}
                    sx={{
                      "&:hover": { bgcolor: "rgba(255,255,255,0.04)" },
                      borderBottom: "1px solid rgba(255,255,255,0.08)"
                    }}
                  >
                    <TableCell sx={{ color: "white", fontWeight: 600, py: 2.5, minWidth: 120 }}>
                      {row.role}
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600, py: 2.5, color: row.onboard.includes("✅") ? "success.main" : "error.main", minWidth: 90 }}>
                      {row.onboard}
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600, py: 2.5, color: row.edit.includes("✅") ? "success.main" : "error.main", minWidth: 70 }}>
                      {row.edit}
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600, py: 2.5, color: row.delete.includes("✅") ? "success.main" : "error.main", minWidth: 80 }}>
                      {row.delete}
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600, py: 2.5, color: row.scan.includes("✅") ? "warning.main" : "error.main", minWidth: 80 }}>
                      {row.scan}
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600, py: 2.5, color: row.sign.includes("✅") ? "info.main" : "error.main", minWidth: 110 }}>
                      {row.sign}
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600, py: 2.5, color: row.release.includes("✅") ? "primary.main" : "error.main", minWidth: 80 }}>
                      {row.release}
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600, py: 2.5, color: row.verify.includes("✅") ? "success.main" : "error.main", minWidth: 100 }}>
                      {row.verify}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Typography variant="body2" color="text.secondary" mt={3} sx={{ fontSize: "0.875rem", textAlign: "center" }}>
            * = Own/Assigned products only | ✅ = Full access | ❌ = No access
          </Typography>
        </Paper>

        {/* CTA */}
        <Box sx={{ mt: 12, textAlign: "center" }}>
          <Button
            variant="contained"
            size="large"
            startIcon={<HomeIcon />}
            onClick={() => navigate("/")}
            sx={{
              px: 6,
              py: 2,
              fontSize: "1rem",
              fontWeight: 600,
              background: "linear-gradient(135deg, #7b5cff, #5ce1e6)",
              borderRadius: 2,
              boxShadow: "0 8px 25px rgba(123,92,255,0.3)",
              "&:hover": {
                transform: "translateY(-2px)",
                boxShadow: "0 12px 35px rgba(123,92,255,0.4)",
              },
            }}
          >
            Return to Dashboard
          </Button>
        </Box>
      </Container>
    </Box>
  );
}
