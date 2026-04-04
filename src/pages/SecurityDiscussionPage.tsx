import { Box } from "@mui/material";
import LLMChatPanel from "../components/llm/LLMChatPanel";

/** Full-page view of the AI chat — shares the same Zustand store as the drawer. */
export default function SecurityDiscussionPage() {
  return (
    <Box sx={{ px: { xs: 1, sm: 3 }, py: 2, height: "calc(100vh - 128px)" }}>
      <LLMChatPanel height="100%" />
    </Box>
  );
}