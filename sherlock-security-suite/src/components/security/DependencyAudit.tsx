// src/components/security/DependencyAudit.tsx

import { useEffect, useRef, useState } from "react";
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
  project: Project
  dependencies: string[];
}

export default function DependencyAudit({ project, dependencies }: Props) {
  const user = useUserStore((s) => s.user);
  const isAuthorized = authorizeApprove(user, project);

  const tooltip = isAuthorized
    ? ""
    : "You can view this page, but cannot perform any security review actions";

  const sessionId = "dependency-audit";

  const chatEndRef = useRef<HTMLDivElement>(null);

  const [chatOpen, setChatOpen] = useState(true);
  const [auditRunning, setAuditRunning] = useState(false);
  const [input, setInput] = useState("");

  const [messages, setMessages] = useState<
    { from: "user" | "bot"; text: string }[]
  >([]);

  /* ✅ SAFE STREAM HANDLER — NO LOOP, NO DELAY */

  useEffect(() => {

    const unsubscribe = onLLMStream((msg) => {

      if (msg.sessionId !== sessionId) return;

      setMessages((prev) => [...prev, { from: "bot", text: msg.chunk }]);

      setAuditRunning(false);
    });

    return () => unsubscribe?.();

  }, []);

  /* ✅ SAFE AUTOSCROLL */

  useEffect(() => {

    if (!chatOpen || messages.length === 0) return;

    chatEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });

  }, [messages, chatOpen]);

  /* ------------------ */

  async function startAudit() {

    if (!dependencies.length) return;

    setAuditRunning(true);

    await llmQuery(
      sessionId,
      `Scan these dependencies for vulnerabilities:\n${dependencies.join("\n")}`
    );
  }

  async function send() {

    if (!input.trim()) return;

    const text = input.trim();

    setInput("");
    setMessages((prev) => [...prev, { from: "user", text }]);

    await llmQuery(sessionId, text);
  }

  /* ------------------ */

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
              onChange={e => setInput(e.target.value)}
            />

            <Tooltip title={tooltip}>
              <span>
                <IconButton color="primary" onClick={send}>
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
