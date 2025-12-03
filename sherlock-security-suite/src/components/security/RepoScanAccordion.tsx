// src/components/projects/RepoAccordion.tsx
import { useEffect, useRef, useState } from "react";
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Box,
  Button,
  IconButton,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
  Avatar,
  Divider,
  Collapse
} from "@mui/material";

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ReplayIcon from "@mui/icons-material/Replay";
import DownloadIcon from "@mui/icons-material/Download";
import SendIcon from "@mui/icons-material/Send";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import PersonIcon from "@mui/icons-material/Person";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";

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
  branch: string;
  gpg: any;
}

const steps = [
  "Signature Verification",
  "Repository Scan By LLM",
];

export default function RepoScanAccordion({
  projectId,
  repoIndex,
  repoUrl,
  branch
}: Props) {

  const sessionId = `repo-${projectId}-${repoIndex}`;

  const bottomRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState(0);

  const [repoRunning, setRepoRunning] = useState(false);
  const [repoFailed, setRepoFailed] = useState(false);
  const [llmRunning, setLlmRunning] = useState(false);
  const [llmFailed, setLlmFailed] = useState(false);

  const [repoLogsOpen, setRepoLogsOpen] = useState(true);
  const [llmLogsOpen, setLlmLogsOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(true);

  const [logsRepo, setLogsRepo] = useState<string[]>([]);
  const [logsLLM, setLogsLLM] = useState<string[]>([]);

  const [messages, setMessages] = useState<
    { from: "user" | "bot"; text: string }[]
  >([]);

  const [input, setInput] = useState("");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const a = onScanProgress((e) => {
      if (e.repo !== repoUrl) return;

      if (e.step === "verify-gpg") {
        setRepoRunning(e.status === "running");
        setRepoFailed(e.status === "failed");
        if (e.logs) setLogsRepo(l => [...l, ...e.logs]);
        if (e.status === "success") setStep(1);
      }

      if (e.step === "llm-scan") {
        setLlmRunning(e.status === "running");
        setLlmFailed(e.status === "failed");
        if (e.logs) setLogsLLM(l => [...l, ...e.logs]);
        if (e.status === "success") setStep(2);
      }
    });

    const b = onLLMStream((msg) => {
      if (msg.sessionId !== sessionId) return;
      setMessages(m => [...m, { from: "bot", text: msg.chunk }]);
    });

    return () => {
      a();
      b();
    };

  }, [repoUrl, sessionId]);

  async function runRepo() {
    setRepoFailed(false);
    setLogsRepo([]);
    setStep(0);
    await runRepoScan(projectId, repoIndex, repoUrl, branch);
  }

  async function runLLM() {
    setLlmFailed(false);
    setLogsLLM([]);
    await runRepoScan(projectId, repoIndex, repoUrl, branch);
  }

  async function send() {
    if (!input.trim()) return;
    setMessages(m => [...m, { from: "user", text: input }]);
    setInput("");
    await llmQuery(sessionId, input);
  }

  function download(logs: string[], name: string) {
    const blob = new Blob([logs.join("\n")], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
  }

  const LogBox = ({ logs }: { logs: string[] }) => (
    <Paper sx={{
      bgcolor: "#070b17",
      border: "1px solid #2a36ff60",
      boxShadow: "0 0 12px #2a36ff44",
      color: "#e5e5ff",
      fontFamily: "JetBrains Mono, monospace",
      fontSize: "12px",
      p: 1.5,
      maxHeight: 220,
      overflow: "auto"
    }}>
      {logs.map((x, i) => (
        <Typography key={i} fontSize={12}>{x}</Typography>
      ))}
    </Paper>
  );

  return (

    <Accordion defaultExpanded>

      {/* ---------- HEADER ---------- */}
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>

        <Stack width="100%" justifyContent="space-between" direction="row">

          <Box>
            <Typography fontWeight={700}>{repoUrl}</Typography>
            <Typography variant="caption" color="text.secondary">
              Branch: {branch}
            </Typography>
          </Box>

          <Stepper activeStep={step} sx={{ width: 520 }} alternativeLabel>
            {steps.map(s => (
              <Step key={s}>
                <StepLabel>{s}</StepLabel>
              </Step>
            ))}
          </Stepper>

        </Stack>

      </AccordionSummary>

      <AccordionDetails>

        {/* ---------- REPO SIGNATURE SCAN ---------- */}

        <Stack direction="row" alignItems="center" justifyContent="space-between">

          <Typography fontWeight={600}>
            Repository Commit Signature Verification
          </Typography>

          <Stack direction="row" spacing={1} alignItems="center">

            <Button startIcon={<PlayArrowIcon />} onClick={runRepo} disabled={repoRunning} variant="contained">
              Run
            </Button>

            {repoFailed && (
              <Button startIcon={<ReplayIcon />} onClick={runRepo} color="error">
                Retry
              </Button>
            )}

            <Button startIcon={<DownloadIcon />} onClick={() => download(logsRepo, "repo.log")}>
              Logs
            </Button>

            <IconButton onClick={() => setRepoLogsOpen(!repoLogsOpen)}>
              {repoLogsOpen ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
            </IconButton>

          </Stack>

        </Stack>

        <Collapse in={repoLogsOpen} unmountOnExit>
          <Box mt={1}>
            <LogBox logs={logsRepo} />
          </Box>
        </Collapse>

        <Divider sx={{ my: 2 }} />

        {/* ---------- LLM SCAN ---------- */}

        <Stack direction="row" alignItems="center" justifyContent="space-between">

          <Typography fontWeight={600}>
            LLM Vulnerability Scan
          </Typography>

          <Stack direction="row" spacing={1} alignItems="center">

            <Button startIcon={<PlayArrowIcon />} onClick={runLLM} disabled={llmRunning} variant="contained">
              Run
            </Button>

            {llmFailed && (
              <Button startIcon={<ReplayIcon />} onClick={runLLM} color="error">
                Retry
              </Button>
            )}

            <Button startIcon={<DownloadIcon />} onClick={() => download(logsLLM, "llm.log")}>
              Logs
            </Button>

            <IconButton onClick={() => setLlmLogsOpen(!llmLogsOpen)}>
              {llmLogsOpen ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
            </IconButton>

          </Stack>

        </Stack>

        <Collapse in={llmLogsOpen} unmountOnExit>
          <Box mt={1}>
            <LogBox logs={logsLLM} />
          </Box>
        </Collapse>

        <Divider sx={{ my: 2 }} />

        {/* ---------- CHAT ---------- */}

        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography fontWeight={600}>Security LLM Chat</Typography>

          <IconButton onClick={() => setChatOpen(!chatOpen)}>
            {chatOpen ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </Stack>

        <Collapse in={chatOpen} unmountOnExit>
          <Paper sx={{ p: 2, mt: 1 }}>

            <Box sx={{ maxHeight: 300, overflow: "auto", mb: 1 }}>

              {messages.map((m, i) => (
                <Stack
                  key={i}
                  direction="row"
                  justifyContent={m.from === "user" ? "flex-end" : "flex-start"}
                  spacing={1}
                  mb={1}
                >

                  {m.from === "bot" && (
                    <Avatar sx={{ width: 26, height: 26 }}>
                      <SmartToyIcon fontSize="small" />
                    </Avatar>
                  )}

                  <Box sx={{
                    bgcolor: m.from === "user" ? "#1976d2" : "#262a35",
                    px: 1.5,
                    py: 1,
                    borderRadius: 2,
                    maxWidth: "70%",
                    color: "#fff",
                    fontSize: 13
                  }}>
                    {m.text}
                  </Box>

                  {m.from === "user" && (
                    <Avatar sx={{ width: 26, height: 26 }}>
                      <PersonIcon fontSize="small" />
                    </Avatar>
                  )}

                </Stack>
              ))}

              <div ref={bottomRef} />

            </Box>

            <Stack direction="row" spacing={1}>
              <TextField
                fullWidth
                size="small"
                placeholder="Ask the LLM..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <IconButton onClick={send} color="primary">
                <SendIcon />
              </IconButton>
            </Stack>

          </Paper>
        </Collapse>

      </AccordionDetails>

    </Accordion>
  );
}
