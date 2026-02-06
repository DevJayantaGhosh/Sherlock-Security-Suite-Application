import { app as ge, BrowserWindow as he, ipcMain as x, dialog as ye } from "electron";
import { fileURLToPath as De } from "node:url";
import V from "node:path";
import { spawn as ee } from "child_process";
import ue from "fs/promises";
import H from "fs";
import Pe from "path";
import _e from "os";
import Le from "crypto";
function Ge(d) {
  return d && d.__esModule && Object.prototype.hasOwnProperty.call(d, "default") ? d.default : d;
}
var K = { exports: {} };
const be = "17.2.4", xe = {
  version: be
};
var Te;
function Ve() {
  if (Te) return K.exports;
  Te = 1;
  const d = H, e = Pe, t = _e, n = Le, T = xe.version, c = [
    "🔐 encrypt with Dotenvx: https://dotenvx.com",
    "🔐 prevent committing .env to code: https://dotenvx.com/precommit",
    "🔐 prevent building .env in docker: https://dotenvx.com/prebuild",
    "📡 add observability to secrets: https://dotenvx.com/ops",
    "👥 sync secrets across teammates & machines: https://dotenvx.com/ops",
    "🗂️ backup and recover secrets: https://dotenvx.com/ops",
    "✅ audit secrets and track compliance: https://dotenvx.com/ops",
    "🔄 add secrets lifecycle management: https://dotenvx.com/ops",
    "🔑 add access controls to secrets: https://dotenvx.com/ops",
    "🛠️  run anywhere with `dotenvx run -- yourcommand`",
    "⚙️  specify custom .env file path with { path: '/custom/path/.env' }",
    "⚙️  enable debug logging with { debug: true }",
    "⚙️  override existing env vars with { override: true }",
    "⚙️  suppress all logs with { quiet: true }",
    "⚙️  write to custom object with { processEnv: myObject }",
    "⚙️  load multiple .env files with { path: ['.env.local', '.env'] }"
  ];
  function u() {
    return c[Math.floor(Math.random() * c.length)];
  }
  function m(r) {
    return typeof r == "string" ? !["false", "0", "no", "off", ""].includes(r.toLowerCase()) : !!r;
  }
  function A() {
    return process.stdout.isTTY;
  }
  function l(r) {
    return A() ? `\x1B[2m${r}\x1B[0m` : r;
  }
  const g = /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/mg;
  function o(r) {
    const N = {};
    let R = r.toString();
    R = R.replace(/\r\n?/mg, `
`);
    let C;
    for (; (C = g.exec(R)) != null; ) {
      const P = C[1];
      let $ = C[2] || "";
      $ = $.trim();
      const p = $[0];
      $ = $.replace(/^(['"`])([\s\S]*)\1$/mg, "$2"), p === '"' && ($ = $.replace(/\\n/g, `
`), $ = $.replace(/\\r/g, "\r")), N[P] = $;
    }
    return N;
  }
  function i(r) {
    r = r || {};
    const N = W(r);
    r.path = N;
    const R = D.configDotenv(r);
    if (!R.parsed) {
      const p = new Error(`MISSING_DATA: Cannot parse ${N} for an unknown reason`);
      throw p.code = "MISSING_DATA", p;
    }
    const C = y(r).split(","), P = C.length;
    let $;
    for (let p = 0; p < P; p++)
      try {
        const _ = C[p].trim(), I = M(R, _);
        $ = D.decrypt(I.ciphertext, I.key);
        break;
      } catch (_) {
        if (p + 1 >= P)
          throw _;
      }
    return D.parse($);
  }
  function w(r) {
    console.error(`[dotenv@${T}][WARN] ${r}`);
  }
  function a(r) {
    console.log(`[dotenv@${T}][DEBUG] ${r}`);
  }
  function G(r) {
    console.log(`[dotenv@${T}] ${r}`);
  }
  function y(r) {
    return r && r.DOTENV_KEY && r.DOTENV_KEY.length > 0 ? r.DOTENV_KEY : process.env.DOTENV_KEY && process.env.DOTENV_KEY.length > 0 ? process.env.DOTENV_KEY : "";
  }
  function M(r, N) {
    let R;
    try {
      R = new URL(N);
    } catch (_) {
      if (_.code === "ERR_INVALID_URL") {
        const I = new Error("INVALID_DOTENV_KEY: Wrong format. Must be in valid uri format like dotenv://:key_1234@dotenvx.com/vault/.env.vault?environment=development");
        throw I.code = "INVALID_DOTENV_KEY", I;
      }
      throw _;
    }
    const C = R.password;
    if (!C) {
      const _ = new Error("INVALID_DOTENV_KEY: Missing key part");
      throw _.code = "INVALID_DOTENV_KEY", _;
    }
    const P = R.searchParams.get("environment");
    if (!P) {
      const _ = new Error("INVALID_DOTENV_KEY: Missing environment part");
      throw _.code = "INVALID_DOTENV_KEY", _;
    }
    const $ = `DOTENV_VAULT_${P.toUpperCase()}`, p = r.parsed[$];
    if (!p) {
      const _ = new Error(`NOT_FOUND_DOTENV_ENVIRONMENT: Cannot locate environment ${$} in your .env.vault file.`);
      throw _.code = "NOT_FOUND_DOTENV_ENVIRONMENT", _;
    }
    return { ciphertext: p, key: C };
  }
  function W(r) {
    let N = null;
    if (r && r.path && r.path.length > 0)
      if (Array.isArray(r.path))
        for (const R of r.path)
          d.existsSync(R) && (N = R.endsWith(".vault") ? R : `${R}.vault`);
      else
        N = r.path.endsWith(".vault") ? r.path : `${r.path}.vault`;
    else
      N = e.resolve(process.cwd(), ".env.vault");
    return d.existsSync(N) ? N : null;
  }
  function Z(r) {
    return r[0] === "~" ? e.join(t.homedir(), r.slice(1)) : r;
  }
  function X(r) {
    const N = m(process.env.DOTENV_CONFIG_DEBUG || r && r.debug), R = m(process.env.DOTENV_CONFIG_QUIET || r && r.quiet);
    (N || !R) && G("Loading env from encrypted .env.vault");
    const C = D._parseVault(r);
    let P = process.env;
    return r && r.processEnv != null && (P = r.processEnv), D.populate(P, C, r), { parsed: C };
  }
  function z(r) {
    const N = e.resolve(process.cwd(), ".env");
    let R = "utf8", C = process.env;
    r && r.processEnv != null && (C = r.processEnv);
    let P = m(C.DOTENV_CONFIG_DEBUG || r && r.debug), $ = m(C.DOTENV_CONFIG_QUIET || r && r.quiet);
    r && r.encoding ? R = r.encoding : P && a("No encoding is specified. UTF-8 is used by default");
    let p = [N];
    if (r && r.path)
      if (!Array.isArray(r.path))
        p = [Z(r.path)];
      else {
        p = [];
        for (const k of r.path)
          p.push(Z(k));
      }
    let _;
    const I = {};
    for (const k of p)
      try {
        const B = D.parse(d.readFileSync(k, { encoding: R }));
        D.populate(I, B, r);
      } catch (B) {
        P && a(`Failed to load ${k} ${B.message}`), _ = B;
      }
    const q = D.populate(C, I, r);
    if (P = m(C.DOTENV_CONFIG_DEBUG || P), $ = m(C.DOTENV_CONFIG_QUIET || $), P || !$) {
      const k = Object.keys(q).length, B = [];
      for (const Ee of p)
        try {
          const re = e.relative(process.cwd(), Ee);
          B.push(re);
        } catch (re) {
          P && a(`Failed to load ${Ee} ${re.message}`), _ = re;
        }
      G(`injecting env (${k}) from ${B.join(",")} ${l(`-- tip: ${u()}`)}`);
    }
    return _ ? { parsed: I, error: _ } : { parsed: I };
  }
  function se(r) {
    if (y(r).length === 0)
      return D.configDotenv(r);
    const N = W(r);
    return N ? D._configVault(r) : (w(`You set DOTENV_KEY but you are missing a .env.vault file at ${N}. Did you forget to build it?`), D.configDotenv(r));
  }
  function Y(r, N) {
    const R = Buffer.from(N.slice(-64), "hex");
    let C = Buffer.from(r, "base64");
    const P = C.subarray(0, 12), $ = C.subarray(-16);
    C = C.subarray(12, -16);
    try {
      const p = n.createDecipheriv("aes-256-gcm", R, P);
      return p.setAuthTag($), `${p.update(C)}${p.final()}`;
    } catch (p) {
      const _ = p instanceof RangeError, I = p.message === "Invalid key length", q = p.message === "Unsupported state or unable to authenticate data";
      if (_ || I) {
        const k = new Error("INVALID_DOTENV_KEY: It must be 64 characters long (or more)");
        throw k.code = "INVALID_DOTENV_KEY", k;
      } else if (q) {
        const k = new Error("DECRYPTION_FAILED: Please check your DOTENV_KEY");
        throw k.code = "DECRYPTION_FAILED", k;
      } else
        throw p;
    }
  }
  function v(r, N, R = {}) {
    const C = !!(R && R.debug), P = !!(R && R.override), $ = {};
    if (typeof N != "object") {
      const p = new Error("OBJECT_REQUIRED: Please check the processEnv argument being passed to populate");
      throw p.code = "OBJECT_REQUIRED", p;
    }
    for (const p of Object.keys(N))
      Object.prototype.hasOwnProperty.call(r, p) ? (P === !0 && (r[p] = N[p], $[p] = N[p]), C && a(P === !0 ? `"${p}" is already defined and WAS overwritten` : `"${p}" is already defined and was NOT overwritten`)) : (r[p] = N[p], $[p] = N[p]);
    return $;
  }
  const D = {
    configDotenv: z,
    _configVault: X,
    _parseVault: i,
    config: se,
    decrypt: Y,
    parse: o,
    populate: v
  };
  return K.exports.configDotenv = D.configDotenv, K.exports._configVault = D._configVault, K.exports._parseVault = D._parseVault, K.exports.config = D.config, K.exports.decrypt = D.decrypt, K.exports.parse = D.parse, K.exports.populate = D.populate, K.exports = D, K.exports;
}
var Ie = Ve();
const ke = /* @__PURE__ */ Ge(Ie), me = V.dirname(De(import.meta.url));
process.env.APP_ROOT = V.join(me, "..");
const $e = process.env.VITE_DEV_SERVER_URL, Xe = V.join(process.env.APP_ROOT, "dist-electron"), Ne = V.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = $e ? V.join(process.env.APP_ROOT, "public") : Ne;
const Me = [
  V.join(process.env.APP_ROOT, ".env"),
  // ROOT .env (dev + prod)
  V.join(me, ".env"),
  // src/.env fallback
  V.join(process.resourcesPath || me, ".env")
  // Packaged app
];
ke.config({ path: Me.find((d) => H.existsSync(d)) });
console.log("✅ .env loaded:", process.env.GITHUB_PAT ? "GITHUB_PAT found" : "No token");
let U = null, pe = null;
const S = /* @__PURE__ */ new Map(), fe = /* @__PURE__ */ new Map();
function O(d) {
  console.log(`[ELECTRON][${(/* @__PURE__ */ new Date()).toISOString()}] ${d}`);
}
function ve() {
  return process.platform === "win32" ? "win" : process.platform === "darwin" ? "darwin" : "linux";
}
function oe(d) {
  const e = process.platform === "win32" ? ".exe" : "", t = d + e;
  return V.join(
    process.env.APP_ROOT,
    "tools",
    ve(),
    d,
    t
  );
}
function ce(d) {
  const e = oe(d);
  if (!H.existsSync(e))
    return O(`Tool not found: ${e}`), null;
  try {
    H.accessSync(e, H.constants.X_OK);
  } catch {
    if (O(`${d} not executable: ${e}`), process.platform !== "win32")
      try {
        H.chmodSync(e, 493), O(`Set execute permission on ${e}`);
      } catch (n) {
        return O(`Failed to set permissions: ${n.message}`), null;
      }
  }
  return O(`Found ${d} at: ${e}`), e;
}
function Q(d, e) {
  if (!d || !d.pid) {
    O(`No PID for ${e}`);
    return;
  }
  O(`Killing ${e} (PID: ${d.pid})`);
  try {
    if (process.platform === "win32")
      ee("taskkill", ["/pid", d.pid.toString(), "/f", "/t"], {
        stdio: "ignore"
      });
    else
      try {
        process.kill(-d.pid, "SIGKILL");
      } catch {
        d.kill("SIGKILL");
      }
  } catch (t) {
    O(`Kill error ${e}: ${t.message}`);
    try {
      d.kill("SIGKILL");
    } catch {
    }
  }
}
function Fe() {
  return process.env.GITHUB_PAT || null;
}
async function ae(d, e, t, n) {
  const s = `${e}:${t}`;
  if (fe.has(s)) {
    const l = fe.get(s);
    try {
      return await ue.access(V.join(l, ".git")), O(`Using cached repo: ${l}`), d.sender.send(`scan-log:${n}`, {
        log: `✅ Using cached repository
   Path: ${l}
   Branch: ${t}

`,
        progress: 50
      }), l;
    } catch {
      fe.delete(s);
    }
  }
  d.sender.send(`scan-log:${n}`, {
    log: `
${"═".repeat(60)}
📦 CLONING REPOSITORY
${"═".repeat(60)}
`,
    progress: 5
  }), d.sender.send(`scan-log:${n}`, {
    log: `Repository: ${e}
Branch: ${t}

`,
    progress: 10
  });
  const T = Fe();
  let c = e;
  T && !e.includes("x-access-token") && (c = e.replace("https://", `https://x-access-token:${T}@`));
  const u = e.split("/").pop()?.replace(".git", "") || "repo", m = Date.now(), A = V.join(
    ge.getPath("temp"),
    "software-security-scans",
    `${u}-${t.replace(/\//g, "-")}-${m}`
  );
  try {
    return await ue.mkdir(A, { recursive: !0 }), await new Promise((l) => {
      const g = ["clone", "-b", t, "--single-branch", c, A];
      d.sender.send(`scan-log:${n}`, {
        log: `$ git clone in-progress ...

`,
        progress: 15
      });
      const o = ee("git", g, {
        detached: !0,
        stdio: ["ignore", "pipe", "pipe"]
      });
      o.unref();
      const i = `${n}-clone`;
      S.set(i, o);
      let w = !1, a = 0;
      o.stdout?.on("data", (y) => {
        a++, d.sender.send(`scan-log:${n}`, {
          log: y.toString(),
          progress: Math.min(20 + a * 2, 45)
        });
      }), o.stderr?.on("data", (y) => {
        a++, d.sender.send(`scan-log:${n}`, {
          log: y.toString(),
          progress: Math.min(20 + a * 2, 45)
        });
      }), o.on("close", (y) => {
        if (S.delete(i), w) {
          l(null);
          return;
        }
        y === 0 ? (fe.set(s, A), d.sender.send(`scan-log:${n}`, {
          log: `
✅ Clone successful!
   Location: ${A}
${"═".repeat(60)}

`,
          progress: 50
        }), l(A)) : (d.sender.send(`scan-log:${n}`, {
          log: `
❌ Clone failed with exit code ${y}
`,
          progress: 0
        }), l(null));
      }), o.on("error", (y) => {
        S.delete(i), d.sender.send(`scan-log:${n}`, {
          log: `
❌ Clone error: ${y.message}
`,
          progress: 0
        }), l(null);
      });
      const G = () => {
        w = !0, O(`Cancelling clone: ${i}`), Q(o, i), S.delete(i), l(null);
      };
      x.once(`scan:cancel-${n}`, G), setTimeout(() => {
        S.has(i) && (Q(o, i), d.sender.send(`scan-log:${n}`, {
          log: `
❌ Clone timeout after 3 minutes
`,
          progress: 0
        }), l(null));
      }, 18e4);
    });
  } catch (l) {
    return d.sender.send(`scan-log:${n}`, {
      log: `
❌ Exception: ${l.message}
`,
      progress: 0
    }), null;
  }
}
function Ue() {
  x.handle("scan:verify-gpg", async (e, { repoUrl: t, branch: n, scanId: s }) => {
    O(`[GPG] Starting verification for ${t} on branch ${n}`);
    const T = await ae(e, t, n, s);
    return T ? new Promise((c) => {
      e.sender.send(`scan-log:${s}`, {
        log: `
${"═".repeat(60)}
🔐 GPG SIGNATURE VERIFICATION
${"═".repeat(60)}

`,
        progress: 52
      }), e.sender.send(`scan-log:${s}`, {
        log: `🔍 Analyzing ALL commit signatures on branch: ${n}...

`,
        progress: 55
      });
      const u = ee(
        "git",
        ["log", "--show-signature", "--pretty=format:%H|%an|%aI|%s", n],
        {
          cwd: T,
          detached: !0,
          stdio: ["ignore", "pipe", "pipe"]
        }
      );
      u.unref(), S.set(s, u);
      let m = "", A = "", l = 0, g = 0, o = !1;
      u.stdout?.on("data", (i) => {
        o || (m += i.toString());
      }), u.stderr?.on("data", (i) => {
        o || (A += i.toString());
      }), u.on("close", (i) => {
        if (S.delete(s), o) {
          c({ success: !1, cancelled: !0 });
          return;
        }
        const a = (m + `
` + A).split(`
`);
        for (let M = 0; M < a.length; M++) {
          const W = a[M].trim();
          if (W.includes("|")) {
            l++;
            const [Z, X, z, se] = W.split("|");
            let Y = !1, v = "";
            for (let r = Math.max(0, M - 20); r < M; r++)
              v += a[r] + `
`;
            (v.includes("Good signature from") || v.includes("gpg: Good signature") || v.includes("Signature made") || v.includes("using RSA key") && v.includes("Good") || v.includes("using ECDSA key") && v.includes("Good")) && (Y = !0, g++), v.includes("Verified") && !Y && (Y = !0, g++);
            const D = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 Commit ${l}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SHA     : ${Z.substring(0, 8)}
Author  : ${X}
Date    : ${z}
Message : ${se}

GPG     : ${Y ? "✅ GOOD SIGNATURE" : "❌ MISSING/INVALID"}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
            e.sender.send(`scan-log:${s}`, {
              log: D,
              progress: 55 + Math.min(l / Math.max(l, 1) * 35, 35)
            }), v = "";
          }
        }
        const G = l > 0 ? Math.round(g / l * 100) : 0, y = `


╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║              🛡️  GPG SIGNED COMMITS VERIFICATION SUMMARY  🛡️                 ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝

Branch           : ${n}
Total Commits    : ${l}
Good Signatures  : ${g}
Missing/Invalid  : ${l - g}
Success Rate     : ${G}%
Status           : ${i === 0 ? "✅ COMPLETE" : "❌ FAILED"}

${"═".repeat(79)}
`;
        e.sender.send(`scan-log:${s}`, {
          log: y,
          progress: 100
        }), e.sender.send(`scan-complete:${s}`, {
          success: i === 0,
          totalCommits: l,
          goodSignatures: g
        }), c({ success: i === 0, totalCommits: l, goodSignatures: g });
      }), u.on("error", (i) => {
        S.delete(s), e.sender.send(`scan-complete:${s}`, {
          success: !1,
          error: i.message
        }), c({ success: !1, error: i.message });
      }), x.once(`scan:cancel-${s}`, () => {
        o = !0, O(`Cancelling GPG scan: ${s}`), Q(u, s), S.delete(s), c({ success: !1, cancelled: !0 });
      });
    }) : (e.sender.send(`scan-complete:${s}`, {
      success: !1,
      error: "Clone failed"
    }), { success: !1, error: "Clone failed" });
  }), x.handle("scan:gitleaks", async (e, { repoUrl: t, branch: n, scanId: s }) => {
    O(`[GITLEAKS] Starting scan for ${t}`);
    const T = ce("gitleaks");
    if (!T)
      return e.sender.send(`scan-log:${s}`, {
        log: `
❌ Gitleaks tool not found
   Expected: ${oe("gitleaks")}

`,
        progress: 0
      }), e.sender.send(`scan-complete:${s}`, {
        success: !1,
        error: "Tool not found"
      }), { success: !1, error: "Tool not found" };
    const c = await ae(e, t, n, s);
    if (!c)
      return e.sender.send(`scan-complete:${s}`, {
        success: !1,
        error: "Clone failed"
      }), { success: !1, error: "Clone failed" };
    const u = V.join(c, "gitleaks-report.json");
    return new Promise((m) => {
      e.sender.send(`scan-log:${s}`, {
        log: `
${"═".repeat(60)}
🔐 SECRETS & CREDENTIALS DETECTION
${"═".repeat(60)}

`,
        progress: 52
      }), e.sender.send(`scan-log:${s}`, {
        log: `🔍 Scanning for hardcoded secrets and credentials...

`,
        progress: 55
      });
      const A = {
        cwd: c,
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          NO_COLOR: "1"
          // Removed ANSI colors for cleaner parsing
        }
      };
      process.platform === "win32" ? (A.windowsHide = !0, A.shell = !1, A.detached = !1) : A.detached = !0;
      const l = ee(
        T,
        ["detect", "--source", c, "--report-path", u, "--verbose"],
        A
      );
      process.platform !== "win32" && l.unref(), S.set(s, l);
      let g = !1;
      l.stdout?.on("data", (o) => {
        g || e.sender.send(`scan-log:${s}`, {
          log: o.toString(),
          progress: 70
        });
      }), l.stderr?.on("data", (o) => {
        g || e.sender.send(`scan-log:${s}`, {
          log: o.toString(),
          progress: 85
        });
      }), l.on("close", async () => {
        if (S.delete(s), g) {
          m({ success: !1, cancelled: !0 });
          return;
        }
        let o = 0;
        if (H.existsSync(u))
          try {
            const w = JSON.parse(await ue.readFile(u, "utf-8"));
            o = w.length || 0, o > 0 && (e.sender.send(`scan-log:${s}`, {
              log: `
🔍 DETAILED FINDINGS:
${"═".repeat(79)}

`,
              progress: 90
            }), w.forEach((a, G) => {
              const y = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 Secret ${G + 1}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Type        : ${a.RuleID || "Unknown"}
Description : ${a.Description || a.RuleID || "N/A"}
File        : ${a.File || "N/A"}
Line        : ${a.StartLine || "N/A"}
Commit      : ${a.Commit?.substring(0, 8) || "N/A"}
Author      : ${a.Author || "N/A"}
Date        : ${a.Date || "N/A"}

Match       : ${a.Match?.substring(0, 80) || "N/A"}${a.Match?.length > 80 ? "..." : ""}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
              e.sender.send(`scan-log:${s}`, {
                log: y,
                progress: 90 + Math.floor(G / o * 5)
              });
            }));
          } catch (w) {
            O(`Error parsing Gitleaks report: ${w}`);
          }
        const i = `

╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║                🔐  SECRETS & CREDENTIALS LEAKAGE SUMMARY  🔐                 ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝

Potential Secrets : ${o}
Status            : ${o > 0 ? "🚨 SECRETS DETECTED" : "✅ CLEAN"}
Severity          : ${o > 0 ? "HIGH - Immediate action required" : "NONE"}

${"═".repeat(79)}
`;
        e.sender.send(`scan-log:${s}`, {
          log: i,
          progress: 100
        }), e.sender.send(`scan-complete:${s}`, {
          success: !0,
          findings: o
        }), m({ success: !0, findings: o });
      }), l.on("error", (o) => {
        S.delete(s), e.sender.send(`scan-complete:${s}`, {
          success: !1,
          error: o.message
        }), m({ success: !1, error: o.message });
      }), x.once(`scan:cancel-${s}`, () => {
        g = !0, O(`Cancelling Gitleaks scan: ${s}`), Q(l, s), S.delete(s), m({ success: !1, cancelled: !0 });
      });
    });
  });
  function d(e) {
    if (!e.Results || e.Results.length === 0) return "";
    let t = `
🔎 DETAILED VULNERABILITY REPORT
`;
    return t += `════════════════════════════════════════════════════════════
`, e.Results.forEach((n) => {
      n.Vulnerabilities && n.Vulnerabilities.length > 0 && (t += `
📂 Target: ${n.Target}
`, t += `   Type:   ${n.Type}
`, t += `   ────────────────────────────────────────────────────────
`, n.Vulnerabilities.forEach((s) => {
        const T = s.Severity === "CRITICAL" ? "🔴" : s.Severity === "HIGH" ? "🟠" : s.Severity === "MEDIUM" ? "🟡" : "🔵";
        t += `   ${T} [${s.Severity}] ${s.VulnerabilityID}
`, t += `      📦 Package: ${s.PkgName} (${s.InstalledVersion})
`, t += `      ⚠️ Title:   ${s.Title || "N/A"}
`, s.FixedVersion && (t += `      ✅ Fixed in: ${s.FixedVersion}
`), t += `
`;
      }));
    }), t;
  }
  x.handle("scan:trivy", async (e, { repoUrl: t, branch: n, scanId: s }) => {
    O(`[TRIVY] Starting SBOM scan for ${t}`);
    const T = ce("trivy");
    if (!T)
      return e.sender.send(`scan-log:${s}`, {
        log: `
❌ Trivy tool not found
   Expected: ${oe("trivy")}

`,
        progress: 0
      }), e.sender.send(`scan-complete:${s}`, {
        success: !1,
        error: "Tool not found"
      }), { success: !1, error: "Tool not found" };
    const c = await ae(e, t, n, s);
    return c ? new Promise((u) => {
      e.sender.send(`scan-log:${s}`, {
        log: `
${"═".repeat(60)}
🛡️ TRIVY SBOM & VULNERABILITY SCAN
${"═".repeat(60)}

`,
        progress: 52
      }), e.sender.send(`scan-log:${s}`, {
        log: `🔍 Analyzing dependencies and security vulnerabilities...
📦 Building Software Bill of Materials (SBOM)...

`,
        progress: 55
      });
      const m = ee(
        T,
        ["fs", "--scanners", "vuln,misconfig", "--format", "json", c],
        {
          detached: !0,
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: !0
        }
      );
      m.unref(), S.set(s, m);
      let A = "", l = !1;
      m.stdout?.on("data", (g) => {
        l || (A += g.toString(), e.sender.send(`scan-log:${s}`, {
          log: `🔍 Analyzing dependencies and vulnerabilities...
`,
          progress: 70
        }));
      }), m.stderr?.on("data", (g) => {
        if (l) return;
        const o = g.toString();
        !o.includes("Update") && !o.includes("deprecated") && e.sender.send(`scan-log:${s}`, {
          log: o,
          progress: 85
        });
      }), m.on("close", (g) => {
        if (S.delete(s), l) {
          u({ success: !1, cancelled: !0 });
          return;
        }
        if (g === 0)
          try {
            const o = JSON.parse(A), i = o.Results?.reduce(
              (G, y) => G + (y.Vulnerabilities?.length || 0),
              0
            ) || 0, w = d(o);
            e.sender.send(`scan-log:${s}`, {
              log: w,
              progress: 95
            });
            const a = `

╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║                 🚨  SBOM & VULNERABILITY SCAN SUMMARY  🚨                    ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝

Vulnerabilities : ${i}
Status          : ${i > 0 ? "🚨 VULNERABILITIES DETECTED" : "✅ NO VULNERABILITIES"}
Risk Level      : ${i > 10 ? "CRITICAL" : i > 5 ? "HIGH" : i > 0 ? "MEDIUM" : "NONE"}

${"═".repeat(79)}
`;
            e.sender.send(`scan-log:${s}`, {
              log: a,
              progress: 100
            }), e.sender.send(`scan-complete:${s}`, {
              success: !0,
              vulnerabilities: i
            }), u({ success: !0, vulnerabilities: i });
          } catch (o) {
            console.error("Trivy Parse Error:", o), e.sender.send(`scan-complete:${s}`, {
              success: !1,
              error: "Failed to parse Trivy results"
            }), u({ success: !1, error: "Failed to parse Trivy results" });
          }
        else
          e.sender.send(`scan-complete:${s}`, {
            success: !1,
            error: `Trivy exited with code ${g}`
          }), u({ success: !1, error: `Trivy exited with code ${g}` });
      }), m.on("error", (g) => {
        S.delete(s), e.sender.send(`scan-complete:${s}`, {
          success: !1,
          error: g.message
        }), u({ success: !1, error: g.message });
      }), x.once(`scan:cancel-${s}`, () => {
        l = !0, O(`Cancelling Trivy scan: ${s}`), Q(m, s), S.delete(s), u({ success: !1, cancelled: !0 });
      });
    }) : (e.sender.send(`scan-complete:${s}`, {
      success: !1,
      error: "Clone failed"
    }), { success: !1, error: "Clone failed" });
  }), x.handle("scan:opengrep", async (e, { repoUrl: t, branch: n, scanId: s }) => {
    O(`[OPENGREP] Starting multi-language SAST analysis for ${t}`);
    const T = ce("opengrep");
    if (!T)
      return e.sender.send(`scan-log:${s}`, {
        log: `
❌ OpenGrep tool not found
   Expected: ${oe("opengrep")}

`,
        progress: 0
      }), e.sender.send(`scan-complete:${s}`, { success: !1, error: "Tool not found" }), { success: !1, error: "Tool not found" };
    const c = await ae(e, t, n, s);
    return c ? new Promise((u) => {
      e.sender.send(`scan-log:${s}`, {
        log: `
${"═".repeat(79)}
🔬 STATIC APPLICATION SECURITY TESTING (SAST) 
${"═".repeat(79)}

`,
        progress: 52
      }), e.sender.send(`scan-log:${s}`, {
        log: `📦 Repository: ${t}
🌿 Branch: ${n}


`,
        progress: 54
      });
      const m = V.join(c, "opengrep-report.json"), A = [
        "scan",
        "--config",
        "auto",
        "--json",
        "--output",
        m,
        "--verbose",
        "--no-git-ignore",
        c
      ];
      e.sender.send(`scan-log:${s}`, {
        log: `🔍 Scanning entire repository recursively (all folders)...
`,
        progress: 60
      }), e.sender.send(`scan-log:${s}`, {
        log: `⏳ This may take 1-3 minutes...

`,
        progress: 62
      });
      const l = {
        cwd: c,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, NO_COLOR: "1" },
        windowsHide: !0,
        shell: !1,
        detached: !1
      }, g = ee(T, A, l), o = `${s}-opengrep`;
      S.set(o, g);
      let i = !1, w = 0, a = "", G = "";
      g.stdout?.on("data", (y) => {
        i || (w++, a += y.toString(), e.sender.send(`scan-log:${s}`, {
          log: "",
          progress: Math.min(65 + Math.floor(w / 5), 85)
        }));
      }), g.stderr?.on("data", (y) => {
        i || (G += y.toString());
      }), g.on("close", async (y) => {
        if (S.delete(o), i) {
          u({ success: !1, cancelled: !0 });
          return;
        }
        O(`[OPENGREP] Process exited with code: ${y}`);
        let M = 0, W = 0, Z = 0, X = [], z = 0, se = 0, Y = 0, v = 0;
        if (H.existsSync(m))
          try {
            let r = function(E) {
              const f = E.replace(/\\/g, "/");
              return f.startsWith(p) ? f.substring(p.length + 1) : f;
            };
            const N = await ue.readFile(m, "utf-8"), R = JSON.parse(N);
            X = R.results || [], M = X.length, Z = M;
            const C = R.paths?.scanned || [], P = R.paths?.skipped || [];
            W = C.length;
            const $ = C.length, p = c.replace(/\\/g, "/"), _ = /* @__PURE__ */ new Set([
              ".git",
              ".idea",
              ".vscode",
              ".github",
              "node_modules",
              "dist",
              "build",
              "target",
              "out",
              "bin",
              "__pycache__",
              ".gradle",
              "coverage",
              ".next",
              ".nuxt",
              ".venv",
              "venv"
            ]), I = /* @__PURE__ */ new Set(), q = /* @__PURE__ */ new Map();
            try {
              (await ue.readdir(c, { withFileTypes: !0 })).forEach((f) => {
                f.isDirectory() && !_.has(f.name) && (I.add(f.name), q.set(f.name, 0));
              }), O(`[OPENGREP] Found ${I.size} project directories`);
            } catch (E) {
              O(`Error reading repo directory: ${E.message}`);
            }
            C.forEach((E) => {
              const L = r(E).replace(/\\/g, "/").split("/").filter((h) => h && h !== ".");
              if (L.length !== 0 && L.length > 1) {
                const h = L[0];
                I.has(h) && q.set(h, (q.get(h) || 0) + 1);
              }
            });
            const k = /* @__PURE__ */ new Set();
            let B = 0;
            const re = /(?:running|loaded|scanning with)\s+(\d+)\s+rules?/gi.exec(G);
            re && (B = parseInt(re[1])), G.split(`
`).forEach((E) => {
              const f = E.trim(), b = f.match(/^(?:rule|checking|running):\s*([a-zA-Z0-9._\-:\/]+)$/i);
              b && k.add(b[1]), f.includes(".") && f.length > 10 && f.length < 100 && !f.includes(" ") && /^[a-zA-Z0-9._\-:\/]+$/.test(f) && k.add(f);
            });
            const ne = /* @__PURE__ */ new Map();
            X.forEach((E) => {
              const f = (E.extra?.severity || "WARNING").toUpperCase();
              f === "ERROR" || f === "CRITICAL" ? z++ : f === "WARNING" || f === "HIGH" ? se++ : f === "MEDIUM" ? Y++ : v++, E.check_id && k.add(E.check_id);
              const b = E.path || "", j = r(b).replace(/\\/g, "/").split("/").filter((F) => F && F !== ".");
              if (j.length > 1) {
                const F = j[0];
                I.has(F) && (ne.has(F) || ne.set(F, []), ne.get(F).push(E));
              }
            }), e.sender.send(`scan-log:${s}`, {
              log: `
✅ Scan completed successfully!

`,
              progress: 88
            });
            const Se = Array.from(q.values()).reduce((E, f) => E + f, 0), de = $ - Se, te = Array.from(q.entries()).filter(([E, f]) => f > 0 && I.has(E)).sort((E, f) => f[1] - E[1]);
            if (te.length > 0) {
              if (e.sender.send(`scan-log:${s}`, {
                log: `

📂 FILES BY PROJECT:
${"─".repeat(79)}

`,
                progress: 89
              }), te.forEach(([E, f]) => {
                const b = ne.get(E) || [], L = b.length === 0 ? "✅" : b.length <= 5 ? "🟡" : "🔴", h = $ > 0 ? Math.round(f / $ * 100) : 0;
                e.sender.send(`scan-log:${s}`, {
                  log: `  ${L} ${E.padEnd(40)} ${f.toString().padStart(4)} files (${h.toString().padStart(2)}%)${b.length > 0 ? ` — ${b.length} issue(s)` : ""}
`,
                  progress: 89
                });
              }), de > 0) {
                const E = $ > 0 ? Math.round(de / $ * 100) : 0;
                e.sender.send(`scan-log:${s}`, {
                  log: `  📄 [root/misc] (config/metadata)           ${de.toString().padStart(4)} files (${E.toString().padStart(2)}%)
`,
                  progress: 89
                });
              }
            } else $ > 0 && e.sender.send(`scan-log:${s}`, {
              log: `
📂 FILES SCANNED: ${$} (root level or flat structure)
`,
              progress: 89
            });
            if (e.sender.send(`scan-log:${s}`, {
              log: `

🛡️  SECURITY RULES APPLIED:
${"═".repeat(79)}

`,
              progress: 90
            }), B > 0 && e.sender.send(`scan-log:${s}`, {
              log: `   OpenGrep scanned ${$} files using ${B} security rules

`,
              progress: 90
            }), k.size > 0) {
              const E = /* @__PURE__ */ new Map();
              k.forEach((b) => {
                const L = b.split(".");
                let h = "Other";
                L.includes("security") ? h = "Security" : L.includes("best-practice") ? h = "Best Practice" : L.includes("performance") ? h = "Performance" : L.includes("correctness") ? h = "Correctness" : L.includes("audit") ? h = "Security Audit" : L.length >= 2 && (h = L[1]), E.has(h) || E.set(h, []), E.get(h).push(b);
              });
              const f = Array.from(E.entries()).sort((b, L) => L[1].length - b[1].length);
              f.length > 0 && (e.sender.send(`scan-log:${s}`, { log: `   Sample Rules by Category:

`, progress: 90 }), f.slice(0, 8).forEach(([b, L]) => {
                e.sender.send(`scan-log:${s}`, {
                  log: `   📋 ${b} (${L.length} rule${L.length > 1 ? "s" : ""})
`,
                  progress: 90
                }), L.slice(0, 3).forEach((h) => {
                  e.sender.send(`scan-log:${s}`, { log: `      • ${h}
`, progress: 90 });
                }), L.length > 3 && e.sender.send(`scan-log:${s}`, { log: `      ... and ${L.length - 3} more
`, progress: 90 }), e.sender.send(`scan-log:${s}`, { log: `
`, progress: 90 });
              }));
            }
            if (M > 0) {
              e.sender.send(`scan-log:${s}`, {
                log: `

🚨 SECURITY FINDINGS:
${"═".repeat(79)}

`,
                progress: 91
              });
              const E = `
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🔴 Critical/Error       : ${z.toString().padStart(4)}                                             │
│ 🟠 High/Warning         : ${se.toString().padStart(4)}                                             │
│ 🟡 Medium               : ${Y.toString().padStart(4)}                                             │
│ 🔵 Low/Info             : ${v.toString().padStart(4)}                                             │
└─────────────────────────────────────────────────────────────────────────────┘
`;
              e.sender.send(`scan-log:${s}`, { log: E, progress: 91 });
              const f = Array.from(ne.entries()).filter(([h]) => h.length > 0).sort((h, j) => j[1].length - h[1].length);
              f.length > 0 && (e.sender.send(`scan-log:${s}`, { log: `
📂 ISSUES BY PROJECT:
${"─".repeat(79)}

`, progress: 91 }), f.forEach(([h, j]) => {
                const F = j.filter((ie) => {
                  const J = (ie.extra?.severity || "WARNING").toUpperCase();
                  return J === "ERROR" || J === "CRITICAL";
                }).length, le = j.filter((ie) => {
                  const J = (ie.extra?.severity || "WARNING").toUpperCase();
                  return J === "WARNING" || J === "HIGH";
                }).length;
                e.sender.send(`scan-log:${s}`, {
                  log: `  📂 ${h}/ — ${j.length} total | 🔴 ${F} critical | 🟠 ${le} high
`,
                  progress: 91
                });
              })), e.sender.send(`scan-log:${s}`, {
                log: `

🔍 TOP ${Math.min(10, M)} CRITICAL FINDINGS:
${"═".repeat(79)}

`,
                progress: 92
              });
              const b = {
                ERROR: 4,
                CRITICAL: 4,
                WARNING: 3,
                HIGH: 3,
                MEDIUM: 2,
                INFO: 1,
                LOW: 1
              };
              X.sort((h, j) => {
                const F = (h.extra?.severity || "WARNING").toUpperCase(), le = (j.extra?.severity || "WARNING").toUpperCase();
                return (b[le] || 0) - (b[F] || 0);
              }).slice(0, 10).forEach((h, j) => {
                const F = (h.extra?.severity || "WARNING").toUpperCase(), le = F === "ERROR" || F === "CRITICAL" ? "🔴 CRITICAL" : F === "WARNING" || F === "HIGH" ? "🟠 HIGH    " : "🔵 LOW     ", ie = h.path || "N/A", J = r(ie), Oe = J.length > 60 ? "..." + J.slice(-57) : J, Ae = `
${j + 1}. ${le} │ ${h.check_id || "Unknown Rule"}
   File: ${Oe}
   Line: ${h.start?.line || "?"}
   ${h.extra?.message || h.message || "No description"}
${"─".repeat(79)}
`;
                e.sender.send(`scan-log:${s}`, { log: Ae, progress: 93 });
              });
            } else
              e.sender.send(`scan-log:${s}`, {
                log: `

✅ NO SECURITY ISSUES DETECTED!
${"═".repeat(79)}

`,
                progress: 95
              }), e.sender.send(`scan-log:${s}`, {
                log: `🎉 All ${$} files passed security analysis.
🛡️  No vulnerabilities found. Repository is secure!
`,
                progress: 95
              });
            const Ce = te.length > 0 ? te.map(([E]) => E).slice(0, 3).join(", ") + (te.length > 3 ? `, +${te.length - 3} more` : "") : "No sub-projects detected", we = `
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║                        📊  SAST ANALYSIS SUMMARY  📊                         ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝

Repository        : ${t}
Branch            : ${n}
Scan Engine       : OpenGrep (Open Source SAST)

📁 SCAN COVERAGE
───────────────────────────────────────────────────────────────────────────────
  Total Files Scanned     : ${$}
  Projects Scanned        : ${te.length} (${Ce})
  Files Skipped           : ${P.length}
  Rules Applied           : ${B > 0 ? B : "Auto (Community Rules)"}

  Breakdown:
   - Project Code         : ${Se}
   - Config/Root/Misc     : ${de}

🔍 FINDINGS SUMMARY
───────────────────────────────────────────────────────────────────────────────
  Total Issues            : ${M}
  🔴 Critical/Error       : ${z}
  🟠 High/Warning         : ${se}
  🟡 Medium               : ${Y}
  🔵 Low/Info             : ${v}

🎯 SECURITY VERDICT
───────────────────────────────────────────────────────────────────────────────
${M === 0 ? `  ✅ SECURE — All code passed security checks
  ✅ No vulnerabilities detected
  ✅ Safe to deploy to production` : z > 0 ? `  🚨 CRITICAL RISK — ${z} critical vulnerabilities detected
  ⛔ DO NOT DEPLOY until all critical issues are fixed
  🔧 Immediate remediation required` : `  ⚠️  RISKS DETECTED — ${M} issues found
  🔧 Review required`}
═══════════════════════════════════════════════════════════════════════════════
`;
            e.sender.send(`scan-log:${s}`, {
              log: we,
              progress: 100
            });
          } catch (r) {
            O(`Error parsing OpenGrep report: ${r.message}`), e.sender.send(`scan-log:${s}`, {
              log: `
❌ Error parsing report: ${r.message}
`,
              progress: 100
            });
          }
        else
          e.sender.send(`scan-log:${s}`, {
            log: `
⚠️ No report file generated
`,
            progress: 100
          }), G.trim() && e.sender.send(`scan-log:${s}`, { log: `
❌ Error details:
${G}
`, progress: 100 });
        const D = y === 0 || y === 1;
        e.sender.send(`scan-complete:${s}`, {
          success: D,
          totalIssues: M,
          passedChecks: W,
          failedChecks: Z,
          error: D ? void 0 : `Scan exited with code ${y}`
        }), u({ success: D, totalIssues: M, passedChecks: W, failedChecks: Z });
      }), g.on("error", (y) => {
        S.delete(o), e.sender.send(`scan-log:${s}`, { log: `
❌ OpenGrep process error: ${y.message}
`, progress: 0 }), e.sender.send(`scan-complete:${s}`, { success: !1, error: y.message }), u({ success: !1, error: y.message });
      }), x.once(`scan:cancel-${s}`, () => {
        i = !0, O(`Cancelling OpenGrep scan: ${s}`), e.sender.send(`scan-log:${s}`, { log: `
⚠️ Scan cancelled by user
`, progress: 0 }), Q(g, o), S.delete(o), u({ success: !1, cancelled: !0 });
      });
    }) : (e.sender.send(`scan-complete:${s}`, { success: !1, error: "Clone failed" }), { success: !1, error: "Clone failed" });
  }), x.handle("crypto:generate-keys", async (e, { type: t, size: n, curve: s, password: T, outputDir: c, scanId: u }) => {
    const m = ce("KeyGenerator");
    return m ? new Promise((A) => {
      e.sender.send(`scan-log:${u}`, {
        log: `
${"═".repeat(65)}
🔑 KEY GENERATION STARTED
${"═".repeat(65)}

🔹 Algorithm: ${t.toUpperCase()}${t === "rsa" ? ` (${n} bits)` : ` (${s})`}
🔹 Output: ${c}
🔹 Security: ${T ? "🔒 Protected" : "⚠️ No Password"}

`,
        progress: 5
      });
      const l = ["generate", t];
      t === "rsa" && n && l.push("-s", `${n}`), t === "ecdsa" && s && l.push("-c", s), T && l.push("-p", T), l.push("-o", c), e.sender.send(`scan-log:${u}`, {
        log: `⏳ Executing...
`,
        progress: 10
      });
      const g = ee(m, l, {
        stdio: ["ignore", "pipe", "pipe"]
      });
      S.set(u, g);
      let o = !1;
      g.stdout && g.stdout.on("data", (i) => {
        if (o) return;
        const w = i.toString();
        e.sender.send(`scan-log:${u}`, { log: w, progress: 60 });
      }), g.stderr && g.stderr.on("data", (i) => {
        if (o) return;
        const w = i.toString();
        e.sender.send(`scan-log:${u}`, { log: `
🔴 [ERROR] ${w.trim()}
`, progress: 50 });
      }), g.on("close", (i) => {
        if (S.delete(u), o) return;
        const w = i === 0;
        let a = `╔══════════════════════════════════════════════════════════════════════╗
`;
        a += `                    KEY GENERATION REPORT                               
`, a += `╚══════════════════════════════════════════════════════════════════════╝

`, a += `    RESULT             : ${i === 0 ? "✅ SUCCESS" : "❌ FAILED (" + i + ")"}
`, a += `    Algorithm         : ${t.toUpperCase()}
`, a += `    Timestamp      : ${(/* @__PURE__ */ new Date()).toLocaleTimeString()}
`, w ? a += `    ✅ KEYS READY FOR SIGNING!
` : a += `    ⚠️  Check error logs above
`, a += `
${"═".repeat(70)}`, e.sender.send(`scan-log:${u}`, { log: a, progress: 100 }), e.sender.send(`scan-complete:${u}`, { success: w }), A({ success: w });
      }), g.on("error", (i) => {
        S.delete(u), e.sender.send(`scan-log:${u}`, {
          log: `
💥 SPAWN ERROR: ${i.message}`,
          progress: 0
        }), A({ success: !1, error: i.message });
      }), x.once(`scan:cancel-${u}`, () => {
        o = !0, g.pid && process.kill(g.pid, "SIGTERM"), e.sender.send(`scan-log:${u}`, { log: `
🛑 CANCELLED
`, progress: 0 }), A({ success: !1, cancelled: !0 });
      });
    }) : (e.sender.send(`scan-log:${u}`, {
      log: `
❌ TOOL ERROR: KeyGenerator not found!
Expected: ${oe("KeyGenerator")}
`,
      progress: 0
    }), { success: !1, error: "Tool not found" });
  }), x.handle("crypto:sign-artifact", async (e, { repoUrl: t, branch: n, privateKeyPath: s, password: T, scanId: c }) => {
    const u = ce("SoftwareSigner");
    if (!u)
      return e.sender.send(`scan-log:${c}`, {
        log: `
❌ TOOL ERROR: SoftwareSigner not found.
Expected at: ${oe("SoftwareSigner")}
`,
        progress: 0
      }), { success: !1, error: "Tool not found" };
    const m = await ae(e, t, n, c);
    return m ? new Promise((A) => {
      e.sender.send(`scan-log:${c}`, {
        log: `
${"═".repeat(60)}
🔏 INITIATING CRYPTOGRAPHIC SIGNING
${"═".repeat(60)}

`,
        progress: 30
      });
      const l = V.join(m, "signature.sig");
      e.sender.send(`scan-log:${c}`, {
        log: `🔹 Target Repo : ${t}
🔹 Branch      : ${n}
🔹 Signing Key : ${V.basename(s)}
🔹 Security    : ${T ? "Password Protected 🔒" : "No Password ⚠️"}
🔹 Output Path : ${l}

`,
        progress: 35
      });
      const g = [
        "sign",
        "-c",
        m,
        "-k",
        s,
        "-o",
        l
      ];
      T && g.push("-p", T);
      const o = ee(u, g);
      S.set(c, o);
      let i = !1;
      o.stdout.on("data", (w) => {
        if (i) return;
        const a = w.toString();
        e.sender.send(`scan-log:${c}`, { log: a, progress: 60 });
      }), o.stderr.on("data", (w) => {
        if (i) return;
        const a = w.toString();
        e.sender.send(`scan-log:${c}`, { log: `[STDERR] ${a}`, progress: 60 });
      }), o.on("close", (w) => {
        if (S.delete(c), i) return;
        const a = w === 0;
        let G = "0 B";
        a && H.existsSync(l) && (G = `${H.statSync(l).size} bytes`);
        const y = `
╔══════════════════════════════════════════════════════════════════════╗
                    DIGITAL SIGNATURE REPORT                            
╚══════════════════════════════════════════════════════════════════════╝

 Status             : ${a ? "✅ SIGNED & VERIFIED" : "❌ SIGNING FAILED"}
 Repository    : ${t}
 Branch           : ${n}
 Timestamp   : ${(/* @__PURE__ */ new Date()).toLocaleTimeString()}

 🔏 Signature Details:
 ───────────────────────────────────────────────
 📄 File              : ${l}
 💾 Size             : ${G}
 🔑 Key Used   : ${s}


 ${"═".repeat(70)}
`;
        e.sender.send(`scan-log:${c}`, { log: y, progress: 100 }), e.sender.send(`scan-complete:${c}`, { success: a }), A({ success: a });
      }), x.once(`scan:cancel-${c}`, () => {
        if (i = !0, o.pid) try {
          process.kill(o.pid);
        } catch {
        }
        S.delete(c), e.sender.send(`scan-log:${c}`, { log: `
⚠️ PROCESS CANCELLED BY USER
`, progress: 0 }), A({ success: !1, cancelled: !0 });
      });
    }) : (e.sender.send(`scan-complete:${c}`, { success: !1, error: "Clone Failed" }), { success: !1, error: "Clone Failed" });
  }), x.handle("dialog:select-folder", async (e) => {
    const t = he.fromWebContents(e.sender);
    if (!t) return null;
    const { filePaths: n, canceled: s } = await ye.showOpenDialog(t, {
      properties: ["openDirectory", "createDirectory", "promptToCreate"],
      title: "Select Output Directory",
      buttonLabel: "Select Folder"
    });
    return s || n.length === 0 ? null : n[0];
  }), x.handle("dialog:select-file", async (e) => {
    const t = he.fromWebContents(e.sender);
    if (!t) return null;
    const { filePaths: n, canceled: s } = await ye.showOpenDialog(t, {
      properties: ["openFile"],
      filters: [{ name: "Keys", extensions: ["pem", "key", "sig"] }],
      title: "Select Private Key",
      buttonLabel: "Select Key"
    });
    return s || n.length === 0 ? null : n[0];
  }), x.handle("scan:cancel", async (e, { scanId: t }) => (O(`Cancel requested: ${t}`), new Promise((n) => {
    let s = !1;
    const T = S.get(t);
    T && (O(`Killing main process: ${t}`), Q(T, t), S.delete(t), s = !0);
    const c = `${t}-clone`, u = S.get(c);
    u && (O(`Killing clone process: ${c}`), Q(u, c), S.delete(c), s = !0), x.emit(`scan:cancel-${t}`), s ? setTimeout(() => {
      O(`Cancel complete: ${t}`), n({ cancelled: !0 });
    }, 500) : (O(`No active process found for: ${t}`), n({ cancelled: !1 }));
  }))), x.handle("window:minimize", () => U?.minimize()), x.handle(
    "window:maximize",
    () => U?.isMaximized() ? U.unmaximize() : U?.maximize()
  ), x.handle("window:close", () => U?.close());
}
function Re() {
  O(`Cancelling all scans (${S.size} processes)`), S.forEach((d, e) => {
    Q(d, e);
  }), S.clear();
}
function Be() {
  pe = new he({
    width: 420,
    height: 280,
    frame: !1,
    transparent: !0,
    alwaysOnTop: !0,
    resizable: !1,
    show: !0,
    backgroundColor: "#00000000"
  }), pe.loadFile(V.join(process.env.VITE_PUBLIC, "splash.html")), U = new he({
    width: 1280,
    height: 840,
    show: !1,
    frame: !1,
    titleBarStyle: "hidden",
    backgroundColor: "#060712",
    icon: V.join(process.env.VITE_PUBLIC, "icon.png"),
    webPreferences: {
      preload: V.join(me, "preload.mjs")
    }
  }), Ue(), $e ? U.loadURL($e) : U.loadFile(V.join(Ne, "index.html")), U.once("ready-to-show", () => {
    pe?.close(), pe = null, U?.show(), $e && U?.webContents.openDevTools({ mode: "detach" });
  }), U.webContents.on("before-input-event", (d, e) => {
    e.type === "keyDown" && (e.key === "F12" || e.control && e.shift && e.key === "I") && (U?.webContents.isDevToolsOpened() ? U?.webContents.closeDevTools() : U?.webContents.openDevTools({ mode: "detach" }));
  });
}
ge.whenReady().then(Be);
ge.on("window-all-closed", () => {
  Re(), ge.quit(), U = null;
});
ge.on("before-quit", () => {
  O("App shutting down"), Re();
});
export {
  Xe as MAIN_DIST,
  Ne as RENDERER_DIST,
  $e as VITE_DEV_SERVER_URL
};
