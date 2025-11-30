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
      <App />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#0b0f20",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.1)"
          }
        }}
      />
    </ThemeProvider>
  </React.StrictMode>
);
