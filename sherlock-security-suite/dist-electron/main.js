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
    frame: false,
    show: false,
    // <-- ADD THIS
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
