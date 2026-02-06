import { app, BrowserWindow, ipcMain, dialog } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { spawn } from "child_process";
import fs from "fs/promises";
import fsSync from "fs";
import require$$1 from "path";
import require$$2 from "os";
import require$$3 from "crypto";
function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
var main = { exports: {} };
const version = "17.2.4";
const require$$4 = {
  version
};
var hasRequiredMain;
function requireMain() {
  if (hasRequiredMain) return main.exports;
  hasRequiredMain = 1;
  const fs2 = fsSync;
  const path2 = require$$1;
  const os = require$$2;
  const crypto = require$$3;
  const packageJson = require$$4;
  const version2 = packageJson.version;
  const TIPS = [
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
  function _getRandomTip() {
    return TIPS[Math.floor(Math.random() * TIPS.length)];
  }
  function parseBoolean(value) {
    if (typeof value === "string") {
      return !["false", "0", "no", "off", ""].includes(value.toLowerCase());
    }
    return Boolean(value);
  }
  function supportsAnsi() {
    return process.stdout.isTTY;
  }
  function dim(text) {
    return supportsAnsi() ? `\x1B[2m${text}\x1B[0m` : text;
  }
  const LINE = /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/mg;
  function parse(src) {
    const obj = {};
    let lines = src.toString();
    lines = lines.replace(/\r\n?/mg, "\n");
    let match;
    while ((match = LINE.exec(lines)) != null) {
      const key = match[1];
      let value = match[2] || "";
      value = value.trim();
      const maybeQuote = value[0];
      value = value.replace(/^(['"`])([\s\S]*)\1$/mg, "$2");
      if (maybeQuote === '"') {
        value = value.replace(/\\n/g, "\n");
        value = value.replace(/\\r/g, "\r");
      }
      obj[key] = value;
    }
    return obj;
  }
  function _parseVault(options) {
    options = options || {};
    const vaultPath = _vaultPath(options);
    options.path = vaultPath;
    const result = DotenvModule.configDotenv(options);
    if (!result.parsed) {
      const err = new Error(`MISSING_DATA: Cannot parse ${vaultPath} for an unknown reason`);
      err.code = "MISSING_DATA";
      throw err;
    }
    const keys = _dotenvKey(options).split(",");
    const length = keys.length;
    let decrypted;
    for (let i = 0; i < length; i++) {
      try {
        const key = keys[i].trim();
        const attrs = _instructions(result, key);
        decrypted = DotenvModule.decrypt(attrs.ciphertext, attrs.key);
        break;
      } catch (error) {
        if (i + 1 >= length) {
          throw error;
        }
      }
    }
    return DotenvModule.parse(decrypted);
  }
  function _warn(message) {
    console.error(`[dotenv@${version2}][WARN] ${message}`);
  }
  function _debug(message) {
    console.log(`[dotenv@${version2}][DEBUG] ${message}`);
  }
  function _log(message) {
    console.log(`[dotenv@${version2}] ${message}`);
  }
  function _dotenvKey(options) {
    if (options && options.DOTENV_KEY && options.DOTENV_KEY.length > 0) {
      return options.DOTENV_KEY;
    }
    if (process.env.DOTENV_KEY && process.env.DOTENV_KEY.length > 0) {
      return process.env.DOTENV_KEY;
    }
    return "";
  }
  function _instructions(result, dotenvKey) {
    let uri;
    try {
      uri = new URL(dotenvKey);
    } catch (error) {
      if (error.code === "ERR_INVALID_URL") {
        const err = new Error("INVALID_DOTENV_KEY: Wrong format. Must be in valid uri format like dotenv://:key_1234@dotenvx.com/vault/.env.vault?environment=development");
        err.code = "INVALID_DOTENV_KEY";
        throw err;
      }
      throw error;
    }
    const key = uri.password;
    if (!key) {
      const err = new Error("INVALID_DOTENV_KEY: Missing key part");
      err.code = "INVALID_DOTENV_KEY";
      throw err;
    }
    const environment = uri.searchParams.get("environment");
    if (!environment) {
      const err = new Error("INVALID_DOTENV_KEY: Missing environment part");
      err.code = "INVALID_DOTENV_KEY";
      throw err;
    }
    const environmentKey = `DOTENV_VAULT_${environment.toUpperCase()}`;
    const ciphertext = result.parsed[environmentKey];
    if (!ciphertext) {
      const err = new Error(`NOT_FOUND_DOTENV_ENVIRONMENT: Cannot locate environment ${environmentKey} in your .env.vault file.`);
      err.code = "NOT_FOUND_DOTENV_ENVIRONMENT";
      throw err;
    }
    return { ciphertext, key };
  }
  function _vaultPath(options) {
    let possibleVaultPath = null;
    if (options && options.path && options.path.length > 0) {
      if (Array.isArray(options.path)) {
        for (const filepath of options.path) {
          if (fs2.existsSync(filepath)) {
            possibleVaultPath = filepath.endsWith(".vault") ? filepath : `${filepath}.vault`;
          }
        }
      } else {
        possibleVaultPath = options.path.endsWith(".vault") ? options.path : `${options.path}.vault`;
      }
    } else {
      possibleVaultPath = path2.resolve(process.cwd(), ".env.vault");
    }
    if (fs2.existsSync(possibleVaultPath)) {
      return possibleVaultPath;
    }
    return null;
  }
  function _resolveHome(envPath) {
    return envPath[0] === "~" ? path2.join(os.homedir(), envPath.slice(1)) : envPath;
  }
  function _configVault(options) {
    const debug = parseBoolean(process.env.DOTENV_CONFIG_DEBUG || options && options.debug);
    const quiet = parseBoolean(process.env.DOTENV_CONFIG_QUIET || options && options.quiet);
    if (debug || !quiet) {
      _log("Loading env from encrypted .env.vault");
    }
    const parsed = DotenvModule._parseVault(options);
    let processEnv = process.env;
    if (options && options.processEnv != null) {
      processEnv = options.processEnv;
    }
    DotenvModule.populate(processEnv, parsed, options);
    return { parsed };
  }
  function configDotenv(options) {
    const dotenvPath = path2.resolve(process.cwd(), ".env");
    let encoding = "utf8";
    let processEnv = process.env;
    if (options && options.processEnv != null) {
      processEnv = options.processEnv;
    }
    let debug = parseBoolean(processEnv.DOTENV_CONFIG_DEBUG || options && options.debug);
    let quiet = parseBoolean(processEnv.DOTENV_CONFIG_QUIET || options && options.quiet);
    if (options && options.encoding) {
      encoding = options.encoding;
    } else {
      if (debug) {
        _debug("No encoding is specified. UTF-8 is used by default");
      }
    }
    let optionPaths = [dotenvPath];
    if (options && options.path) {
      if (!Array.isArray(options.path)) {
        optionPaths = [_resolveHome(options.path)];
      } else {
        optionPaths = [];
        for (const filepath of options.path) {
          optionPaths.push(_resolveHome(filepath));
        }
      }
    }
    let lastError;
    const parsedAll = {};
    for (const path22 of optionPaths) {
      try {
        const parsed = DotenvModule.parse(fs2.readFileSync(path22, { encoding }));
        DotenvModule.populate(parsedAll, parsed, options);
      } catch (e) {
        if (debug) {
          _debug(`Failed to load ${path22} ${e.message}`);
        }
        lastError = e;
      }
    }
    const populated = DotenvModule.populate(processEnv, parsedAll, options);
    debug = parseBoolean(processEnv.DOTENV_CONFIG_DEBUG || debug);
    quiet = parseBoolean(processEnv.DOTENV_CONFIG_QUIET || quiet);
    if (debug || !quiet) {
      const keysCount = Object.keys(populated).length;
      const shortPaths = [];
      for (const filePath of optionPaths) {
        try {
          const relative = path2.relative(process.cwd(), filePath);
          shortPaths.push(relative);
        } catch (e) {
          if (debug) {
            _debug(`Failed to load ${filePath} ${e.message}`);
          }
          lastError = e;
        }
      }
      _log(`injecting env (${keysCount}) from ${shortPaths.join(",")} ${dim(`-- tip: ${_getRandomTip()}`)}`);
    }
    if (lastError) {
      return { parsed: parsedAll, error: lastError };
    } else {
      return { parsed: parsedAll };
    }
  }
  function config(options) {
    if (_dotenvKey(options).length === 0) {
      return DotenvModule.configDotenv(options);
    }
    const vaultPath = _vaultPath(options);
    if (!vaultPath) {
      _warn(`You set DOTENV_KEY but you are missing a .env.vault file at ${vaultPath}. Did you forget to build it?`);
      return DotenvModule.configDotenv(options);
    }
    return DotenvModule._configVault(options);
  }
  function decrypt(encrypted, keyStr) {
    const key = Buffer.from(keyStr.slice(-64), "hex");
    let ciphertext = Buffer.from(encrypted, "base64");
    const nonce = ciphertext.subarray(0, 12);
    const authTag = ciphertext.subarray(-16);
    ciphertext = ciphertext.subarray(12, -16);
    try {
      const aesgcm = crypto.createDecipheriv("aes-256-gcm", key, nonce);
      aesgcm.setAuthTag(authTag);
      return `${aesgcm.update(ciphertext)}${aesgcm.final()}`;
    } catch (error) {
      const isRange = error instanceof RangeError;
      const invalidKeyLength = error.message === "Invalid key length";
      const decryptionFailed = error.message === "Unsupported state or unable to authenticate data";
      if (isRange || invalidKeyLength) {
        const err = new Error("INVALID_DOTENV_KEY: It must be 64 characters long (or more)");
        err.code = "INVALID_DOTENV_KEY";
        throw err;
      } else if (decryptionFailed) {
        const err = new Error("DECRYPTION_FAILED: Please check your DOTENV_KEY");
        err.code = "DECRYPTION_FAILED";
        throw err;
      } else {
        throw error;
      }
    }
  }
  function populate(processEnv, parsed, options = {}) {
    const debug = Boolean(options && options.debug);
    const override = Boolean(options && options.override);
    const populated = {};
    if (typeof parsed !== "object") {
      const err = new Error("OBJECT_REQUIRED: Please check the processEnv argument being passed to populate");
      err.code = "OBJECT_REQUIRED";
      throw err;
    }
    for (const key of Object.keys(parsed)) {
      if (Object.prototype.hasOwnProperty.call(processEnv, key)) {
        if (override === true) {
          processEnv[key] = parsed[key];
          populated[key] = parsed[key];
        }
        if (debug) {
          if (override === true) {
            _debug(`"${key}" is already defined and WAS overwritten`);
          } else {
            _debug(`"${key}" is already defined and was NOT overwritten`);
          }
        }
      } else {
        processEnv[key] = parsed[key];
        populated[key] = parsed[key];
      }
    }
    return populated;
  }
  const DotenvModule = {
    configDotenv,
    _configVault,
    _parseVault,
    config,
    decrypt,
    parse,
    populate
  };
  main.exports.configDotenv = DotenvModule.configDotenv;
  main.exports._configVault = DotenvModule._configVault;
  main.exports._parseVault = DotenvModule._parseVault;
  main.exports.config = DotenvModule.config;
  main.exports.decrypt = DotenvModule.decrypt;
  main.exports.parse = DotenvModule.parse;
  main.exports.populate = DotenvModule.populate;
  main.exports = DotenvModule;
  return main.exports;
}
var mainExports = requireMain();
const dotenv = /* @__PURE__ */ getDefaultExportFromCjs(mainExports);
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
const envPaths = [
  path.join(process.env.APP_ROOT, ".env"),
  // ROOT .env (dev + prod)
  path.join(__dirname$1, ".env"),
  // src/.env fallback
  path.join(process.resourcesPath || __dirname$1, ".env")
  // Packaged app
];
dotenv.config({ path: envPaths.find((p) => fsSync.existsSync(p)) });
console.log("✅ .env loaded:", process.env.GITHUB_PAT ? "GITHUB_PAT found" : "No token");
let win = null;
let splash = null;
const activeProcesses = /* @__PURE__ */ new Map();
const repoCache = /* @__PURE__ */ new Map();
function debugLog(msg) {
  console.log(`[ELECTRON][${(/* @__PURE__ */ new Date()).toISOString()}] ${msg}`);
}
function getOsFolder() {
  if (process.platform === "win32") return "win";
  if (process.platform === "darwin") return "darwin";
  return "linux";
}
function toolPath(tool) {
  const ext = process.platform === "win32" ? ".exe" : "";
  const toolFile = tool + ext;
  return path.join(
    process.env.APP_ROOT,
    "tools",
    getOsFolder(),
    tool,
    toolFile
  );
}
function validateTool(tool) {
  const fullPath = toolPath(tool);
  if (!fsSync.existsSync(fullPath)) {
    debugLog(`Tool not found: ${fullPath}`);
    return null;
  }
  try {
    fsSync.accessSync(fullPath, fsSync.constants.X_OK);
  } catch (err) {
    debugLog(`${tool} not executable: ${fullPath}`);
    if (process.platform !== "win32") {
      try {
        fsSync.chmodSync(fullPath, 493);
        debugLog(`Set execute permission on ${fullPath}`);
      } catch (chmodErr) {
        debugLog(`Failed to set permissions: ${chmodErr.message}`);
        return null;
      }
    }
  }
  debugLog(`Found ${tool} at: ${fullPath}`);
  return fullPath;
}
function killProcess(child, processId) {
  if (!child || !child.pid) {
    debugLog(`No PID for ${processId}`);
    return;
  }
  debugLog(`Killing ${processId} (PID: ${child.pid})`);
  try {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", child.pid.toString(), "/f", "/t"], {
        stdio: "ignore"
      });
    } else {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch (e) {
        child.kill("SIGKILL");
      }
    }
  } catch (err) {
    debugLog(`Kill error ${processId}: ${err.message}`);
    try {
      child.kill("SIGKILL");
    } catch {
    }
  }
}
function getGitHubToken() {
  return process.env.GITHUB_PAT || null;
}
async function cloneRepository(event, repoUrl, branch, scanId) {
  const cacheKey = `${repoUrl}:${branch}`;
  if (repoCache.has(cacheKey)) {
    const cachedPath = repoCache.get(cacheKey);
    try {
      await fs.access(path.join(cachedPath, ".git"));
      debugLog(`Using cached repo: ${cachedPath}`);
      event.sender.send(`scan-log:${scanId}`, {
        log: `✅ Using cached repository
   Path: ${cachedPath}
   Branch: ${branch}

`,
        progress: 50
      });
      return cachedPath;
    } catch {
      repoCache.delete(cacheKey);
    }
  }
  event.sender.send(`scan-log:${scanId}`, {
    log: `
${"═".repeat(60)}
📦 CLONING REPOSITORY
${"═".repeat(60)}
`,
    progress: 5
  });
  event.sender.send(`scan-log:${scanId}`, {
    log: `Repository: ${repoUrl}
Branch: ${branch}

`,
    progress: 10
  });
  const token = getGitHubToken();
  let cloneUrl = repoUrl;
  if (token && !repoUrl.includes("x-access-token")) {
    cloneUrl = repoUrl.replace("https://", `https://x-access-token:${token}@`);
  }
  const repoName = repoUrl.split("/").pop()?.replace(".git", "") || "repo";
  const timestamp = Date.now();
  const tempDir = path.join(
    app.getPath("temp"),
    "software-security-scans",
    `${repoName}-${branch.replace(/\//g, "-")}-${timestamp}`
  );
  try {
    await fs.mkdir(tempDir, { recursive: true });
    return await new Promise((resolve) => {
      const args = ["clone", "-b", branch, "--single-branch", cloneUrl, tempDir];
      event.sender.send(`scan-log:${scanId}`, {
        log: `$ git clone in-progress ...

`,
        progress: 15
      });
      const child = spawn("git", args, {
        detached: true,
        stdio: ["ignore", "pipe", "pipe"]
      });
      child.unref();
      const cloneId = `${scanId}-clone`;
      activeProcesses.set(cloneId, child);
      let cancelled = false;
      let progressCount = 0;
      child.stdout?.on("data", (data) => {
        progressCount++;
        event.sender.send(`scan-log:${scanId}`, {
          log: data.toString(),
          progress: Math.min(20 + progressCount * 2, 45)
        });
      });
      child.stderr?.on("data", (data) => {
        progressCount++;
        event.sender.send(`scan-log:${scanId}`, {
          log: data.toString(),
          progress: Math.min(20 + progressCount * 2, 45)
        });
      });
      child.on("close", (code) => {
        activeProcesses.delete(cloneId);
        if (cancelled) {
          resolve(null);
          return;
        }
        if (code === 0) {
          repoCache.set(cacheKey, tempDir);
          event.sender.send(`scan-log:${scanId}`, {
            log: `
✅ Clone successful!
   Location: ${tempDir}
${"═".repeat(60)}

`,
            progress: 50
          });
          resolve(tempDir);
        } else {
          event.sender.send(`scan-log:${scanId}`, {
            log: `
❌ Clone failed with exit code ${code}
`,
            progress: 0
          });
          resolve(null);
        }
      });
      child.on("error", (err) => {
        activeProcesses.delete(cloneId);
        event.sender.send(`scan-log:${scanId}`, {
          log: `
❌ Clone error: ${err.message}
`,
          progress: 0
        });
        resolve(null);
      });
      const cancelHandler = () => {
        cancelled = true;
        debugLog(`Cancelling clone: ${cloneId}`);
        killProcess(child, cloneId);
        activeProcesses.delete(cloneId);
        resolve(null);
      };
      ipcMain.once(`scan:cancel-${scanId}`, cancelHandler);
      setTimeout(() => {
        if (activeProcesses.has(cloneId)) {
          killProcess(child, cloneId);
          event.sender.send(`scan-log:${scanId}`, {
            log: `
❌ Clone timeout after 3 minutes
`,
            progress: 0
          });
          resolve(null);
        }
      }, 18e4);
    });
  } catch (err) {
    event.sender.send(`scan-log:${scanId}`, {
      log: `
❌ Exception: ${err.message}
`,
      progress: 0
    });
    return null;
  }
}
function registerIPC() {
  ipcMain.handle("scan:verify-gpg", async (event, { repoUrl, branch, scanId }) => {
    debugLog(`[GPG] Starting verification for ${repoUrl} on branch ${branch}`);
    const repoPath = await cloneRepository(event, repoUrl, branch, scanId);
    if (!repoPath) {
      event.sender.send(`scan-complete:${scanId}`, {
        success: false,
        error: "Clone failed"
      });
      return { success: false, error: "Clone failed" };
    }
    return new Promise((resolve) => {
      event.sender.send(`scan-log:${scanId}`, {
        log: `
${"═".repeat(60)}
🔐 GPG SIGNATURE VERIFICATION
${"═".repeat(60)}

`,
        progress: 52
      });
      event.sender.send(`scan-log:${scanId}`, {
        log: `🔍 Analyzing ALL commit signatures on branch: ${branch}...

`,
        progress: 55
      });
      const child = spawn(
        "git",
        ["log", "--show-signature", "--pretty=format:%H|%an|%aI|%s", branch],
        {
          cwd: repoPath,
          detached: true,
          stdio: ["ignore", "pipe", "pipe"]
        }
      );
      child.unref();
      activeProcesses.set(scanId, child);
      let buffer = "";
      let stderrBuffer = "";
      let commitCount = 0;
      let goodSignatures = 0;
      let cancelled = false;
      child.stdout?.on("data", (chunk) => {
        if (cancelled) return;
        buffer += chunk.toString();
      });
      child.stderr?.on("data", (chunk) => {
        if (cancelled) return;
        stderrBuffer += chunk.toString();
      });
      child.on("close", (code) => {
        activeProcesses.delete(scanId);
        if (cancelled) {
          resolve({ success: false, cancelled: true });
          return;
        }
        const fullOutput = buffer + "\n" + stderrBuffer;
        const lines = fullOutput.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.includes("|")) {
            commitCount++;
            const [sha, author, date, subject] = line.split("|");
            let isGoodSig = false;
            let signatureBlock = "";
            for (let j = Math.max(0, i - 20); j < i; j++) {
              signatureBlock += lines[j] + "\n";
            }
            if (signatureBlock.includes("Good signature from") || signatureBlock.includes("gpg: Good signature") || signatureBlock.includes("Signature made") || signatureBlock.includes("using RSA key") && signatureBlock.includes("Good") || signatureBlock.includes("using ECDSA key") && signatureBlock.includes("Good")) {
              isGoodSig = true;
              goodSignatures++;
            }
            if (signatureBlock.includes("Verified") && !isGoodSig) {
              isGoodSig = true;
              goodSignatures++;
            }
            const log = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 Commit ${commitCount}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SHA     : ${sha.substring(0, 8)}
Author  : ${author}
Date    : ${date}
Message : ${subject}

GPG     : ${isGoodSig ? "✅ GOOD SIGNATURE" : "❌ MISSING/INVALID"}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
            event.sender.send(`scan-log:${scanId}`, {
              log,
              progress: 55 + Math.min(commitCount / Math.max(commitCount, 1) * 35, 35)
            });
            signatureBlock = "";
          }
        }
        const successRate = commitCount > 0 ? Math.round(goodSignatures / commitCount * 100) : 0;
        const summary = `


╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║              🛡️  GPG SIGNED COMMITS VERIFICATION SUMMARY  🛡️                 ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝

Branch           : ${branch}
Total Commits    : ${commitCount}
Good Signatures  : ${goodSignatures}
Missing/Invalid  : ${commitCount - goodSignatures}
Success Rate     : ${successRate}%
Status           : ${code === 0 ? "✅ COMPLETE" : "❌ FAILED"}

${"═".repeat(79)}
`;
        event.sender.send(`scan-log:${scanId}`, {
          log: summary,
          progress: 100
        });
        event.sender.send(`scan-complete:${scanId}`, {
          success: code === 0,
          totalCommits: commitCount,
          goodSignatures
        });
        resolve({ success: code === 0, totalCommits: commitCount, goodSignatures });
      });
      child.on("error", (err) => {
        activeProcesses.delete(scanId);
        event.sender.send(`scan-complete:${scanId}`, {
          success: false,
          error: err.message
        });
        resolve({ success: false, error: err.message });
      });
      ipcMain.once(`scan:cancel-${scanId}`, () => {
        cancelled = true;
        debugLog(`Cancelling GPG scan: ${scanId}`);
        killProcess(child, scanId);
        activeProcesses.delete(scanId);
        resolve({ success: false, cancelled: true });
      });
    });
  });
  ipcMain.handle("scan:gitleaks", async (event, { repoUrl, branch, scanId }) => {
    debugLog(`[GITLEAKS] Starting scan for ${repoUrl}`);
    const gitleaksPath = validateTool("gitleaks");
    if (!gitleaksPath) {
      event.sender.send(`scan-log:${scanId}`, {
        log: `
❌ Gitleaks tool not found
   Expected: ${toolPath("gitleaks")}

`,
        progress: 0
      });
      event.sender.send(`scan-complete:${scanId}`, {
        success: false,
        error: "Tool not found"
      });
      return { success: false, error: "Tool not found" };
    }
    const repoPath = await cloneRepository(event, repoUrl, branch, scanId);
    if (!repoPath) {
      event.sender.send(`scan-complete:${scanId}`, {
        success: false,
        error: "Clone failed"
      });
      return { success: false, error: "Clone failed" };
    }
    const reportPath = path.join(repoPath, "gitleaks-report.json");
    return new Promise((resolve) => {
      event.sender.send(`scan-log:${scanId}`, {
        log: `
${"═".repeat(60)}
🔐 SECRETS & CREDENTIALS DETECTION
${"═".repeat(60)}

`,
        progress: 52
      });
      event.sender.send(`scan-log:${scanId}`, {
        log: `🔍 Scanning for hardcoded secrets and credentials...

`,
        progress: 55
      });
      const spawnOptions = {
        cwd: repoPath,
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          NO_COLOR: "1"
          // Removed ANSI colors for cleaner parsing
        }
      };
      if (process.platform === "win32") {
        spawnOptions.windowsHide = true;
        spawnOptions.shell = false;
        spawnOptions.detached = false;
      } else {
        spawnOptions.detached = true;
      }
      const child = spawn(
        gitleaksPath,
        ["detect", "--source", repoPath, "--report-path", reportPath, "--verbose"],
        spawnOptions
      );
      if (process.platform !== "win32") {
        child.unref();
      }
      activeProcesses.set(scanId, child);
      let cancelled = false;
      child.stdout?.on("data", (data) => {
        if (cancelled) return;
        event.sender.send(`scan-log:${scanId}`, {
          log: data.toString(),
          progress: 70
        });
      });
      child.stderr?.on("data", (data) => {
        if (cancelled) return;
        event.sender.send(`scan-log:${scanId}`, {
          log: data.toString(),
          progress: 85
        });
      });
      child.on("close", async () => {
        activeProcesses.delete(scanId);
        if (cancelled) {
          resolve({ success: false, cancelled: true });
          return;
        }
        let findings = 0;
        if (fsSync.existsSync(reportPath)) {
          try {
            const report = JSON.parse(await fs.readFile(reportPath, "utf-8"));
            findings = report.length || 0;
            if (findings > 0) {
              event.sender.send(`scan-log:${scanId}`, {
                log: `
🔍 DETAILED FINDINGS:
${"═".repeat(79)}

`,
                progress: 90
              });
              report.forEach((finding, index) => {
                const secretLog = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 Secret ${index + 1}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Type        : ${finding.RuleID || "Unknown"}
Description : ${finding.Description || finding.RuleID || "N/A"}
File        : ${finding.File || "N/A"}
Line        : ${finding.StartLine || "N/A"}
Commit      : ${finding.Commit?.substring(0, 8) || "N/A"}
Author      : ${finding.Author || "N/A"}
Date        : ${finding.Date || "N/A"}

Match       : ${finding.Match?.substring(0, 80) || "N/A"}${finding.Match?.length > 80 ? "..." : ""}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
                event.sender.send(`scan-log:${scanId}`, {
                  log: secretLog,
                  progress: 90 + Math.floor(index / findings * 5)
                });
              });
            }
          } catch (err) {
            debugLog(`Error parsing Gitleaks report: ${err}`);
          }
        }
        const summary = `

╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║                🔐  SECRETS & CREDENTIALS LEAKAGE SUMMARY  🔐                 ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝

Potential Secrets : ${findings}
Status            : ${findings > 0 ? "🚨 SECRETS DETECTED" : "✅ CLEAN"}
Severity          : ${findings > 0 ? "HIGH - Immediate action required" : "NONE"}

${"═".repeat(79)}
`;
        event.sender.send(`scan-log:${scanId}`, {
          log: summary,
          progress: 100
        });
        event.sender.send(`scan-complete:${scanId}`, {
          success: true,
          findings
        });
        resolve({ success: true, findings });
      });
      child.on("error", (err) => {
        activeProcesses.delete(scanId);
        event.sender.send(`scan-complete:${scanId}`, {
          success: false,
          error: err.message
        });
        resolve({ success: false, error: err.message });
      });
      ipcMain.once(`scan:cancel-${scanId}`, () => {
        cancelled = true;
        debugLog(`Cancelling Gitleaks scan: ${scanId}`);
        killProcess(child, scanId);
        activeProcesses.delete(scanId);
        resolve({ success: false, cancelled: true });
      });
    });
  });
  function formatTrivyReport(results) {
    if (!results.Results || results.Results.length === 0) return "";
    let report = "\n🔎 DETAILED VULNERABILITY REPORT\n";
    report += "════════════════════════════════════════════════════════════\n";
    results.Results.forEach((target) => {
      if (target.Vulnerabilities && target.Vulnerabilities.length > 0) {
        report += `
📂 Target: ${target.Target}
`;
        report += `   Type:   ${target.Type}
`;
        report += "   ────────────────────────────────────────────────────────\n";
        target.Vulnerabilities.forEach((vuln) => {
          const severityIcon = vuln.Severity === "CRITICAL" ? "🔴" : vuln.Severity === "HIGH" ? "🟠" : vuln.Severity === "MEDIUM" ? "🟡" : "🔵";
          report += `   ${severityIcon} [${vuln.Severity}] ${vuln.VulnerabilityID}
`;
          report += `      📦 Package: ${vuln.PkgName} (${vuln.InstalledVersion})
`;
          report += `      ⚠️ Title:   ${vuln.Title || "N/A"}
`;
          if (vuln.FixedVersion) {
            report += `      ✅ Fixed in: ${vuln.FixedVersion}
`;
          }
          report += "\n";
        });
      }
    });
    return report;
  }
  ipcMain.handle("scan:trivy", async (event, { repoUrl, branch, scanId }) => {
    debugLog(`[TRIVY] Starting SBOM scan for ${repoUrl}`);
    const trivyPath = validateTool("trivy");
    if (!trivyPath) {
      event.sender.send(`scan-log:${scanId}`, {
        log: `
❌ Trivy tool not found
   Expected: ${toolPath("trivy")}

`,
        progress: 0
      });
      event.sender.send(`scan-complete:${scanId}`, {
        success: false,
        error: "Tool not found"
      });
      return { success: false, error: "Tool not found" };
    }
    const repoPath = await cloneRepository(event, repoUrl, branch, scanId);
    if (!repoPath) {
      event.sender.send(`scan-complete:${scanId}`, {
        success: false,
        error: "Clone failed"
      });
      return { success: false, error: "Clone failed" };
    }
    return new Promise((resolve) => {
      event.sender.send(`scan-log:${scanId}`, {
        log: `
${"═".repeat(60)}
🛡️ TRIVY SBOM & VULNERABILITY SCAN
${"═".repeat(60)}

`,
        progress: 52
      });
      event.sender.send(`scan-log:${scanId}`, {
        log: `🔍 Analyzing dependencies and security vulnerabilities...
📦 Building Software Bill of Materials (SBOM)...

`,
        progress: 55
      });
      const child = spawn(
        trivyPath,
        ["fs", "--scanners", "vuln,misconfig", "--format", "json", repoPath],
        {
          detached: true,
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true
        }
      );
      child.unref();
      activeProcesses.set(scanId, child);
      let jsonBuffer = "";
      let cancelled = false;
      child.stdout?.on("data", (chunk) => {
        if (cancelled) return;
        jsonBuffer += chunk.toString();
        event.sender.send(`scan-log:${scanId}`, {
          log: "🔍 Analyzing dependencies and vulnerabilities...\n",
          progress: 70
        });
      });
      child.stderr?.on("data", (data) => {
        if (cancelled) return;
        const msg = data.toString();
        if (!msg.includes("Update") && !msg.includes("deprecated")) {
          event.sender.send(`scan-log:${scanId}`, {
            log: msg,
            progress: 85
          });
        }
      });
      child.on("close", (code) => {
        activeProcesses.delete(scanId);
        if (cancelled) {
          resolve({ success: false, cancelled: true });
          return;
        }
        if (code === 0) {
          try {
            const results = JSON.parse(jsonBuffer);
            const vulns = results.Results?.reduce(
              (acc, r) => acc + (r.Vulnerabilities?.length || 0),
              0
            ) || 0;
            const detailedReport = formatTrivyReport(results);
            event.sender.send(`scan-log:${scanId}`, {
              log: detailedReport,
              progress: 95
            });
            const summary = `

╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║                 🚨  SBOM & VULNERABILITY SCAN SUMMARY  🚨                    ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝

Vulnerabilities : ${vulns}
Status          : ${vulns > 0 ? "🚨 VULNERABILITIES DETECTED" : "✅ NO VULNERABILITIES"}
Risk Level      : ${vulns > 10 ? "CRITICAL" : vulns > 5 ? "HIGH" : vulns > 0 ? "MEDIUM" : "NONE"}

${"═".repeat(79)}
`;
            event.sender.send(`scan-log:${scanId}`, {
              log: summary,
              progress: 100
            });
            event.sender.send(`scan-complete:${scanId}`, {
              success: true,
              vulnerabilities: vulns
            });
            resolve({ success: true, vulnerabilities: vulns });
          } catch (err) {
            console.error("Trivy Parse Error:", err);
            event.sender.send(`scan-complete:${scanId}`, {
              success: false,
              error: "Failed to parse Trivy results"
            });
            resolve({ success: false, error: "Failed to parse Trivy results" });
          }
        } else {
          event.sender.send(`scan-complete:${scanId}`, {
            success: false,
            error: `Trivy exited with code ${code}`
          });
          resolve({ success: false, error: `Trivy exited with code ${code}` });
        }
      });
      child.on("error", (err) => {
        activeProcesses.delete(scanId);
        event.sender.send(`scan-complete:${scanId}`, {
          success: false,
          error: err.message
        });
        resolve({ success: false, error: err.message });
      });
      ipcMain.once(`scan:cancel-${scanId}`, () => {
        cancelled = true;
        debugLog(`Cancelling Trivy scan: ${scanId}`);
        killProcess(child, scanId);
        activeProcesses.delete(scanId);
        resolve({ success: false, cancelled: true });
      });
    });
  });
  ipcMain.handle("scan:opengrep", async (event, { repoUrl, branch, scanId }) => {
    debugLog(`[OPENGREP] Starting multi-language SAST analysis for ${repoUrl}`);
    const opengrepPath = validateTool("opengrep");
    if (!opengrepPath) {
      event.sender.send(`scan-log:${scanId}`, {
        log: `
❌ OpenGrep tool not found
   Expected: ${toolPath("opengrep")}

`,
        progress: 0
      });
      event.sender.send(`scan-complete:${scanId}`, { success: false, error: "Tool not found" });
      return { success: false, error: "Tool not found" };
    }
    const repoPath = await cloneRepository(event, repoUrl, branch, scanId);
    if (!repoPath) {
      event.sender.send(`scan-complete:${scanId}`, { success: false, error: "Clone failed" });
      return { success: false, error: "Clone failed" };
    }
    return new Promise((resolve) => {
      event.sender.send(`scan-log:${scanId}`, {
        log: `
${"═".repeat(79)}
🔬 STATIC APPLICATION SECURITY TESTING (SAST) 
${"═".repeat(79)}

`,
        progress: 52
      });
      event.sender.send(`scan-log:${scanId}`, {
        log: `📦 Repository: ${repoUrl}
🌿 Branch: ${branch}


`,
        progress: 54
      });
      const reportPath = path.join(repoPath, "opengrep-report.json");
      const args = [
        "scan",
        "--config",
        "auto",
        "--json",
        "--output",
        reportPath,
        "--verbose",
        "--no-git-ignore",
        repoPath
      ];
      event.sender.send(`scan-log:${scanId}`, {
        log: `🔍 Scanning entire repository recursively (all folders)...
`,
        progress: 60
      });
      event.sender.send(`scan-log:${scanId}`, {
        log: `⏳ This may take 1-3 minutes...

`,
        progress: 62
      });
      const spawnOptions = {
        cwd: repoPath,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, NO_COLOR: "1" },
        windowsHide: true,
        shell: false,
        detached: false
      };
      const child = spawn(opengrepPath, args, spawnOptions);
      const scanProcessId = `${scanId}-opengrep`;
      activeProcesses.set(scanProcessId, child);
      let cancelled = false;
      let progressCounter = 0;
      let stdoutData = "";
      let stderrData = "";
      child.stdout?.on("data", (data) => {
        if (cancelled) return;
        progressCounter++;
        stdoutData += data.toString();
        event.sender.send(`scan-log:${scanId}`, {
          log: "",
          progress: Math.min(65 + Math.floor(progressCounter / 5), 85)
        });
      });
      child.stderr?.on("data", (data) => {
        if (cancelled) return;
        stderrData += data.toString();
      });
      child.on("close", async (code) => {
        activeProcesses.delete(scanProcessId);
        if (cancelled) {
          resolve({ success: false, cancelled: true });
          return;
        }
        debugLog(`[OPENGREP] Process exited with code: ${code}`);
        let totalIssues = 0;
        let passedChecks = 0;
        let failedChecks = 0;
        let findings = [];
        let criticalCount = 0;
        let highCount = 0;
        let mediumCount = 0;
        let lowCount = 0;
        if (fsSync.existsSync(reportPath)) {
          try {
            let getRelativePath = function(absolutePath) {
              const normalized = absolutePath.replace(/\\/g, "/");
              if (normalized.startsWith(repoPathNormalized)) {
                return normalized.substring(repoPathNormalized.length + 1);
              }
              return normalized;
            };
            const reportContent = await fs.readFile(reportPath, "utf-8");
            const report = JSON.parse(reportContent);
            findings = report.results || [];
            totalIssues = findings.length;
            failedChecks = totalIssues;
            const scannedFiles = report.paths?.scanned || [];
            const skippedFiles = report.paths?.skipped || [];
            passedChecks = scannedFiles.length;
            const totalFilesScanned = scannedFiles.length;
            const repoPathNormalized = repoPath.replace(/\\/g, "/");
            const ignoredDirs = /* @__PURE__ */ new Set([
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
            ]);
            const projectDirectories = /* @__PURE__ */ new Set();
            const filesByDirectory = /* @__PURE__ */ new Map();
            try {
              const repoContents = await fs.readdir(repoPath, { withFileTypes: true });
              repoContents.forEach((item) => {
                if (item.isDirectory() && !ignoredDirs.has(item.name)) {
                  projectDirectories.add(item.name);
                  filesByDirectory.set(item.name, 0);
                }
              });
              debugLog(`[OPENGREP] Found ${projectDirectories.size} project directories`);
            } catch (err) {
              debugLog(`Error reading repo directory: ${err.message}`);
            }
            scannedFiles.forEach((absolutePath) => {
              const relativePath = getRelativePath(absolutePath);
              const normalizedPath = relativePath.replace(/\\/g, "/");
              const parts = normalizedPath.split("/").filter((p) => p && p !== ".");
              if (parts.length === 0) return;
              if (parts.length > 1) {
                const topDir = parts[0];
                if (projectDirectories.has(topDir)) {
                  filesByDirectory.set(topDir, (filesByDirectory.get(topDir) || 0) + 1);
                }
              }
            });
            const rulesRun = /* @__PURE__ */ new Set();
            let totalRulesCount = 0;
            const ruleCountPattern = /(?:running|loaded|scanning with)\s+(\d+)\s+rules?/gi;
            const ruleCountMatch = ruleCountPattern.exec(stderrData);
            if (ruleCountMatch) {
              totalRulesCount = parseInt(ruleCountMatch[1]);
            }
            const lines = stderrData.split("\n");
            lines.forEach((line) => {
              const trimmed = line.trim();
              const ruleMatch = trimmed.match(/^(?:rule|checking|running):\s*([a-zA-Z0-9._\-:\/]+)$/i);
              if (ruleMatch) rulesRun.add(ruleMatch[1]);
              if (trimmed.includes(".") && trimmed.length > 10 && trimmed.length < 100 && !trimmed.includes(" ") && /^[a-zA-Z0-9._\-:\/]+$/.test(trimmed)) {
                rulesRun.add(trimmed);
              }
            });
            const findingsByDirectory = /* @__PURE__ */ new Map();
            findings.forEach((f) => {
              const severity = (f.extra?.severity || "WARNING").toUpperCase();
              if (severity === "ERROR" || severity === "CRITICAL") criticalCount++;
              else if (severity === "WARNING" || severity === "HIGH") highCount++;
              else if (severity === "MEDIUM") mediumCount++;
              else lowCount++;
              if (f.check_id) rulesRun.add(f.check_id);
              const absolutePath = f.path || "";
              const relativePath = getRelativePath(absolutePath);
              const normalizedPath = relativePath.replace(/\\/g, "/");
              const parts = normalizedPath.split("/").filter((p) => p && p !== ".");
              if (parts.length > 1) {
                const topDir = parts[0];
                if (projectDirectories.has(topDir)) {
                  if (!findingsByDirectory.has(topDir)) findingsByDirectory.set(topDir, []);
                  findingsByDirectory.get(topDir).push(f);
                }
              }
            });
            event.sender.send(`scan-log:${scanId}`, {
              log: `
✅ Scan completed successfully!

`,
              progress: 88
            });
            const filesInIdentifiedProjects = Array.from(filesByDirectory.values()).reduce((sum, count) => sum + count, 0);
            const otherFiles = totalFilesScanned - filesInIdentifiedProjects;
            const projectsWithFiles = Array.from(filesByDirectory.entries()).filter(([dir, count]) => count > 0 && projectDirectories.has(dir)).sort((a, b) => b[1] - a[1]);
            if (projectsWithFiles.length > 0) {
              event.sender.send(`scan-log:${scanId}`, {
                log: `

📂 FILES BY PROJECT:
${"─".repeat(79)}

`,
                progress: 89
              });
              projectsWithFiles.forEach(([dir, count]) => {
                const issues = findingsByDirectory.get(dir) || [];
                const statusIcon = issues.length === 0 ? "✅" : issues.length <= 5 ? "🟡" : "🔴";
                const percentage = totalFilesScanned > 0 ? Math.round(count / totalFilesScanned * 100) : 0;
                event.sender.send(`scan-log:${scanId}`, {
                  log: `  ${statusIcon} ${dir.padEnd(40)} ${count.toString().padStart(4)} files (${percentage.toString().padStart(2)}%)${issues.length > 0 ? ` — ${issues.length} issue(s)` : ""}
`,
                  progress: 89
                });
              });
              if (otherFiles > 0) {
                const rootPercentage = totalFilesScanned > 0 ? Math.round(otherFiles / totalFilesScanned * 100) : 0;
                event.sender.send(`scan-log:${scanId}`, {
                  log: `  📄 [root/misc] (config/metadata)           ${otherFiles.toString().padStart(4)} files (${rootPercentage.toString().padStart(2)}%)
`,
                  progress: 89
                });
              }
            } else if (totalFilesScanned > 0) {
              event.sender.send(`scan-log:${scanId}`, {
                log: `
📂 FILES SCANNED: ${totalFilesScanned} (root level or flat structure)
`,
                progress: 89
              });
            }
            event.sender.send(`scan-log:${scanId}`, {
              log: `

🛡️  SECURITY RULES APPLIED:
${"═".repeat(79)}

`,
              progress: 90
            });
            if (totalRulesCount > 0) {
              event.sender.send(`scan-log:${scanId}`, {
                log: `   OpenGrep scanned ${totalFilesScanned} files using ${totalRulesCount} security rules

`,
                progress: 90
              });
            }
            if (rulesRun.size > 0) {
              const rulesByCategory = /* @__PURE__ */ new Map();
              rulesRun.forEach((ruleId) => {
                const parts = ruleId.split(".");
                let category = "Other";
                if (parts.includes("security")) category = "Security";
                else if (parts.includes("best-practice")) category = "Best Practice";
                else if (parts.includes("performance")) category = "Performance";
                else if (parts.includes("correctness")) category = "Correctness";
                else if (parts.includes("audit")) category = "Security Audit";
                else if (parts.length >= 2) category = parts[1];
                if (!rulesByCategory.has(category)) rulesByCategory.set(category, []);
                rulesByCategory.get(category).push(ruleId);
              });
              const sortedCategories = Array.from(rulesByCategory.entries()).sort((a, b) => b[1].length - a[1].length);
              if (sortedCategories.length > 0) {
                event.sender.send(`scan-log:${scanId}`, { log: `   Sample Rules by Category:

`, progress: 90 });
                sortedCategories.slice(0, 8).forEach(([category, rules]) => {
                  event.sender.send(`scan-log:${scanId}`, {
                    log: `   📋 ${category} (${rules.length} rule${rules.length > 1 ? "s" : ""})
`,
                    progress: 90
                  });
                  rules.slice(0, 3).forEach((ruleId) => {
                    event.sender.send(`scan-log:${scanId}`, { log: `      • ${ruleId}
`, progress: 90 });
                  });
                  if (rules.length > 3) {
                    event.sender.send(`scan-log:${scanId}`, { log: `      ... and ${rules.length - 3} more
`, progress: 90 });
                  }
                  event.sender.send(`scan-log:${scanId}`, { log: `
`, progress: 90 });
                });
              }
            }
            if (totalIssues > 0) {
              event.sender.send(`scan-log:${scanId}`, {
                log: `

🚨 SECURITY FINDINGS:
${"═".repeat(79)}

`,
                progress: 91
              });
              const severityLog = `
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🔴 Critical/Error       : ${criticalCount.toString().padStart(4)}                                             │
│ 🟠 High/Warning         : ${highCount.toString().padStart(4)}                                             │
│ 🟡 Medium               : ${mediumCount.toString().padStart(4)}                                             │
│ 🔵 Low/Info             : ${lowCount.toString().padStart(4)}                                             │
└─────────────────────────────────────────────────────────────────────────────┘
`;
              event.sender.send(`scan-log:${scanId}`, { log: severityLog, progress: 91 });
              const sortedFindings = Array.from(findingsByDirectory.entries()).filter(([issues]) => issues.length > 0).sort((a, b) => b[1].length - a[1].length);
              if (sortedFindings.length > 0) {
                event.sender.send(`scan-log:${scanId}`, { log: `
📂 ISSUES BY PROJECT:
${"─".repeat(79)}

`, progress: 91 });
                sortedFindings.forEach(([dir, dirFindings]) => {
                  const critical = dirFindings.filter((f) => {
                    const sev = (f.extra?.severity || "WARNING").toUpperCase();
                    return sev === "ERROR" || sev === "CRITICAL";
                  }).length;
                  const high = dirFindings.filter((f) => {
                    const sev = (f.extra?.severity || "WARNING").toUpperCase();
                    return sev === "WARNING" || sev === "HIGH";
                  }).length;
                  event.sender.send(`scan-log:${scanId}`, {
                    log: `  📂 ${dir}/ — ${dirFindings.length} total | 🔴 ${critical} critical | 🟠 ${high} high
`,
                    progress: 91
                  });
                });
              }
              event.sender.send(`scan-log:${scanId}`, {
                log: `

🔍 TOP ${Math.min(10, totalIssues)} CRITICAL FINDINGS:
${"═".repeat(79)}

`,
                progress: 92
              });
              const severityMap = {
                ERROR: 4,
                CRITICAL: 4,
                WARNING: 3,
                HIGH: 3,
                MEDIUM: 2,
                INFO: 1,
                LOW: 1
              };
              const allSortedFindings = findings.sort((a, b) => {
                const sevA = (a.extra?.severity || "WARNING").toUpperCase();
                const sevB = (b.extra?.severity || "WARNING").toUpperCase();
                return (severityMap[sevB] || 0) - (severityMap[sevA] || 0);
              });
              allSortedFindings.slice(0, 10).forEach((finding, index) => {
                const sev = (finding.extra?.severity || "WARNING").toUpperCase();
                const sevIcon = sev === "ERROR" || sev === "CRITICAL" ? "🔴 CRITICAL" : sev === "WARNING" || sev === "HIGH" ? "🟠 HIGH    " : "🔵 LOW     ";
                const absolutePath = finding.path || "N/A";
                const relativePath = getRelativePath(absolutePath);
                const shortPath = relativePath.length > 60 ? "..." + relativePath.slice(-57) : relativePath;
                const findingLog = `
${index + 1}. ${sevIcon} │ ${finding.check_id || "Unknown Rule"}
   File: ${shortPath}
   Line: ${finding.start?.line || "?"}
   ${finding.extra?.message || finding.message || "No description"}
${"─".repeat(79)}
`;
                event.sender.send(`scan-log:${scanId}`, { log: findingLog, progress: 93 });
              });
            } else {
              event.sender.send(`scan-log:${scanId}`, {
                log: `

✅ NO SECURITY ISSUES DETECTED!
${"═".repeat(79)}

`,
                progress: 95
              });
              event.sender.send(`scan-log:${scanId}`, {
                log: `🎉 All ${totalFilesScanned} files passed security analysis.
🛡️  No vulnerabilities found. Repository is secure!
`,
                progress: 95
              });
            }
            const projectsList = projectsWithFiles.length > 0 ? projectsWithFiles.map(([dir]) => dir).slice(0, 3).join(", ") + (projectsWithFiles.length > 3 ? `, +${projectsWithFiles.length - 3} more` : "") : "No sub-projects detected";
            const summary_text = `
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║                        📊  SAST ANALYSIS SUMMARY  📊                         ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝

Repository        : ${repoUrl}
Branch            : ${branch}
Scan Engine       : OpenGrep (Open Source SAST)

📁 SCAN COVERAGE
───────────────────────────────────────────────────────────────────────────────
  Total Files Scanned     : ${totalFilesScanned}
  Projects Scanned        : ${projectsWithFiles.length} (${projectsList})
  Files Skipped           : ${skippedFiles.length}
  Rules Applied           : ${totalRulesCount > 0 ? totalRulesCount : "Auto (Community Rules)"}

  Breakdown:
   - Project Code         : ${filesInIdentifiedProjects}
   - Config/Root/Misc     : ${otherFiles}

🔍 FINDINGS SUMMARY
───────────────────────────────────────────────────────────────────────────────
  Total Issues            : ${totalIssues}
  🔴 Critical/Error       : ${criticalCount}
  🟠 High/Warning         : ${highCount}
  🟡 Medium               : ${mediumCount}
  🔵 Low/Info             : ${lowCount}

🎯 SECURITY VERDICT
───────────────────────────────────────────────────────────────────────────────
${totalIssues === 0 ? `  ✅ SECURE — All code passed security checks
  ✅ No vulnerabilities detected
  ✅ Safe to deploy to production` : criticalCount > 0 ? `  🚨 CRITICAL RISK — ${criticalCount} critical vulnerabilities detected
  ⛔ DO NOT DEPLOY until all critical issues are fixed
  🔧 Immediate remediation required` : `  ⚠️  RISKS DETECTED — ${totalIssues} issues found
  🔧 Review required`}
═══════════════════════════════════════════════════════════════════════════════
`;
            event.sender.send(`scan-log:${scanId}`, {
              log: summary_text,
              progress: 100
            });
          } catch (err) {
            debugLog(`Error parsing OpenGrep report: ${err.message}`);
            event.sender.send(`scan-log:${scanId}`, {
              log: `
❌ Error parsing report: ${err.message}
`,
              progress: 100
            });
          }
        } else {
          event.sender.send(`scan-log:${scanId}`, {
            log: `
⚠️ No report file generated
`,
            progress: 100
          });
          if (stderrData.trim()) {
            event.sender.send(`scan-log:${scanId}`, { log: `
❌ Error details:
${stderrData}
`, progress: 100 });
          }
        }
        const success = code === 0 || code === 1;
        event.sender.send(`scan-complete:${scanId}`, {
          success,
          totalIssues,
          passedChecks,
          failedChecks,
          error: success ? void 0 : `Scan exited with code ${code}`
        });
        resolve({ success, totalIssues, passedChecks, failedChecks });
      });
      child.on("error", (err) => {
        activeProcesses.delete(scanProcessId);
        event.sender.send(`scan-log:${scanId}`, { log: `
❌ OpenGrep process error: ${err.message}
`, progress: 0 });
        event.sender.send(`scan-complete:${scanId}`, { success: false, error: err.message });
        resolve({ success: false, error: err.message });
      });
      ipcMain.once(`scan:cancel-${scanId}`, () => {
        cancelled = true;
        debugLog(`Cancelling OpenGrep scan: ${scanId}`);
        event.sender.send(`scan-log:${scanId}`, { log: `
⚠️ Scan cancelled by user
`, progress: 0 });
        killProcess(child, scanProcessId);
        activeProcesses.delete(scanProcessId);
        resolve({ success: false, cancelled: true });
      });
    });
  });
  ipcMain.handle("crypto:generate-keys", async (event, { type, size, curve, password, outputDir, scanId }) => {
    const exePath = validateTool("KeyGenerator");
    if (!exePath) {
      event.sender.send(`scan-log:${scanId}`, {
        log: `
❌ TOOL ERROR: KeyGenerator not found!
Expected: ${toolPath("KeyGenerator")}
`,
        progress: 0
      });
      return { success: false, error: "Tool not found" };
    }
    return new Promise((resolve) => {
      event.sender.send(`scan-log:${scanId}`, {
        log: `
${"═".repeat(65)}
🔑 KEY GENERATION STARTED
${"═".repeat(65)}

🔹 Algorithm: ${type.toUpperCase()}${type === "rsa" ? ` (${size} bits)` : ` (${curve})`}
🔹 Output: ${outputDir}
🔹 Security: ${password ? "🔒 Protected" : "⚠️ No Password"}

`,
        progress: 5
      });
      const args = ["generate", type];
      if (type === "rsa" && size) args.push("-s", `${size}`);
      if (type === "ecdsa" && curve) args.push("-c", curve);
      if (password) args.push("-p", password);
      args.push("-o", outputDir);
      event.sender.send(`scan-log:${scanId}`, {
        log: `⏳ Executing...
`,
        progress: 10
      });
      const child = spawn(exePath, args, {
        stdio: ["ignore", "pipe", "pipe"]
      });
      activeProcesses.set(scanId, child);
      let cancelled = false;
      if (child.stdout) {
        child.stdout.on("data", (chunk) => {
          if (cancelled) return;
          const text = chunk.toString();
          event.sender.send(`scan-log:${scanId}`, { log: text, progress: 60 });
        });
      }
      if (child.stderr) {
        child.stderr.on("data", (chunk) => {
          if (cancelled) return;
          const text = chunk.toString();
          event.sender.send(`scan-log:${scanId}`, { log: `
🔴 [ERROR] ${text.trim()}
`, progress: 50 });
        });
      }
      child.on("close", (code) => {
        activeProcesses.delete(scanId);
        if (cancelled) return;
        const trueSuccess = code === 0;
        let finalReport = `╔══════════════════════════════════════════════════════════════════════╗
`;
        finalReport += `                    KEY GENERATION REPORT                               
`;
        finalReport += `╚══════════════════════════════════════════════════════════════════════╝

`;
        finalReport += `    RESULT             : ${code === 0 ? "✅ SUCCESS" : "❌ FAILED (" + code + ")"}
`;
        finalReport += `    Algorithm         : ${type.toUpperCase()}
`;
        finalReport += `    Timestamp      : ${(/* @__PURE__ */ new Date()).toLocaleTimeString()}
`;
        if (trueSuccess) {
          finalReport += `    ✅ KEYS READY FOR SIGNING!
`;
        } else {
          finalReport += `    ⚠️  Check error logs above
`;
        }
        finalReport += `
${"═".repeat(70)}`;
        event.sender.send(`scan-log:${scanId}`, { log: finalReport, progress: 100 });
        event.sender.send(`scan-complete:${scanId}`, { success: trueSuccess });
        resolve({ success: trueSuccess });
      });
      child.on("error", (error) => {
        activeProcesses.delete(scanId);
        event.sender.send(`scan-log:${scanId}`, {
          log: `
💥 SPAWN ERROR: ${error.message}`,
          progress: 0
        });
        resolve({ success: false, error: error.message });
      });
      ipcMain.once(`scan:cancel-${scanId}`, () => {
        cancelled = true;
        if (child.pid) process.kill(child.pid, "SIGTERM");
        event.sender.send(`scan-log:${scanId}`, { log: `
🛑 CANCELLED
`, progress: 0 });
        resolve({ success: false, cancelled: true });
      });
    });
  });
  ipcMain.handle("crypto:sign-artifact", async (event, { repoUrl, branch, privateKeyPath, password, scanId }) => {
    const exePath = validateTool("SoftwareSigner");
    if (!exePath) {
      event.sender.send(`scan-log:${scanId}`, {
        log: `
❌ TOOL ERROR: SoftwareSigner not found.
Expected at: ${toolPath("SoftwareSigner")}
`,
        progress: 0
      });
      return { success: false, error: "Tool not found" };
    }
    const repoPath = await cloneRepository(event, repoUrl, branch, scanId);
    if (!repoPath) {
      event.sender.send(`scan-complete:${scanId}`, { success: false, error: "Clone Failed" });
      return { success: false, error: "Clone Failed" };
    }
    return new Promise((resolve) => {
      event.sender.send(`scan-log:${scanId}`, {
        log: `
${"═".repeat(60)}
🔏 INITIATING CRYPTOGRAPHIC SIGNING
${"═".repeat(60)}

`,
        progress: 30
      });
      const outputSigPath = path.join(repoPath, "signature.sig");
      event.sender.send(`scan-log:${scanId}`, {
        log: `🔹 Target Repo : ${repoUrl}
🔹 Branch      : ${branch}
🔹 Signing Key : ${path.basename(privateKeyPath)}
🔹 Security    : ${password ? "Password Protected 🔒" : "No Password ⚠️"}
🔹 Output Path : ${outputSigPath}

`,
        progress: 35
      });
      const args = [
        "sign",
        "-c",
        repoPath,
        "-k",
        privateKeyPath,
        "-o",
        outputSigPath
      ];
      if (password) args.push("-p", password);
      const child = spawn(exePath, args);
      activeProcesses.set(scanId, child);
      let cancelled = false;
      child.stdout.on("data", (chunk) => {
        if (cancelled) return;
        const text = chunk.toString();
        event.sender.send(`scan-log:${scanId}`, { log: text, progress: 60 });
      });
      child.stderr.on("data", (chunk) => {
        if (cancelled) return;
        const text = chunk.toString();
        event.sender.send(`scan-log:${scanId}`, { log: `[STDERR] ${text}`, progress: 60 });
      });
      child.on("close", (code) => {
        activeProcesses.delete(scanId);
        if (cancelled) return;
        const success = code === 0;
        let sigSize = "0 B";
        if (success && fsSync.existsSync(outputSigPath)) {
          sigSize = `${fsSync.statSync(outputSigPath).size} bytes`;
        }
        const summary = `
╔══════════════════════════════════════════════════════════════════════╗
                    DIGITAL SIGNATURE REPORT                            
╚══════════════════════════════════════════════════════════════════════╝

 Status             : ${success ? "✅ SIGNED & VERIFIED" : "❌ SIGNING FAILED"}
 Repository    : ${repoUrl}
 Branch           : ${branch}
 Timestamp   : ${(/* @__PURE__ */ new Date()).toLocaleTimeString()}

 🔏 Signature Details:
 ───────────────────────────────────────────────
 📄 File              : ${outputSigPath}
 💾 Size             : ${sigSize}
 🔑 Key Used   : ${privateKeyPath}


 ${"═".repeat(70)}
`;
        event.sender.send(`scan-log:${scanId}`, { log: summary, progress: 100 });
        event.sender.send(`scan-complete:${scanId}`, { success });
        resolve({ success });
      });
      ipcMain.once(`scan:cancel-${scanId}`, () => {
        cancelled = true;
        if (child.pid) try {
          process.kill(child.pid);
        } catch (e) {
        }
        activeProcesses.delete(scanId);
        event.sender.send(`scan-log:${scanId}`, { log: "\n⚠️ PROCESS CANCELLED BY USER\n", progress: 0 });
        resolve({ success: false, cancelled: true });
      });
    });
  });
  ipcMain.handle("dialog:select-folder", async (event) => {
    const win2 = BrowserWindow.fromWebContents(event.sender);
    if (!win2) return null;
    const { filePaths, canceled } = await dialog.showOpenDialog(win2, {
      properties: ["openDirectory", "createDirectory", "promptToCreate"],
      title: "Select Output Directory",
      buttonLabel: "Select Folder"
    });
    return canceled || filePaths.length === 0 ? null : filePaths[0];
  });
  ipcMain.handle("dialog:select-file", async (event) => {
    const win2 = BrowserWindow.fromWebContents(event.sender);
    if (!win2) return null;
    const { filePaths, canceled } = await dialog.showOpenDialog(win2, {
      properties: ["openFile"],
      filters: [{ name: "Keys", extensions: ["pem", "key", "sig"] }],
      title: "Select Private Key",
      buttonLabel: "Select Key"
    });
    return canceled || filePaths.length === 0 ? null : filePaths[0];
  });
  ipcMain.handle("scan:cancel", async (_, { scanId }) => {
    debugLog(`Cancel requested: ${scanId}`);
    return new Promise((resolve) => {
      let cleaned = false;
      const child = activeProcesses.get(scanId);
      if (child) {
        debugLog(`Killing main process: ${scanId}`);
        killProcess(child, scanId);
        activeProcesses.delete(scanId);
        cleaned = true;
      }
      const cloneId = `${scanId}-clone`;
      const cloneChild = activeProcesses.get(cloneId);
      if (cloneChild) {
        debugLog(`Killing clone process: ${cloneId}`);
        killProcess(cloneChild, cloneId);
        activeProcesses.delete(cloneId);
        cleaned = true;
      }
      ipcMain.emit(`scan:cancel-${scanId}`);
      if (cleaned) {
        setTimeout(() => {
          debugLog(`Cancel complete: ${scanId}`);
          resolve({ cancelled: true });
        }, 500);
      } else {
        debugLog(`No active process found for: ${scanId}`);
        resolve({ cancelled: false });
      }
    });
  });
  ipcMain.handle("window:minimize", () => win?.minimize());
  ipcMain.handle(
    "window:maximize",
    () => win?.isMaximized() ? win.unmaximize() : win?.maximize()
  );
  ipcMain.handle("window:close", () => win?.close());
}
function cancelAllScans() {
  debugLog(`Cancelling all scans (${activeProcesses.size} processes)`);
  activeProcesses.forEach((child, id) => {
    killProcess(child, id);
  });
  activeProcesses.clear();
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
  registerIPC();
  if (VITE_DEV_SERVER_URL) win.loadURL(VITE_DEV_SERVER_URL);
  else win.loadFile(path.join(RENDERER_DIST, "index.html"));
  win.once("ready-to-show", () => {
    splash?.close();
    splash = null;
    win?.show();
    if (VITE_DEV_SERVER_URL) {
      win?.webContents.openDevTools({ mode: "detach" });
    }
  });
  win.webContents.on("before-input-event", (_, input) => {
    if (input.type === "keyDown") {
      if (input.key === "F12" || input.control && input.shift && input.key === "I") {
        if (win?.webContents.isDevToolsOpened()) {
          win?.webContents.closeDevTools();
        } else {
          win?.webContents.openDevTools({ mode: "detach" });
        }
      }
    }
  });
}
app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  cancelAllScans();
  app.quit();
  win = null;
});
app.on("before-quit", () => {
  debugLog("App shutting down");
  cancelAllScans();
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
