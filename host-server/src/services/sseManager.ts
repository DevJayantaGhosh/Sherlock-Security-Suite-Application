// host-server/src/services/sseManager.ts
// Central SSE client registry & emitter with early-log buffering.
// Services emit events here; SSE routes subscribe per scanId.
// cleanup() MUST be called when scans complete to prevent memory leaks.

import { EventEmitter } from "events";

export const sseEvents = new EventEmitter();
sseEvents.setMaxListeners(200);

/* ── Listener Tracking ─────────────────────────────────── */

const activeScans = new Map<string, NodeJS.Timeout>();
const MAX_SCAN_LIFETIME_MS = 3 * 60 * 60 * 1000; // 3 hours

/* ── Early-Log Buffer ──────────────────────────────────── */
// Captures logs emitted before SSE clients connect (~3-8 entries).
// Replayed by sseRoutes on connect, deleted on cleanup().

const logBuffers = new Map<string, Array<{ log: string; progress: number }>>();
const MAX_BUFFER_SIZE = 500; // Safety cap, never reached in practice

/* ── Public Emitters ───────────────────────────────────── */

/** Buffer + emit a log entry. Buffer handles late SSE connections. */
export function emitLog(scanId: string, log: string, progress: number): void {
  ensureTracked(scanId);
  const entry = { log, progress };

  // Buffer for late-connecting SSE clients
  let buf = logBuffers.get(scanId);
  if (!buf) {
    buf = [];
    logBuffers.set(scanId, buf);
  }
  if (buf.length < MAX_BUFFER_SIZE) buf.push(entry);

  // Live emit to already-connected clients
  sseEvents.emit(`log:${scanId}`, entry);
}

/** Get buffered logs for replay when SSE client connects. */
export function getBufferedLogs(scanId: string): Array<{ log: string; progress: number }> {
  return logBuffers.get(scanId) || [];
}

/** Emit completion, then cleanup after a short flush window. */
export function emitComplete(scanId: string, data: Record<string, unknown>): void {
  sseEvents.emit(`complete:${scanId}`, data);
  setTimeout(() => cleanup(scanId), 1_000);
}

/** Emit cancel signal, then cleanup. */
export function emitCancel(scanId: string): void {
  sseEvents.emit(`cancel:${scanId}`);
  setTimeout(() => cleanup(scanId), 500);
}

/* ── Cleanup ───────────────────────────────────────────── */

/** Remove all listeners, timers, and buffers for a scanId. Safe to call multiple times. */
export function cleanup(scanId: string): void {
  const events = [`log:${scanId}`, `complete:${scanId}`, `cancel:${scanId}`];
  let removed = 0;

  for (const event of events) {
    const count = sseEvents.listenerCount(event);
    if (count > 0) {
      sseEvents.removeAllListeners(event);
      removed += count;
    }
  }

  const timer = activeScans.get(scanId);
  if (timer) {
    clearTimeout(timer);
    activeScans.delete(scanId);
  }

  logBuffers.delete(scanId);

  if (removed > 0) {
    console.log(
      `[host-server] SSE cleanup: ${scanId} — removed ${removed} listener(s). Active scans: ${activeScans.size}`
    );
  }
}

/** Track scanId with auto-cleanup timer (safety net for crashes). */
function ensureTracked(scanId: string): void {
  if (activeScans.has(scanId)) return;

  const timer = setTimeout(() => {
    console.log(`[host-server] SSE auto-cleanup: ${scanId} — exceeded ${MAX_SCAN_LIFETIME_MS / 60000}min lifetime`);
    cleanup(scanId);
  }, MAX_SCAN_LIFETIME_MS);

  timer.unref();
  activeScans.set(scanId, timer);
}

/* ── Diagnostics ───────────────────────────────────────── */

export function getActiveScansCount(): number {
  return activeScans.size;
}

export function getTotalListenerCount(): number {
  return sseEvents.eventNames().reduce(
    (sum, name) => sum + sseEvents.listenerCount(name),
    0
  );
}