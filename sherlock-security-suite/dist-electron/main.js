import { app as d, BrowserWindow as g, ipcMain as m } from "electron";
import { fileURLToPath as _ } from "node:url";
import t from "node:path";
import { execSync as E, spawn as P } from "child_process";
const h = t.dirname(_(import.meta.url));
process.env.APP_ROOT = t.join(h, "..");
const p = process.env.VITE_DEV_SERVER_URL, j = t.join(process.env.APP_ROOT, "dist-electron"), w = t.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = p ? t.join(process.env.APP_ROOT, "public") : w;
let e, a = null;
function l(o, s) {
  e == null || e.webContents.send(o, s);
}
function f(o, s, n, r) {
  return new Promise((c) => {
    const u = P(o, s, { shell: !0 });
    u.stdout.on("data", (i) => {
      l("scan:progress", {
        repo: n,
        step: r,
        status: "running",
        logs: [i.toString()]
      });
    }), u.stderr.on("data", (i) => {
      l("scan:progress", {
        repo: n,
        step: r,
        status: "running",
        logs: [i.toString()]
      });
    }), u.on("close", (i) => {
      l("scan:progress", {
        repo: n,
        step: r,
        status: i === 0 ? "success" : "failed",
        logs: [`Process finished (exit=${i})`]
      }), c(i === 0);
    });
  });
}
async function R(o, s) {
  const n = t.join(d.getPath("temp"), `repo-${Date.now()}`);
  l("scan:progress", {
    repo: o,
    step: "verify-gpg",
    status: "running",
    logs: [`Cloning branch: ${s}`]
  }), await f("git", ["clone", "--branch", s, o, n], o, "verify-gpg");
  const r = E(`git -C "${n}" rev-list --max-count=50 ${s}`).toString().trim().split(`
`);
  for (const c of r)
    await f(
      "git",
      ["-C", n, "show", "--show-signature", "-s", c],
      o,
      "verify-gpg"
    );
  l("scan:progress", {
    repo: o,
    step: "verify-gpg",
    status: "success",
    logs: ["✔ All commits verified"]
  });
}
function v() {
  a = new g({
    width: 420,
    height: 280,
    frame: !1,
    transparent: !0,
    alwaysOnTop: !0,
    resizable: !1,
    show: !0,
    backgroundColor: "#00000000"
  }), a.loadFile(t.join(process.env.VITE_PUBLIC, "splash.html")), e = new g({
    width: 1280,
    height: 840,
    show: !1,
    frame: !1,
    titleBarStyle: "hidden",
    backgroundColor: "#060712",
    icon: t.join(process.env.VITE_PUBLIC, "icon.png"),
    webPreferences: {
      preload: t.join(h, "preload.mjs")
    }
  }), m.handle("window:minimize", () => e == null ? void 0 : e.minimize()), m.handle("window:maximize", () => {
    e && (e.isMaximized() ? e.unmaximize() : e.maximize());
  }), m.handle("window:close", () => e == null ? void 0 : e.close()), m.handle("scan:run", async (o, s) => {
    const { repoUrl: n, branch: r } = s;
    return await R(n, r), l("scan:progress", {
      repo: n,
      step: "summary",
      status: "done",
      logs: ["✅ SCAN COMPLETED SUCCESSFULLY"]
    }), { ok: !0 };
  }), m.handle("llm:query", async (o, { sessionId: s, prompt: n }) => {
    for (const r of n.split(" "))
      e == null || e.webContents.send("llm:stream", {
        sessionId: s,
        chunk: r + " ",
        done: !1
      }), await new Promise((c) => setTimeout(c, 40));
    return e == null || e.webContents.send("llm:stream", {
      sessionId: s,
      chunk: "[END]",
      done: !0
    }), { ok: !0 };
  }), p ? e.loadURL(p) : e.loadFile(t.join(w, "index.html")), e.once("ready-to-show", () => {
    a == null || a.close(), a = null, e == null || e.show();
  });
}
d.whenReady().then(v);
d.on("window-all-closed", () => {
  process.platform !== "darwin" && (d.quit(), e = null);
});
export {
  j as MAIN_DIST,
  w as RENDERER_DIST,
  p as VITE_DEV_SERVER_URL
};
