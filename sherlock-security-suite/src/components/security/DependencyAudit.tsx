// src/components/security/DependencyAudit.tsx
import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import {
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
  Avatar,
  IconButton,
  Divider,
  Collapse,
  CircularProgress,
  Tooltip
} from "@mui/material";

import SendIcon from "@mui/icons-material/Send";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import PersonIcon from "@mui/icons-material/Person";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowUp";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowDown";

import { llmQuery, onLLMStream } from "../../services/securityService";
import { useUserStore } from "../../store/userStore";
import { authorizeApprove } from "../../services/projectService";
import { Project } from "../../models/Project";

interface Props {
  project: Project;
  dependencies: string[];
}

export default function DependencyAudit({ project, dependencies }: Props) {
  const user = useUserStore((s) => s.user);
  const isAuthorized = authorizeApprove(user, project);
  const location = useLocation();

  const tooltip = isAuthorized
    ? ""
    : "You can view this page, but cannot perform any security review actions";

  const sessionId = useRef(`dependency-audit-${crypto.randomUUID()}`).current;
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const [chatOpen, setChatOpen] = useState(true);
  const [auditRunning, setAuditRunning] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<
    { from: "user" | "bot"; text: string }[]
  >([]);

  // ✅ Cleanup function
  const cleanup = useCallback(() => {
    console.log("[DEPENDENCY AUDIT] Cleanup started");
    isMountedRef.current = false;
    setAuditRunning(false);
    
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    
    console.log("[DEPENDENCY AUDIT] Cleanup complete");
  }, []);

  // ✅ Setup stream listener with cleanup on unmount
  useEffect(() => {
    console.log("[DEPENDENCY AUDIT] Mounted with sessionId:", sessionId);
    isMountedRef.current = true;

    const unsubscribe = onLLMStream((msg) => {
      if (!isMountedRef.current) {
        console.log("[DEPENDENCY AUDIT] Ignoring stream - unmounted");
        return;
      }

      if (msg.sessionId !== sessionId) return;

      setMessages((prev) => [...prev, { from: "bot", text: msg.chunk }]);
      setAuditRunning(false);
    });

    unsubscribeRef.current = unsubscribe;

    return () => {
      console.log("[DEPENDENCY AUDIT] Unmounting");
      cleanup();
    };
  }, [sessionId, cleanup]);

  // ✅ Cleanup on route change
  useEffect(() => {
    return () => {
      console.log("[DEPENDENCY AUDIT] Route change cleanup");
      cleanup();
    };
  }, [location.pathname, cleanup]);

  // ✅ Safe autoscroll
  useEffect(() => {
    if (!chatOpen || messages.length === 0 || !isMountedRef.current) return;

    chatEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, chatOpen]);

  // Start audit
  async function startAudit() {
    if (!dependencies.length || !isMountedRef.current) return;

    setAuditRunning(true);

    try {
      await llmQuery(
        sessionId,
        `Scan these dependencies for vulnerabilities:\n${dependencies.join("\n")}`
      );
    } catch (err) {
      console.error("[DEPENDENCY AUDIT] Audit error:", err);
      if (isMountedRef.current) {
        setAuditRunning(false);
      }
    }
  }

  // Send message
  async function send() {
    if (!input.trim() || !isMountedRef.current) return;

    const text = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { from: "user", text }]);

    try {
      await llmQuery(sessionId, text);
    } catch (err) {
      console.error("[DEPENDENCY AUDIT] Send error:", err);
    }
  }

  // Handle Enter key
  function handleKeyPress(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <Paper sx={{ p: 3, mt: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography fontWeight={700} variant="h6">
          Dependency Audit
        </Typography>

        <Stack direction="row" spacing={1}>
          <Tooltip title={tooltip}>
            <span>
              <Button
                startIcon={<PlayArrowIcon />}
                onClick={startAudit}
                disabled={!isAuthorized || auditRunning || dependencies.length === 0}
                variant="contained"
              >
                Run Audit
              </Button>
            </span>
          </Tooltip>

          <IconButton onClick={() => setChatOpen(!chatOpen)}>
            {chatOpen ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </Stack>
      </Stack>

      <Divider sx={{ my: 2 }} />

      <Collapse in={chatOpen}>
        <Paper sx={{ p: 2 }}>
          {auditRunning && (
            <Stack direction="row" spacing={1} alignItems="center" mb={1}>
              <CircularProgress size={18} />
              <Typography variant="caption">
                Scanning dependencies...
              </Typography>
            </Stack>
          )}

          <Box maxHeight={260} overflow="auto" mb={2}>
            {messages.length === 0 && (
              <Typography color="text.secondary" textAlign="center" py={3}>
                No messages yet. Click "Run Audit" to start analyzing dependencies.
              </Typography>
            )}

            {messages.map((m, i) => (
              <Stack
                key={i}
                direction="row"
                justifyContent={m.from === "user" ? "flex-end" : "flex-start"}
                spacing={1.2}
                mb={1.6}
              >
                {m.from === "bot" && (
                  <Avatar sx={{ width: 26, height: 26 }}>
                    <SmartToyIcon fontSize="small" />
                  </Avatar>
                )}

                <Box
                  sx={{
                    px: 1.5,
                    py: 1,
                    borderRadius: 3,
                    bgcolor: m.from === "user" ? "#2563eb" : "#2c2f38",
                    color: "#fff",
                    maxWidth: "70%",
                    fontSize: 13,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {m.text}
                </Box>

                {m.from === "user" && (
                  <Avatar sx={{ width: 26, height: 26 }}>
                    <PersonIcon fontSize="small" />
                  </Avatar>
                )}
              </Stack>
            ))}

            <div ref={chatEndRef} />
          </Box>

          <Stack direction="row" spacing={1.5}>
            <TextField
              fullWidth
              size="small"
              placeholder="Ask about dependencies..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={!isAuthorized}
            />

            <Tooltip title={tooltip}>
              <span>
                <IconButton 
                  color="primary" 
                  onClick={send}
                  disabled={!isAuthorized || !input.trim()}
                >
                  <SendIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Paper>
      </Collapse>
    </Paper>
  );
}
