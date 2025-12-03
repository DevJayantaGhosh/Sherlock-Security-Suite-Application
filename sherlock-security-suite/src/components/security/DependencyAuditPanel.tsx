// src/components/projects/DependencyAudit.tsx

import { Box, Button, Paper, Stack, TextField, Typography, Avatar, IconButton } from "@mui/material";
import { useEffect, useRef, useState } from "react";

import SmartToyIcon from "@mui/icons-material/SmartToy";
import PersonIcon from "@mui/icons-material/Person";
import SendIcon from "@mui/icons-material/Send";

import { llmQuery, onLLMStream } from "../../services/securityService";

interface Props {
  dependencies: string[];
}

export default function DependencyAudit({ dependencies }: Props) {

  const [current, setCurrent] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const [input, setInput] = useState("");

  const [messagesByDep, setMessagesByDep] = useState<
    Record<string, { from: "user" | "bot"; text: string }[]>
  >({});

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [current, messagesByDep]);

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

  return (
    <Paper sx={{ p: 2, mt: 4 }}>

      <Typography variant="h6">Dependency Audit (Interactive)</Typography>

      <Stack direction="row" spacing={2} mt={2}>
        {dependencies.map((d) => (
          <Button
            key={d}
            variant={current === d ? "contained" : "outlined"}
            onClick={() => setCurrent(d)}
          >
            {d}
          </Button>
        ))}
      </Stack>

      {current && (
        <Box mt={2}>

          <Typography>Auditing: <b>{current}</b></Typography>

          <Box sx={{ maxHeight: 260, overflow: "auto", mt: 1 }}>
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

          <Stack direction="row" spacing={1} mt={1}>
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
      )}

    </Paper>
  );
}
