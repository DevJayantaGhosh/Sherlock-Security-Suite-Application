

<h1 align="center">🛡️ Sherlock Security Suite 🛡️</h1>

<p align="center">
  <strong>Enterprise-grade security platform that safeguards software supply chain integrity using cryptography and blockchain technology.
</strong>
</p>

---


> **Author:** Jayanta Ghosh (CS23M513, IIT Madras)  


---

## Overview

Sherlock Security Suite is a security platform for software supply chain integrity. It runs as:

- **Desktop Mode** — Electron app with local IPC for native OS access  
- **Web Mode** — Browser SPA backed by a Node.js host-server via REST & SSE  

Both modes share the **same React frontend**. A platform abstraction layer auto-detects the environment and routes all operations through the correct backend.

---

## High-Level Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                      SHERLOCK SECURITY SUITE                       │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                     React Frontend (SPA)                     │  │
│  │                                                              │  │
│  │  ┌───────────┐  ┌────────────┐  ┌──────────┐  ┌──────────┐   │  │
│  │  │   Pages   │  │ Components │  │ Services │  │  Store   │   │  │
│  │  │           │  │            │  │  (API)   │  │ (Zustand)│   │  │
│  │  └─────┬─────┘  └──────┬─────┘  └────┬─────┘  └──────────┘   │  │
│  │        │               │             │                       │  │
│  │        └───────────────┴─────────────┘                       │  │
│  │                        │                                     │  │
│  │               ┌────────▼─────────┐                           │  │
│  │               │ Platform Bridge  │                           │  │
│  │               │  (auto-detect)   │                           │  │
│  │               └───────┬──┬───────┘                           │  │
│  │                       │  │                                   │  │
│  └───────────────────────┼──┼───────────────────────────────────┘  │
│                          │  │                                      │
│           ┌──────────────┘  └──────────────┐                       │
│           ▼                                ▼                       │
│  ┌─────────────────────┐      ┌──────────────────────────┐         │
│  │    DESKTOP MODE     │      │         WEB MODE         │         │
│  │                     │      │                          │         │
│  │  ┌───────────────┐  │      │  ┌────────────────────┐  │         │
│  │  │   Electron    │  │      │  │    Host-Server     │  │         │
│  │  │   Main Proc   │  │      │  │    (Express.js)    │  │         │
│  │  │     (IPC)     │  │      │  │    REST & SSE      │  │         │
│  │  └───────┬───────┘  │      │  └──────────┬─────────┘  │         │
│  │          │          │      │             │            │         │
│  └──────────┼──────────┘      └─────────────┼────────────┘         │
│             │                               │                      │
│             └───────────────┬───────────────┘                      │
│                             ▼                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Security Tools (CLI)                      │  │
│  │                                                              │  │
│  │  ┌────────────────────────────┐  ┌────────────────────────┐  │  │
│  │  │ GPG Signed Commit Verifier │  │        GitLeaks        │  │  │
│  │  └────────────────────────────┘  └────────────────────────┘  │  │
│  │  ┌────────────────────────────┐  ┌────────────────────────┐  │  │
│  │  │   VulnerabilityScanner     │  │         KeyGen         │  │  │
│  │  └────────────────────────────┘  └────────────────────────┘  │  │
│  │  ┌────────────────────────────┐  ┌────────────────────────┐  │  │
│  │  │     SoftwareSigner         │  │    SoftwareVerifier    │  │  │
│  │  └────────────────────────────┘  └────────────────────────┘  │  │
│  │                                                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│                       External Services                            │
│                                                                    │
│  ┌──────────────────┐  ┌────────────────────┐  ┌───────────────┐   │
│  │ User Management  │  │ Product Management │  │  Blockchain   │   │
│  │   Microservice   │  │   Microservice     │  │   (Hedera)    │   │
│  └──────────────────┘  └────────────────────┘  └───────────────┘   │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## Core Features

| Feature | Description |
|---|---|
| **GPG Commit Verification** | Verify signed commits across a repository's history |
| **Secret Leak Detection** | Scan repos for exposed credentials using Gitleaks |
| **Vulnerability Scanning** | SBOM generation & CVE detection |
| **Key Generation** | RSA/ECDSA key pair generation for signing |
| **Digital Signing** | Cryptographically sign software artifacts |
| **Signature Verification** | Verify artifact signatures with public keys |
| **GitHub Release** | Create releases with signed artifacts via Octokit |
| **IPFS Archival** | Upload signed artifacts to IPFS via Storacha (web3.storage) |
| **Blockchain Archival** | Record artifact hashes on Hedera for tamper-proofing |
| **Admin Dashboard** | User management, product approvals, analytics |

---

## Platform Abstraction

The `PlatformBridge` interface defines a unified contract for all operations.
UI components call `platform.*` — they never know which mode is active.

```
                    ┌─────────────────────────────┐
                    │          UI Components      │
                    │                             │
                    └──────────────┬──────────────┘
                                   │
                        platform.* calls
                                   │
                    ┌──────────────▼───────────────┐
                    │      PlatformBridge          │
                    │     (Unified Interface)      │
                    │                              │
                    │ Scans │ Crypto │ Files │ SSE │
                    └──────┬───────────────┬───────┘
                           │               │
                    is-electron?      is-browser?
                           │               │
              ┌────────────▼──┐   ┌────────▼────────────┐
              │ electronBridge│   │ hostServerBridge    │
              │               │   │                     │
              │  IPC via      │   │  REST  → HTTP POST  │
              │  preload.ts   │   │  SSE   → EventSource│
              │  (sync, local)│   │  (async, networked) │
              └───────────────┘   └─────────────────────┘
```

---

## Request Flow — Desktop Mode (Electron)

```
┌──────────┐         ┌───────────┐         ┌───────────┐
│  React   │         │ Electron  │         │ Security  │
│  UI      │         │ Main Proc │         │ Tools     │
│(Renderer)│         │  (Node)   │         │ (CLI)     │
└────┬─────┘         └─────┬─────┘         └─────┬─────┘
     │                     │                     │
     │  1. User clicks     │                     │
     │     "Run Scan"      │                     │
     │                     │                     │
     │  2. onScanLog()     │                     │
     │────────────────────►│ ipcRenderer.on()    │
     │     (sync attach)   │ (listener ready     │
     │                     │  immediately)       │
     │                     │                     │
     │  3. verifyGPG()     │                     │
     │────────────────────►│ ipcMain.handle()    │
     │     (IPC invoke)    │                     │
     │                     │  4. Clone repo      │
     │                     │────────────────────►│
     │                     │     git clone       │
     │                     │                     │
     │                     │  5. Run tool        │
     │                     │────────────────────►│
     │                     │  gitleaks/vuln-scan │
     │                     │                     │
     │  6. Log events      │                     │
     │◄────────────────────│ webContents.send()  │
     │     (real-time)     │                     │
     │                     │                     │
     │  7. Complete event  │                     │
     │◄────────────────────│                     │
     │                     │                     │
     ▼                     ▼                     ▼
```

**Key:** IPC listeners attach synchronously — no logs are ever lost.

---

## Request Flow — Web Mode (Host Server)

```
┌──────────┐         ┌───────────┐         ┌───────────┐
│  React   │         │  Host     │         │ Security  │
│  UI      │         │  Server   │         │ Tools     │
│(Browser) │         │ (Express) │         │ (CLI)     │
└────┬─────┘         └─────┬─────┘         └─────┬─────┘
     │                     │                     │
     │  1. User clicks     │                     │
     │     "Run Scan"      │                     │
     │                     │                     │
     │  2. EventSource     │                     │
     │────────────────────►│ GET /stream/:id/log │
     │   (SSE connect,     │ (connection opens)  │
     │    async)           │                     │
     │                     │                     │
     │  3. POST /scan      │                     │
     │────────────────────►│                     │
     │   (trigger scan)    │                     │
     │                     │  4. Clone repo      │
     │                     │────────────────────►│
     │                     │     git clone       │
     │                     │                     │
     │                     │  5. emitLog() →     │
     │                     │    buffer & emit    │
     │                     │                     │
     │  6. SSE connected   │                     │
     │◄─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │                     │
     │   Replay buffered   │                     │
     │   logs (early ones) │                     │
     │                     │                     │
     │  7. Live SSE logs   │  8. Run tool        │
     │◄────────────────────│────────────────────►│
     │   (real-time)       │  gitleaks/vuln-scan │
     │                     │                     │
     │  9. SSE complete    │                     │
     │◄────────────────────│                     │
     │                     │                     │
     ▼                     ▼                     ▼
```

**Key:** Early logs (steps 4-5) are buffered by `sseManager` and replayed when SSE connects (step 6), ensuring no log loss — matching Electron's behavior.

---

## IPFS & Blockchain — End-to-End File Archival

Signing artifacts (signature file & public key) are stored across **three systems** for immutability and verifiability.

### Technology Stack

| Technology | Role | 
|---|---|
| **IPFS** | Content-addressed file storage protocol |
| **Hedera Hashgraph** | Blockchain for immutable provenance records | 


### End-to-End Workflow

```
┌─────────────────────┐     ┌──────────────────┐     ┌──────────────┐     ┌──────────────┐
│  IPFSUploadCard     │     │     IPFS Node    │     │Application-DB│     │    Hedera    │
│  (user picks file)  │     │                  │     │  (Product)   │     │ (Blockchain) │
└─────────┬───────────┘     └────────┬─────────┘     └──────┬───────┘     └──────┬───────┘
          │                          │                      │                    │
          │ 1. uploadFileToIPFS()    │                      │                    │
          │─────────────────────────►│                      │                    │
          │                          │                      │                    │
          │                          │                      │                    │
          │   CID (ipfs://bafy...)   │                      │                    │
          │◄─────────────────────────│                      │                    │
          │                          │                      │                    │
          │ 2. updateProduct()       │                      │                    │
          │  signatureFilePath=CID   │                      │                    │
          │  publicKeyFilePath=CID   │                      │                    │
          │────────────────────────────────────────────────►│                    │
          │                          │                      │                    │
┌─────────┴───────────────────┐      │                      │                    │
│ BlockchainInscriptionCard   │      │                      │                    │
│ (SIGN stage)                │      │                      │                    │
└─────────┬───────────────────┘      │                      │                    │
          │                          │                      │                    │
          │ 3. buildProductSnapshot()│                      │                    │
          │  signatureFileIPFS = product.signatureFilePath  │                    │
          │  publicKeyFileIPFS = product.publicKeyFilePath  │                    │
          │                          │                      │                    │
          │ 4. inscribeOnLedger(snapshot)                   │                    │
          │  (SIGN stage validates both CIDs present)       │                    │
          │─────────────────────────────────────────────────────────────────────►│
          │                          │                      │                    │  
          │                          │                      │                    │
          │ 5. updateProduct()       │                      │                    │
          │  signingReportPath =     │                      │                    │
          │    hashscan.io URL       │                      │                    │
          │────────────────────────────────────────────────►│                    │
          │                          │                      │                    │
┌─────────┴───────────────────┐      │                      │                    │
│ ProvenanceChainCard         │      │                      │                    │
│ (read & verify)             │      │                      │                    │
└─────────┬───────────────────┘      │                      │                    │
          │                          │                      │                    │
          │ 6. getProductSnapshots() │                      │                    │
          │◄────────────────────────────────────────────────────────────────────►│
          │   Reads CID from chain   │                      │                    │
          │   (MongoDB as fallback)  │                      │                    │
          │                          │                      │                    │
          │ 7. fetchBytesFromIPFS()  │                      │                    │
          │─────────────────────────►│                      │                    │
          │   Download from IPFS     │                      │                    │
          │◄─────────────────────────│                      │                    │
          │   (user gets the file)   │                      │                    │
          ▼                          ▼                      ▼                    ▼
```

### Retrieval

`ProvenanceChain UI Component` reads CIDs from the blockchain snapshot or ApplicationDB fallback:
```
signSnap?.signatureFileIPFS || product.signatureFilePath
```
Users can download artifacts directly from IPFS storage

---

## Backend Microservices

The frontend communicates with external microservices for persistent data:

| Service | 
|---|
| **User Management Service** |
| **Product Management Service** | 
| **Software Security Provenance Chain (Blockchain Hedera)** | 

---

## Security Tools (Bundled)

Platform-specific binaries are bundled under `tools/`:

| Tool | Purpose | Platforms |
|---|---|---|
| **GPG Signed Commit Verifier** | Verify GPG-signed commits | Win, macOS, Linux |
| **GitLeaks** | Secret/credential leak detection | Win, macOS, Linux |
| **VulnerabilityScanner** | Vulnerability scanner & SBOM | Win, macOS, Linux |
| **KeyGen** | RSA/ECDSA key pair generation | Win, macOS, Linux |
| **SoftwareSigner** | Artifact digital signing | Win, macOS, Linux |
| **SoftwareVerifier** | Signature verification | Win, macOS, Linux |

---

