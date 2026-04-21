/**
 * Sherlock Security Suite — Host Server
 *
 * Express entry point for browser-based deployments.
 * Provides REST + SSE endpoints for security scanning,
 * cryptographic signing, verification, and release management.
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { scanRouter } from "./routes/scanRoutes.js";
import { cryptoRouter } from "./routes/cryptoRoutes.js";
import { verifyRouter } from "./routes/verifyRoutes.js";
import { releaseRouter } from "./routes/releaseRoutes.js";
import { sseRouter } from "./routes/sseRoutes.js";
import { logToolResolution } from "./services/toolPaths.js";
import { requestLogger, getLogMode } from "./services/requestLogger.js";
import { getActiveScansCount, getTotalListenerCount } from "./services/sseManager.js";

dotenv.config();

/* ── Corporate Network SSL Fix ────────────────────────────────────
   Bypass self-signed certificate errors common behind corporate
   proxies/firewalls. This affects ALL outbound HTTPS from this
   process (Octokit, fetch, etc.).                                  */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const app = express();
const PORT = parseInt(process.env.HOST_SERVER_PORT || "4821", 10);

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(requestLogger);

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    sse: {
      activeScans: getActiveScansCount(),
      totalListeners: getTotalListenerCount(),
    },
  });
});

app.use("/api/scan", scanRouter);
app.use("/api/crypto", cryptoRouter);
app.use("/api/verify", verifyRouter);
app.use("/api/release", releaseRouter);
app.use("/api/sse", sseRouter);

app.listen(PORT, () => {
  console.log(`\n🛡️ Sherlock Security Suite — Host Server 🛡️`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
  console.log(`   Log Mode: ${getLogMode().toUpperCase()}\n`);
  logToolResolution();
});

export default app;