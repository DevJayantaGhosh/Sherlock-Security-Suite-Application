import React, { createContext, useContext, useState } from "react";
import { Snackbar, Alert } from "@mui/material";

type ToastState = { open: boolean; message: string; severity?: "success" | "info" | "warning" | "error" };

const ToastContext = createContext<(msg: string, sev?: ToastState["severity"]) => void>(() => {});

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [t, setT] = useState<ToastState>({ open: false, message: "" });

  function show(message: string, severity: ToastState["severity"] = "info") {
    setT({ open: true, message, severity });
  }

  return (
    <ToastContext.Provider value={show}>
      {children}
      <Snackbar open={t.open} onClose={() => setT(s => ({ ...s, open: false }))} autoHideDuration={3000} anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
        <Alert severity={t.severity} variant="filled" onClose={() => setT(s => ({ ...s, open: false }))}>
          {t.message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
