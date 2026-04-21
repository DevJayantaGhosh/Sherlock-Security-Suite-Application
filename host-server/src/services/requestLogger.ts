/**
 * HTTP request logging middleware with two modes:
 *
 *   VERBOSE (development) — Full details: method, URL, status, duration, body summary
 *   MINIMAL (production)  — Compact: endpoint + scanId only
 *
 * Mode is controlled by LOG_MODE env var or NODE_ENV:
 *   LOG_MODE=verbose  → verbose
 *   LOG_MODE=minimal  → minimal
 *   NODE_ENV=production (without LOG_MODE) → minimal
 *   default → verbose
 */

import { Request, Response, NextFunction } from "express";

/* ── Resolve Log Mode ──────────────────────────────────── */

type LogMode = "verbose" | "minimal";

function resolveLogMode(): LogMode {
  const explicit = process.env.LOG_MODE?.toLowerCase();
  if (explicit === "minimal" || explicit === "production") return "minimal";
  if (explicit === "verbose" || explicit === "dev") return "verbose";
  if (process.env.NODE_ENV === "production") return "minimal";
  return "verbose";
}

const LOG_MODE: LogMode = resolveLogMode();

/* ── ANSI Colors ───────────────────────────────────────── */

const C = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
};

function statusColor(s: number): string {
  if (s >= 500) return C.red;
  if (s >= 400) return C.yellow;
  if (s >= 300) return C.cyan;
  return C.green;
}

function methodColor(m: string): string {
  switch (m) {
    case "GET": return C.blue;
    case "POST": return C.magenta;
    case "PUT": return C.yellow;
    case "DELETE": return C.red;
    default: return C.cyan;
  }
}

/* ── Helpers ───────────────────────────────────────────── */

const SENSITIVE_KEYS = [
  "password", "privateKeyPath", "publicKeyPath",
  "signaturePath", "githubToken", "token", "secret", "apiKey",
];

/** Redact sensitive fields and truncate long values for safe logging. */
function summarizeBody(body: any): string {
  if (!body || typeof body !== "object" || Object.keys(body).length === 0) return "";

  const summary: Record<string, any> = {};
  for (const [key, value] of Object.entries(body)) {
    if (SENSITIVE_KEYS.some((sk) => key.toLowerCase().includes(sk.toLowerCase()))) {
      summary[key] = "[REDACTED]";
    } else if (typeof value === "string" && value.length > 100) {
      summary[key] = value.substring(0, 80) + `...(${value.length} chars)`;
    } else {
      summary[key] = value;
    }
  }
  return JSON.stringify(summary);
}

/** Extract scanId from body, query, or route params. */
function extractScanId(req: Request): string | null {
  return (
    req.body?.scanId ||
    req.query?.scanId ||
    req.params?.scanId ||
    null
  );
}

/* ── Minimal Logger (Production) ───────────────────────── */

function minimalLogger(req: Request, _res: Response, next: NextFunction): void {
  const method = req.method;
  const url = req.originalUrl || req.url;
  const scanId = extractScanId(req);
  const ts = new Date().toISOString();

  // Skip SSE heartbeat streams from cluttering logs
  if (url.includes("/stream/")) {
    next();
    return;
  }

  const scanPart = scanId ? ` [scanId: ${scanId}]` : "";
  console.log(`${C.dim}[${ts}]${C.reset} ${method} ${url}${scanPart}`);

  next();
}

/* ── Verbose Logger (Development) ──────────────────────── */

function verboseLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const ts = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl || req.url;
  const scanId = extractScanId(req);
  const bodySummary = method !== "GET" ? summarizeBody(req.body) : "";

  // SSE streams stay open — log as received request with SSE note
  if (url.includes("/stream/")) {
    const scanPart = scanId ? ` ${C.cyan}[scanId: ${scanId}]${C.reset}` : "";
    console.log(
      `${C.dim}[${ts}]${C.reset} ` +
      `${C.green}Received Request :${C.reset} ` +
      `${methodColor(method)}${method.padEnd(6)}${C.reset} ` +
      `${url}${scanPart} ${C.dim}(SSE stream opened)${C.reset}`
    );
    next();
    return;
  }

  // Log incoming request
  const scanPart = scanId ? ` ${C.cyan}[scanId: ${scanId}]${C.reset}` : "";
  console.log(
    `${C.dim}[${ts}]${C.reset} ` +
    `${C.green}Received Request :${C.reset} ` +
    `${methodColor(method)}${method.padEnd(6)}${C.reset} ` +
    `${url}${scanPart}` +
    (bodySummary ? `\n${C.dim}  Body: ${bodySummary}${C.reset}` : "")
  );

  // Capture response finish
  const originalEnd = res.end;
  res.end = function (this: Response, ...args: any[]) {
    const duration = Date.now() - start;
    const status = res.statusCode;

    console.log(
      `${C.dim}[${ts}]${C.reset} ` +
      `${C.cyan}Sending Response :${C.reset} ` +
      `${methodColor(method)}${method.padEnd(6)}${C.reset} ` +
      `${url} → ` +
      `${statusColor(status)}${status}${C.reset} ` +
      `${C.dim}(${duration}ms)${C.reset}`
    );

    return originalEnd.apply(this, args as any);
  } as any;

  next();
}

/* ── Exported Middleware ────────────────────────────────── */

/**
 * Request logging middleware.
 * - Production (LOG_MODE=minimal): logs endpoint + scanId only
 * - Development (LOG_MODE=verbose): logs full request/response details
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  if (LOG_MODE === "minimal") {
    return minimalLogger(req, res, next);
  }
  return verboseLogger(req, res, next);
}

/** Returns the active log mode for startup diagnostics. */
export function getLogMode(): LogMode {
  return LOG_MODE;
}