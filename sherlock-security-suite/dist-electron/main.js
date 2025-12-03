import { app, BrowserWindow, ipcMain } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
createRequire(import.meta.url);
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
let splash = null;
function createWindow() {
  splash = new BrowserWindow({
    width: 420,
    height: 280,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    show: true,
    backgroundColor: "#00000000"
  });
  splash.loadFile(path.join(process.env.VITE_PUBLIC, "splash.html"));
  win = new BrowserWindow({
    width: 1280,
    height: 840,
    show: false,
    frame: false,
    titleBarStyle: "hidden",
    backgroundColor: "#060712",
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs")
    }
  });
  ipcMain.handle("window:minimize", () => win == null ? void 0 : win.minimize());
  ipcMain.handle("window:maximize", () => {
    if (!win) return;
    win.isMaximized() ? win.unmaximize() : win.maximize();
  });
  ipcMain.handle("window:close", () => win == null ? void 0 : win.close());
  ipcMain.handle("scan:run", async (event, { projectId, repoIndex, repoUrl }) => {
    const runId = `run_${Date.now()}_${Math.floor(Math.random() * 1e3)}`;
    (async () => {
      const steps = ["verify-gpg", "llm-scan"];
      for (const step of steps) {
        win == null ? void 0 : win.webContents.send("scan:progress", {
          runId,
          repo: repoUrl,
          step,
          status: "running",
          logs: [`[${step}] started for ${repoUrl}`]
        });
        for (let i = 0; i < 3; i++) {
          await new Promise((r) => setTimeout(r, 600 + Math.random() * 700));
          win == null ? void 0 : win.webContents.send("scan:progress", {
            runId,
            repo: repoUrl,
            step,
            status: "running",
            logs: [`[${step}] chunk ${i + 1} for ${repoUrl}`]
          });
        }
        const ok = Math.random() > 0.25;
        await new Promise((r) => setTimeout(r, 400));
        win == null ? void 0 : win.webContents.send("scan:progress", {
          runId,
          repo: repoUrl,
          step,
          status: ok ? "success" : "failed",
          logs: [`[${step}] ${ok ? "completed ✅" : "failed ❌"}`]
        });
        await new Promise((r) => setTimeout(r, 400));
      }
      win == null ? void 0 : win.webContents.send("scan:progress", {
        runId,
        repo: repoUrl,
        step: "summary",
        status: "done",
        logs: [`Scan finished for ${repoUrl}`]
      });
    })();
    return { runId };
  });
  ipcMain.handle("llm:query", async (event, { sessionId, prompt }) => {
    const streamId = `llm_${Date.now()}_${Math.floor(Math.random() * 1e3)}`;
    const chunks = [
      "Analyzing repository code and patterns...",
      "Checking for risky patterns, eval usage, insecure dependencies...",
      "Fetching package manifests and known CVEs...",
      "Summarizing findings: suspicious usage in parser.js and outdated package xyz@1.0.0..."
    ];
    let idx = 0;
    const interval = setInterval(() => {
      if (!win) return;
      if (idx >= chunks.length) {
        win.webContents.send("llm:stream", {
          streamId,
          sessionId,
          chunk: "[END]",
          done: true
        });
        clearInterval(interval);
        return;
      }
      win.webContents.send("llm:stream", {
        streamId,
        sessionId,
        chunk: chunks[idx],
        done: false
      });
      idx++;
    }, 650);
    return { streamId };
  });
  ipcMain.handle("ping", () => "pong");
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
  win.once("ready-to-show", () => {
    splash == null ? void 0 : splash.close();
    splash = null;
    win == null ? void 0 : win.show();
  });
}
app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
