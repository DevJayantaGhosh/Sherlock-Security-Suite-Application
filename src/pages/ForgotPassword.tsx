import { useState } from "react";
import { Box, Container, Paper, Typography, TextField, Button, Stepper, Step, StepLabel, Divider } from "@mui/material";
import { motion } from "framer-motion";
import { forgotPassword, verifyOtp, resetPassword } from "./../services/userService";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";

const steps = ['Enter Email', 'Verify OTP', 'Reset Password'];

export default function ForgotPassword() {
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState(""); 
  const navigate = useNavigate();

  //  EMAIL VALIDATION
  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);

    // Clear previous error or show new one
    if (value && !validateEmail(value)) {
      setEmailError("Please enter a valid email address");
    } else {
      setEmailError("");
    }
  };

  const nextStep = () => setStep(prev => prev + 1);
  const prevStep = () => setStep(prev => prev - 1);

  const handleForgotPassword = async () => {
    if (!email || !validateEmail(email)) {
      toast.error("Please enter valid email");
      return;
    }
    if (emailError) {
      toast.error(emailError);
      return;
    }
    
    try {
      setLoading(true);
      setEmailError("");
      await forgotPassword(email);
      toast.success("OTP sent to your email!");
      nextStep();
    } catch {
      toast.error("Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      toast.error("Enter 6-digit OTP");
      return;
    }
    try {
      setLoading(true);
      await verifyOtp(email, otp);
      toast.success("OTP verified!");
      nextStep();
    } catch {
      toast.error("Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    try {
      setLoading(true);
      await resetPassword(email, newPassword);
      toast.success("Password reset successfully!");
      navigate("/login");
    } catch {
      toast.error("Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 0:
        return (
          <TextField
            fullWidth
            label="Email"
            type="email"
            value={email}
            onChange={handleEmailChange}  
            error={!!emailError}          
            helperText={emailError}      
            disabled={loading}
            sx={{ mb: 2 }}
          />
        );
      case 1:
        return (
          <TextField
            fullWidth
            label="Enter 6-digit OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            inputProps={{ maxLength: 6, inputMode: 'numeric' }}
            disabled={loading}
            sx={{ mb: 2 }}
          />
        );
      case 2:
        return (
          <TextField
            fullWidth
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={loading}
            sx={{ mb: 2 }}
          />
        );
    }
  };

  return (
    <Box sx={{ pt: 12, minHeight: "80vh", display: "flex", alignItems: "center" }}>
      <Container maxWidth="sm">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Paper sx={{ p: 6, borderRadius: 3 }}>
            <Typography variant="h5" fontWeight={700} mb={4} textAlign="center">
              Reset Password
            </Typography>
            
            <Stepper activeStep={step} sx={{ mb: 4 }}>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>

            {renderStepContent()}
            
            <Box sx={{ mt: 3, display: "flex", gap: 2, flexDirection: { xs: "column", sm: "row" } }}>
              {step > 0 && (
                <Button variant="outlined" onClick={prevStep} disabled={loading}>
                  Back
                </Button>
              )}
              <Button
                fullWidth
                variant="contained"
                onClick={step === 0 ? handleForgotPassword : step === 1 ? handleVerifyOtp : handleResetPassword}
                disabled={loading || (step === 0 && (!email || !!emailError))}
              >
                {loading ? "Loading..." : steps[step].split(' ')[1]}
              </Button>
            </Box>

            <Divider sx={{ my: 3 }} />
            <Button onClick={() => navigate("/login")} variant="text" fullWidth>
              Back to Login
            </Button>
          </Paper>
        </motion.div>
      </Container>
    </Box>
  );
}
