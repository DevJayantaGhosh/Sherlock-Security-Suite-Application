/**
 * LLMChatPanel — Multi-session AI chat UI for security analysis.
 * Sessions are persisted in Zustand llmStore (in-memory until logout).
 */

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Paper,
  Stack,
  Button,
  Avatar,
  CircularProgress,
  Chip,
  Tooltip,
  List,
  ListItemButton,
  ListItemText,
  ListItemIcon,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import StopIcon from "@mui/icons-material/Stop";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import PersonIcon from "@mui/icons-material/Person";
import SettingsIcon from "@mui/icons-material/Settings";
import DeleteIcon from "@mui/icons-material/Delete";
import AddCommentIcon from "@mui/icons-material/AddComment";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import DownloadIcon from "@mui/icons-material/Download";
import ReactMarkdown from "react-markdown";

import { getProviderPreset } from "../../config/llmConfig";
import { useLLMStore } from "../../store/llmStore";
import type { ChatMessage as StoreChatMessage, ChatSession } from "../../store/llmStore";
import { streamChat, type ChatMessage } from "../../services/llmService";
import LLMConfigDialog from "./LLMConfigDialog";

const MONO_FONT = "'Fira Code', 'JetBrains Mono', 'Consolas', monospace";
const FONT_SM = "0.78rem";
const FONT_XS = "0.72rem";
const SIDEBAR_W = 180;

interface Props {
  systemContext?: string;
  placeholder?: string;
  height?: string | number;
  /** Hide the session sidebar (e.g. in drawer mode) */
  hideSidebar?: boolean;
}

export default function LLMChatPanel({
  systemContext,
  placeholder = "Ask Sherlock about security...",
  height = "500px",
  hideSidebar = false,
}: Props) {
  const {
    config,
    isConfigured,
    sessions,
    activeSessionId,
    createSession,
    switchSession,
    deleteSession,
    clearAllSessions,
    getActiveMessages,
    addMessage,
    updateLastAssistant,
    clearActiveMessages,
  } = useLLMStore();

  const configured = isConfigured();
  const preset = getProviderPreset(config.provider);
  const messages = getActiveMessages();

  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const streamingRef = useRef(false);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Ensure at least one session exists
  useEffect(() => {
    if (configured && sessions.length === 0) {
      createSession();
    }
  }, [configured, sessions.length, createSession]);

  // Keep streamingRef in sync so the event handler always sees latest value
  useEffect(() => {
    streamingRef.current = streaming;
  }, [streaming]);

  // Event-driven: listen for "analyze-with-sherlock" CustomEvent from AnalyzeLogButton
  useEffect(() => {
    function handleAnalyzeEvent(e: Event) {
      const prompt = (e as CustomEvent<{ prompt: string }>).detail?.prompt;
      if (!prompt) return;

      // Note : If a stream is already in progress, abort it first
      if (streamingRef.current && abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
        streamingRef.current = false;
      }

      // Ensure a session exists (AnalyzeLogButton already calls createSession,
      // but guard in case the store hasn't flushed yet)
      const store = useLLMStore.getState();
      const sessionId = store.activeSessionId || store.createSession();
      if (!sessionId) return;

      // Add user message and start streaming
      const userMsg: StoreChatMessage = { role: "user", content: prompt, timestamp: Date.now() };
      store.addMessage(userMsg);
      setStreaming(true);
      streamingRef.current = true; // sync ref immediately (useEffect runs after render, too late for guards)

      const history: ChatMessage[] = [{ role: "user", content: prompt }];
      if (systemContext) {
        history.unshift({ role: "system", content: systemContext });
      }
      store.addMessage({ role: "assistant", content: "", timestamp: Date.now() });

      const controller = new AbortController();
      abortRef.current = controller;

      streamChat(
        history,
        (chunk) => useLLMStore.getState().updateLastAssistant(chunk),
        () => setStreaming(false),
        (error) => {
          useLLMStore.getState().updateLastAssistant(`⚠️ ${error}`);
          setStreaming(false);
        },
        controller.signal
      );
    }

    window.addEventListener("analyze-with-sherlock", handleAnalyzeEvent);
    return () => window.removeEventListener("analyze-with-sherlock", handleAnalyzeEvent);
  }, [systemContext]); // stable deps only — no store values that trigger re-renders

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    if (!isConfigured()) {
      setConfigOpen(true);
      return;
    }

    // Ensure active session
    if (!activeSessionId) createSession();

    const userMsg: StoreChatMessage = { role: "user", content: text, timestamp: Date.now() };
    addMessage(userMsg);
    setInput("");
    setStreaming(true);

    const history: ChatMessage[] = getActiveMessages()
      .filter((m: StoreChatMessage) => m.content) // skip empty
      .map((m: StoreChatMessage) => ({ role: m.role, content: m.content }));
    // The userMsg was already added to store but we need it in the API call
    if (!history.find((h) => h.content === text)) {
      history.push({ role: "user", content: text });
    }

    if (systemContext) {
      history.unshift({ role: "system", content: systemContext });
    }

    addMessage({ role: "assistant", content: "", timestamp: Date.now() });

    const controller = new AbortController();
    abortRef.current = controller;

    await streamChat(
      history,
      (chunk) => updateLastAssistant(chunk),
      () => setStreaming(false),
      (error) => {
        updateLastAssistant(`⚠️ ${error}`);
        setStreaming(false);
      },
      controller.signal
    );
  }, [input, streaming, activeSessionId, systemContext, isConfigured, createSession, addMessage, getActiveMessages, updateLastAssistant]);

  const handleStop = () => {
    abortRef.current?.abort();
    setStreaming(false);
  };

  const handleNewChat = () => {
    if (streaming) {
      abortRef.current?.abort();
      setStreaming(false);
    }
    createSession();
  };

  const handleDeleteSession = (id: string) => {
    if (streaming && id === activeSessionId) {
      abortRef.current?.abort();
      setStreaming(false);
    }
    deleteSession(id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /** Download a specific session's conversation as a Markdown analysis report. */
  const handleDownloadSessionReport = useCallback((sessionId: string) => {
    const session = sessions.find((s: ChatSession) => s.id === sessionId);
    if (!session || session.messages.length === 0) return;

    const title = session.title || "Sherlock AI Analysis";
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    let report = `# 🔍 Sherlock AI — Analysis Report\n\n`;
    report += `**Session:** ${title}\n`;
    report += `**Provider:** ${preset.label} / ${config.model}\n`;
    report += `**Exported:** ${new Date().toLocaleString()}\n\n`;
    report += `---\n\n`;

    session.messages.forEach((msg: StoreChatMessage) => {
      if (msg.role === "user") {
        report += `## 🧑 User\n\n${msg.content}\n\n`;
      } else {
        report += `## 🤖 Sherlock AI\n\n${msg.content}\n\n`;
      }
      report += `---\n\n`;
    });

    report += `\n*Report generated by Sherlock Security Suite*\n`;

    const blob = new Blob([report], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sherlock-analysis-${timestamp}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [sessions, preset.label, config.model]);

  /** Download the active session's report (convenience wrapper). */
  const handleDownloadReport = useCallback(() => {
    if (activeSessionId) handleDownloadSessionReport(activeSessionId);
  }, [activeSessionId, handleDownloadSessionReport]);

  // Not configured — show setup prompt
  if (!configured) {
    return (
      <>
        <Paper
          sx={{
            height,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            p: 4,
            border: "1px dashed",
            borderColor: "warning.main",
            borderRadius: 2,
          }}
        >
          <SmartToyIcon sx={{ fontSize: 48, color: "warning.main" }} />
          <Typography variant="subtitle1" fontWeight={700}>
            Configure AI to start chatting
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center" maxWidth={400} fontSize={FONT_SM}>
            Sherlock AI needs an LLM provider to analyze security data.
            Click below to set up your API key.
          </Typography>
          <Button variant="contained" size="small" startIcon={<SettingsIcon />} onClick={() => setConfigOpen(true)}>
            Configure AI Provider
          </Button>
        </Paper>
        <LLMConfigDialog open={configOpen} onClose={() => setConfigOpen(false)} />
      </>
    );
  }

  return (
    <>
      <Paper
        sx={{
          height,
          display: "flex",
          flexDirection: "row",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        {/* ── Session Sidebar ── */}
        {!hideSidebar && (
          <Box
            sx={{
              width: SIDEBAR_W,
              minWidth: SIDEBAR_W,
              borderRight: "1px solid",
              borderColor: "divider",
              display: "flex",
              flexDirection: "column",
              bgcolor: "rgba(0,0,0,0.15)",
            }}
          >
            {/* New chat button */}
            <Box sx={{ px: 1, py: 0.75, borderBottom: "1px solid", borderColor: "divider" }}>
              <Button
                fullWidth
                size="small"
                variant="outlined"
                startIcon={<AddCommentIcon sx={{ fontSize: 15 }} />}
                onClick={handleNewChat}
                sx={{ fontSize: FONT_XS, textTransform: "none" }}
              >
                New Chat
              </Button>
            </Box>

            {/* Session list */}
            <Box sx={{ flex: 1, overflowY: "auto" }}>
              <List dense disablePadding>
                {sessions.map((s: ChatSession) => (
                  <ListItemButton
                    key={s.id}
                    selected={s.id === activeSessionId}
                    onClick={() => switchSession(s.id)}
                    sx={{ py: 0.5, px: 1, gap: 0.5 }}
                  >
                    <ListItemIcon sx={{ minWidth: 24 }}>
                      <ChatBubbleOutlineIcon sx={{ fontSize: 14, opacity: 0.6 }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={s.title}
                      primaryTypographyProps={{
                        fontSize: FONT_XS,
                        noWrap: true,
                        fontWeight: s.id === activeSessionId ? 700 : 400,
                      }}
                    />
                    <Tooltip title="Download Report">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadSessionReport(s.id);
                        }}
                        disabled={s.messages.length === 0}
                        sx={{ p: 0.25 }}
                      >
                        <DownloadIcon sx={{ fontSize: 14, opacity: 0.5 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSession(s.id);
                        }}
                        sx={{ p: 0.25 }}
                      >
                        <DeleteIcon sx={{ fontSize: 14, opacity: 0.5 }} />
                      </IconButton>
                    </Tooltip>
                  </ListItemButton>
                ))}
              </List>
            </Box>

            {/* Clear all */}
            {sessions.length > 1 && (
              <Box sx={{ px: 1, py: 0.5, borderTop: "1px solid", borderColor: "divider" }}>
                <Button
                  fullWidth
                  size="small"
                  color="error"
                  startIcon={<DeleteSweepIcon sx={{ fontSize: 14 }} />}
                  onClick={clearAllSessions}
                  sx={{ fontSize: FONT_XS, textTransform: "none" }}
                >
                  Clear All
                </Button>
              </Box>
            )}
          </Box>
        )}

        {/* ── Chat Area ── */}
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {/* Header */}
          <Box
            sx={{
              px: 1.5,
              py: 0.75,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid",
              borderColor: "divider",
              bgcolor: "background.paper",
            }}
          >
            <Stack direction="row" spacing={0.75} alignItems="center">
              <SmartToyIcon sx={{ color: "primary.main", fontSize: 18 }} />
              <Typography fontWeight={700} fontSize={FONT_SM}>
                Sherlock AI
              </Typography>
              <Chip
                label={`${preset.label} / ${config.model}`}
                size="small"
                variant="outlined"
                sx={{ fontSize: FONT_XS, height: 20 }}
              />
            </Stack>
            <Stack direction="row" spacing={0}>
              {hideSidebar && (
                <Tooltip title="New Chat">
                  <IconButton size="small" onClick={handleNewChat}>
                    <AddCommentIcon sx={{ fontSize: 17 }} />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="Download Analysis Report">
                <span>
                  <IconButton size="small" onClick={handleDownloadReport} disabled={messages.length === 0}>
                    <DownloadIcon sx={{ fontSize: 17 }} />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="AI Settings">
                <IconButton size="small" onClick={() => setConfigOpen(true)}>
                  <SettingsIcon sx={{ fontSize: 17 }} />
                </IconButton>
              </Tooltip>
              {hideSidebar && (
                <Tooltip title="Clear this chat">
                  <IconButton size="small" onClick={clearActiveMessages} disabled={streaming || messages.length === 0}>
                    <DeleteSweepIcon sx={{ fontSize: 17 }} />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          </Box>

          {/* Messages */}
          <Box sx={{ flex: 1, overflowY: "auto", overflowX: "hidden", px: 1.5, py: 1 }}>
            {messages.length === 0 && (
              <Box sx={{ textAlign: "center", py: 5, color: "text.secondary" }}>
                <SmartToyIcon sx={{ fontSize: 36, mb: 1, opacity: 0.4 }} />
                <Typography fontSize={FONT_SM}>
                  Ask Sherlock to analyze vulnerabilities, review dependencies, or explain CVEs.
                </Typography>
              </Box>
            )}

            {messages.map((msg: StoreChatMessage, i: number) => (
              <Box key={i} sx={{ display: "flex", gap: 1, mb: 1.5, alignItems: "flex-start" }}>
                <Avatar
                  sx={{
                    width: 24,
                    height: 24,
                    bgcolor: msg.role === "user" ? "primary.dark" : "secondary.dark",
                    mt: 0.3,
                  }}
                >
                  {msg.role === "user" ? (
                    <PersonIcon sx={{ fontSize: 14 }} />
                  ) : (
                    <SmartToyIcon sx={{ fontSize: 14 }} />
                  )}
                </Avatar>
                <Box
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    overflow: "hidden",
                    wordBreak: "break-word",
                    bgcolor: msg.role === "user" ? "action.hover" : "transparent",
                    borderRadius: 1.5,
                    px: msg.role === "user" ? 1.5 : 0,
                    py: msg.role === "user" ? 0.75 : 0,
                    fontFamily: MONO_FONT,
                    fontSize: FONT_SM,
                    "& p": { m: 0, fontSize: FONT_SM, lineHeight: 1.5, fontFamily: MONO_FONT },
                    "& li": { fontSize: FONT_SM, fontFamily: MONO_FONT },
                    "& pre": {
                      bgcolor: "rgba(0,0,0,0.3)",
                      p: 1,
                      borderRadius: 1,
                      overflowX: "auto",
                      maxWidth: "100%",
                      fontSize: FONT_XS,
                      fontFamily: MONO_FONT,
                    },
                    "& code": { fontSize: FONT_XS, fontFamily: MONO_FONT, wordBreak: "break-all" },
                    "& table": { borderCollapse: "collapse", width: "100%", tableLayout: "fixed" },
                    "& th, & td": {
                      border: "1px solid",
                      borderColor: "divider",
                      px: 0.75,
                      py: 0.3,
                      fontSize: FONT_XS,
                      wordBreak: "break-word",
                    },
                  }}
                >
                  {msg.role === "user" ? (
                    <Typography fontSize={FONT_SM} sx={{ whiteSpace: "pre-wrap", fontFamily: MONO_FONT }}>
                      {msg.content}
                    </Typography>
                  ) : msg.content ? (
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  ) : (
                    <CircularProgress size={14} />
                  )}
                </Box>
              </Box>
            ))}
            <div ref={bottomRef} />
          </Box>

          {/* Input */}
          <Box
            sx={{
              px: 1.5,
              py: 1,
              borderTop: "1px solid",
              borderColor: "divider",
              bgcolor: "background.paper",
            }}
          >
            <Stack direction="row" spacing={1} alignItems="flex-end">
              <TextField
                fullWidth
                multiline
                maxRows={3}
                size="small"
                placeholder={placeholder}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={streaming}
                InputProps={{ sx: { fontSize: FONT_SM, fontFamily: MONO_FONT } }}
              />
              {streaming ? (
                <IconButton color="error" onClick={handleStop} size="small" title="Stop">
                  <StopIcon fontSize="small" />
                </IconButton>
              ) : (
                <IconButton color="primary" onClick={handleSend} size="small" disabled={!input.trim()} title="Send">
                  <SendIcon fontSize="small" />
                </IconButton>
              )}
            </Stack>
          </Box>
        </Box>
      </Paper>

      <LLMConfigDialog open={configOpen} onClose={() => setConfigOpen(false)} />
    </>
  );
}