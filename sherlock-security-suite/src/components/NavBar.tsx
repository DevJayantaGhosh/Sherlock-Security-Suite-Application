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
  useMediaQuery,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useTheme } from "@mui/material/styles";

import { logoutLocal } from "../services/userService";
import { useUserStore } from "../store/userStore";

export default function NavBar() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const user = useUserStore((s) => s.user);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const openUserMenu = Boolean(anchorEl);

  const handleAvatarClick = (e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
  };

  const handleLogout = () => {
    logoutLocal();
    setAnchorEl(null);
    navigate("/login");
  };

  const commonLinks = [
    { label: "Home", path: "/" },
    { label: "About", path: "/about" },
    { label: "Projects", path: "/projects" },
  ];

  const adminLinks = [{ label: "Admin", path: "/admin" }];

  const links = [...commonLinks, ...(user?.role === "Admin" ? adminLinks : [])];

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
            minHeight: "64px !important",
            display: "flex",
            alignItems: "center",
          }}
        >
          {/* Window Drag Region */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              flexGrow: 1,
              WebkitAppRegion: "drag",
            }}
          >
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }}>
              <Box
                component="span"
                sx={{
                  width: 42,
                  height: 42,
                  borderRadius: 2,
                  background: "linear-gradient(135deg,#7b5cff,#5ce1e6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
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
                ml: 2,
                WebkitAppRegion: "no-drag",
              }}
            >
              Sherlock Security
            </Typography>
          </Box>

          {/* Desktop Links */}
          {!isMobile && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              {links.map((l) => (
                <Button key={l.path} component={Link} to={l.path} color="inherit">
                  {l.label}
                </Button>
              ))}

              {!user ? (
                <Button component={Link} to="/login" color="inherit">
                  Login
                </Button>
              ) : (
                <IconButton onClick={handleAvatarClick}>
                  <Avatar sx={{ bgcolor: "primary.main" }}>
                    {user.name.charAt(0)}
                  </Avatar>
                </IconButton>
              )}
            </Box>
          )}

          {/* Mobile Hamburger */}
          {isMobile && (
            <IconButton
              color="inherit"
              sx={{ WebkitAppRegion: "no-drag" }}
              onClick={() => setDrawerOpen(true)}
            >
              <MenuIcon />
            </IconButton>
          )}
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <List sx={{ width: 260 }}>
          {links.map((l) => (
            <ListItem key={l.path} disablePadding>
              <ListItemButton component={Link} to={l.path} onClick={() => setDrawerOpen(false)}>
                <ListItemText primary={l.label} />
              </ListItemButton>
            </ListItem>
          ))}

          {!user ? (
            <ListItem disablePadding>
              <ListItemButton component={Link} to="/login" onClick={() => setDrawerOpen(false)}>
                <ListItemText primary="Login" />
              </ListItemButton>
            </ListItem>
          ) : (
            <>
              <ListItem>
                <ListItemText primary={user.email} secondary={`Role: ${user.role}`} />
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

      {/* Avatar Menu */}
      <Menu anchorEl={anchorEl} open={openUserMenu} onClose={() => setAnchorEl(null)}>
        <MenuItem disabled>
          {user?.name} — {user?.role}
        </MenuItem>
        <MenuItem onClick={handleLogout}>Logout</MenuItem>
      </Menu>
    </>
  );
}
