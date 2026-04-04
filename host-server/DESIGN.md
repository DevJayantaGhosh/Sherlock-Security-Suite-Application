# Host-Server — Design Document

## Purpose

The **host-server** is a standalone Express.js process that provides the same
security-tool functionality as the Electron main process, but over HTTP. This
enables the React front-end to run as a normal web application (no Electron
required) while retaining access to CLI tools like **gitleaks**, **trivy**,
**KeyGenerator**, **SoftwareSigner**, and **SoftwareVerifier**.

```
┌──────────────────┐  HTTP/SSE   ┌──────────────────┐  spawn    ┌──────────────────┐
│                  │ ──────────► │                  │ ────────► │                  │
│    React SPA     │             │    host-server   │           │    CLI tools     │
│    (browser)     │ ◄────────── │    (Express)     │ ◄──────── │    gitleaks,     │
│                  │  SSE stream │                  │  stdout   │    trivy …       │
│                  │             │                  │           │                  │
└──────────────────┘             └──────────────────┘           └──────────────────┘
```

## Architecture Overview

### Layers

| Layer | Files | Responsibility |
|-------|-------|----------------|
| **Entry** | `src/index.ts` | Express setup, CORS, JSON parsing, route mounting, tool resolution logging |
| **Routes** | `src/routes/*.ts` | HTTP endpoint handlers — validate input, start async operations, return `scanId` |
| **Services** | `src/services/*.ts` | Business logic — tool resolution, process spawning, SSE emission, git cloning |

### Request Lifecycle

1. **Client opens SSE streams** — `GET /api/scan/stream/:scanId/log` and `/complete`
2. **Client POSTs an operation** — e.g. `POST /api/scan/secrets`
3. **Route handler** validates input, generates/accepts a `scanId`, responds immediately with `{ scanId, started: true }`
4. **Async function** (fire-and-forget) clones the repo if needed, spawns the CLI tool
5. **stdout/stderr** from the child process are forwarded as SSE `scan-log` events
6. **On exit**, a `scan-complete` SSE event carries the result payload (success, findings, etc.)

### SSE Protocol

| Event | Direction | Payload |
|-------|-----------|---------|
| `scan-log` | server → client | `{ log: string, progress: number }` |
| `scan-complete` | server → client | `{ success: boolean, ...result }` |
| heartbeat | server → client | SSE comment (`: heartbeat\n\n`) every 15 s |

## File Reference

### `src/index.ts`
Express application entry point. Mounts all routers under `/api/*` and logs
tool resolution status at startup.

### `src/services/toolPaths.ts`
Resolves absolute paths to bundled CLI tools (`tools/<platform>/...`).
Web-only — does **not** use Electron APIs. Exports `validateTool(name)` which
returns the resolved path or `null` if the binary is missing.

### `src/services/sseManager.ts`
Thin wrapper around a Node `EventEmitter`. Provides:
- `emitLog(scanId, text, progress)` — broadcast a log line
- `emitComplete(scanId, payload)` — broadcast completion
- `emitCancel(scanId)` — signal cancellation to listeners
- `sseEvents` — the raw emitter (for `.once("cancel:…")` hooks)

### `src/services/processManager.ts`
Registry of active `ChildProcess` instances keyed by `scanId`. Provides:
- `register / unregister / get / has` — CRUD on the registry
- `killProcess(child, id)` — platform-aware kill (Windows `taskkill` vs POSIX `SIGKILL`)
- `cancel(scanId)` — kill + unregister in one call

### `src/services/gitClone.ts`
Clones repositories into OS temp directories. Supports:
- Branch-based clone with in-memory caching
- Tag-based clone (`--no-checkout` + `git checkout <tag>`)
- Local directory passthrough for quick scans
- 30-minute timeout and cancellation via SSE events

### `src/routes/scanRoutes.ts`
| Endpoint | Tool | Description |
|----------|------|-------------|
| `POST /api/scan/verify-gpg` | `git log --show-signature` | GPG commit signature check |
| `POST /api/scan/secrets` | gitleaks | Secrets & credential detection |
| `POST /api/scan/sbom` | trivy | SBOM generation |
| `POST /api/scan/vulnerability` | trivy | Vulnerability scan |
| `POST /api/scan/cancel` | — | Cancel a running scan by `scanId` |

### `src/routes/cryptoRoutes.ts`
| Endpoint | Tool | Description |
|----------|------|-------------|
| `POST /api/crypto/generate-keys` | KeyGenerator | RSA/ECDSA key-pair generation (string I/O) |
| `POST /api/crypto/sign-artifact` | SoftwareSigner | Digital signing of a cloned repo |

### `src/routes/verifyRoutes.ts`
| Endpoint | Tool | Description |
|----------|------|-------------|
| `POST /api/verify/signature` | SoftwareVerifier | Verify a signature against repo content |

### `src/routes/releaseRoutes.ts`
| Endpoint | Tool | Description |
|----------|------|-------------|
| `POST /api/release/create` | `gh` CLI / `curl` | Create a GitHub release (tag + notes) |

### `src/routes/sseRoutes.ts`
| Endpoint | Description |
|----------|-------------|
| `GET /api/scan/stream/:scanId/log` | SSE stream for real-time log lines |
| `GET /api/scan/stream/:scanId/complete` | SSE stream for the completion payload |

## Tool Resolution

Tools are resolved at startup from `<project-root>/tools/<platform>/`:

| Platform | gitleaks | trivy | KeyGenerator | SoftwareSigner | SoftwareVerifier |
|----------|----------|-------|--------------|----------------|------------------|
| Windows  | `tools/win/gitleaks/gitleaks.exe` | `tools/win/trivy/trivy.exe` | `tools/win/KeyGenerator/KeyGenerator.exe` | `tools/win/SoftwareSigner/SoftwareSigner.exe` | `tools/win/SoftwareVerifier/SoftwareVerifier.exe` |
| macOS    | `tools/darwin/gitleaks/gitleaks` | `tools/darwin/trivy/trivy` | — | — | — |
| Linux    | `tools/linux/gitleaks/gitleaks` | `tools/linux/trivy/trivy` | — | — | — |

> **Note:** KeyGenerator, SoftwareSigner, and SoftwareVerifier are currently
> Windows-only. On other platforms those endpoints will return a "tool not found"
> error until cross-platform binaries are added.

## Cancellation Flow

```
Client                          host-server
  │                                 │
  ├── POST /api/scan/cancel ───────►│
  │   { scanId }                    │
  │                                 ├── emitCancel(scanId)
  │                                 │   └── sseEvents.emit("cancel:<scanId>")
  │                                 │       └── listener in route handler fires
  │                                 │           └── killProcess(child, scanId)
  │                                 │               └── taskkill / SIGKILL
  │◄── { cancelled: true } ────────┤
```

## Environment Variables

See `.env.example` for a copy-paste template.

| Variable | Required | Description |
|----------|----------|-------------|
| `HOST_SERVER_PORT` | No | Server port (default: `4821`) |
| `GITHUB_PAT` | For private repos & releases | GitHub Personal Access Token |
| `TOOLS_DIR` | No | Override the tools base directory |

## Building & Running

### Development (inside monorepo)

```bash
cd host-server
npm install
npm run dev        # tsx watch src/index.ts
```

Tools are resolved from `../tools/<platform>/` (the project root).

### Production / Standalone Packaging

```bash
cd host-server
npm install
npm run package    # tsc + copy tools into host-server/tools/
npm start          # node dist/index.js
```

`npm run package` performs two steps:
1. **`npm run build`** — compiles TypeScript → `dist/`
2. **`npm run copy-tools`** — runs `scripts/copy-tools.mjs` which copies
   the current platform's tools from `../tools/<platform>/` into
   `host-server/tools/<platform>/`

To copy tools for **all** platforms (e.g. for a multi-platform archive):
```bash
node scripts/copy-tools.mjs --all
```

The resulting standalone directory structure:

```
host-server/
├── dist/               # compiled JS
├── tools/              # bundled CLI binaries
│   └── win/            # (or darwin/, linux/)
│       ├── gitleaks/
│       ├── trivy/
│       ├── KeyGenerator/
│       ├── SoftwareSigner/
│       └── SoftwareVerifier/
├── node_modules/
├── .env
├── package.json
└── ...
```


