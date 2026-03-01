import {
  Box,
  Button,
  Container,
  Typography,

  Chip,
  Paper,
  Stack,
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
                        <Typography
                          variant="caption"
                          fontWeight={700}
                          sx={{
                            lineHeight: 1.2,
                            mt: 2,
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
            p: 4,
            bgcolor: "rgba(255,255,255,0.03)",
            borderRadius: 3,
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <Typography variant="h6" fontWeight={700} mb={4} color="white">
            ⏳ Action & Status Workflow
          </Typography>

          <Box sx={{ maxWidth: 1000, mx: "auto", overflowX: "auto", pb: 2 }}>
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, minWidth: 900 }}>
              {/* 1. ONBOARD → PENDING */}
              <Box sx={{ textAlign: "center", flexShrink: 0, width: 80 }}>
                <Box sx={{ p: 2, bgcolor: "rgba(255,233,32,0.15)", borderRadius: 2, border: "1px solid rgba(255,233,32,0.3)" }}>
                  <EngineeringIcon sx={{ fontSize: 24, color: "#ffe920" }} />
                  <Typography variant="caption" fontWeight={700} color="#ffe920" sx={{ display: "block", fontSize: "0.65rem", mt: 0.5 }}>
                    ONBOARD
                  </Typography>
                </Box>
                <Chip label="PENDING" size="small" sx={{ mt: 1, bgcolor: "#ffe920", color: "#000", fontWeight: 700, height: 24, fontSize: "0.6rem", width: 65 }} />
              </Box>

              {/* DOTTED LINE 1 */}
              <Box sx={{ flex: 1, height: 2, position: "relative", mt: 6 }}>
                <Box sx={{
                  position: "absolute",
                  top: "50%",
                  left: 8,
                  right: 8,
                  height: 2,
                  borderBottom: "2px dashed rgba(255,255,255,0.3)",
                  backgroundImage: "linear-gradient(to right, transparent 50%, rgba(255,255,255,0.4) 50%)",
                  backgroundSize: "8px 2px",
                  backgroundRepeat: "repeat-x",
                }} />
              </Box>

              {/* 2. SECURITY SCAN */}
              <Box sx={{ textAlign: "center", flexShrink: 0, width: 80 }}>
                <Box sx={{ p: 2, bgcolor: "rgba(255,152,0,0.15)", borderRadius: 2, border: "1px solid rgba(255,152,0,0.3)" }}>
                  <SecurityIcon sx={{ fontSize: 24, color: "#ff9800" }} />
                  <Typography variant="caption" fontWeight={700} color="#ff9800" sx={{ display: "block", fontSize: "0.65rem", mt: 0.5 }}>
                    SCAN
                  </Typography>
                </Box>

                {/* REJECTED BRANCH - VERTICAL RED DOTS */}
                <Box sx={{ mt: 1.5, ml: -1 }}>
                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5, mb: 0.4 }}>
                    <Box sx={{
                      width: 8, height: 8,
                      borderRadius: "50%",
                      bgcolor: "#f44336",
                      boxShadow: "0 2px 8px rgba(244,67,54,0.4)",
                    }} />
                    <Box sx={{
                      width: 8, height: 8,
                      borderRadius: "50%",
                      bgcolor: "#f44336",
                      boxShadow: "0 2px 8px rgba(244,67,54,0.4)",
                    }} />
                    <Box sx={{
                      width: 8, height: 8,
                      borderRadius: "50%",
                      bgcolor: "#f44336",
                      boxShadow: "0 2px 8px rgba(244,67,54,0.4)",
                    }} />
                  </Box>
                  <Typography variant="caption" color="#f44336" sx={{ fontSize: "0.65rem", fontWeight: 600 }}>
                    REJECTED ❌
                  </Typography>
                </Box>
              </Box>

              {/* APPROVED PATH - SAME STYLE AS OTHERS (dots first) */}
              <Box sx={{ flex: 1, height: 2, position: "relative", mt: 6 }}>
                <Box sx={{
                  position: "absolute",
                  top: "50%",
                  left: 8,
                  right: 8,
                  height: 2,
                  borderBottom: "2px dashed #00e5ff40",
                  backgroundImage: "linear-gradient(to right, transparent 50%, #00e5ff60 50%)",
                  backgroundSize: "8px 2px",
                  backgroundRepeat: "repeat-x",
                }} />
                <Typography variant="caption" color="#1ca153" sx={{
                  position: "relative",
                  top: "1rem",
                  left: "60%",
                  transform: "translate(-50%, -50%)",
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  whiteSpace: "nowrap"
                }}>
                  APPROVED ✅
                </Typography>
              </Box>

              {/* 3. SIGN → SIGNED */}
              <Box sx={{ textAlign: "center", flexShrink: 0, width: 80 }}>
                <Box sx={{ p: 2, bgcolor: "rgba(0,229,255,0.15)", borderRadius: 2, border: "1px solid rgba(0,229,255,0.3)" }}>
                  <FingerprintIcon sx={{ fontSize: 24, color: "#00e5ff" }} />
                  <Typography variant="caption" fontWeight={700} color="#00e5ff" sx={{ display: "block", fontSize: "0.65rem", mt: 0.5 }}>
                    SIGN
                  </Typography>
                </Box>
                <Chip label="SIGNED" size="small" sx={{ mt: 1, bgcolor: "#00e5ff", color: "#000", fontWeight: 700, height: 24, fontSize: "0.6rem", width: 65 }} />
              </Box>

              {/* DOTTED LINE 3 */}
              <Box sx={{ flex: 1, height: 2, position: "relative", mt: 6 }}>
                <Box sx={{
                  position: "absolute",
                  top: "50%",
                  left: 8,
                  right: 8,
                  height: 2,
                  borderBottom: "2px dashed #7b5cff40",
                  backgroundImage: "linear-gradient(to right, transparent 50%, #7b5cff60 50%)",
                  backgroundSize: "8px 2px",
                  backgroundRepeat: "repeat-x",
                }} />
              </Box>

              {/* 4. RELEASE → RELEASED */}
              <Box sx={{ textAlign: "center", flexShrink: 0, width: 80 }}>
                <Box sx={{ p: 2, bgcolor: "rgba(123,92,255,0.15)", borderRadius: 2, border: "1px solid rgba(123,92,255,0.3)" }}>
                  <RocketLaunchIcon sx={{ fontSize: 24, color: "#7b5cff" }} />
                  <Typography variant="caption" fontWeight={700} color="#7b5cff" sx={{ display: "block", fontSize: "0.65rem", mt: 0.5 }}>
                    RELEASE
                  </Typography>
                </Box>
                <Chip label="RELEASED" size="small" sx={{ mt: 1, bgcolor: "#7b5cff", color: "white", fontWeight: 700, height: 24, fontSize: "0.6rem", width: 72 }} />
              </Box>

              {/* DOTTED LINE 4 */}
              <Box sx={{ flex: 1, height: 2, position: "relative", mt: 6 }}>
                <Box sx={{
                  position: "absolute",
                  top: "50%",
                  left: 8,
                  right: 8,
                  height: 2,
                  borderBottom: "2px dashed #4caf5040",
                  backgroundImage: "linear-gradient(to right, transparent 50%, #4caf5060 50%)",
                  backgroundSize: "8px 2px",
                  backgroundRepeat: "repeat-x",
                }} />
              </Box>

              {/* 5. VERIFY → VERIFIED */}
              <Box sx={{ textAlign: "center", flexShrink: 0, width: 80 }}>
                <Box sx={{ p: 2, bgcolor: "rgba(76,175,80,0.15)", borderRadius: 2, border: "1px solid rgba(76,175,80,0.3)" }}>
                  <ReceiptLongIcon sx={{ fontSize: 24, color: "#4caf50" }} />
                  <Typography variant="caption" fontWeight={700} color="#4caf50" sx={{ display: "block", fontSize: "0.65rem", mt: 0.5 }}>
                    VERIFY
                  </Typography>
                </Box>
                <Chip label="VERIFIED ✓" size="small" sx={{ mt: 1, bgcolor: "#4caf50", color: "white", fontWeight: 700, height: 24, fontSize: "0.6rem", width: 72 }} />
              </Box>
            </Box>

            {/* Edit/ Delete */}
            <Box sx={{ mt: 4, textAlign: "center" }}>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: "block", fontStyle: "italic", fontSize: "0.8rem" }}>
                🔒 Edit/Delete only for PENDING status
              </Typography>
            </Box>
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
            Return to Home
          </Button>
        </Box>
      </Container>
    </Box>
  );
}
