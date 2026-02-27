// src/components/NavBar.tsx
import { useState } from "react";
import {
  AppBar,
  Toolbar,
  Box,
  Typography,
  Button,
  IconButton,
  Avatar,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  useMediaQuery
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import MinimizeIcon from "@mui/icons-material/HorizontalRuleRounded";
import MaximizeIcon from "@mui/icons-material/CheckBoxOutlineBlankRounded";
import CloseIcon from "@mui/icons-material/CloseRounded";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useTheme } from "@mui/material/styles";

import { logout } from "../services/userService";
import { useUserStore } from "../store/userStore";

export default function NavBar() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const user = useUserStore((s) => s.user);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const openUserMenu = Boolean(anchorEl);

  const commonLinks = [
    { label: "Home", path: "/" },
    { label: "About", path: "/about" },
    { label: "Products", path: "/products" },
    { label: "Quick-Scan", path: "/quick-security-scan" },
    { label: "Digital-Signing", path: "/quick-crypto-sign" },
  ];

  const adminLinks = [{ label: "Admin", path: "/admin" }];
  const links = [...commonLinks, ...(user?.role === "Admin" ? adminLinks : [])];

  const handleLogout = () => {
    logout();
    setAnchorEl(null);
    navigate("/login");
  };

  return (
    <>
      <AppBar
        elevation={4}
        position="fixed"
        sx={{
          height: 64,
          background: "rgba(6,7,18,0.86)",
          backdropFilter: "blur(6px)",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
        }}
      >
        <Toolbar
          sx={{
            height: 64,
            minHeight: "64px !important",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          {/* LEFT DRAG REGION */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              WebkitAppRegion: "drag"
            }}
          >
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }}>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 2,
                  background: "linear-gradient(135deg,#7b5cff,#5ce1e6)",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 900,
                  color: "#081026",
                }}
              >
                S
              </Box>
            </motion.div>

            <Typography
              variant="h6"
              sx={{
                fontWeight: 800,
                WebkitAppRegion: "no-drag",
              }}
            >
              Sherlock Security Suite
            </Typography>

            {!isMobile && (
              <Box sx={{ ml: 3, display: "flex", gap: 2, WebkitAppRegion: "no-drag" }}>
                {links.map((l) => (
                  <Button
                    key={l.path}
                    component={Link}
                    to={l.path}
                    color="inherit"
                  >
                    {l.label}
                  </Button>
                ))}
              </Box>
            )}
          </Box>

          {/* RIGHT - AUTH & WINDOW CONTROLS */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              WebkitAppRegion: "no-drag"
            }}
          >
            {!user ? (
              <Button component={Link} to="/login" color="inherit">
                Login
              </Button>
            ) : (
              <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
                <Avatar sx={{ bgcolor: "primary.main" }}>
                  {user.name.charAt(0).toLocaleUpperCase()}
                </Avatar>
              </IconButton>
            )}

            {isMobile && (
              <IconButton
                color="inherit"
                onClick={() => setDrawerOpen(true)}
              >
                <MenuIcon />
              </IconButton>
            )}

            {/* WINDOW BUTTONS */}
            <IconButton size="small" onClick={() => window.electronWindow.minimize()}>
              <MinimizeIcon fontSize="small" />
            </IconButton>

            <IconButton size="small" onClick={() => window.electronWindow.maximize()}>
              <MaximizeIcon fontSize="small" />
            </IconButton>

            <IconButton
              size="small"
              sx={{ color: "#ff6b6b" }}
              onClick={() => window.electronWindow.close()}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      {/* MOBILE DRAWER */}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <List sx={{ width: 260 }}>
          {links.map((l) => (
            <ListItem key={l.path} disablePadding>
              <ListItemButton
                component={Link}
                to={l.path}
                onClick={() => setDrawerOpen(false)}
              >
                <ListItemText primary={l.label} />
              </ListItemButton>
            </ListItem>
          ))}

          {!user ? (
            <ListItem disablePadding>
              <ListItemButton
                component={Link}
                to="/login"
                onClick={() => setDrawerOpen(false)}
              >
                <ListItemText primary="Login" />
              </ListItemButton>
            </ListItem>
          ) : (
            <>
              <ListItem>
                <ListItemText primary={user.email} secondary={user.role} />
              </ListItem>
              <ListItem disablePadding>
                <ListItemButton onClick={handleLogout}>
                  <ListItemText primary="Logout" />
                </ListItemButton>
              </ListItem>
            </>
          )}
        </List>
      </Drawer>

      {/* USER MENU */}
      <Menu
        anchorEl={anchorEl}
        open={openUserMenu}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem disabled>
          {user?.name} — {user?.role}
        </MenuItem>
        <MenuItem onClick={handleLogout}>Logout</MenuItem>
      </Menu>
    </>
  );
}
