import { create } from "zustand";
import type { LLMProviderConfig } from "../config/llmConfig";
import { getProviderPreset } from "../config/llmConfig";

/* ── Chat message ── */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number; // epoch ms
}

/* ── Chat session ── */
export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
}

/* ── Store shape ── */
interface LLMState {
  /* config */
  config: LLMProviderConfig;
  setConfig: (cfg: LLMProviderConfig) => void;
  updateConfig: (partial: Partial<LLMProviderConfig>) => void;
  resetConfig: () => void;
  isConfigured: () => boolean;

  /* sessions */
  sessions: ChatSession[];
  activeSessionId: string | null;

  createSession: () => string;              // returns new id
  switchSession: (id: string) => void;
  deleteSession: (id: string) => void;
  clearAllSessions: () => void;

  /* messages — operate on active session */
  getActiveMessages: () => ChatMessage[];
  addMessage: (msg: ChatMessage) => void;
  updateLastAssistant: (chunk: string) => void;
  clearActiveMessages: () => void;
}

/* ── Helpers ── */
const uid = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const defaultConfig = (): LLMProviderConfig => {
  const provider = (import.meta.env.VITE_LLM_PROVIDER || "litellm").toLowerCase();
  const preset = getProviderPreset(provider);
  return {
    provider,
    baseURL: import.meta.env.VITE_LLM_BASE_URL || "",
    apiKey: import.meta.env.VITE_LLM_API_KEY || "",
    model: import.meta.env.VITE_LLM_MODEL || preset.defaultModel,
  };
};

/** Derive a short title from the first user message */
function deriveTitle(msg: string): string {
  const clean = msg.replace(/\n/g, " ").trim();
  return clean.length > 40 ? clean.slice(0, 40) + "…" : clean || "New Chat";
}

/* ── Store ── */
export const useLLMStore = create<LLMState>((set, get) => ({
  config: defaultConfig(),
  sessions: [],
  activeSessionId: null,
  /* ── Config ── */
  setConfig: (cfg) => set({ config: cfg }),
  updateConfig: (partial) =>
    set((s) => ({ config: { ...s.config, ...partial } })),
  resetConfig: () => set({ config: defaultConfig() }),
  isConfigured: () => {
    const cfg = get().config;
    if (cfg.provider === "ollama") return !!cfg.baseURL;
    return !!cfg.apiKey && !!cfg.baseURL;
  },

  /* ── Sessions ── */
  createSession: () => {
    const id = uid();
    const session: ChatSession = {
      id,
      title: "New Chat",
      messages: [],
      createdAt: Date.now(),
    };
    set((s) => ({
      sessions: [session, ...s.sessions],
      activeSessionId: id,
    }));
    return id;
  },

  switchSession: (id) => set({ activeSessionId: id }),

  deleteSession: (id) =>
    set((s) => {
      const sessions = s.sessions.filter((se) => se.id !== id);
      let activeSessionId = s.activeSessionId;
      if (activeSessionId === id) {
        activeSessionId = sessions.length > 0 ? sessions[0].id : null;
      }
      return { sessions, activeSessionId };
    }),

  clearAllSessions: () => set({ sessions: [], activeSessionId: null }),

  /* ── Messages (active session) ── */
  getActiveMessages: () => {
    const { sessions, activeSessionId } = get();
    return sessions.find((s) => s.id === activeSessionId)?.messages ?? [];
  },

  addMessage: (msg) =>
    set((s) => {
      const sessions = s.sessions.map((se) => {
        if (se.id !== s.activeSessionId) return se;
        const updated = { ...se, messages: [...se.messages, msg] };
        // Auto-title from first user message
        if (msg.role === "user" && se.messages.length === 0) {
          updated.title = deriveTitle(msg.content);
        }
        return updated;
      });
      return { sessions };
    }),

  updateLastAssistant: (chunk) =>
    set((s) => {
      const sessions = s.sessions.map((se) => {
        if (se.id !== s.activeSessionId) return se;
        const msgs = [...se.messages];
        const last = msgs[msgs.length - 1];
        if (last?.role === "assistant") {
          msgs[msgs.length - 1] = { ...last, content: last.content + chunk };
        }
        return { ...se, messages: msgs };
      });
      return { sessions };
    }),

  clearActiveMessages: () =>
    set((s) => {
      const sessions = s.sessions.map((se) =>
        se.id === s.activeSessionId ? { ...se, messages: [], title: "New Chat" } : se
      );
      return { sessions };
    }),
}));