// SSE streaming endpoints for real-time scan logs and completion events.
// Log stream replays buffered early logs on connect to match Electron's behavior.

import { Router, Request, Response } from "express";
import { sseEvents, getBufferedLogs } from "../services/sseManager.js";

export const sseRouter = Router();

/* ── Log Stream: GET /api/scan/stream/:scanId/log ──────── */

sseRouter.get("/stream/:scanId/log", (req: Request, res: Response) => {
  const { scanId } = req.params;

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 15_000);

  const onLog = (data: { log: string; progress: number }) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Replay early logs buffered before this SSE connection opened.
  // Ensures headers/clone-start messages aren't lost (web mode race condition fix).
  const buffered = getBufferedLogs(scanId);
  for (const entry of buffered) {
    res.write(`data: ${JSON.stringify(entry)}\n\n`);
  }

  // Subscribe to live logs (attached after replay — no duplicates)
  sseEvents.on(`log:${scanId}`, onLog);

  req.on("close", () => {
    clearInterval(heartbeat);
    sseEvents.removeListener(`log:${scanId}`, onLog);
  });
});

/* ── Completion Stream: GET /api/scan/stream/:scanId/complete */

sseRouter.get("/stream/:scanId/complete", (req: Request, res: Response) => {
  const { scanId } = req.params;

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 15_000);

  const onComplete = (data: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    setTimeout(() => res.end(), 200);
  };

  sseEvents.on(`complete:${scanId}`, onComplete);

  req.on("close", () => {
    clearInterval(heartbeat);
    sseEvents.removeListener(`complete:${scanId}`, onComplete);
  });
});