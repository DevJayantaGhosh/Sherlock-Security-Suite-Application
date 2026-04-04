/**
 * LLM Configuration — Provider presets, model lists, and constants.
 *
 * Runtime config is stored in Zustand store (src/store/llmStore.ts).
 * This file provides type definitions, provider presets, and the system prompt.
 *
 * baseURL is provided by the user via the config dialog.
 */

export interface LLMProviderConfig {
  provider: string;
  baseURL: string;
  apiKey: string;
  model: string;
}

export interface ProviderPreset {
  provider: string;
  label: string;
  models: string[];
  defaultModel: string;
  description: string;
  requiresApiKey: boolean;
}

/** Provider presets — user selects provider, model, and API key. */
export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    provider: "litellm",
    label: "LiteLLM",
    models: [
      "claude-opus-4-6",
      "claude-sonnet-4-20250514",
      "gpt-4o",
      "gpt-4o-mini",
      "gemini-2.0-flash",
      "gemini-2.5-pro-preview-06-05",
    ],
    defaultModel: "claude-opus-4-6",
    description:
      "LiteLLM provides a unified interface to 100+ LLM providers (Claude, GPT, Gemini, etc.). Enter your LiteLLM proxy API Key.",
    requiresApiKey: true,
  },
  {
    provider: "openai",
    label: "OpenAI",
    models: [
      "gpt-4o",
      "gpt-4o-mini",
      "gpt-4.1",
      "gpt-4.1-mini",
      "gpt-4.1-nano",
      "o1",
      "o1-mini",
      "o3",
      "o3-mini",
      "o4-mini",
    ],
    defaultModel: "gpt-4o-mini",
    description:
      "Direct connection to OpenAI API. Supports GPT-4o, o1, o3, o4-mini, etc.",
    requiresApiKey: true,
  },
  {
    provider: "gemini",
    label: "Google Gemini",
    models: [
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
      "gemini-2.5-flash-preview-05-20",
      "gemini-2.5-pro-preview-06-05",
      "gemini-1.5-pro",
      "gemini-1.5-flash",
    ],
    defaultModel: "gemini-2.0-flash",
    description:
      "Google Gemini via OpenAI-compatible endpoint. Get API key from Google AI Studio.",
    requiresApiKey: true,
  },
  {
    provider: "ollama",
    label: "Ollama",
    models: [
      "llama3.1",
      "llama3.2",
      "mistral",
      "codellama",
      "deepseek-r1",
      "phi3",
      "gemma2",
      "qwen2",
    ],
    defaultModel: "llama3.1",
    description:
      "Run models locally with Ollama. No API key needed. Install from ollama.com.",
    requiresApiKey: false,
  },
  {
    provider: "azure",
    label: "Azure OpenAI",
    models: [
      "gpt-4o",
      "gpt-4o-mini",
      "gpt-4.1",
      "gpt-4.1-mini",
      "o1",
      "o3-mini",
    ],
    defaultModel: "gpt-4o-mini",
    description:
      "Azure OpenAI Service. Requires API key from your Azure deployment.",
    requiresApiKey: true,
  },
];

export const PROVIDER_OPTIONS = PROVIDER_PRESETS.map((p) => p.provider);


/** Get preset for a given provider name. */
export function getProviderPreset(provider: string): ProviderPreset {
  return (
    PROVIDER_PRESETS.find((p) => p.provider === provider) || PROVIDER_PRESETS[0]
  );
}

/** Get available models for a provider (from preset). */
export function getModelsForProvider(provider: string): string[] {
  const preset = getProviderPreset(provider);
  return preset.models;
}

/** Security-focused system prompt for Sherlock AI. */
export const SECURITY_SYSTEM_PROMPT = `You are **Sherlock** — an elite application-security analyst integrated into the Sherlock Security Suite. You think like a threat actor to defend like a guardian.

━━━ AREAS OF EXPERTISE ━━━
• **Software Composition Analysis (SCA)** — dependency vulnerabilities, outdated packages, license compliance, transitive risk
• **SBOM Analysis** — interpreting Software Bill of Materials, identifying phantom dependencies, supply-chain gaps
• **CVE & Vulnerability Intelligence** — severity scoring (CVSS), exploit likelihood (EPSS), real-world exploitability, patch availability
• **Secret & Credential Detection** — hardcoded API keys, tokens, certificates, leaked .env files, git history secrets
• **Cryptographic Signing & Verification** — GPG/PGP signatures, code-signing trust chains, certificate validation
• **Supply Chain Security** — build provenance (SLSA), artifact integrity, tamper detection, dependency confusion
• **Container & Infrastructure Security** — Dockerfile misconfigurations, base-image vulnerabilities, IaC risks

━━━ RESPONSE GUIDELINES ━━━
1. **Prioritize ruthlessly** — always surface 🔴 CRITICAL and 🟠 HIGH issues first, then 🟡 MEDIUM, 🔵 LOW, ✅ CLEAN.
2. **Be actionable** — every finding must include a concrete remediation step (e.g., "Upgrade \`lodash\` from 4.17.15 → 4.17.21 to fix CVE-2021-23337").
3. **Structure for clarity** — use markdown tables, bullet lists, and code blocks. Group findings by severity or category.
4. **Quantify risk** — mention CVSS scores, affected versions, and whether a public exploit exists when available.
5. **Parse scan data intelligently** — when given raw scan output (Trivy, Gitleaks, npm audit, etc.), extract and summarize findings into a structured assessment.
6. **Never fabricate** — do not invent CVE IDs, version numbers, or CVSS scores. If uncertain, state it clearly.
7. **Explain the "why"** — briefly explain why a vulnerability matters (e.g., RCE, data exfiltration, privilege escalation) so developers understand impact.
8. **Be concise yet thorough** — respect the reader's time while ensuring nothing critical is missed.
9. **Use severity indicators consistently**:
   - 🔴 **CRITICAL** — Immediate action required, likely exploitable
   - 🟠 **HIGH** — Significant risk, prioritize remediation
   - 🟡 **MEDIUM** — Moderate risk, schedule fix
   - 🔵 **LOW** — Minor risk, address when convenient
   - ✅ **CLEAN** — No issues found`;
