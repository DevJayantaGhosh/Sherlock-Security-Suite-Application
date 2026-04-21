/**
 * AnalyzeLogButton — Reusable button that sends log panel content to Sherlock AI.
 * Place it alongside CopyLogButton in any log Paper.
 * Dispatches a "analyze-with-sherlock" CustomEvent carrying the prompt.
 * LLMChatPanel listens for this event and sends the message directly.
 */
import { useState } from "react";
import { IconButton, Tooltip } from "@mui/material";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import CheckIcon from "@mui/icons-material/Check";
import { useLLMStore } from "../store/llmStore";

interface Props {
  /** The log text (or array of log lines) to analyze */
  text: string | string[];
  /** Optional prefix prompt before the log content */
  promptPrefix?: string;
  /** Position offset from right (default 40 to sit next to CopyLogButton at right:6) */
  right?: number;
}

export default function AnalyzeLogButton({
  text,
  promptPrefix = "Analyze the following security scan log and provide a detailed security assessment with recommendations:\n\n```\n",
  right = 40,
}: Props) {
  const [sent, setSent] = useState(false);
  const { createSession, isConfigured } = useLLMStore();

  const handleAnalyze = () => {
    const content = Array.isArray(text) ? text.join("\n") : text;
    if (!content.trim()) return;

    const prompt = `${promptPrefix}${content}\n\`\`\``;

    // Create a fresh session for this analysis
    createSession();

    // Dispatch event to open drawer AND carry prompt data — LLMChatPanel handles the rest
    window.dispatchEvent(new CustomEvent("analyze-with-sherlock", { detail: { prompt } }));

    setSent(true);
    setTimeout(() => setSent(false), 2000);
  };

  return (
    <Tooltip title={sent ? "Sent to AI!" : isConfigured() ? "AI Analysis" : "Configure AI first"}>
      <IconButton
        size="small"
        onClick={handleAnalyze}
        disabled={!isConfigured()}
        sx={{
          position: "absolute",
          top: 6,
          right,
          color: sent ? "success.main" : "info.main",
          bgcolor: "rgba(0,0,0,0.3)",
          "&:hover": { bgcolor: "rgba(0,0,0,0.5)" },
          zIndex: 1,
        }}
      >
        {sent ? <CheckIcon sx={{ fontSize: 16 }} /> : <SmartToyIcon sx={{ fontSize: 16 }} />}
      </IconButton>
    </Tooltip>
  );
}