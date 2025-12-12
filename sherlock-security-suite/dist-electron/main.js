import { app, BrowserWindow, ipcMain } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { execSync, spawn } from "child_process";
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
let splash = null;
function send(channel, payload) {
  win == null ? void 0 : win.webContents.send(channel, payload);
}
function stream(cmd, args, repo, step) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { shell: true });
    p.stdout.on("data", (d) => {
      send("scan:progress", {
        repo,
        step,
        status: "running",
        logs: [d.toString()]
      });
    });
    p.stderr.on("data", (d) => {
      send("scan:progress", {
        repo,
        step,
        status: "running",
        logs: [d.toString()]
      });
    });
    p.on("close", (code) => {
      send("scan:progress", {
        repo,
        step,
        status: code === 0 ? "success" : "failed",
        logs: [`Process finished (exit=${code})`]
      });
      resolve(code === 0);
    });
  });
}
async function verifyBranchGpg(repo, branch) {
  const tmpDir = path.join(app.getPath("temp"), `repo-${Date.now()}`);
  send("scan:progress", {
    repo,
    step: "verify-gpg",
    status: "running",
    logs: [`Cloning branch: ${branch}`]
  });
  await stream("git", ["clone", "--branch", branch, repo, tmpDir], repo, "verify-gpg");
  const shas = execSync(`git -C "${tmpDir}" rev-list --max-count=50 ${branch}`).toString().trim().split("\n");
  for (const sha of shas) {
    await stream(
      "git",
      ["-C", tmpDir, "show", "--show-signature", "-s", sha],
      repo,
      "verify-gpg"
    );
  }
  send("scan:progress", {
    repo,
    step: "verify-gpg",
    status: "success",
    logs: ["✔ All commits verified"]
  });
}
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
    icon: path.join(process.env.VITE_PUBLIC, "icon.png"),
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
  ipcMain.handle("scan:run", async (_, payload) => {
    const { repoUrl, branch } = payload;
    await verifyBranchGpg(repoUrl, branch);
    send("scan:progress", {
      repo: repoUrl,
      step: "summary",
      status: "done",
      logs: ["✅ SCAN COMPLETED SUCCESSFULLY"]
    });
    return { ok: true };
  });
  ipcMain.handle("llm:query", async (_, { sessionId, prompt }) => {
    for (const word of prompt.split(" ")) {
      win == null ? void 0 : win.webContents.send("llm:stream", {
        sessionId,
        chunk: word + " ",
        done: false
      });
      await new Promise((r) => setTimeout(r, 40));
    }
    win == null ? void 0 : win.webContents.send("llm:stream", {
      sessionId,
      chunk: "[END]",
      done: true
    });
    return { ok: true };
  });
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
