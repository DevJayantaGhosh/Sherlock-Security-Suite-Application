// src/components/projects/DependencyAudit.tsx

import {
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
  Avatar,
  IconButton,
  Chip,
  Collapse
} from "@mui/material";
import { useEffect, useRef, useState } from "react";

import SmartToyIcon from "@mui/icons-material/SmartToy";
import PersonIcon from "@mui/icons-material/Person";
import SendIcon from "@mui/icons-material/Send";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";

import { llmQuery, onLLMStream } from "../../services/securityService";

interface Props {
  dependencies: string[];
}

export default function DependencyAudit({ dependencies }: Props) {

  const [current, setCurrent] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(true);

  const bottomRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");

  const [messagesByDep, setMessagesByDep] = useState<
    Record<string, { from: "user" | "bot"; text: string }[]>
  >({});

  /* Auto-scroll chat */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [current, messagesByDep]);

  /* LLM streaming */
  useEffect(() => {
    return onLLMStream((msg) => {
      if (!current || msg.sessionId !== `dep-${current}`) return;

      setMessagesByDep((m) => ({
        ...m,
        [current]: [...(m[current] || []), { from: "bot", text: msg.chunk }]
      }));
    });
  }, [current]);

  async function send() {
    if (!input || !current) return;

    setMessagesByDep((m) => ({
      ...m,
      [current]: [...(m[current] || []), { from: "user", text: input }]
    }));

    await llmQuery(`dep-${current}`, input);
    setInput("");
  }

  function selectDep(dep: string) {
    setCurrent(dep);
    setChatOpen(true);
  }

  return (
    <Paper sx={{ p: 2, mt: 4 }}>

      {/* ✅ TITLE + BADGE */}
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="h6">
          Dependency Audit (Interactive)
        </Typography>

        <Chip
          label={`Dependencies: ${dependencies?.length ?? 0}`}
          color="primary"
        />
      </Stack>

      {/* Dependency selector */}
      <Stack direction="row" spacing={2} mt={2}>
        {dependencies.map((d) => (
          <Button
            key={d}
            variant={current === d ? "contained" : "outlined"}
            onClick={() => selectDep(d)}
          >
            {d}
          </Button>
        ))}
      </Stack>

      {/* ✅ Collapse Toggle + Header */}
      {current && (
        <Box mt={2}>

          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
          >
            <Typography>
              Auditing: <b>{current}</b>
            </Typography>

            <IconButton onClick={() => setChatOpen(o => !o)}>
              {chatOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Stack>

          {/* ✅ CHAT COLLAPSE */}
          <Collapse in={chatOpen}>
            <Box mt={1}>

              <Box sx={{ maxHeight: 260, overflow: "auto", mb: 1 }}>
                {(messagesByDep[current] || []).map((m, i) => (
                  <Stack
                    key={i}
                    direction="row"
                    justifyContent={m.from === "user" ? "flex-end" : "flex-start"}
                    spacing={1}
                    mb={1}
                  >

                    {m.from === "bot" && (
                      <Avatar sx={{ width: 28, height: 28 }}>
                        <SmartToyIcon />
                      </Avatar>
                    )}

                    <Box
                      sx={{
                        bgcolor: m.from === "user" ? "#1976d2" : "#2c2f38",
                        color: "#fff",
                        px: 1.2,
                        py: 0.8,
                        borderRadius: 2,
                        maxWidth: "70%"
                      }}
                    >
                      {m.text}
                    </Box>

                    {m.from === "user" && (
                      <Avatar sx={{ width: 28, height: 28 }}>
                        <PersonIcon />
                      </Avatar>
                    )}

                  </Stack>
                ))}

                <div ref={bottomRef} />
              </Box>

              {/* Input */}
              <Stack direction="row" spacing={1}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder={`Ask about ${current}`}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                />

                <IconButton onClick={send}>
                  <SendIcon />
                </IconButton>
              </Stack>

            </Box>
          </Collapse>

        </Box>
      )}

    </Paper>
  );
}
