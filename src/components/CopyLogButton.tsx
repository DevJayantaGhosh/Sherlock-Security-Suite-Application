/**
 * CopyLogButton — Reusable copy-to-clipboard icon button for log panels.
 * Place it in the top-right corner of any log Paper.
 */
import { useState } from "react";
import { IconButton, Tooltip } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import { copyToClipboard } from "../utils/clipboardUtils";

interface Props {
  /** The text (or array of log lines) to copy */
  text: string | string[];
}

export default function CopyLogButton({ text }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const content = Array.isArray(text) ? text.join("\n") : text;
    const ok = await copyToClipboard(content);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Tooltip title={copied ? "Copied!" : "Copy to clipboard"}>
      <IconButton
        size="small"
        onClick={handleCopy}
        sx={{
          position: "absolute",
          top: 6,
          right: 6,
          color: copied ? "success.main" : "text.secondary",
          bgcolor: "rgba(0,0,0,0.3)",
          "&:hover": { bgcolor: "rgba(0,0,0,0.5)" },
          zIndex: 1,
        }}
      >
        {copied ? <CheckIcon sx={{ fontSize: 16 }} /> : <ContentCopyIcon sx={{ fontSize: 16 }} />}
      </IconButton>
    </Tooltip>
  );
}