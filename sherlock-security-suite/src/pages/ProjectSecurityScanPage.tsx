import React, { useEffect, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Container,
  Paper,
  Stack,
  Typography,
  Divider,
  Chip,
  TextField,
  IconButton
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";

import { getProjects } from "../services/projectService";

/* ------------------------------------------------------------------ */
/* ----------------------------- TYPES --------------------------------*/

type StepStatus = "idle" | "running" | "success" | "failed";

interface RepoStep {
  status: StepStatus;
  logs: string[];
}

interface RepoScan {
  repo: string;
  branch: string;
  gpg: string;

  gpgVerify: RepoStep;
  llmChat: RepoStep;
  chatMessages: { from: "user" | "llm"; msg: string }[];
}

/* ------------------------------------------------------------------ */

export default function ProjectSecurityScanPage() {
  const { id } = useParams();
  const project = getProjects().find(p => p.id === id);

  const [repos, setRepos] = useState<RepoScan[]>([]);
  const [dependencyChat, setDependencyChat] = useState<
    { from: "user" | "llm"; msg: string }[]
  >([]);
  const [depInput, setDepInput] = useState("");

  useEffect(() => {
    if (!project) return;

    const initial: RepoScan[] =
      project.gitRepo?.map((r, i) => ({
        repo: r,
        branch: project.gitBrances?.[i] || "main",
        gpg: project.gpgKey?.[i] || "—",

        gpgVerify: { status: "idle", logs: [] },
        llmChat: { status: "idle", logs: [] },

        chatMessages: []
      })) || [];

    setRepos(initial);
  }, [project]);

  if (!project) return null;

  /* ------------------------------------------------------------------ */
  /* ------------------------------ UTILS ------------------------------*/

  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

  /* ------------------------------------------------------------------ */
  /* ------------------------- GPG SIMULATION --------------------------*/

  async function runGpgScan(repo: RepoScan) {
    updateRepoStep(repo.repo, "gpgVerify", {
      status: "running",
      logs: []
    });

    appendLog(repo.repo, "gpgVerify", "Fetching commit history...");

    await delay(600);

    const total = 15 + Math.floor(Math.random() * 10);
    let signed = 0;

    for (let i = 1; i <= total; i++) {
      const ok = Math.random() > 0.2;
      appendLog(
        repo.repo,
        "gpgVerify",
        `Commit ${i}: ${ok ? "SIGNED" : "UNSIGNED"}`
      );
      if (ok) signed++;
      await delay(120);
    }

    appendLog(
      repo.repo,
      "gpgVerify",
      `Summary: ${signed}/${total} signed commits`
    );

    updateRepoStep(repo.repo, "gpgVerify", {
      status: signed === total ? "success" : "failed"
    });
  }

  /* ------------------------------------------------------------------ */
  /* ----------------------- INTERACTIVE LLM CHAT ----------------------*/

  async function sendRepoLLMMessage(repo: RepoScan, input: string) {
    updateRepo((r) => {
      r.chatMessages.push({ from: "user", msg: input });
      r.llmChat.status = "running";
    }, repo.repo);

    await delay(500);

    /*
      ======================================================
      REAL INTEGRATION (EXAMPLE)
      ======================================================
      const resp = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        body: JSON.stringify({
          model: "llama3",
          prompt: input,
          stream: false
        })
      });

      const data = await resp.json();
      const llmReply = data.response;
      ======================================================
    */

    // ---- SIMULATED LLM RESPONSE ----
    const llmReply = `
LLM analysis complete:
• No immediate critical vulnerabilities detected
• Recommend dependency review for known CVEs
• Static analysis confidence: HIGH
`;

    await delay(800);

    updateRepo((r) => {
      r.chatMessages.push({ from: "llm", msg: llmReply });
      r.llmChat.status = "success";
    }, repo.repo);
  }

  /* ------------------------------------------------------------------ */
  /* ---------------------- DEPENDENCY LLM CHAT ------------------------*/

  async function sendDependencyChat() {
    if (!depInput.trim()) return;

    const userMsg = depInput;
    setDepInput("");

    setDependencyChat(prev => [...prev, { from: "user", msg: userMsg }]);

    await delay(700);

    /*
      ** REAL LLM AUDIT HOOK **
      POST dependency lock file data + chat context to your LLM server
    */

    const llmSimulatedResponse = `
Dependency audit completed:
• lodash <4.17.21 – MEDIUM
• axios <1.6.1 – LOW
• no HIGH vulnerabilities detected
`;

    setDependencyChat(prev => [
      ...prev,
      { from: "llm", msg: llmSimulatedResponse }
    ]);
  }

  /* ------------------------------------------------------------------ */
  /* ----------------------------- HELPERS -----------------------------*/

  function updateRepoStep(
    repoUrl: string,
    step: "gpgVerify" | "llmChat",
    patch: Partial<RepoStep>
  ) {
    setRepos(prev =>
      prev.map(r =>
        r.repo === repoUrl
          ? { ...r, [step]: { ...r[step], ...patch } }
          : r
      )
    );
  }

  function appendLog(
    repoUrl: string,
    step: "gpgVerify",
    line: string
  ) {
    setRepos(prev =>
      prev.map(r =>
        r.repo === repoUrl
          ? {
              ...r,
              gpgVerify: {
                ...r.gpgVerify,
                logs: [...r.gpgVerify.logs, line]
              }
            }
          : r
      )
    );
  }

  function updateRepo(
    mutator: (r: RepoScan) => void,
    repoUrl: string
  ) {
    setRepos(prev =>
      prev.map(r => {
        if (r.repo === repoUrl) {
          const copy = structuredClone(r);
          mutator(copy);
          return copy;
        }
        return r;
      })
    );
  }

  /* ------------------------------------------------------------------ */
  /* ------------------------------ UI --------------------------------*/

  return (
    <Box sx={{ background: "#0d1117", minHeight: "100vh", pt: 8 }}>
      <Container maxWidth="lg">

        {/* HEADER - ONLY METADATA */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h4">{project.name}</Typography>
          <Typography color="text.secondary">
            {project.description}
          </Typography>

          <Stack direction="row" spacing={3} mt={1}>
            <Typography>Director: {project.projectDirector || "—"}</Typography>
            <Typography>Security Head: {project.securityHead || "—"}</Typography>
            <Typography>
              Release Engineers: {project.releaseEngineers.length}
            </Typography>
          </Stack>
        </Paper>

        {/* -------------------------------------------------------- */}

        {/* MASTER ACCORDION */}
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">
              Repository Scans
            </Typography>
          </AccordionSummary>

          <AccordionDetails>

            {repos.map((repo) => (
              <Accordion key={repo.repo} sx={{ mb: 2 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Stack spacing={0.5}>
                    <Typography fontWeight={700}>{repo.repo}</Typography>
                    <Typography fontSize={12}>
                      {repo.branch} | GPG: {repo.gpg}
                    </Typography>
                  </Stack>
                </AccordionSummary>

                <AccordionDetails>

                  {/* ---------------- GPG STEP ---------------- */}

                  <Typography variant="subtitle1">
                    Verify GPG Signatures
                  </Typography>

                  <NeonButton onClick={() => runGpgScan(repo)}>
                    RUN VERIFICATION
                  </NeonButton>

                  <LogsBox logs={repo.gpgVerify.logs} />

                  <Divider sx={{ my: 2 }} />

                  {/* ---------------- LLM CHAT ---------------- */}

                  <Typography variant="subtitle1">
                    LLM Vulnerability Scan
                  </Typography>

                  <ChatBlock
                    messages={repo.chatMessages}
                    onSend={(msg) => sendRepoLLMMessage(repo, msg)}
                  />

                </AccordionDetails>
              </Accordion>
            ))}

          </AccordionDetails>
        </Accordion>

        {/* -------------------------------------------------------- */}

        {/* DEPENDENCY LLM PANEL */}

        <Paper sx={{ p: 2, mt: 4 }}>
          <Typography variant="h6">
            Dependency Audit — LLM Chat
          </Typography>

          <ChatBlock
            messages={dependencyChat}
            inputValue={depInput}
            setInputValue={setDepInput}
            onSend={sendDependencyChat}
          />
        </Paper>

      </Container>
    </Box>
  );
}

/* ------------------------------------------------------------------ */
/* ------------------------- REUSABLE UI -----------------------------*/

function NeonButton({ onClick, children }: any) {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      style={{ display: "inline-block", marginTop: 6 }}
    >
      <Button
        startIcon={<PlayArrowIcon />}
        onClick={onClick}
        sx={{
          background: "linear-gradient(90deg,#00f5ff,#6f00ff)",
          color: "black",
          fontWeight: 800,
          boxShadow:
            "0 0 8px #00f5ff, 0 0 16px #6f00ff",
        }}
      >
        {children}
      </Button>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */

function LogsBox({ logs }: { logs: string[] }) {
  if (!logs.length) return null;

  return (
    <Box
      component="pre"
      sx={{
        maxHeight: 180,
        overflow: "auto",
        bgcolor: "#020617",
        p: 1,
        mt: 1,
        fontSize: 12,
        color: "#00f5ff",
      }}
    >
      {logs.join("\n")}
    </Box>
  );
}

/* ------------------------------------------------------------------ */

function ChatBlock({
  messages,
  onSend,
  inputValue,
  setInputValue
}: {
  messages: { from: "user" | "llm"; msg: string }[];
  onSend: (msg: string) => void;
  inputValue?: string;
  setInputValue?: any;
}) {
  const [localInput, setLocalInput] = useState("");

  const value = setInputValue ? inputValue : localInput;
  const setValue = setInputValue || setLocalInput;

  return (
    <Box>
      <Box
        sx={{
          bgcolor: "#020617",
          p: 1,
          borderRadius: 1,
          minHeight: 120,
        }}
      >
        {messages.map((m, i) => (
          <Box key={i} sx={{ mb: 1 }}>
            <Typography
              sx={{
                fontWeight: 700,
                color:
                  m.from === "user"
                    ? "#00f5ff"
                    : "#7c3aed"
              }}
            >
              {m.from === "user" ? "You" : "LLM"}:
            </Typography>
            <Typography sx={{ whiteSpace: "pre-wrap" }}>
              {m.msg}
            </Typography>
          </Box>
        ))}
      </Box>

      <Stack direction="row" spacing={1} mt={1}>
        <TextField
          size="small"
          fullWidth
          value={value || ""}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ask LLM..."
        />
        <Button
          variant="contained"
          onClick={() => {
            if (value?.trim()) {
              onSend(value);
              setValue("");
            }
          }}
        >
          Send
        </Button>
      </Stack>
    </Box>
  );
}
