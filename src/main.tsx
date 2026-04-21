import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './theme';
import './index.css';
import { Toaster } from "react-hot-toast";

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />

      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#0b0f20",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.08)",
          },
          success: {
            style: {
              background: "linear-gradient(133deg,#18c964,#13b97b)",
            },
          },
          error: {
            style: {
              background: "linear-gradient(133deg,#ff4d4f,#ff1a40)",
            },
          },
        }}
      />

      <App />
    </ThemeProvider>
  </React.StrictMode>
);
