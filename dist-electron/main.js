import { app as ae, BrowserWindow as pe, ipcMain as O, dialog as ye } from "electron";
import { fileURLToPath as Me } from "node:url";
import D from "node:path";
import { spawn as I } from "child_process";
import ie from "fs/promises";
import Y from "fs";
const Te = D.dirname(Me(import.meta.url));
process.env.APP_ROOT = D.join(Te, "..");
const de = process.env.VITE_DEV_SERVER_URL, He = D.join(process.env.APP_ROOT, "dist-electron"), Ae = D.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = de ? D.join(process.env.APP_ROOT, "public") : Ae;
let m = null, Z = null;
const h = /* @__PURE__ */ new Map(), ge = /* @__PURE__ */ new Map();
function E(S) {
  console.log(`[ELECTRON][${(/* @__PURE__ */ new Date()).toISOString()}] ${S}`);
}
function xe() {
  return process.platform === "win32" ? "win" : process.platform === "darwin" ? "darwin" : "linux";
}
function X(S) {
  const e = process.platform === "win32" ? ".exe" : "", r = S + e;
  return D.join(
    process.env.APP_ROOT,
    "tools",
    xe(),
    S,
    r
  );
}
function ne(S) {
  const e = X(S);
  if (!Y.existsSync(e))
    return E(`Tool not found: ${e}`), null;
  try {
    Y.accessSync(e, Y.constants.X_OK);
  } catch {
    if (E(`${S} not executable: ${e}`), process.platform !== "win32")
      try {
        Y.chmodSync(e, 493), E(`Set execute permission on ${e}`);
      } catch (t) {
        return E(`Failed to set permissions: ${t.message}`), null;
      }
  }
  return E(`Found ${S} at: ${e}`), e;
}
function B(S, e) {
  if (!S || !S.pid) {
    E(`No PID for ${e}`);
    return;
  }
  E(`Killing ${e} (PID: ${S.pid})`);
  try {
    if (process.platform === "win32")
      I("taskkill", ["/pid", S.pid.toString(), "/f", "/t"], {
        stdio: "ignore"
      });
    else
      try {
        process.kill(-S.pid, "SIGKILL");
      } catch {
        S.kill("SIGKILL");
      }
  } catch (r) {
    E(`Kill error ${e}: ${r.message}`);
    try {
      S.kill("SIGKILL");
    } catch {
    }
  }
}
async function le(S, e, r, t) {
  var R;
  const s = `${e}:${r}`;
  if (ge.has(s)) {
    const $ = ge.get(s);
    try {
      return await ie.access(D.join($, ".git")), E(`Using cached repo: ${$}`), S.sender.send(`scan-log:${t}`, {
        log: `✅ Using cached repository
   Path: ${$}
   Branch: ${r}

`,
        progress: 50
      }), $;
    } catch {
      ge.delete(s);
    }
  }
  E(`Cloning ${e} (branch: ${r})`), S.sender.send(`scan-log:${t}`, {
    log: `
${"═".repeat(60)}
📦 CLONING REPOSITORY
${"═".repeat(60)}
`,
    progress: 5
  }), S.sender.send(`scan-log:${t}`, {
    log: `Repository: ${e}
Branch: ${r}

`,
    progress: 10
  });
  const C = ((R = e.split("/").pop()) == null ? void 0 : R.replace(".git", "")) || "repo", l = Date.now(), o = D.join(
    ae.getPath("temp"),
    "cipher-scans",
    `${C}-${r.replace(/\//g, "-")}-${l}`
  );
  try {
    return await ie.mkdir(o, { recursive: !0 }), await new Promise(($) => {
      var y, T;
      const g = ["clone", "-b", r, "--single-branch", e, o];
      S.sender.send(`scan-log:${t}`, {
        log: `$ git clone -b ${r} --single-branch ${e}

`,
        progress: 15
      });
      const i = I("git", g, {
        detached: !0,
        stdio: ["ignore", "pipe", "pipe"]
      });
      i.unref();
      const p = `${t}-clone`;
      h.set(p, i);
      let a = !1, n = 0;
      (y = i.stdout) == null || y.on("data", (w) => {
        n++, S.sender.send(`scan-log:${t}`, {
          log: w.toString(),
          progress: Math.min(20 + n * 2, 45)
        });
      }), (T = i.stderr) == null || T.on("data", (w) => {
        n++, S.sender.send(`scan-log:${t}`, {
          log: w.toString(),
          progress: Math.min(20 + n * 2, 45)
        });
      }), i.on("close", (w) => {
        if (h.delete(p), a) {
          $(null);
          return;
        }
        w === 0 ? (ge.set(s, o), S.sender.send(`scan-log:${t}`, {
          log: `
✅ Clone successful!
   Location: ${o}
${"═".repeat(60)}

`,
          progress: 50
        }), $(o)) : (S.sender.send(`scan-log:${t}`, {
          log: `
❌ Clone failed with exit code ${w}
`,
          progress: 0
        }), $(null));
      }), i.on("error", (w) => {
        h.delete(p), S.sender.send(`scan-log:${t}`, {
          log: `
❌ Clone error: ${w.message}
`,
          progress: 0
        }), $(null);
      });
      const c = () => {
        a = !0, E(`Cancelling clone: ${p}`), B(i, p), h.delete(p), $(null);
      };
      O.once(`scan:cancel-${t}`, c), setTimeout(() => {
        h.has(p) && (B(i, p), S.sender.send(`scan-log:${t}`, {
          log: `
❌ Clone timeout after 3 minutes
`,
          progress: 0
        }), $(null));
      }, 18e4);
    });
  } catch ($) {
    return S.sender.send(`scan-log:${t}`, {
      log: `
❌ Exception: ${$.message}
`,
      progress: 0
    }), null;
  }
}
function be() {
  O.handle("scan:verify-gpg", async (e, { repoUrl: r, branch: t, scanId: s }) => {
    E(`[GPG] Starting verification for ${r} on branch ${t}`);
    const C = await le(e, r, t, s);
    return C ? new Promise((l) => {
      var a, n;
      e.sender.send(`scan-log:${s}`, {
        log: `
${"═".repeat(60)}
🔐 GPG SIGNATURE VERIFICATION
${"═".repeat(60)}

`,
        progress: 52
      }), e.sender.send(`scan-log:${s}`, {
        log: `🔍 Analyzing ALL commit signatures on branch: ${t}...

`,
        progress: 55
      });
      const o = I(
        "git",
        ["log", "--show-signature", "--pretty=format:%H|%an|%aI|%s", t],
        {
          cwd: C,
          detached: !0,
          stdio: ["ignore", "pipe", "pipe"]
        }
      );
      o.unref(), h.set(s, o);
      let R = "", $ = "", g = 0, i = 0, p = !1;
      (a = o.stdout) == null || a.on("data", (c) => {
        p || (R += c.toString());
      }), (n = o.stderr) == null || n.on("data", (c) => {
        p || ($ += c.toString());
      }), o.on("close", (c) => {
        if (h.delete(s), p) {
          l({ success: !1, cancelled: !0 });
          return;
        }
        const T = (R + `
` + $).split(`
`);
        for (let N = 0; N < T.length; N++) {
          const x = T[N].trim();
          if (x.includes("|")) {
            g++;
            const [_, W, H, Q] = x.split("|");
            let V = !1, G = "";
            for (let q = Math.max(0, N - 20); q < N; q++)
              G += T[q] + `
`;
            (G.includes("Good signature from") || G.includes("gpg: Good signature") || G.includes("Signature made") || G.includes("using RSA key") && G.includes("Good") || G.includes("using ECDSA key") && G.includes("Good")) && (V = !0, i++), G.includes("Verified") && !V && (V = !0, i++);
            const v = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 Commit ${g}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SHA     : ${_.substring(0, 8)}
Author  : ${W}
Date    : ${H}
Message : ${Q}

GPG     : ${V ? "✅ GOOD SIGNATURE" : "❌ MISSING/INVALID"}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
            e.sender.send(`scan-log:${s}`, {
              log: v,
              progress: 55 + Math.min(g / Math.max(g, 1) * 35, 35)
            }), G = "";
          }
        }
        const w = g > 0 ? Math.round(i / g * 100) : 0, L = `


╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║              🛡️  GPG SIGNED COMMITS VERIFICATION SUMMARY  🛡️                 ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝

Branch           : ${t}
Total Commits    : ${g}
Good Signatures  : ${i}
Missing/Invalid  : ${g - i}
Success Rate     : ${w}%
Status           : ${c === 0 ? "✅ COMPLETE" : "❌ FAILED"}

${"═".repeat(79)}
`;
        e.sender.send(`scan-log:${s}`, {
          log: L,
          progress: 100
        }), e.sender.send(`scan-complete:${s}`, {
          success: c === 0,
          totalCommits: g,
          goodSignatures: i
        }), l({ success: c === 0, totalCommits: g, goodSignatures: i });
      }), o.on("error", (c) => {
        h.delete(s), e.sender.send(`scan-complete:${s}`, {
          success: !1,
          error: c.message
        }), l({ success: !1, error: c.message });
      }), O.once(`scan:cancel-${s}`, () => {
        p = !0, E(`Cancelling GPG scan: ${s}`), B(o, s), h.delete(s), l({ success: !1, cancelled: !0 });
      });
    }) : (e.sender.send(`scan-complete:${s}`, {
      success: !1,
      error: "Clone failed"
    }), { success: !1, error: "Clone failed" });
  }), O.handle("scan:gitleaks", async (e, { repoUrl: r, branch: t, scanId: s }) => {
    E(`[GITLEAKS] Starting scan for ${r}`);
    const C = ne("gitleaks");
    if (!C)
      return e.sender.send(`scan-log:${s}`, {
        log: `
❌ Gitleaks tool not found
   Expected: ${X("gitleaks")}

`,
        progress: 0
      }), e.sender.send(`scan-complete:${s}`, {
        success: !1,
        error: "Tool not found"
      }), { success: !1, error: "Tool not found" };
    const l = await le(e, r, t, s);
    if (!l)
      return e.sender.send(`scan-complete:${s}`, {
        success: !1,
        error: "Clone failed"
      }), { success: !1, error: "Clone failed" };
    const o = D.join(l, "gitleaks-report.json");
    return new Promise((R) => {
      var p, a;
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
      const $ = {
        cwd: l,
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          NO_COLOR: "1"
          // Removed ANSI colors for cleaner parsing
        }
      };
      process.platform === "win32" ? ($.windowsHide = !0, $.shell = !1, $.detached = !1) : $.detached = !0;
      const g = I(
        C,
        ["detect", "--source", l, "--report-path", o, "--verbose"],
        $
      );
      process.platform !== "win32" && g.unref(), h.set(s, g);
      let i = !1;
      (p = g.stdout) == null || p.on("data", (n) => {
        i || e.sender.send(`scan-log:${s}`, {
          log: n.toString(),
          progress: 70
        });
      }), (a = g.stderr) == null || a.on("data", (n) => {
        i || e.sender.send(`scan-log:${s}`, {
          log: n.toString(),
          progress: 85
        });
      }), g.on("close", async () => {
        if (h.delete(s), i) {
          R({ success: !1, cancelled: !0 });
          return;
        }
        let n = 0;
        if (Y.existsSync(o))
          try {
            const y = JSON.parse(await ie.readFile(o, "utf-8"));
            n = y.length || 0, n > 0 && (e.sender.send(`scan-log:${s}`, {
              log: `
🔍 DETAILED FINDINGS:
${"═".repeat(79)}

`,
              progress: 90
            }), y.forEach((T, w) => {
              var N, x, _;
              const L = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 Secret ${w + 1}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Type        : ${T.RuleID || "Unknown"}
Description : ${T.Description || T.RuleID || "N/A"}
File        : ${T.File || "N/A"}
Line        : ${T.StartLine || "N/A"}
Commit      : ${((N = T.Commit) == null ? void 0 : N.substring(0, 8)) || "N/A"}
Author      : ${T.Author || "N/A"}
Date        : ${T.Date || "N/A"}

Match       : ${((x = T.Match) == null ? void 0 : x.substring(0, 80)) || "N/A"}${((_ = T.Match) == null ? void 0 : _.length) > 80 ? "..." : ""}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
              e.sender.send(`scan-log:${s}`, {
                log: L,
                progress: 90 + Math.floor(w / n * 5)
              });
            }));
          } catch (y) {
            E(`Error parsing Gitleaks report: ${y}`);
          }
        const c = `

╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║                🔐  SECRETS & CREDENTIALS LEAKAGE SUMMARY  🔐                 ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝

Potential Secrets : ${n}
Status            : ${n > 0 ? "🚨 SECRETS DETECTED" : "✅ CLEAN"}
Severity          : ${n > 0 ? "HIGH - Immediate action required" : "NONE"}

${"═".repeat(79)}
`;
        e.sender.send(`scan-log:${s}`, {
          log: c,
          progress: 100
        }), e.sender.send(`scan-complete:${s}`, {
          success: !0,
          findings: n
        }), R({ success: !0, findings: n });
      }), g.on("error", (n) => {
        h.delete(s), e.sender.send(`scan-complete:${s}`, {
          success: !1,
          error: n.message
        }), R({ success: !1, error: n.message });
      }), O.once(`scan:cancel-${s}`, () => {
        i = !0, E(`Cancelling Gitleaks scan: ${s}`), B(g, s), h.delete(s), R({ success: !1, cancelled: !0 });
      });
    });
  });
  function S(e) {
    if (!e.Results || e.Results.length === 0) return "";
    let r = `
🔎 DETAILED VULNERABILITY REPORT
`;
    return r += `════════════════════════════════════════════════════════════
`, e.Results.forEach((t) => {
      t.Vulnerabilities && t.Vulnerabilities.length > 0 && (r += `
📂 Target: ${t.Target}
`, r += `   Type:   ${t.Type}
`, r += `   ────────────────────────────────────────────────────────
`, t.Vulnerabilities.forEach((s) => {
        const C = s.Severity === "CRITICAL" ? "🔴" : s.Severity === "HIGH" ? "🟠" : s.Severity === "MEDIUM" ? "🟡" : "🔵";
        r += `   ${C} [${s.Severity}] ${s.VulnerabilityID}
`, r += `      📦 Package: ${s.PkgName} (${s.InstalledVersion})
`, r += `      ⚠️ Title:   ${s.Title || "N/A"}
`, s.FixedVersion && (r += `      ✅ Fixed in: ${s.FixedVersion}
`), r += `
`;
      }));
    }), r;
  }
  O.handle("scan:trivy", async (e, { repoUrl: r, branch: t, scanId: s }) => {
    E(`[TRIVY] Starting SBOM scan for ${r}`);
    const C = ne("trivy");
    if (!C)
      return e.sender.send(`scan-log:${s}`, {
        log: `
❌ Trivy tool not found
   Expected: ${X("trivy")}

`,
        progress: 0
      }), e.sender.send(`scan-complete:${s}`, {
        success: !1,
        error: "Tool not found"
      }), { success: !1, error: "Tool not found" };
    const l = await le(e, r, t, s);
    return l ? new Promise((o) => {
      var i, p;
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
      const R = I(
        C,
        ["fs", "--scanners", "vuln,misconfig", "--format", "json", l],
        {
          detached: !0,
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: !0
        }
      );
      R.unref(), h.set(s, R);
      let $ = "", g = !1;
      (i = R.stdout) == null || i.on("data", (a) => {
        g || ($ += a.toString(), e.sender.send(`scan-log:${s}`, {
          log: `🔍 Analyzing dependencies and vulnerabilities...
`,
          progress: 70
        }));
      }), (p = R.stderr) == null || p.on("data", (a) => {
        if (g) return;
        const n = a.toString();
        !n.includes("Update") && !n.includes("deprecated") && e.sender.send(`scan-log:${s}`, {
          log: n,
          progress: 85
        });
      }), R.on("close", (a) => {
        var n;
        if (h.delete(s), g) {
          o({ success: !1, cancelled: !0 });
          return;
        }
        if (a === 0)
          try {
            const c = JSON.parse($), y = ((n = c.Results) == null ? void 0 : n.reduce(
              (L, N) => {
                var x;
                return L + (((x = N.Vulnerabilities) == null ? void 0 : x.length) || 0);
              },
              0
            )) || 0, T = S(c);
            e.sender.send(`scan-log:${s}`, {
              log: T,
              progress: 95
            });
            const w = `

╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║                 🚨  SBOM & VULNERABILITY SCAN SUMMARY  🚨                    ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝

Vulnerabilities : ${y}
Status          : ${y > 0 ? "🚨 VULNERABILITIES DETECTED" : "✅ NO VULNERABILITIES"}
Risk Level      : ${y > 10 ? "CRITICAL" : y > 5 ? "HIGH" : y > 0 ? "MEDIUM" : "NONE"}

${"═".repeat(79)}
`;
            e.sender.send(`scan-log:${s}`, {
              log: w,
              progress: 100
            }), e.sender.send(`scan-complete:${s}`, {
              success: !0,
              vulnerabilities: y
            }), o({ success: !0, vulnerabilities: y });
          } catch (c) {
            console.error("Trivy Parse Error:", c), e.sender.send(`scan-complete:${s}`, {
              success: !1,
              error: "Failed to parse Trivy results"
            }), o({ success: !1, error: "Failed to parse Trivy results" });
          }
        else
          e.sender.send(`scan-complete:${s}`, {
            success: !1,
            error: `Trivy exited with code ${a}`
          }), o({ success: !1, error: `Trivy exited with code ${a}` });
      }), R.on("error", (a) => {
        h.delete(s), e.sender.send(`scan-complete:${s}`, {
          success: !1,
          error: a.message
        }), o({ success: !1, error: a.message });
      }), O.once(`scan:cancel-${s}`, () => {
        g = !0, E(`Cancelling Trivy scan: ${s}`), B(R, s), h.delete(s), o({ success: !1, cancelled: !0 });
      });
    }) : (e.sender.send(`scan-complete:${s}`, {
      success: !1,
      error: "Clone failed"
    }), { success: !1, error: "Clone failed" });
  }), O.handle("scan:opengrep", async (e, { repoUrl: r, branch: t, scanId: s }) => {
    E(`[OPENGREP] Starting multi-language SAST analysis for ${r}`);
    const C = ne("opengrep");
    if (!C)
      return e.sender.send(`scan-log:${s}`, {
        log: `
❌ OpenGrep tool not found
   Expected: ${X("opengrep")}

`,
        progress: 0
      }), e.sender.send(`scan-complete:${s}`, { success: !1, error: "Tool not found" }), { success: !1, error: "Tool not found" };
    const l = await le(e, r, t, s);
    return l ? new Promise((o) => {
      var T, w;
      e.sender.send(`scan-log:${s}`, {
        log: `
${"═".repeat(79)}
🔬 STATIC APPLICATION SECURITY TESTING (SAST) 
${"═".repeat(79)}

`,
        progress: 52
      }), e.sender.send(`scan-log:${s}`, {
        log: `📦 Repository: ${r}
🌿 Branch: ${t}


`,
        progress: 54
      });
      const R = D.join(l, "opengrep-report.json"), $ = [
        "scan",
        "--config",
        "auto",
        "--json",
        "--output",
        R,
        "--verbose",
        "--no-git-ignore",
        l
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
      const g = {
        cwd: l,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, NO_COLOR: "1" },
        windowsHide: !0,
        shell: !1,
        detached: !1
      }, i = I(C, $, g), p = `${s}-opengrep`;
      h.set(p, i);
      let a = !1, n = 0, c = "", y = "";
      (T = i.stdout) == null || T.on("data", (L) => {
        a || (n++, c += L.toString(), e.sender.send(`scan-log:${s}`, {
          log: "",
          progress: Math.min(65 + Math.floor(n / 5), 85)
        }));
      }), (w = i.stderr) == null || w.on("data", (L) => {
        a || (y += L.toString());
      }), i.on("close", async (L) => {
        var q, fe;
        if (h.delete(p), a) {
          o({ success: !1, cancelled: !0 });
          return;
        }
        E(`[OPENGREP] Process exited with code: ${L}`);
        let N = 0, x = 0, _ = 0, W = [], H = 0, Q = 0, V = 0, G = 0;
        if (Y.existsSync(R))
          try {
            let J = function(f) {
              const d = f.replace(/\\/g, "/");
              return d.startsWith(he) ? d.substring(he.length + 1) : d;
            };
            const Pe = await ie.readFile(R, "utf-8"), ue = JSON.parse(Pe);
            W = ue.results || [], N = W.length, _ = N;
            const $e = ((q = ue.paths) == null ? void 0 : q.scanned) || [], Oe = ((fe = ue.paths) == null ? void 0 : fe.skipped) || [];
            x = $e.length;
            const U = $e.length, he = l.replace(/\\/g, "/"), we = /* @__PURE__ */ new Set([
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
            ]), ee = /* @__PURE__ */ new Set(), se = /* @__PURE__ */ new Map();
            try {
              (await ie.readdir(l, { withFileTypes: !0 })).forEach((d) => {
                d.isDirectory() && !we.has(d.name) && (ee.add(d.name), se.set(d.name, 0));
              }), E(`[OPENGREP] Found ${ee.size} project directories`);
            } catch (f) {
              E(`Error reading repo directory: ${f.message}`);
            }
            $e.forEach((f) => {
              const A = J(f).replace(/\\/g, "/").split("/").filter((u) => u && u !== ".");
              if (A.length !== 0 && A.length > 1) {
                const u = A[0];
                ee.has(u) && se.set(u, (se.get(u) || 0) + 1);
              }
            });
            const re = /* @__PURE__ */ new Set();
            let te = 0;
            const me = /(?:running|loaded|scanning with)\s+(\d+)\s+rules?/gi.exec(y);
            me && (te = parseInt(me[1])), y.split(`
`).forEach((f) => {
              const d = f.trim(), P = d.match(/^(?:rule|checking|running):\s*([a-zA-Z0-9._\-:\/]+)$/i);
              P && re.add(P[1]), d.includes(".") && d.length > 10 && d.length < 100 && !d.includes(" ") && /^[a-zA-Z0-9._\-:\/]+$/.test(d) && re.add(d);
            });
            const oe = /* @__PURE__ */ new Map();
            W.forEach((f) => {
              var F;
              const d = (((F = f.extra) == null ? void 0 : F.severity) || "WARNING").toUpperCase();
              d === "ERROR" || d === "CRITICAL" ? H++ : d === "WARNING" || d === "HIGH" ? Q++ : d === "MEDIUM" ? V++ : G++, f.check_id && re.add(f.check_id);
              const P = f.path || "", b = J(P).replace(/\\/g, "/").split("/").filter((M) => M && M !== ".");
              if (b.length > 1) {
                const M = b[0];
                ee.has(M) && (oe.has(M) || oe.set(M, []), oe.get(M).push(f));
              }
            }), e.sender.send(`scan-log:${s}`, {
              log: `
✅ Scan completed successfully!

`,
              progress: 88
            });
            const Se = Array.from(se.values()).reduce((f, d) => f + d, 0), ce = U - Se, z = Array.from(se.entries()).filter(([f, d]) => d > 0 && ee.has(f)).sort((f, d) => d[1] - f[1]);
            if (z.length > 0) {
              if (e.sender.send(`scan-log:${s}`, {
                log: `

📂 FILES BY PROJECT:
${"─".repeat(79)}

`,
                progress: 89
              }), z.forEach(([f, d]) => {
                const P = oe.get(f) || [], A = P.length === 0 ? "✅" : P.length <= 5 ? "🟡" : "🔴", u = U > 0 ? Math.round(d / U * 100) : 0;
                e.sender.send(`scan-log:${s}`, {
                  log: `  ${A} ${f.padEnd(40)} ${d.toString().padStart(4)} files (${u.toString().padStart(2)}%)${P.length > 0 ? ` — ${P.length} issue(s)` : ""}
`,
                  progress: 89
                });
              }), ce > 0) {
                const f = U > 0 ? Math.round(ce / U * 100) : 0;
                e.sender.send(`scan-log:${s}`, {
                  log: `  📄 [root/misc] (config/metadata)           ${ce.toString().padStart(4)} files (${f.toString().padStart(2)}%)
`,
                  progress: 89
                });
              }
            } else U > 0 && e.sender.send(`scan-log:${s}`, {
              log: `
📂 FILES SCANNED: ${U} (root level or flat structure)
`,
              progress: 89
            });
            if (e.sender.send(`scan-log:${s}`, {
              log: `

🛡️  SECURITY RULES APPLIED:
${"═".repeat(79)}

`,
              progress: 90
            }), te > 0 && e.sender.send(`scan-log:${s}`, {
              log: `   OpenGrep scanned ${U} files using ${te} security rules

`,
              progress: 90
            }), re.size > 0) {
              const f = /* @__PURE__ */ new Map();
              re.forEach((P) => {
                const A = P.split(".");
                let u = "Other";
                A.includes("security") ? u = "Security" : A.includes("best-practice") ? u = "Best Practice" : A.includes("performance") ? u = "Performance" : A.includes("correctness") ? u = "Correctness" : A.includes("audit") ? u = "Security Audit" : A.length >= 2 && (u = A[1]), f.has(u) || f.set(u, []), f.get(u).push(P);
              });
              const d = Array.from(f.entries()).sort((P, A) => A[1].length - P[1].length);
              d.length > 0 && (e.sender.send(`scan-log:${s}`, { log: `   Sample Rules by Category:

`, progress: 90 }), d.slice(0, 8).forEach(([P, A]) => {
                e.sender.send(`scan-log:${s}`, {
                  log: `   📋 ${P} (${A.length} rule${A.length > 1 ? "s" : ""})
`,
                  progress: 90
                }), A.slice(0, 3).forEach((u) => {
                  e.sender.send(`scan-log:${s}`, { log: `      • ${u}
`, progress: 90 });
                }), A.length > 3 && e.sender.send(`scan-log:${s}`, { log: `      ... and ${A.length - 3} more
`, progress: 90 }), e.sender.send(`scan-log:${s}`, { log: `
`, progress: 90 });
              }));
            }
            if (N > 0) {
              e.sender.send(`scan-log:${s}`, {
                log: `

🚨 SECURITY FINDINGS:
${"═".repeat(79)}

`,
                progress: 91
              });
              const f = `
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🔴 Critical/Error       : ${H.toString().padStart(4)}                                             │
│ 🟠 High/Warning         : ${Q.toString().padStart(4)}                                             │
│ 🟡 Medium               : ${V.toString().padStart(4)}                                             │
│ 🔵 Low/Info             : ${G.toString().padStart(4)}                                             │
└─────────────────────────────────────────────────────────────────────────────┘
`;
              e.sender.send(`scan-log:${s}`, { log: f, progress: 91 });
              const d = Array.from(oe.entries()).filter(([u]) => u.length > 0).sort((u, b) => b[1].length - u[1].length);
              d.length > 0 && (e.sender.send(`scan-log:${s}`, { log: `
📂 ISSUES BY PROJECT:
${"─".repeat(79)}

`, progress: 91 }), d.forEach(([u, b]) => {
                const F = b.filter((j) => {
                  var K;
                  const k = (((K = j.extra) == null ? void 0 : K.severity) || "WARNING").toUpperCase();
                  return k === "ERROR" || k === "CRITICAL";
                }).length, M = b.filter((j) => {
                  var K;
                  const k = (((K = j.extra) == null ? void 0 : K.severity) || "WARNING").toUpperCase();
                  return k === "WARNING" || k === "HIGH";
                }).length;
                e.sender.send(`scan-log:${s}`, {
                  log: `  📂 ${u}/ — ${b.length} total | 🔴 ${F} critical | 🟠 ${M} high
`,
                  progress: 91
                });
              })), e.sender.send(`scan-log:${s}`, {
                log: `

🔍 TOP ${Math.min(10, N)} CRITICAL FINDINGS:
${"═".repeat(79)}

`,
                progress: 92
              });
              const P = {
                ERROR: 4,
                CRITICAL: 4,
                WARNING: 3,
                HIGH: 3,
                MEDIUM: 2,
                INFO: 1,
                LOW: 1
              };
              W.sort((u, b) => {
                var j, k;
                const F = (((j = u.extra) == null ? void 0 : j.severity) || "WARNING").toUpperCase(), M = (((k = b.extra) == null ? void 0 : k.severity) || "WARNING").toUpperCase();
                return (P[M] || 0) - (P[F] || 0);
              }).slice(0, 10).forEach((u, b) => {
                var Ee, Re, Ce;
                const F = (((Ee = u.extra) == null ? void 0 : Ee.severity) || "WARNING").toUpperCase(), M = F === "ERROR" || F === "CRITICAL" ? "🔴 CRITICAL" : F === "WARNING" || F === "HIGH" ? "🟠 HIGH    " : "🔵 LOW     ", j = u.path || "N/A", k = J(j), K = k.length > 60 ? "..." + k.slice(-57) : k, Ge = `
${b + 1}. ${M} │ ${u.check_id || "Unknown Rule"}
   File: ${K}
   Line: ${((Re = u.start) == null ? void 0 : Re.line) || "?"}
   ${((Ce = u.extra) == null ? void 0 : Ce.message) || u.message || "No description"}
${"─".repeat(79)}
`;
                e.sender.send(`scan-log:${s}`, { log: Ge, progress: 93 });
              });
            } else
              e.sender.send(`scan-log:${s}`, {
                log: `

✅ NO SECURITY ISSUES DETECTED!
${"═".repeat(79)}

`,
                progress: 95
              }), e.sender.send(`scan-log:${s}`, {
                log: `🎉 All ${U} files passed security analysis.
🛡️  No vulnerabilities found. Repository is secure!
`,
                progress: 95
              });
            const Le = z.length > 0 ? z.map(([f]) => f).slice(0, 3).join(", ") + (z.length > 3 ? `, +${z.length - 3} more` : "") : "No sub-projects detected", De = `
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║                        📊  SAST ANALYSIS SUMMARY  📊                         ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝

Repository        : ${r}
Branch            : ${t}
Scan Engine       : OpenGrep (Open Source SAST)

📁 SCAN COVERAGE
───────────────────────────────────────────────────────────────────────────────
  Total Files Scanned     : ${U}
  Projects Scanned        : ${z.length} (${Le})
  Files Skipped           : ${Oe.length}
  Rules Applied           : ${te > 0 ? te : "Auto (Community Rules)"}

  Breakdown:
   - Project Code         : ${Se}
   - Config/Root/Misc     : ${ce}

🔍 FINDINGS SUMMARY
───────────────────────────────────────────────────────────────────────────────
  Total Issues            : ${N}
  🔴 Critical/Error       : ${H}
  🟠 High/Warning         : ${Q}
  🟡 Medium               : ${V}
  🔵 Low/Info             : ${G}

🎯 SECURITY VERDICT
───────────────────────────────────────────────────────────────────────────────
${N === 0 ? `  ✅ SECURE — All code passed security checks
  ✅ No vulnerabilities detected
  ✅ Safe to deploy to production` : H > 0 ? `  🚨 CRITICAL RISK — ${H} critical vulnerabilities detected
  ⛔ DO NOT DEPLOY until all critical issues are fixed
  🔧 Immediate remediation required` : `  ⚠️  RISKS DETECTED — ${N} issues found
  🔧 Review required`}
═══════════════════════════════════════════════════════════════════════════════
`;
            e.sender.send(`scan-log:${s}`, {
              log: De,
              progress: 100
            });
          } catch (J) {
            E(`Error parsing OpenGrep report: ${J.message}`), e.sender.send(`scan-log:${s}`, {
              log: `
❌ Error parsing report: ${J.message}
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
          }), y.trim() && e.sender.send(`scan-log:${s}`, { log: `
❌ Error details:
${y}
`, progress: 100 });
        const v = L === 0 || L === 1;
        e.sender.send(`scan-complete:${s}`, {
          success: v,
          totalIssues: N,
          passedChecks: x,
          failedChecks: _,
          error: v ? void 0 : `Scan exited with code ${L}`
        }), o({ success: v, totalIssues: N, passedChecks: x, failedChecks: _ });
      }), i.on("error", (L) => {
        h.delete(p), e.sender.send(`scan-log:${s}`, { log: `
❌ OpenGrep process error: ${L.message}
`, progress: 0 }), e.sender.send(`scan-complete:${s}`, { success: !1, error: L.message }), o({ success: !1, error: L.message });
      }), O.once(`scan:cancel-${s}`, () => {
        a = !0, E(`Cancelling OpenGrep scan: ${s}`), e.sender.send(`scan-log:${s}`, { log: `
⚠️ Scan cancelled by user
`, progress: 0 }), B(i, p), h.delete(p), o({ success: !1, cancelled: !0 });
      });
    }) : (e.sender.send(`scan-complete:${s}`, { success: !1, error: "Clone failed" }), { success: !1, error: "Clone failed" });
  }), O.handle("crypto:generate-keys", async (e, { type: r, size: t, curve: s, password: C, outputDir: l, scanId: o }) => {
    const R = ne("KeyGenerator");
    return R ? new Promise(($) => {
      e.sender.send(`scan-log:${o}`, {
        log: `
${"═".repeat(65)}
🔑 KEY GENERATION STARTED
${"═".repeat(65)}

🔹 Algorithm: ${r.toUpperCase()}${r === "rsa" ? ` (${t} bits)` : ` (${s})`}
🔹 Output: ${l}
🔹 Security: ${C ? "🔒 Protected" : "⚠️ No Password"}

`,
        progress: 5
      });
      const g = ["generate", r];
      r === "rsa" && t && g.push("-s", `${t}`), r === "ecdsa" && s && g.push("-c", s), C && g.push("-p", C), g.push("-o", l), e.sender.send(`scan-log:${o}`, {
        log: `⏳ Executing...
`,
        progress: 10
      });
      const i = I(R, g, {
        stdio: ["ignore", "pipe", "pipe"]
      });
      h.set(o, i);
      let p = !1;
      i.stdout && i.stdout.on("data", (a) => {
        if (p) return;
        const n = a.toString();
        e.sender.send(`scan-log:${o}`, { log: n, progress: 60 });
      }), i.stderr && i.stderr.on("data", (a) => {
        if (p) return;
        const n = a.toString();
        e.sender.send(`scan-log:${o}`, { log: `
🔴 [ERROR] ${n.trim()}
`, progress: 50 });
      }), i.on("close", (a) => {
        if (h.delete(o), p) return;
        const n = a === 0;
        let c = `╔══════════════════════════════════════════════════════════════════════╗
`;
        c += `                    KEY GENERATION REPORT                               
`, c += `╚══════════════════════════════════════════════════════════════════════╝

`, c += `    RESULT             : ${a === 0 ? "✅ SUCCESS" : "❌ FAILED (" + a + ")"}
`, c += `    Algorithm         : ${r.toUpperCase()}
`, c += `    Timestamp      : ${(/* @__PURE__ */ new Date()).toLocaleTimeString()}
`, n ? c += `    ✅ KEYS READY FOR SIGNING!
` : c += `    ⚠️  Check error logs above
`, c += `
${"═".repeat(70)}`, e.sender.send(`scan-log:${o}`, { log: c, progress: 100 }), e.sender.send(`scan-complete:${o}`, { success: n }), $({ success: n });
      }), i.on("error", (a) => {
        h.delete(o), e.sender.send(`scan-log:${o}`, {
          log: `
💥 SPAWN ERROR: ${a.message}`,
          progress: 0
        }), $({ success: !1, error: a.message });
      }), O.once(`scan:cancel-${o}`, () => {
        p = !0, i.pid && process.kill(i.pid, "SIGTERM"), e.sender.send(`scan-log:${o}`, { log: `
🛑 CANCELLED
`, progress: 0 }), $({ success: !1, cancelled: !0 });
      });
    }) : (e.sender.send(`scan-log:${o}`, {
      log: `
❌ TOOL ERROR: KeyGenerator not found!
Expected: ${X("KeyGenerator")}
`,
      progress: 0
    }), { success: !1, error: "Tool not found" });
  }), O.handle("crypto:sign-artifact", async (e, { repoUrl: r, branch: t, privateKeyPath: s, password: C, scanId: l }) => {
    const o = ne("SoftwareSigner");
    if (!o)
      return e.sender.send(`scan-log:${l}`, {
        log: `
❌ TOOL ERROR: SoftwareSigner not found.
Expected at: ${X("SoftwareSigner")}
`,
        progress: 0
      }), { success: !1, error: "Tool not found" };
    const R = await le(e, r, t, l);
    return R ? new Promise(($) => {
      e.sender.send(`scan-log:${l}`, {
        log: `
${"═".repeat(60)}
🔏 INITIATING CRYPTOGRAPHIC SIGNING
${"═".repeat(60)}

`,
        progress: 30
      });
      const g = D.join(R, "signature.sig");
      e.sender.send(`scan-log:${l}`, {
        log: `🔹 Target Repo : ${r}
🔹 Branch      : ${t}
🔹 Signing Key : ${D.basename(s)}
🔹 Security    : ${C ? "Password Protected 🔒" : "No Password ⚠️"}
🔹 Output Path : ${g}

`,
        progress: 35
      });
      const i = [
        "sign",
        "-c",
        R,
        "-k",
        s,
        "-o",
        g
      ];
      C && i.push("-p", C);
      const p = I(o, i);
      h.set(l, p);
      let a = !1;
      p.stdout.on("data", (n) => {
        if (a) return;
        const c = n.toString();
        e.sender.send(`scan-log:${l}`, { log: c, progress: 60 });
      }), p.stderr.on("data", (n) => {
        if (a) return;
        const c = n.toString();
        e.sender.send(`scan-log:${l}`, { log: `[STDERR] ${c}`, progress: 60 });
      }), p.on("close", (n) => {
        if (h.delete(l), a) return;
        const c = n === 0;
        let y = "0 B";
        c && Y.existsSync(g) && (y = `${Y.statSync(g).size} bytes`);
        const T = `
╔══════════════════════════════════════════════════════════════════════╗
                    DIGITAL SIGNATURE REPORT                            
╚══════════════════════════════════════════════════════════════════════╝

 Status             : ${c ? "✅ SIGNED & VERIFIED" : "❌ SIGNING FAILED"}
 Repository    : ${r}
 Branch           : ${t}
 Timestamp   : ${(/* @__PURE__ */ new Date()).toLocaleTimeString()}

 🔏 Signature Details:
 ───────────────────────────────────────────────
 📄 File              : ${g}
 💾 Size             : ${y}
 🔑 Key Used   : ${s}


 ${"═".repeat(70)}
`;
        e.sender.send(`scan-log:${l}`, { log: T, progress: 100 }), e.sender.send(`scan-complete:${l}`, { success: c }), $({ success: c });
      }), O.once(`scan:cancel-${l}`, () => {
        if (a = !0, p.pid) try {
          process.kill(p.pid);
        } catch {
        }
        h.delete(l), e.sender.send(`scan-log:${l}`, { log: `
⚠️ PROCESS CANCELLED BY USER
`, progress: 0 }), $({ success: !1, cancelled: !0 });
      });
    }) : (e.sender.send(`scan-complete:${l}`, { success: !1, error: "Clone Failed" }), { success: !1, error: "Clone Failed" });
  }), O.handle("dialog:select-folder", async (e) => {
    const r = pe.fromWebContents(e.sender);
    if (!r) return null;
    const { filePaths: t, canceled: s } = await ye.showOpenDialog(r, {
      properties: ["openDirectory", "createDirectory", "promptToCreate"],
      title: "Select Output Directory",
      buttonLabel: "Select Folder"
    });
    return s || t.length === 0 ? null : t[0];
  }), O.handle("dialog:select-file", async (e) => {
    const r = pe.fromWebContents(e.sender);
    if (!r) return null;
    const { filePaths: t, canceled: s } = await ye.showOpenDialog(r, {
      properties: ["openFile"],
      filters: [{ name: "Keys", extensions: ["pem", "key", "sig"] }],
      title: "Select Private Key",
      buttonLabel: "Select Key"
    });
    return s || t.length === 0 ? null : t[0];
  }), O.handle("scan:cancel", async (e, { scanId: r }) => (E(`Cancel requested: ${r}`), new Promise((t) => {
    let s = !1;
    const C = h.get(r);
    C && (E(`Killing main process: ${r}`), B(C, r), h.delete(r), s = !0);
    const l = `${r}-clone`, o = h.get(l);
    o && (E(`Killing clone process: ${l}`), B(o, l), h.delete(l), s = !0), O.emit(`scan:cancel-${r}`), s ? setTimeout(() => {
      E(`Cancel complete: ${r}`), t({ cancelled: !0 });
    }, 500) : (E(`No active process found for: ${r}`), t({ cancelled: !1 }));
  }))), O.handle("window:minimize", () => m == null ? void 0 : m.minimize()), O.handle(
    "window:maximize",
    () => m != null && m.isMaximized() ? m.unmaximize() : m == null ? void 0 : m.maximize()
  ), O.handle("window:close", () => m == null ? void 0 : m.close());
}
function Ne() {
  E(`Cancelling all scans (${h.size} processes)`), h.forEach((S, e) => {
    B(S, e);
  }), h.clear();
}
function ke() {
  Z = new pe({
    width: 420,
    height: 280,
    frame: !1,
    transparent: !0,
    alwaysOnTop: !0,
    resizable: !1,
    show: !0,
    backgroundColor: "#00000000"
  }), Z.loadFile(D.join(process.env.VITE_PUBLIC, "splash.html")), m = new pe({
    width: 1280,
    height: 840,
    show: !1,
    frame: !1,
    titleBarStyle: "hidden",
    backgroundColor: "#060712",
    icon: D.join(process.env.VITE_PUBLIC, "icon.png"),
    webPreferences: {
      preload: D.join(Te, "preload.mjs")
    }
  }), be(), de ? m.loadURL(de) : m.loadFile(D.join(Ae, "index.html")), m.once("ready-to-show", () => {
    Z == null || Z.close(), Z = null, m == null || m.show(), de && (m == null || m.webContents.openDevTools({ mode: "detach" }));
  }), m.webContents.on("before-input-event", (S, e) => {
    e.type === "keyDown" && (e.key === "F12" || e.control && e.shift && e.key === "I") && (m != null && m.webContents.isDevToolsOpened() ? m == null || m.webContents.closeDevTools() : m == null || m.webContents.openDevTools({ mode: "detach" }));
  });
}
ae.whenReady().then(ke);
ae.on("window-all-closed", () => {
  Ne(), ae.quit(), m = null;
});
ae.on("before-quit", () => {
  E("App shutting down"), Ne();
});
export {
  He as MAIN_DIST,
  Ae as RENDERER_DIST,
  de as VITE_DEV_SERVER_URL
};
