import { app, BrowserWindow, ipcMain } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
    ? path.join(process.env.APP_ROOT, 'public')
    : RENDERER_DIST

let win: BrowserWindow | null
let splash: BrowserWindow | null = null

function sendToWin(channel: string, payload: any) {
    win?.webContents.send(channel, payload)
}

function createWindow() {

    // ---------- SPLASH ----------
    splash = new BrowserWindow({
        width: 420,
        height: 280,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: false,
        show: true,
        backgroundColor: "#00000000",
    })

    splash.loadFile(path.join(process.env.VITE_PUBLIC!, "splash.html"))

    // ---------- MAIN WINDOW ----------
    win = new BrowserWindow({
        width: 1280,
        height: 840,
        show: false,
        frame: false,
        titleBarStyle: 'hidden',
        backgroundColor: '#060712',
        icon: path.join(process.env.VITE_PUBLIC!, 'electron-vite.svg'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.mjs'),
        }
    })

    // ---------- WINDOW IPC ----------
    ipcMain.handle('window:minimize', () => win?.minimize())
    ipcMain.handle('window:maximize', () => {
        if (!win) return
        win.isMaximized() ? win.unmaximize() : win.maximize()
    })
    ipcMain.handle('window:close', () => win?.close())

// -------------------------
  // Mock Scan / LLM IPC
  // -------------------------
  // Channel: 'scan:run' -> start mock repo scan, returns a runId
  // It will send progress events on 'scan:progress' with payload { runId, repo, step, status, logs }
  // You can replace this with real code invoking a scanner via child_process or an API.
  ipcMain.handle("scan:run", async (event, { projectId, repoIndex, repoUrl }) => {
    const runId = `run_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    // simulate async scanning process in background
    (async () => {
      const steps = ["verify-gpg", "llm-scan"]; // dependency audit moved out
      for (const step of steps) {
        // notify start
        win?.webContents.send("scan:progress", {
          runId,
          repo: repoUrl,
          step,
          status: "running",
          logs: [`[${step}] started for ${repoUrl}`],
        });

        // simulate work with several chunks
        for (let i = 0; i < 3; i++) {
          await new Promise((r) => setTimeout(r, 600 + Math.random() * 700));
          win?.webContents.send("scan:progress", {
            runId,
            repo: repoUrl,
            step,
            status: "running",
            logs: [`[${step}] chunk ${i + 1} for ${repoUrl}`],
          });
        }

        // random pass/fail for demo
        const ok = Math.random() > 0.25;
        await new Promise((r) => setTimeout(r, 400));
        win?.webContents.send("scan:progress", {
          runId,
          repo: repoUrl,
          step,
          status: ok ? "success" : "failed",
          logs: [`[${step}] ${ok ? "completed ✅" : "failed ❌"}`],
        });

        // brief pause before next step
        await new Promise((r) => setTimeout(r, 400));
      }

      // final summary
      win?.webContents.send("scan:progress", {
        runId,
        repo: repoUrl,
        step: "summary",
        status: "done",
        logs: [`Scan finished for ${repoUrl}`],
      });
    })();

    return { runId };
  });

  // Channel: 'llm:query' -> simulate streaming LLM tokens using 'llm:stream' events
  ipcMain.handle("llm:query", async (event, { sessionId, prompt }) => {
    // In real implementation you'd open a streaming connection to your LLM provider
    // and push partial responses back to renderer via webContents.send('llm:stream', ...).
    const streamId = `llm_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    // simulate streaming by sending chunks
    const chunks = [
      "Analyzing repository code and patterns...",
      "Checking for risky patterns, eval usage, insecure dependencies...",
      "Fetching package manifests and known CVEs...",
      "Summarizing findings: suspicious usage in parser.js and outdated package xyz@1.0.0...",
    ];

    let idx = 0;
    const interval = setInterval(() => {
      if (!win) return;
      if (idx >= chunks.length) {
        win.webContents.send("llm:stream", {
          streamId,
          sessionId,
          chunk: "[END]",
          done: true,
        });
        clearInterval(interval);
        return;
      }
      win.webContents.send("llm:stream", {
        streamId,
        sessionId,
        chunk: chunks[idx],
        done: false,
      });
      idx++;
    }, 650);

    // Return a streamId for renderer if needed
    return { streamId };
  });

  // Fallback: simple health
  ipcMain.handle("ping", () => "pong");

  

    // ---------- LOAD FRONTEND ----------
    if (VITE_DEV_SERVER_URL) {
        win.loadURL(VITE_DEV_SERVER_URL)
    } else {
        win.loadFile(path.join(RENDERER_DIST, 'index.html'))
    }

    win.once("ready-to-show", () => {
        splash?.close()
        splash = null
        win?.show()
    })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
        win = null
    }
})
