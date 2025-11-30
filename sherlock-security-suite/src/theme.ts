import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "dark",
    background: { default: "#060712", paper: "#0b0f1a" },
    primary: { main: "#7b5cff" },
    secondary: { main: "#5ce1e6" },
    text: { primary: "#ffffff", secondary: "#aab3c5" },
  },
  typography: { fontFamily: 'Inter, Roboto, Helvetica, Arial, sans-serif' },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', borderRadius: 12, fontWeight: 700 },
        containedPrimary: {
          background: 'linear-gradient(90deg,#7b5cff 0%, #5ce1e6 100%)',
          boxShadow: '0 10px 30px rgba(92,225,230,0.08)'
        }
      }
    }
  }
});

export default theme;
