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
  Collapse,
  CircularProgress
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
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

import {
  runRepoScan,
  llmQuery,
  onScanProgress,
  onLLMStream,
  ScanProgress
} from "../../services/securityService";

/* ---------------------------------------------------------------- */

interface Props {
  projectId: string;
  repoIndex: number;
  repoUrl: string;
  branch: string;
  gpg?: string;
}

type StepStatus = "idle" | "running" | "success" | "failed" | "done";

const steps = ["Signature Verification", "Repository Scan (LLM)"];

/* ---------------------------------------------------------------- */

function StepStateIcon({ state, index }: { state: StepStatus; index: number }) {
  if (state === "running") return <CircularProgress size={18} />;
  if (state === "success" || state === "done")
    return <CheckCircleIcon color="success" fontSize="small" />;
  if (state === "failed")
    return <CancelIcon color="error" fontSize="small" />;

  return (
    <Box
      sx={{
        width: 22,
        height: 22,
        borderRadius: "50%",
        border: "1px solid #7c3aed",
        color: "#c7d2fe",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontSize: 12,
      }}
    >
      {index + 1}
    </Box>
  );
}

/* ---------------------------------------------------------------- */

export default function RepoScanAccordion({
  projectId,
  repoIndex,
  repoUrl,
  branch,
  gpg,
}: Props) {

  const sessionId = `repo-${projectId}-${repoIndex}`;

  const chatRef = useRef<HTMLDivElement>(null);

  const [sigStatus, setSigStatus] = useState<StepStatus>("idle");
  const [llmStatus, setLlmStatus] = useState<StepStatus>("idle");

  const [repoRunning, setRepoRunning] = useState(false);
  const [repoFailed, setRepoFailed] = useState(false);

  const [llmRunning, setLlmRunning] = useState(false);
  const [llmFailed, setLlmFailed] = useState(false);

  const [repoLogs, setRepoLogs] = useState<string[]>([]);
  const [llmLogs, setLlmLogs] = useState<string[]>([]);

  const [repoLogsOpen, setRepoLogsOpen] = useState(true);
  const [llmLogsOpen, setLlmLogsOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(true);

  const [input, setInput] = useState("");

  const [messages, setMessages] = useState<
    { from: "user" | "bot"; text: string }[]
  >([]);

  /* ---------------------------------------------------------------- */
  /* TOKEN STREAM TYPING ANIMATION */
  /* ---------------------------------------------------------------- */

  async function stream(chunk: string) {
    setMessages(m => [...m, { from: "bot", text: "" }]);

    for (const char of chunk) {
      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1].text += char;
        return copy;
      });

      chatRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end"
      });

      await new Promise(res => setTimeout(res, 12));
    }
  }

  useEffect(() => {
    return onLLMStream((msg) => {
      if (msg.sessionId !== sessionId) return;
      stream(msg.chunk);
    });
  }, [sessionId]);

  /* ---------------------------------------------------------------- */
  /* SCAN PROGRESS */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    return onScanProgress((p: ScanProgress) => {

      if (p.repo !== repoUrl) return;

      const logs = p.logs ?? [];

      if (p.step === "verify-gpg") {
        setSigStatus(p.status);
        setRepoRunning(p.status === "running");
        setRepoFailed(p.status === "failed");

        if (logs.length)
          setRepoLogs(l => [...l, ...logs]);
      }

      if (p.step === "llm-scan") {
        setLlmStatus(p.status);
        setLlmRunning(p.status === "running");
        setLlmFailed(p.status === "failed");

        if (logs.length)
          setLlmLogs(l => [...l, ...logs]);
      }

    });
  }, [repoUrl]);

  /* ---------------------------------------------------------------- */

  async function runRepo() {
    setRepoLogs([]);
    setSigStatus("running");
    await runRepoScan(projectId, repoIndex, repoUrl, branch);
  }

  async function runLLM() {
    if (sigStatus !== "success" && sigStatus !== "done") return;
    setLlmLogs([]);
    setLlmStatus("running");
    await llmQuery(sessionId, "Run LLM vulnerability scan");
  }

  async function send() {
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");

    setMessages(m => [...m, { from: "user", text }]);
    await llmQuery(sessionId, text);
  }

  function download(logs: string[], filename: string) {
    const blob = new Blob([logs.join("\n")], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  }

  function copyGPG() {
    if (gpg) navigator.clipboard.writeText(gpg);
  }

  /* ---------------------------------------------------------------- */

  const LogBox = ({ logs }: { logs: string[] }) => (
    <Paper
      sx={{
        bgcolor: "#05081a",
        border: "1px solid #2a36ff50",
        boxShadow: "0 0 12px #2a36ff44",
        fontFamily: "JetBrains Mono",
        fontSize: 12,
        color: "#dbeafe",
        p: 1,
        maxHeight: 200,
        overflow: "auto"
      }}
    >
      {logs.map((l, i) => (
        <Typography key={i} fontSize={12}>
          {l}
        </Typography>
      ))}
    </Paper>
  );

  /* ---------------------------------------------------------------- */

  return (
    <Accordion defaultExpanded>

      {/* ------------ HEADER ------------ */}
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>

        <Stack spacing={1} width="100%">

          <Typography variant="h6" >Repository Security Scan</Typography>

          <Stack
            direction="row"
            spacing={2}
            alignItems="center"
            justifyContent="space-between"
          >

            <Stack>
              <Typography fontSize={14}>{repoUrl}</Typography>
              <Typography variant="caption" color="text.secondary">
                Branch: {branch}
              </Typography>
            </Stack>

            <Stepper sx={{ width: 420 }}>
              <Step>
                <StepLabel icon={<StepStateIcon state={sigStatus} index={0} />}>
                  Signature
                </StepLabel>
              </Step>

              <Step>
                <StepLabel icon={<StepStateIcon state={llmStatus} index={1} />}>
                  LLM Scan
                </StepLabel>
              </Step>
            </Stepper>

          </Stack>

          {gpg && (
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="caption">GPG:</Typography>
              <Typography
                noWrap
                width={450}
                variant="caption"
                color="text.secondary"
              >
                {gpg}
              </Typography>

              <IconButton size="small" onClick={copyGPG}>
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Stack>
          )}

        </Stack>

      </AccordionSummary>

      <AccordionDetails>

        {/* ----- REPO STEP ----- */}
        <Stack direction="row" justifyContent="space-between">
          <Typography fontWeight={600}>Commit Signature Check</Typography>

          <Stack direction="row" spacing={1}>
            <Button
              startIcon={<PlayArrowIcon />}
              onClick={runRepo}
              disabled={repoRunning}
              variant="contained"
            >
              Run
            </Button>

            {repoFailed && (
              <Button
                startIcon={<ReplayIcon />}
                onClick={runRepo}
                color="error"
              >
                Retry
              </Button>
            )}

            <Button
              startIcon={<DownloadIcon />}
              onClick={() => download(repoLogs, "repo.log")}
            >
              Logs
            </Button>

            <IconButton onClick={() => setRepoLogsOpen(!repoLogsOpen)}>
              {repoLogsOpen ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
            </IconButton>
          </Stack>
        </Stack>

        <Collapse in={repoLogsOpen}>
          <Box mt={1}>
            <LogBox logs={repoLogs} />
          </Box>
        </Collapse>

        <Divider sx={{ my: 2 }} />

        {/* ----- LLM STEP ----- */}

        <Stack direction="row" justifyContent="space-between">
          <Typography fontWeight={600}>LLM Vulnerability Scan</Typography>

          <Stack direction="row" spacing={1}>
            <Button
              startIcon={<PlayArrowIcon />}
              onClick={runLLM}
              disabled={llmRunning || sigStatus !== "success"}
              variant="contained"
            >
              Run
            </Button>

            {llmFailed && (
              <Button
                startIcon={<ReplayIcon />}
                onClick={runLLM}
                color="error"
              >
                Retry
              </Button>
            )}

            <Button
              startIcon={<DownloadIcon />}
              onClick={() => download(llmLogs, "llm.log")}
            >
              Logs
            </Button>

            <IconButton onClick={() => setLlmLogsOpen(!llmLogsOpen)}>
              {llmLogsOpen ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
            </IconButton>
          </Stack>
        </Stack>

        <Collapse in={llmLogsOpen}>
          <Box mt={1}>
            <LogBox logs={llmLogs} />
          </Box>
        </Collapse>

        <Divider sx={{ my: 2 }} />

        {/* ----- CHAT ----- */}

        <Stack direction="row" justifyContent="space-between">
          <Typography fontWeight={700}>Security Chat with LLM</Typography>
          <IconButton onClick={() => setChatOpen(!chatOpen)}>
            {chatOpen ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </Stack>

        <Collapse in={chatOpen}>

          <Paper sx={{ p: 2, mt: 1 }}>

            <Box maxHeight={260} overflow="auto" mb={2}>

              {messages.map((m, i) => (
                <Stack
                  key={i}
                  direction="row"
                  justifyContent={m.from === "user" ? "flex-end" : "flex-start"}
                  spacing={1.2}
                  mb={1.8}
                >
                  {m.from === "bot" &&
                    <Avatar sx={{ width: 26, height: 26 }}>
                      <SmartToyIcon fontSize="small" />
                    </Avatar>
                  }

                  <Box
                    sx={{
                      px: 1.6,
                      py: 1,
                      borderRadius: 3,
                      bgcolor: m.from === "user" ? "#2563eb" : "#2c2f38",
                      color: "#fff",
                      fontSize: 13.2,
                      lineHeight: 1.6,
                      maxWidth: "68%"
                    }}
                  >
                    {m.text}
                  </Box>

                  {m.from === "user" &&
                    <Avatar sx={{ width: 26, height: 26 }}>
                      <PersonIcon fontSize="small" />
                    </Avatar>
                  }
                </Stack>
              ))}

              <div ref={chatRef}/>
            </Box>

            <Stack direction="row" spacing={1.5}>
              <TextField
                fullWidth
                value={input}
                size="small"
                placeholder="Ask security questions..."
                onChange={e => setInput(e.target.value)}
              />

              <IconButton color="primary" onClick={send}>
                <SendIcon />
              </IconButton>
            </Stack>

          </Paper>

        </Collapse>

      </AccordionDetails>

    </Accordion>
  );
}
