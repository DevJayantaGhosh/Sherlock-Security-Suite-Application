// src/components/projects/RepoAccordion.tsx
import  { useEffect, useMemo, useRef, useState } from "react";
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Stack,
  Stepper,
  Step,
  StepLabel,
  Typography,
  Avatar,
  TextField,
  Collapse
} from "@mui/material";

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ReplayIcon from "@mui/icons-material/Replay";
import ArticleIcon from "@mui/icons-material/Article";
import SendIcon from "@mui/icons-material/Send";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import PersonIcon from "@mui/icons-material/Person";
import DownloadIcon from "@mui/icons-material/Download";

import {
  runRepoScan,
  llmQuery,
  onScanProgress,
  onLLMStream
} from "../../services/securityService";

interface Props {
  projectId: string;
  repoIndex: number;
  repoUrl: string;
  branch: string;               // <-- NEW
  gpg: any;
  depsCount?: number;
}

export default function RepoScanAccordion({
  projectId,
  repoIndex,
  repoUrl,
  branch,
  gpg,
  depsCount = 0
}: Props) {
  const sessionId = useMemo(
    () => `repo-${projectId}-${repoIndex}`,
    [projectId, repoIndex]
  );

  const [expanded, setExpanded] = useState(true);

  // Status flags
  const [repoRunning, setRepoRunning] = useState(false);
  const [repoFailed, setRepoFailed] = useState(false);

  const [llmRunning, setLlmRunning] = useState(false);
  const [llmFailed, setLlmFailed] = useState(false);

  // Logs
  const [logsRepo, setLogsRepo] = useState<string[]>([]);
  const [logsLLM, setLogsLLM] = useState<string[]>([]);

  // Collapse toggles
  const [showRepoLogs, setShowRepoLogs] = useState(true);
  const [showLLMLogs, setShowLLMLogs] = useState(true);
  const [showChat, setShowChat] = useState(true);

  // Chat
  const [messages, setMessages] = useState<
    { from: "user" | "bot"; text: string }[]
  >([]);

  const [input, setInput] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), [messages]);

  // Subscribe to scan events
  useEffect(() => {
    const unsub1 = onScanProgress((ev) => {
      if (ev.repo !== repoUrl) return;

      if (ev.step === "verify-gpg") {
        setRepoRunning(ev.status === "running");
        setRepoFailed(ev.status === "failed");
        setLogsRepo((prev) => [...prev, ...ev.logs]);
      }

      if (ev.step === "llm-scan") {
        setLlmRunning(ev.status === "running");
        setLlmFailed(ev.status === "failed");
        setLogsLLM((prev) => [...prev, ...ev.logs]);
      }
    });

    const unsub2 = onLLMStream((msg) => {
      if (msg.sessionId !== sessionId) return;
      setMessages((m) => [...m, { from: "bot", text: msg.chunk }]);
    });

    return () => {
      unsub1();
      unsub2();
    };
  }, [repoUrl, sessionId]);

  async function runRepo() {
    setRepoRunning(true);
    setRepoFailed(false);
    setLogsRepo([]);
    await runRepoScan(projectId, repoIndex, repoUrl, branch);
  }

  async function runLLM() {
    setLlmRunning(true);
    setLlmFailed(false);
    setLogsLLM([]);
    await runRepoScan(projectId, repoIndex, repoUrl, branch);
  }

  async function send() {
    if (!input.trim()) return;
    setMessages((m) => [...m, { from: "user", text: input }]);
    await llmQuery(sessionId, input);
    setInput("");
  }

  function download(text: string[], filename: string) {
    const blob = new Blob([text.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const LogBox = ({ logs }: { logs: string[] }) => (
    <Paper
      sx={{
        bgcolor: "#0c0f17",
        fontSize: "12px",
        fontFamily: "JetBrains Mono, monospace",
        border: "1px solid #1e2638",
        p: 1.3,
        maxHeight: 220,
        overflow: "auto",
        whiteSpace: "pre-wrap"
      }}
    >
      {logs.join("\n")}
    </Paper>
  );

  return (
    <Accordion expanded={expanded} onChange={() => setExpanded(!expanded)}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography fontWeight={700}>{repoUrl} ({branch})</Typography>
      </AccordionSummary>

      <AccordionDetails>

        {/* ------------------ GPG Scan ------------------ */}
        <Stack direction="row" justifyContent="space-between" mb={1}>
          <Typography fontWeight={600}>Repo Signature Verification</Typography>

          <Stack direction="row" spacing={1}>
            <Button
              startIcon={<PlayArrowIcon />}
              onClick={runRepo}
              disabled={repoRunning}
              variant="contained"
            >Run</Button>

            {repoFailed && (
              <Button startIcon={<ReplayIcon />} onClick={runRepo}>
                Retry
              </Button>
            )}

            <Button
              startIcon={<DownloadIcon />}
              onClick={() => download(logsRepo, "repo-scan.log")}
            >
              Download Logs
            </Button>

            <Button
              startIcon={<ArticleIcon />}
              onClick={() => setShowRepoLogs(!showRepoLogs)}
            >
              {showRepoLogs ? "Hide Logs" : "Show Logs"}
            </Button>
          </Stack>
        </Stack>

        <Collapse in={showRepoLogs}>
          <LogBox logs={logsRepo} />
        </Collapse>



        {/* ------------------ LLM Scan ------------------ */}
        <Stack direction="row" justifyContent="space-between" mt={3} mb={1}>
          <Typography fontWeight={600}>LLM Security Scan</Typography>

          <Stack direction="row" spacing={1}>
            <Button
              startIcon={<PlayArrowIcon />}
              onClick={runLLM}
              disabled={llmRunning}
              variant="contained"
            >Run</Button>

            {llmFailed && (
              <Button startIcon={<ReplayIcon />} onClick={runLLM}>
                Retry
              </Button>
            )}

            <Button
              startIcon={<DownloadIcon />}
              onClick={() => download(logsLLM, "llm-scan.log")}
            >
              Download Logs
            </Button>

            <Button
              startIcon={<ArticleIcon />}
              onClick={() => setShowLLMLogs(!showLLMLogs)}
            >
              {showLLMLogs ? "Hide Logs" : "Show Logs"}
            </Button>
          </Stack>
        </Stack>

        <Collapse in={showLLMLogs}>
          <LogBox logs={logsLLM} />
        </Collapse>



        {/* ------------------ Chat ------------------ */}
        <Stack direction="row" justifyContent="space-between" mt={3}>
          <Typography fontWeight={600}>Security LLM Chat</Typography>

          <Button onClick={() => setShowChat(!showChat)}>
            {showChat ? "Hide Chat" : "Show Chat"}
          </Button>
        </Stack>

        <Collapse in={showChat}>
          <Paper sx={{ mt: 1, p: 2 }}>
            <Box sx={{ maxHeight: 240, overflow: "auto" }}>
              {messages.map((m, i) => (
                <Stack
                  key={i}
                  direction="row"
                  spacing={1}
                  justifyContent={m.from === "user" ? "flex-end" : "flex-start"}
                  mb={1}
                >
                  {m.from === "bot" && (
                    <Avatar sx={{ width: 28, height: 28 }}>
                      <SmartToyIcon fontSize="small" />
                    </Avatar>
                  )}

                  <Box
                    sx={{
                      bgcolor: m.from === "user" ? "#1976d2" : "#2c2f38",
                      px: 1.2,
                      py: 0.8,
                      borderRadius: 2,
                      maxWidth: "75%",
                      color: "#fff"
                    }}
                  >
                    {m.text}
                  </Box>

                  {m.from === "user" && (
                    <Avatar sx={{ width: 28, height: 28 }}>
                      <PersonIcon fontSize="small" />
                    </Avatar>
                  )}
                </Stack>
              ))}
              <div ref={bottomRef} />
            </Box>

            <Stack direction="row" mt={1} spacing={1}>
              <TextField
                fullWidth
                size="small"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask the LLM..."
              />
              <IconButton onClick={send}>
                <SendIcon />
              </IconButton>
            </Stack>
          </Paper>
        </Collapse>

      </AccordionDetails>
    </Accordion>
  );
}
