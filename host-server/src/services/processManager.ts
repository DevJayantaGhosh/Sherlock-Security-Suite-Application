/**
 * Child process registry and lifecycle management.
 * Tracks active spawned processes by scanId for cancellation support.
 */

import { spawn, ChildProcess } from "child_process";

/* ── Active Process Registry ───────────────────────────── */

const activeProcesses = new Map<string, ChildProcess>();

/** Register a child process under an id (scanId or sub-id). */
export function register(id: string, child: ChildProcess): void {
  activeProcesses.set(id, child);
}

/** Unregister a process after it exits. */
export function unregister(id: string): void {
  activeProcesses.delete(id);
}

/** Get a registered process (or undefined). */
export function get(id: string): ChildProcess | undefined {
  return activeProcesses.get(id);
}

/** Check if a process is registered. */
export function has(id: string): boolean {
  return activeProcesses.has(id);
}

/* ── Kill ──────────────────────────────────────────────── */

function log(msg: string) {
  console.log(`[host-server] ${msg}`);
}

/**
 * Kill a child process (and its tree on Windows).
 * Safe to call even if the process already exited.
 */
export function killProcess(child: ChildProcess, processId: string): void {
  if (!child || !child.pid) return;
  log(`Killing ${processId} (PID: ${child.pid})`);
  try {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", child.pid.toString(), "/f", "/t"], {
        stdio: "ignore",
      });
    } else {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch (pgErr) {
        log(`Process group kill failed for ${processId} (PID: ${child.pid}): ${pgErr instanceof Error ? pgErr.message : pgErr} — falling back to direct kill`);
        child.kill("SIGKILL");
      }
    }
  } catch (outerErr) {
    log(`Primary kill failed for ${processId} (PID: ${child.pid}): ${outerErr instanceof Error ? outerErr.message : outerErr}`);
    try {
      child.kill("SIGKILL");
    } catch (fallbackErr) {
      log(`Fallback kill also failed for ${processId} — process likely already exited: ${fallbackErr instanceof Error ? fallbackErr.message : fallbackErr}`);
    }
  }
}

/**
 * Cancel an active operation by its scanId.
 * Returns true if a process was found and killed.
 */
export function cancel(scanId: string): boolean {
  const child = activeProcesses.get(scanId);
  if (child) {
    killProcess(child, scanId);
    activeProcesses.delete(scanId);
    return true;
  }
  return false;
}