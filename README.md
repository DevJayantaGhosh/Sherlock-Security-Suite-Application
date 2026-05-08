<h1 align="center">🛡️ Sherlock Security Suite 🛡️</h1>

<p>
  <strong> Enterprise-Grade Secure Software Delivery: A Cryptographic Framework for Code-Signing, Artifact Integrity, and Provenance Assurance in Software Supply Chain </strong>
</p>

---


> **Author:** Jayanta Ghosh  

---

## Abstract

Modern software supply chains are increasingly susceptible to dependency poisoning, credential leakage, and 
artifact tampering. Q-Sherlock Security Suite mitigates these risks through an end-to-end secure delivery framework 
that integrates AI-assisted vulnerability analysis, cryptographic code signing, and blockchain-backed provenance 
auditing. The framework provides a hardened security combining decentralized trust, cryptographic verification, and 
enterprise-grade controls to ensure verifiable and tamper-resistant software distribution. 

## Problem Definition and Motivation 
Despite the availability of vulnerability scanners, code-signing utilities, and package managers, these tools typically 
operate in isolation and fail to produce a unified, cryptographically verifiable, blockchain-anchored chain of trust 
from code audit to final signed release. Most existing solutions centralize trust under a single organization, creating 
a monopoly over verification and distribution. This lack of transparency fundamentally conflicts with the needs of 
open-source software, which depends on openness, independent verification, and public auditable trust. 

- No single platform links evidence across stages—scanned → released → signed—into one verifiable 
provenance record. 
- There is no end-to-end, tamper-evident chain of evidence that survives compromise of the producer’s 
infrastructure. 
- Integrity and authenticity cannot be validated independently. 
- Lack of decentralization: centralized trust creates single points of failure and concentrates control over 
verification and distribution within one administrative domain. 
- Publicly auditable provenance from source audit to signed release is typically unavailable, limiting 
transparency for open-source consumers. 

**Sherlock Security Suite** combines cryptographic trust, blockchain-backed auditing, and AI-driven analytics to enforce end-to-end supply chain integrity through a blockchain-anchored provenance distribution pipeline (SCAN → RELEASE → SIGN):

**(1) Vulnerability Scanning & Proactive Defense** — automated vulnerability scanning with CVE correlation, Software Bill of Materials (SBOM) generation in CycloneDX format, secret leak detection via Gitleaks across repository history, and GPG commit signature verification for developer identity validation.

**(2) Cryptographic Trust & Software Integrity** — RSA/ECDSA key pair generation and deterministic digital code-signing of artifacts. Signed artifacts are archived on the InterPlanetary File System (IPFS), producing immutable Content Identifiers (CIDs) guaranteeing bitwise integrity.

**(3) Blockchain-Backed Secure Distribution** — each lifecycle step is permanently inscribed on the Hedera Hashgraph distributed ledger through a custom Solidity smart contract (ProductRegistry), binding scan decisions, release metadata, and IPFS CIDs into a tamper-evident provenance record.

**(4) AI-Driven Security Intelligence** — Large Language Model integration for automated vulnerability triage and remediation guidance.

The architecture enables any stakeholder to cryptographically audit the complete journey of a software artifact — anchored on public blockchain and decentralized storage.

---

## High-Level Architecture & Service Interactions

```
                                         ┌──────────┐
                                         │   USER   │
                                         └────┬─────┘
                                              │
                          ┌───────────────────┼────────────────────┐
                          │ 1. Login /        │ 2. Authenticated   │
                          │    Register       │    Requests (JWT)  │
                          ▼                   ▼                    │
 ┌═══════════════════════════════════════════════════════════════════════════════════════┐
 ║                                                                                       ║
 ║                         Q-SHERLOCK SECURITY SUITE                                     ║
 ║                       (Electron Desktop / Web Browser)                                ║
 ║                                                                                       ║
 ║  ┌────────────────────────────────────────────────────────────────────────────────┐   ║
 ║  │                         React Frontend (SPA)                                   │   ║
 ║  │          Pages · Components · Services · Store (Zustand)                       │   ║
 ║  │                      Platform Bridge (auto-detect)                             │   ║
 ║  └────────────────────────────────────────────────────────────────────────────────┘   ║
 ║                                                                                       ║
 ║  ┌────────────────────────────────────────────────────────────────────────────────┐   ║
 ║  │                      Security Tools (Bundled CLIs)                             │   ║
 ║  │                                                                                │   ║
 ║  │   ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐              │   ║
 ║  │   │  SECURITY SCAN  │   │    SIGNING      │   │  VERIFICATION   │              │   ║
 ║  │   │                 │   │                 │   │                 │              │   ║
 ║  │   │ • GPG Commit    │   │ • KeyGen        │   │ • Software      │              │   ║
 ║  │   │   Verifier      │   │   (RSA / ECDSA) │   │   Verifier      │              │   ║
 ║  │   │ • GitLeaks      │   │ • Software      │   │                 │              │   ║
 ║  │   │   (Secret Scan) │   │   Signer        │   │                 │              │   ║
 ║  │   │ • Vuln Scanner  │   │                 │   │                 │              │   ║
 ║  │   │   (CVE + SBOM)  │   │                 │   │                 │              │   ║
 ║  │   └─────────────────┘   └─────────────────┘   └─────────────────┘              │   ║
 ║  └────────────────────────────────────────────────────────────────────────────────┘   ║
 ║                                                                                       ║
 ╚════╤═══════════════╤══════════════════╤═══════════════════╤══════════════╤════════════╝
      │               │                  │                   │              │
      │ Auth API      │ Product API      │ Upload            │ Inscribe     │ AI Query
      │ (REST)        │ (REST + JWT)     │ Artifacts         │ Provenance   │ (Streaming)
      │               │                  │                   │              │
      ▼               ▼                  ▼                   ▼              ▼
┌────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   User     │  │   Product    │  │              │  │  Blockchain  │  │   LiteLLM    │
│Management  │  │  Management  │  │     IPFS     │  │   (Hedera    │  │   Proxy      │
│Microservice│  │ Microservice │  │  (Storacha)  │  │  Hashgraph)  │  │              │
│            │  │              │  │              │  │              │  │              │
└─────┬──────┘  └──────┬───────┘  └──────┬───────┘  └───────┬──────┘  └──────┬───────┘
      │                │                 │              ▲   │                │
      ▼                ▼                 │    CID       │   │                ▼
┌───────────┐  ┌──────────────┐          └──────────────┘   │         ┌──────────────┐
│PostgreSQL │  │   MongoDB    │          (CID stored        │         │  LLM Models  │
│           │  │              │           on-chain)         │         │              │
│ • Users   │  │ • Products   │                             │         │ • GPT-4o     │
│ • Roles   │  │ • Repos      │    Smart Contract           │         │ • Gemini     │
│ • Licenses│  │ • Scan Data  │    (ProductRegistry.sol)    │         │ • Ollama     │
│           │  │ • Artifacts  │    • recordStep()           │         │ • Mistral    │
└───────────┘  └──────────────┘    • getSnapshots()         │         └──────────────┘
                                                            │
                                                   ┌────────┴────────┐
                                                   │   HashScan.io   │
                                                   │  (Tx Explorer)  │
                                                   └─────────────────┘
```

---

## Interaction Flow Summary

| # | Flow | Path |
|---|------|------|
| 1 | **Authentication** | User → Sherlock Suite → User Management Service → PostgreSQL |
| 2 | **Product Management** | User (JWT) → Sherlock Suite → Product Management Service → MongoDB |
| 3 | **Security Scanning** | User → Sherlock Suite → Bundled CLI Tools (GitLeaks, Vuln Scanner, GPG Verifier) |
| 4 | **Cryptographic Signing** | User → Sherlock Suite → KeyGen + SoftwareSigner tools |
| 5 | **Signature Verification** | User → Sherlock Suite → SoftwareVerifier tool |
| 6 | **IPFS Archival** | User → Sherlock Suite → IPFS (Storacha) → CID stored on Hedera Blockchain |
| 7 | **Blockchain Inscription** | User → Sherlock Suite → Hedera Hashgraph (Smart Contract) |
| 8 | **AI Security Analysis** | User → Sherlock Suite → LiteLLM Proxy → LLM Models (GPT-4o, Gemini, Ollama) |

---

## 3-Step Provenance Pipeline

```
  ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
  │   STEP 1: SCAN  │──────►│ STEP 2: RELEASE │──────►│  STEP 3: SIGN   │
  │                 │       │                 │       │                 │
  │ • GPG Verify    │       │ • GitHub Release│       │ • Key Generate  │
  │ • Secret Scan   │       │ • Tag & Publish │       │ • Digital Sign  │
  │ • Vuln Scan     │       │                 │       │ • IPFS Upload   │
  │ • SBOM Generate │       │                 │       │                 │
  │                 │       │                 │       │                 │
  │  ┌───────────┐  │       │  ┌───────────┐  │       │  ┌───────────┐  │
  │  │ Inscribe  │  │       │  │ Inscribe  │  │       │  │ Inscribe  │  │
  │  │ on Hedera │  │       │  │ on Hedera │  │       │  │ on Hedera │  │
  │  └───────────┘  │       │  └───────────┘  │       │  └───────────┘  │
  └─────────────────┘       └─────────────────┘       └─────────────────┘
         │                         │                         │
         ▼                         ▼                         ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │              Hedera Hashgraph — Immutable Provenance            │
  │                                                                 │
  │   ProductRegistry Smart Contract (Solidity)                     │
  │   • recordStep(productId, step, snapshot)                       │
  │   • getProductSnapshots(productId) → 3 on-chain records         │
  └─────────────────────────────────────────────────────────────────┘
```

Each step's decision (Approved / Rejected) is permanently inscribed on-chain with full product metadata, scan results, and IPFS artifact CIDs.

---

## Sherlock Security Suite_ is a security platform for software supply chain integrity. It runs as:

- **Desktop Mode** — Electron app with local IPC for native OS access  
- **Web Mode** — Browser SPA backed by a Node.js host-server via REST & SSE  

Both modes share the **same React frontend**. A platform abstraction layer auto-detects the environment and routes all operations through the correct backend.

---

## High-Level Application Workflow

```
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    SHERLOCK SECURITY SUITE                                 │
├────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                              React Frontend (SPA)                                    │  │
│  │                                                                                      │  │
│  │  ┌───────────┐  ┌────────────┐  ┌──────────┐  ┌──────────┐                           │  │
│  │  │   Pages   │  │ Components │  │ Services │  │  Store   │                           │  │
│  │  │           │  │            │  │  (API)   │  │ (Zustand)│                           │  │
│  │  └─────┬─────┘  └──────┬─────┘  └────┬─────┘  └──────────┘                           │  │
│  │        │               │             │                                               │  │
│  │        └───────────────┴─────────────┘                                               │  │
│  │                        │                                                             │  │
│  │               ┌────────▼─────────┐                                                   │  │
│  │               │ Platform Bridge  │                                                   │  │
│  │               │  (auto-detect)   │                                                   │  │
│  │               └───────┬──┬───────┘                                                   │  │
│  │                       │  │                                                           │  │
│  └───────────────────────┼──┼───────────────────────────────────────────────────────────┘  │
│                          │  │                                                              │
│           ┌──────────────┘  └──────────────┐                                               │
│           ▼                                ▼                                               │
│  ┌─────────────────────┐      ┌──────────────────────────┐                                 │
│  │    DESKTOP MODE     │      │         WEB MODE         │                                 │
│  │                     │      │                          │                                 │
│  │  ┌───────────────┐  │      │  ┌────────────────────┐  │                                 │
│  │  │   Electron    │  │      │  │    Host-Server     │  │                                 │
│  │  │   Main Proc   │  │      │  │    (Express.js)    │  │                                 │
│  │  │     (IPC)     │  │      │  │    REST & SSE      │  │                                 │
│  │  └───────┬───────┘  │      │  └──────────┬─────────┘  │                                 │
│  │          │          │      │             │            │                                 │
│  └──────────┼──────────┘      └─────────────┼────────────┘                                 │
│             │                               │                                              │
│             └───────────────┬───────────────┘                                              │
│                             ▼                                                              │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                              Security Tools (CLI)                                     │ │
│  │                                                                                       │ │
│  │  ┌────────────────────────────┐  ┌────────────────────────┐                           │ │
│  │  │ GPG Signed Commit Verifier │  │        GitLeaks        │                           │ │
│  │  └────────────────────────────┘  └────────────────────────┘                           │ │
│  │  ┌────────────────────────────┐  ┌────────────────────────┐                           │ │
│  │  │   VulnerabilityScanner     │  │         KeyGen         │                           │ │
│  │  └────────────────────────────┘  └────────────────────────┘                           │ │
│  │  ┌────────────────────────────┐  ┌────────────────────────┐                           │ │
│  │  │     SoftwareSigner         │  │    SoftwareVerifier    │                           │ │
│  │  └────────────────────────────┘  └────────────────────────┘                           │ │
│  │                                                                                       │ │
│  └───────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                            │
├────────────────────────────────────────────────────────────────────────────────────────────┤
│                                     External Services                                      │
│                                                                                            │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────┐ ┌────────────────────────────┐ │
│  │ User Management  │ │    Product       │ │  Blockchain  │ │ AI Driven Security         │ │
│  │   Microservice   │ │   Management     │ │   (Hedera)   │ │ Scanning & Analysis (LLM)  │ │
│  └──────────────────┘ └──────────────────┘ └──────────────┘ └────────────────────────────┘ │
│                                                                                            │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Features

| Feature | Description |
|---|---|
| **GPG Commit Verification** | Verify signed commits across a repository's history |
| **Secret Leak Detection** | Scan repos for exposed credentials using Gitleaks |
| **Software Bill of Materials (SBOM) - Generation** | SBOM generation|
| **Vulnerability Scanning** | Vulnerability & CVE detection |
| **Key Generation** | RSA/ECDSA key pair generation for signing |
| **Digital Signing** | Cryptographically sign software artifacts |
| **Signature Verification** | Verify artifact signatures with public keys |
| **GitHub Release** | Create releases with signed artifacts via Octokit |
| **IPFS Archival** | Upload signed artifacts to IPFS via Storacha (web3.storage) |
| **Blockchain Archival** | Record artifact hashes on Hedera for tamper-proofing |
| **Admin Dashboard** | User management, product approvals, analytics |
| **AI Driven Security Scanning & Analysis** | LLM-powered chat for security analysis — supports OpenAI, Gemini, Ollama, Azure, LiteLLM |

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
     │◄─ ─ ─ ─ ─ ─ ─ ─ ─  ─│                     │
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

## AI Driven Security Scanning & Analysis

The suite includes an embedded AI chat assistant specialized in software supply-chain security. It uses a streaming API so it works with multiple LLM providers.

### Architecture

```
┌──────────────────────┐       ┌──────────────────────┐       ┌──────────────────────┐
│   Sherlock Suite App │       │    LLM Provider      │       │      LLM Model       │
│                      │       │                      │       │                      │
│  User sends security │       │  e.g. LiteLLM Proxy  │       │  e.g. GPT-4o,        │
│  question via chat   │──────►│  OpenAI, Gemini,     │──────►│  Gemini 2.0 Flash,   │
│  panel (streaming)   │       │  Ollama, Azure       │       │  Llama 3, Mistral    │
│                      │◄──────│                      │◄──────│                      │
│  Renders markdown    │  SSE  │  OpenAI-compatible   │  LLM  │  Generates security  │
│  response in UI      │ stream│  /chat/completions   │ output│  analysis response   │
└──────────────────────┘       └──────────────────────┘       └──────────────────────┘
```

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
| **KeyGenerator** | RSA/ECDSA key pair generation | Win, macOS, Linux |
| **SoftwareSigner** | Artifact digital signing | Win, macOS, Linux |
| **SoftwareVerifier** | Signature verification | Win, macOS, Linux |

---
