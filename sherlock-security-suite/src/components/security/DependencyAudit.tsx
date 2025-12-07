// src/components/projects/DependencyAudit.tsx

import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
  Avatar,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress
} from "@mui/material";
import { useEffect, useRef, useState } from "react";

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import PersonIcon from "@mui/icons-material/Person";
import SendIcon from "@mui/icons-material/Send";
import SummarizeIcon from "@mui/icons-material/Summarize";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";

import { llmQuery, onLLMStream } from "../../services/securityService";

interface Props {
  dependencies: string[];
}

interface ChatMsg {
  from: "user" | "bot";
  text: string;
}

export default function DependencyAudit({ dependencies }: Props) {

  const bottomRef = useRef<HTMLDivElement>(null);

  const [activeDep, setActiveDep] = useState<string | null>(null);
  const [inputs, setInputs] = useState<Record<string,string>>({});
  const [messages, setMessages] = useState<Record<string, ChatMsg[]>>({});
  const [riskScores, setRiskScores] = useState<Record<string, number>>({});

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const [wallet, setWallet] = useState<string | null>(null);

  /* ---------------- AUTOSCROLL ---------------- */

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeDep]);

  /* ---------------- LLM STREAM LISTENER ---------------- */

  useEffect(() => {

    return onLLMStream((msg) => {
      const dep = activeDep;
      if (!dep || msg.sessionId !== `dep-${dep}`) return;

      setMessages(m => ({
        ...m,
        [dep]: [...(m[dep] || []), { from: "bot", text: msg.chunk }]
      }));

      /* Simple demo risk scoring (naive heuristic) */
      if (/critical|high risk|severe/i.test(msg.chunk)) {
        setRiskScores(r => ({ ...r, [dep]: 90 }));
      }
      else if (/medium/i.test(msg.chunk)) {
        setRiskScores(r => ({ ...r, [dep]: 50 }));
      }
      else if (/low|safe|ok/i.test(msg.chunk)) {
        setRiskScores(r => ({ ...r, [dep]: 15 }));
      }
    });

  }, [activeDep]);

  /* ---------------- WALLET CONNECT ---------------- */

  async function connectWallet() {
    if (!(window as any).ethereum) {
      alert("MetaMask not installed");
      return;
    }

    const accounts = await (window as any).ethereum.request({
      method: "eth_requestAccounts"
    });

    setWallet(accounts[0]);
  }

  /* ---------------- SEND CHAT ---------------- */

  async function send(dep: string) {
    const input = inputs[dep];
    if (!input) return;

    setMessages(m => ({
      ...m,
      [dep]: [...(m[dep] || []), { from: "user", text: input }]
    }));

    setInputs(i => ({ ...i, [dep]: "" }));

    await llmQuery(`dep-${dep}`, input);
  }

  /* ---------------- AUTO SUMMARY ---------------- */

  async function summarize(dep: string) {
    await llmQuery(
      `dep-${dep}`,
      "Provide a short vulnerability summary and risk rating for this dependency."
    );
  }

  /* ---------------- DECISION FLOW ---------------- */

  function decide(type: "approve" | "reject") {
    setDecision(type);
    setConfirmOpen(true);
  }

  function confirmDecision() {
    console.log("DECISION:", decision, "Wallet:", wallet);
    setConfirmOpen(false);
  }

  /* ---------------- RENDER ---------------- */

  return (
    <Paper sx={{ p: 2, mt: 4 }}>

      {/* --- Title --- */}
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h6">
          Dependency Audit
        </Typography>

        <Chip
          label={`Dependencies: ${dependencies.length}`}
          color="primary"
        />
      </Stack>

      {/* --- Accordions --- */}
      <Stack spacing={2} mt={2}>
        {dependencies.map(dep => {

          const msgs = messages[dep] || [];
          const risk = riskScores[dep] || 0;

          return (

            <Accordion
              key={dep}
              expanded={activeDep === dep}
              onChange={() => setActiveDep(d => d === dep ? null : dep)}
            >

              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack width="100%" spacing={1}>
                  <Typography fontWeight={600}>{dep}</Typography>

                  {/* ---- Risk Score ---- */}
                  <Box>
                    <Typography fontSize={12}>
                      Risk Score: {risk}/100
                    </Typography>
                    <LinearProgress
                      value={risk}
                      variant="determinate"
                      sx={{
                        height: 8,
                        borderRadius: 2
                      }}
                    />
                  </Box>
                </Stack>
              </AccordionSummary>

              <AccordionDetails>

                {/* ---- Summary Action ---- */}
                <Stack direction="row" mb={1}>
                  <Button
                    startIcon={<SummarizeIcon />}
                    onClick={() => summarize(dep)}
                    variant="outlined"
                  >
                    Summarize Findings (AI)
                  </Button>
                </Stack>

                {/* ---- Chat Window ---- */}
                <Box sx={{ maxHeight: 240, overflow: "auto", mb: 1 }}>

                  {msgs.map((m,i) => (
                    <Stack
                      key={i}
                      direction="row"
                      justifyContent={m.from === "user" ? "flex-end" : "flex-start"}
                      spacing={1}
                      mb={1}
                    >

                      {m.from === "bot" && (
                        <Avatar sx={{ width:28, height:28 }}>
                          <SmartToyIcon fontSize="small"/>
                        </Avatar>
                      )}

                      <Box sx={{
                        bgcolor: m.from === "user" ? "#1976d2" : "#2c2f38",
                        color: "#fff",
                        px: 1.2,
                        py: .8,
                        borderRadius: 2,
                        maxWidth: "70%"
                      }}>
                        {m.text}
                      </Box>

                      {m.from === "user" && (
                        <Avatar sx={{ width:28, height:28 }}>
                          <PersonIcon fontSize="small"/>
                        </Avatar>
                      )}

                    </Stack>
                  ))}

                  <div ref={bottomRef} />

                </Box>

                {/* ---- Input ---- */}
                <Stack direction="row" spacing={1}>
                  <TextField
                    size="small"
                    fullWidth
                    placeholder={`Ask about ${dep}`}
                    value={inputs[dep] || ""}
                    onChange={(e) =>
                      setInputs(i => ({ ...i, [dep]: e.target.value }))
                    }
                  />

                  <IconButton onClick={() => send(dep)}>
                    <SendIcon/>
                  </IconButton>
                </Stack>

              </AccordionDetails>

            </Accordion>

          );
        })}
      </Stack>


      {/* ---- Approve / Reject ---- */}

      <Stack direction="row" spacing={2} justifyContent="center" mt={4}>

        <Button
          color="success"
          startIcon={<CheckCircleIcon />}
          variant="contained"
          onClick={() => decide("approve")}
        >
          Approve
        </Button>

        <Button
          color="error"
          startIcon={<CancelIcon />}
          variant="contained"
          onClick={() => decide("reject")}
        >
          Reject
        </Button>

      </Stack>


      {/* ---- Confirmation Dialog ---- */}

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>

        <DialogTitle>
          Confirm Decision
        </DialogTitle>

        <DialogContent>

          <Stack spacing={2}>

            <Typography>
              You are about to <b>{decision}</b> all dependency security decisions.
            </Typography>

            <Button
              startIcon={<AccountBalanceWalletIcon/>}
              onClick={connectWallet}
              variant="outlined"
            >
              {wallet ? `Wallet: ${wallet.slice(0,6)}...` : "Connect MetaMask"}
            </Button>

          </Stack>

        </DialogContent>

        <DialogActions>

          <Button onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>

          <Button
            disabled={!wallet}
            variant="contained"
            onClick={confirmDecision}
          >
            Confirm
          </Button>

        </DialogActions>

      </Dialog>

    </Paper>
  );
}
