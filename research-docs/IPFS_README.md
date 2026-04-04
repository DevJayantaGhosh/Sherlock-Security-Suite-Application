# IPFS Protocol — Complete Mathematical Deep Dive

> A research-grade explanation of the IPFS protocol: content addressing, Merkle DAGs,  
> Kademlia DHT, Bitswap parallel transfer, and the mathematics that make it all work.  

---

## Table of Contents

1. [What is IPFS?](#1-what-is-ipfs)
2. [Content Addressing — The Mathematics of SHA-256](#2-content-addressing--the-mathematics-of-sha-256)
3. [CID — Content Identifier Structure](#3-cid--content-identifier-structure)
4. [Merkle DAG — File Chunking and Tree Hashing](#4-merkle-dag--file-chunking-and-tree-hashing)
5. [Merkle Proofs — Verify Any Chunk Mathematically](#5-merkle-proofs--verify-any-chunk-mathematically)
6. [Kademlia DHT — Finding Nodes with XOR Distance](#6-kademlia-dht--finding-nodes-with-xor-distance)
7. [Bitswap — Parallel Data Transfer from Multiple Nodes](#7-bitswap--parallel-data-transfer-from-multiple-nodes)
8. [The Mathematics of Multi-Node Parallel Download](#8-the-mathematics-of-multi-node-parallel-download)
9. [Deduplication — How Shared Chunks Save Space](#9-deduplication--how-shared-chunks-save-space)
10. [libp2p — The Networking Layer That Connects Everything](#10-libp2p--the-networking-layer-that-connects-everything)
11. [The Complete Journey — How a File is PUT and GET](#11-the-complete-journey-how-a-file-is-put-and-get)
12. [Why "InterPlanetary"? — The Name Explained](#12-why-interplanetary-the-name-explained)
13. [The Persistence Problem — Pinning and Storage](#13-the-persistence-problem--pinning-and-storage)
14. [How Sherlock Uses IPFS (with IPFS Desktop Kubo Node)](#14-how-sherlock-uses-ipfs-with-local-kubo-node)
15. [References](#15-references)

---

## 1. What is IPFS?

**IPFS (InterPlanetary File System)** is a peer-to-peer protocol for content-addressed file storage and retrieval. It is NOT a single service or company — it is an **open protocol** (like HTTP or TCP) that anyone can implement and run.

### Location Addressing vs. Content Addressing

```
═══════════════════════════════════════════════════════════════
TODAY'S WEB: LOCATION ADDRESSING (HTTP)
═══════════════════════════════════════════════════════════════

  URL: https://server.com/path/file.txt

  Meaning: "Go to server.com, find the file at /path/file.txt"

  Problems:
    1. If server.com goes down → file is GONE (single point of failure)
    2. If server.com changes the file → you get different content at same URL
    3. You CANNOT verify the file is what you expected (you trust the server)
    4. Two copies of the same file on different servers = two different URLs

═══════════════════════════════════════════════════════════════
IPFS: CONTENT ADDRESSING
═══════════════════════════════════════════════════════════════

  CID: bafkreia7b3c9d2e1f0...

  Meaning: "Give me the file whose SHA-256 hash is a7b3c9d2e1f0..."

  Solutions:
    1. ANY node that has the file can serve it (no single point of failure)
    2. The CID IS the hash — if content changes, CID changes (immutable)
    3. You VERIFY the file: compute hash yourself, compare with CID
    4. Same file on 1000 nodes = same CID (deduplicated automatically)

═══════════════════════════════════════════════════════════════
REAL-LIFE ANALOGY:
═══════════════════════════════════════════════════════════════

  HTTP = "Go to the library on Main Street, shelf 3, row 2"
         → Library burns down? Book is gone.
         → Librarian swaps the book? You'd never know.

  IPFS = "Get me the book with ISBN 978-3-16-148410-0"
         → ANY library with a copy can give it to you
         → ISBN is computed from the content — can't be faked
         → You verify: does this book match ISBN? Yes → authentic
```

### The Five Core Components of IPFS

```
┌─────────────────────────────────────────────────────────────────┐
│                        IPFS PROTOCOL                            │
│                                                                 │
│  ┌──────────────┐  Files are hashed to produce CIDs             │
│  │ 1. SHA-256   │  (Section 2-3)                                │
│  │    Hashing   │                                               │
│  └──────┬───────┘                                               │
│         ▼                                                       │
│  ┌──────────────┐  Files are split into chunks, arranged        │
│  │ 2. Merkle    │  in a hash tree (Sections 4-5)                │
│  │    DAG       │                                               │
│  └──────┬───────┘                                               │
│         ▼                                                       │
│  ┌──────────────┐  Nodes find each other using XOR distance     │
│  │ 3. Kademlia  │  (Section 6)                                  │
│  │    DHT       │                                               │
│  └──────┬───────┘                                               │
│         ▼                                                       │
│  ┌──────────────┐  Blocks are exchanged between peers           │
│  │ 4. Bitswap   │  in parallel from multiple nodes (Sec 7-8)    │
│  │    Exchange  │                                               │
│  └──────┬───────┘                                               │
│         ▼                                                       │
│  ┌──────────────┐  libp2p handles actual network connections    │
│  │ 5. libp2p    │  (TCP, QUIC, WebSocket, NAT traversal)        │
│  │    Network   │                                               │
│  └──────────────┘                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Content Addressing — The Mathematics of SHA-256

### What is a Cryptographic Hash Function?

A cryptographic hash function takes **any input** (any size) and produces a **fixed-size output** (the "digest" or "hash"). It is a **one-way function**: easy to compute forward, impossible to reverse.

### Formal Definition

```
  H : {0,1}* → {0,1}²⁵⁶

  This means:
    H takes any binary string of any length (that's what {0,1}* means)
    and produces exactly a 256-bit binary string.

  In plain terms:
    Input:  any file (1 byte, 1 KB, 4 GB — anything)
    Output: exactly 256 bits = 32 bytes = 64 hexadecimal characters
```

### SHA-256 Example Computations

```
  Input: "Hello"
  SHA-256 → 185f8db32271fe25f561a6fc938b2e264306ec304eda518007d1764826381969

  Input: "Hello!" (added one character)
  SHA-256 → 334d016f755cd6dc58c53a86e183882f8ec14f52fb05345887c8a5edd42c87b7

  Input: "Hello" (same as first — deterministic)
  SHA-256 → 185f8db32271fe25f561a6fc938b2e264306ec304eda518007d1764826381969

  Observations:
    1. Same input → ALWAYS same output (deterministic)
    2. Adding "!" changed EVERY character in the output (avalanche effect)
    3. Both outputs are exactly 64 hex chars (256 bits)
```

### The Output Space: How Many Possible Hashes?

```
  256 bits = 2²⁵⁶ possible hash values

  2²⁵⁶ = 115,792,089,237,316,195,423,570,985,008,687,907,853,269,984,
          665,640,564,039,457,584,007,913,129,639,936

  ≈ 1.16 × 10⁷⁷

  For perspective:
    Atoms in the observable universe ≈ 10⁸⁰
    Stars in the universe ≈ 10²⁴
    Grains of sand on Earth ≈ 10¹⁹
    
  SHA-256 has nearly as many possible outputs as there are atoms!
```

### The Three Security Properties (Mathematical Definitions)

```
═══════════════════════════════════════════════════════════════
PROPERTY 1: PRE-IMAGE RESISTANCE
═══════════════════════════════════════════════════════════════

  Definition:
    Given h ∈ {0,1}²⁵⁶, it is computationally infeasible
    to find ANY m such that H(m) = h.

  Plain English:
    Given a hash output, you CANNOT find the input that produced it.

  Example:
    Given: a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e
    Find:  ??? → impossible (the input was "Hello World" but you can't figure that out)

  Complexity:
    Best attack: brute force = try all possible inputs
    Expected attempts: 2²⁵⁶ ≈ 10⁷⁷
    At 10¹⁰ hashes/second: 10⁷⁷ / 10¹⁰ = 10⁶⁷ seconds ≈ 3 × 10⁵⁹ years

═══════════════════════════════════════════════════════════════
PROPERTY 2: SECOND PRE-IMAGE RESISTANCE
═══════════════════════════════════════════════════════════════

  Definition:
    Given m₁, it is computationally infeasible
    to find m₂ ≠ m₁ such that H(m₁) = H(m₂).

  Plain English:
    Given a file, you CANNOT find a DIFFERENT file with the same hash.

  Example:
    Given: "Hello World" → a591a6...
    Find:  some other input that ALSO produces a591a6... → impossible

  Why this matters for IPFS:
    An attacker CANNOT create a malicious file that has the same CID
    as a legitimate file. If CID matches → content is guaranteed authentic.

═══════════════════════════════════════════════════════════════
PROPERTY 3: COLLISION RESISTANCE
═══════════════════════════════════════════════════════════════

  Definition:
    It is computationally infeasible to find ANY pair
    m₁ ≠ m₂ such that H(m₁) = H(m₂).

  Plain English:
    You CANNOT find ANY two different inputs that produce the same hash.

  This is stronger than Property 2:
    Property 2: given a SPECIFIC input, can't find another with same hash
    Property 3: can't find ANY pair at all (even if you choose both inputs freely)
```

### Birthday Attack: Probability of Collision

```
═══════════════════════════════════════════════════════════════
THE BIRTHDAY PARADOX
═══════════════════════════════════════════════════════════════

  In a room of 23 people, there's a >50% chance two share a birthday.
  (Out of 365 possible days — surprisingly few people needed!)

  Why? Because we're looking for ANY pair, not a specific one.
  With 23 people, there are C(23,2) = 253 possible pairs to check.

  The same math applies to hash collisions.

═══════════════════════════════════════════════════════════════
BIRTHDAY ATTACK FORMULA
═══════════════════════════════════════════════════════════════

  P(at least one collision among k items in a space of N)
    ≈ 1 - e^(-k² / 2N)

  Alternatively, for 50% collision probability:
    k₅₀% ≈ √(2N × ln 2) ≈ 1.177 × √N

═══════════════════════════════════════════════════════════════
APPLYING TO SHA-256 (N = 2²⁵⁶)
═══════════════════════════════════════════════════════════════

  k₅₀% ≈ 1.177 × √(2²⁵⁶)
       = 1.177 × 2¹²⁸
       ≈ 4.0 × 10³⁸

  You need to hash ~4 × 10³⁸ different files to have a 50% chance
  of finding ANY two that collide.

  At 10 billion (10¹⁰) hashes per second:
    Time = 4 × 10³⁸ / 10¹⁰ = 4 × 10²⁸ seconds
         = 4 × 10²⁸ / (3.15 × 10⁷ sec/year)
         ≈ 1.27 × 10²¹ years

  Age of universe: 1.4 × 10¹⁰ years
  Ratio: 1.27 × 10²¹ / 1.4 × 10¹⁰ ≈ 10¹¹ = 100 BILLION times the age of the universe

═══════════════════════════════════════════════════════════════
PROBABILITY TABLE
═══════════════════════════════════════════════════════════════

  ┌─────────────────────────┬──────────────────────────────────┐
  │ Files hashed (k)        │ P(collision)                     │
  ├─────────────────────────┼──────────────────────────────────┤
  │ 10⁶ (1 million)         │ ≈ 10⁻⁶⁵ (essentially zero)       │
  │ 10⁹ (1 billion)         │ ≈ 10⁻⁵⁹                          │
  │ 10¹² (1 trillion)       │ ≈ 10⁻⁵³                          │
  │ 10²⁰                    │ ≈ 10⁻³⁷                          │
  │ 10³⁰                    │ ≈ 10⁻¹⁷                          │
  │ 10³⁵ (atoms on Earth)   │ ≈ 10⁻⁷                           │
  │ 4 × 10³⁸ (= 2¹²⁸)       │ ≈ 50%                            │
  └─────────────────────────┴──────────────────────────────────┘

  CONCLUSION: For any practical number of files (even trillions),
  the probability of a hash collision is effectively ZERO.
  
  This is why CID = unique file identity. No two different files
  will ever produce the same CID.
```

### The Avalanche Effect (Why 1 Bit Change → 50% Output Change)

```
═══════════════════════════════════════════════════════════════
INTERNAL STRUCTURE OF SHA-256 (simplified)
═══════════════════════════════════════════════════════════════

  SHA-256 processes input in 512-bit blocks through 64 rounds.
  Each round applies:

    Σ₀(a) = ROTR²(a) ⊕ ROTR¹³(a) ⊕ ROTR²²(a)
    Σ₁(e) = ROTR⁶(e) ⊕ ROTR¹¹(e) ⊕ ROTR²⁵(e)
    Ch(e,f,g) = (e ∧ f) ⊕ (¬e ∧ g)
    Maj(a,b,c) = (a ∧ b) ⊕ (a ∧ c) ⊕ (b ∧ c)

  Where:
    ROTR^n(x) = circular right rotation by n bits
    ⊕ = XOR, ∧ = AND, ¬ = NOT

  Per round:
    T₁ = h + Σ₁(e) + Ch(e,f,g) + Kᵢ + Wᵢ
    T₂ = Σ₀(a) + Maj(a,b,c)
    
    Then shift the 8 working variables:
      h←g, g←f, f←e, e←d+T₁, d←c, c←b, b←a, a←T₁+T₂

  After 64 rounds, a 1-bit input change has propagated through
  so many XOR, rotation, and addition operations that ~50% of
  output bits have flipped. This is the "avalanche effect."

═══════════════════════════════════════════════════════════════
EXAMPLE: AVALANCHE IN ACTION
═══════════════════════════════════════════════════════════════

  Input 1: "AB" (binary: 01000001 01000010)
  Input 2: "AC" (binary: 01000001 01000011) — changed 1 bit!

  SHA-256("AB") = 38b060a751ac96384cd9327eb1b1e36a...
  SHA-256("AC") = 1f2e3d4c5b6a79880011223344556677...  (COMPLETELY different)

  Bit-by-bit comparison of the two 256-bit outputs:
    Bits that differ: ~128 out of 256 ≈ 50%

  This means: changing 1 bit in the input changes ~50% of the output.
  The outputs appear STATISTICALLY INDEPENDENT — no pattern.
```

---

## 3. CID — Content Identifier Structure

### From Raw Hash to Structured Address

The raw SHA-256 hash is just 32 bytes. IPFS wraps it in a self-describing format called a **CID (Content Identifier)** that encodes:
- What hash function was used
- What data format the content is in
- The CID version

```
═══════════════════════════════════════════════════════════════
CIDv1 STRUCTURE
═══════════════════════════════════════════════════════════════

  CID = <multibase> <version> <multicodec> <multihash>

  Example CID: bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3osphber...

  Breaking it down:
  ┌───────────────┬──────────┬─────────────────────────────────────┐
  │ Component     │ Value    │ Meaning                             │
  ├───────────────┼──────────┼─────────────────────────────────────┤
  │ multibase     │ b        │ Base32 encoding                     │
  │ version       │ 0x01     │ CID version 1                       │
  │ multicodec    │ 0x70     │ dag-pb (protobuf DAG format)        │
  │ multihash     │ ...      │ The actual hash (see below)         │
  └───────────────┴──────────┴─────────────────────────────────────┘

═══════════════════════════════════════════════════════════════
MULTIHASH STRUCTURE
═══════════════════════════════════════════════════════════════

  multihash = <hash-function-code> <digest-length> <digest-value>

  Example:
    0x12  0x20  7d2f88a9014b5e0a6d2c7b3e8f1a2b3c...
    ────  ────  ───────────────────────────────────
    │     │     └─ actual hash bytes (32 bytes)
    │     └─ 0x20 = 32 (length in bytes)
    └─ 0x12 = SHA-256 (hash function identifier)

═══════════════════════════════════════════════════════════════
WHY SELF-DESCRIBING?
═══════════════════════════════════════════════════════════════

  Future-proofing! If SHA-256 is ever broken (unlikely), IPFS can
  switch to SHA-3 or BLAKE3. The CID tells you WHICH hash was used.

  SHA-256 CID: 0x12 0x20 <hash>  → "I used SHA-256, here's 32 bytes"
  SHA-3 CID:   0x16 0x20 <hash>  → "I used SHA-3, here's 32 bytes"
  BLAKE3 CID:  0x1e 0x20 <hash>  → "I used BLAKE3, here's 32 bytes"

  Any future node can still verify: read the code, use the right function.

═══════════════════════════════════════════════════════════════
CIDv0 vs CIDv1
═══════════════════════════════════════════════════════════════

  CIDv0: starts with "Qm..." (base58, always SHA-256, always dag-pb)
    Example: QmX7b2nGfC5kMZ1N9VVHRtRYqeKgVEzLH9S4sYiL5y7gD

  CIDv1: starts with "bafy..." (base32, self-describing)
    Example: bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3osphber...

  CIDv0 and CIDv1 can represent the SAME content — just different encoding.
  CIDv1 is preferred because it's future-proof and self-describing.
```

### Verification: The Mathematical Guarantee

```
═══════════════════════════════════════════════════════════════
THE VERIFICATION ALGORITHM
═══════════════════════════════════════════════════════════════

  Given: a CID "bafybeig..." and received file bytes B

  Step 1: Extract hash function from CID → SHA-256 (code 0x12)
  Step 2: Extract expected digest from CID → D_expected
  Step 3: Compute: D_actual = SHA-256(B)
  Step 4: Compare: D_actual == D_expected?

  If YES:
    → File is EXACTLY the content identified by this CID
    → Not a single bit has been changed
    → Guaranteed by collision resistance of SHA-256

  If NO:
    → File has been tampered with, corrupted, or is completely different
    → REJECT immediately

═══════════════════════════════════════════════════════════════
WHY THIS WORKS (THE PROOF)
═══════════════════════════════════════════════════════════════

  Claim: If D_actual == D_expected, then B is the original file.

  Proof by contradiction:
    Assume B is NOT the original file (B ≠ original).
    But SHA-256(B) = SHA-256(original) = D_expected.
    This means we found two different inputs with the same hash.
    This is a COLLISION — which contradicts SHA-256 collision resistance.
    
    Therefore: B MUST be the original file. ∎

  The only way to break this: find a SHA-256 collision.
  As shown above, this requires ~2¹²⁸ operations = impossible.
```

---

## 4. Merkle DAG — File Chunking and Tree Hashing

### The Problem with Hashing Whole Files

```
  File: 4 GB movie

  Approach 1: Hash the entire 4 GB → single CID
    Problem: Must download ALL 4 GB before you can verify ANY of it.
    Problem: If 1 byte is corrupted → re-download ALL 4 GB.
    Problem: Can't download from multiple sources in parallel.

  Approach 2 (IPFS): Split into chunks, hash each chunk, build a tree
    Benefit: Verify each chunk independently.
    Benefit: Re-download only the corrupted chunk.
    Benefit: Download DIFFERENT chunks from DIFFERENT peers simultaneously!
```

### Step-by-Step: Chunking, Hashing, and Tree Construction

```
═══════════════════════════════════════════════════════════════
STEP 1: CHUNKING
═══════════════════════════════════════════════════════════════

  IPFS splits files into fixed-size chunks.
  Default chunk size: 256 KB (262,144 bytes)

  Example: A 1 MB file (1,048,576 bytes)
    Chunk size = 256 KB = 262,144 bytes
    Number of chunks = ⌈1,048,576 / 262,144⌉ = 4

    C₁ = bytes[0 .. 262,143]         (256 KB)
    C₂ = bytes[262,144 .. 524,287]   (256 KB)
    C₃ = bytes[524,288 .. 786,431]   (256 KB)
    C₄ = bytes[786,432 .. 1,048,575] (256 KB)

  For our simplified example: file "ABCDEFGH" with chunk size = 2 bytes:
    C₁ = "AB"   C₂ = "CD"   C₃ = "EF"   C₄ = "GH"

═══════════════════════════════════════════════════════════════
STEP 2: LEAF HASHING — Hash each chunk independently
═══════════════════════════════════════════════════════════════

  Each chunk is hashed individually to create a "leaf node":

    H₁ = SHA-256(C₁) = SHA-256("AB") = 38b060a7...
    H₂ = SHA-256(C₂) = SHA-256("CD") = 98c1eb4e...
    H₃ = SHA-256(C₃) = SHA-256("EF") = 3f79bb7b...
    H₄ = SHA-256(C₄) = SHA-256("GH") = 7c4a8d09...

  Each leaf hash is a CID that uniquely identifies that chunk.
  Each chunk can be independently verified and downloaded.

═══════════════════════════════════════════════════════════════
STEP 3: BUILD THE MERKLE TREE — Hash pairs upward
═══════════════════════════════════════════════════════════════

  Pair the leaf hashes and hash them together:

  Level 1 (internal nodes):
    H₁₂ = SHA-256(H₁ ∥ H₂) = SHA-256("38b0..." + "98c1...") = d4e56f...
    H₃₄ = SHA-256(H₃ ∥ H₄) = SHA-256("3f79..." + "7c4a...") = b2a173...

    ∥ means "concatenate" — stick the two hash byte strings together.

  Level 2 (root):
    Root = SHA-256(H₁₂ ∥ H₃₄) = SHA-256("d4e5..." + "b2a1...") = f7c8ab...

  The ROOT HASH is the file's CID!
  
═══════════════════════════════════════════════════════════════
STEP 4: THE COMPLETE MERKLE TREE
═══════════════════════════════════════════════════════════════

                      ┌────────────────┐
                      │  Root: f7c8ab  │  ← THIS IS THE FILE's CID
                      │  (root hash)   │
                      └───────┬────────┘
                              │
                   ┌──────────┴─────────┐
                   │                    │
             ┌─────┴─────┐        ┌─────┴─────┐
             │ H₁₂:d4e56f│        │ H₃₄:b2a173│
             └─────┬─────┘        └─────┬─────┘
                   │                    │
             ┌─────┴─────┐        ┌─────┴─────┐
             │           │        │           │
          ┌──┴──┐     ┌──┴──┐  ┌──┴──┐     ┌──┴──┐
          │ H₁  │     │ H₂  │  │ H₃  │     │ H₄  │
          │38b0 │     │98c1 │  │3f79 │     │7c4a │
          └──┬──┘     └──┬──┘  └──┬──┘     └──┬──┘
             │           │        │           │
          ┌──┴──┐     ┌──┴──┐  ┌──┴──┐     ┌──┴──┐
          │"AB" │     │"CD" │  │"EF" │     │"GH" │
          │(C₁) │     │(C₂) │  │(C₃) │     │(C₄) │
          └─────┘     └─────┘  └─────┘     └─────┘

  EVERY node in this tree has its own CID:
    - C₁ has CID based on SHA-256("AB")
    - H₁₂ has CID based on SHA-256(H₁ ∥ H₂)
    - Root has CID based on SHA-256(H₁₂ ∥ H₃₄)

  The root CID UNIQUELY identifies the ENTIRE file.
  Change any byte in any chunk → root CID changes completely.
```

### The Formal Definition: Merkle DAG

```
═══════════════════════════════════════════════════════════════
DEFINITION
═══════════════════════════════════════════════════════════════

  A Merkle DAG (Directed Acyclic Graph) is a graph G = (V, E) where:

    V = set of nodes (each node contains data or hash references)
    E = set of directed edges (parent → child)

  Properties:
    1. DIRECTED: edges go one way (parent points to child)
    2. ACYCLIC: no cycles (you can't follow edges back to where you started)
    3. CONTENT-ADDRESSED: each node's ID = hash of its contents + children's IDs

  Formally, for any node N:
    CID(N) = H(content(N) ∥ CID(child₁) ∥ CID(child₂) ∥ ... ∥ CID(childₖ))

  This means: the CID of a parent DEPENDS on the CIDs of all its children.
  Change any child → parent CID changes → grandparent CID changes → root CID changes.

═══════════════════════════════════════════════════════════════
WHY DAG AND NOT TREE?
═══════════════════════════════════════════════════════════════

  A tree: each node has exactly ONE parent
  A DAG:  a node can have MULTIPLE parents (shared references)

  This matters for deduplication (Section 9):
    File A and File B can both point to the same chunk node.
    The chunk is stored ONCE but referenced by both files.

  Example:
    File A root ──► [chunk "AB"] ◄── File B root
                    [chunk "CD"] ◄──
                    [chunk "EF"]     [chunk "WX"]
                    [chunk "GH"]     [chunk "YZ"]

  Chunks "AB" and "CD" are shared — stored once, linked by both.
```

### Tamper Detection: Complete Mathematical Proof

```
═══════════════════════════════════════════════════════════════
SCENARIO: Attacker changes 1 byte in chunk C₃
═══════════════════════════════════════════════════════════════

  Original C₃ = "EF"  →  Tampered C₃' = "EX" (changed 'F' to 'X')

  Step-by-step cascade:

  1. Leaf level:
     H₃  = SHA-256("EF") = 3f79bb7b...
     H₃' = SHA-256("EX") = 9a2b1c3d...  ← COMPLETELY DIFFERENT (avalanche)

  2. Internal node level:
     H₃₄  = SHA-256(H₃  ∥ H₄) = SHA-256(3f79... ∥ 7c4a...) = b2a173...
     H₃₄' = SHA-256(H₃' ∥ H₄) = SHA-256(9a2b... ∥ 7c4a...) = 5e7f22...  ← DIFFERENT

  3. Root level:
     Root  = SHA-256(H₁₂ ∥ H₃₄)  = SHA-256(d4e5... ∥ b2a1...) = f7c8ab...
     Root' = SHA-256(H₁₂ ∥ H₃₄') = SHA-256(d4e5... ∥ 5e7f...) = a1b2c3...  ← DIFFERENT

  Result:
     Original CID: bafybeif7c8ab...
     Tampered CID: bafybeia1b2c3...  ← COMPLETELY DIFFERENT

  MATHEMATICAL GUARANTEE:
    Changing 1 byte in 1 chunk changes:
      → That chunk's hash (avalanche effect)
      → Its parent's hash (because parent hashes children)
      → Grandparent's hash
      → ... all the way to the root
      → The CID is DIFFERENT

  The probability of finding a tampered file with the SAME root CID:
    = probability of SHA-256 collision ≈ 2⁻¹²⁸ ≈ 10⁻³⁹ = essentially ZERO
```

### Tree Depth and Scale

```
═══════════════════════════════════════════════════════════════
HOW TREE SIZE SCALES WITH FILE SIZE
═══════════════════════════════════════════════════════════════

  For a binary Merkle tree with chunk size S = 256 KB:

    Number of leaves (chunks): n = ⌈file_size / S⌉
    Tree depth: d = ⌈log₂(n)⌉
    Total nodes: 2n - 1 (for a complete binary tree)

  ┌──────────────┬────────────┬───────────┬──────────────────┐
  │ File Size    │ # Chunks   │ Depth     │ Total Nodes      │
  ├──────────────┼────────────┼───────────┼──────────────────┤
  │ 256 KB       │ 1          │ 0         │ 1                │
  │ 1 MB         │ 4          │ 2         │ 7                │
  │ 16 MB        │ 64         │ 6         │ 127              │
  │ 256 MB       │ 1,024      │ 10        │ 2,047            │
  │ 1 GB         │ 4,096      │ 12        │ 8,191            │
  │ 4 GB         │ 16,384     │ 14        │ 32,767           │
  │ 1 TB         │ 4,194,304  │ 22        │ 8,388,607        │
  └──────────────┴────────────┴───────────┴──────────────────┘

  Key insight: depth grows as log₂(n).
    File size doubles → depth increases by 1.
    File size × 1000 → depth increases by only 10.

  IPFS actually uses wider trees (up to 174 children per node, not just 2).
  This makes trees shallower:
    With branching factor 174: depth = ⌈log₁₇₄(n)⌉
    A 1 TB file: depth ≈ ⌈log₁₇₄(4,194,304)⌉ ≈ 3 levels!
```

---

## 5. Merkle Proofs — Verify Any Chunk Mathematically

### The Problem

```
  You downloaded chunk C₃ from a random peer on the internet.
  You know the file's root CID: f7c8ab...
  
  QUESTION: Is this chunk really part of the file, or is it fake?
  
  NAIVE APPROACH: Download ALL chunks, rebuild the tree, check root.
    → Defeats the purpose! You'd need the entire file.
  
  MERKLE PROOF: Verify C₃ using only ~log₂(n) hashes (tiny amount of data).
```

### How a Merkle Proof Works: Step-by-Step

```
═══════════════════════════════════════════════════════════════
SETUP: Verify chunk C₃ = "EF" belongs to root f7c8ab
═══════════════════════════════════════════════════════════════

  The tree (for reference):
                      Root: f7c8
                      /         \
                H₁₂: d4e5    H₃₄: b2a1
                /    \        /    \
              H₁     H₂    H₃     H₄
             38b0   98c1   3f79   7c4a
              |      |      |      |
             "AB"   "CD"  "EF"   "GH"
                           ^^^
                    We want to verify this chunk

═══════════════════════════════════════════════════════════════
THE PROOF: Only need "sibling" hashes along the path to root
═══════════════════════════════════════════════════════════════

  Path from C₃ to Root: C₃ → H₃ → H₃₄ → Root

  At each level, we need the SIBLING (the other branch):
    Level 0: We have C₃ = "EF" (the chunk we're verifying)
    Level 1: Sibling of H₃ is H₄ = 7c4a  ← NEED THIS
    Level 2: Sibling of H₃₄ is H₁₂ = d4e5 ← NEED THIS

  Merkle Proof = { H₄, H₁₂ } = just 2 hashes (64 bytes total)

═══════════════════════════════════════════════════════════════
VERIFICATION ALGORITHM (anyone can run this)
═══════════════════════════════════════════════════════════════

  Input:
    - chunk data: "EF"
    - proof: [H₄ = 7c4a, H₁₂ = d4e5]
    - claimed position: index 2 (C₃, 0-indexed)
    - expected root: f7c8

  Step 1: Hash the chunk
    computed_H₃ = SHA-256("EF") = 3f79  ✓ (computed locally, not trusted)

  Step 2: Combine with sibling H₄ at level 1
    index 2 in binary = "10" → bit 0 is 0 → H₃ is on the LEFT
    computed_H₃₄ = SHA-256(computed_H₃ ∥ H₄)
                  = SHA-256(3f79 ∥ 7c4a) = b2a1  ✓

  Step 3: Combine with sibling H₁₂ at level 2
    index 2 in binary = "10" → bit 1 is 1 → H₃₄ is on the RIGHT
    computed_Root = SHA-256(H₁₂ ∥ computed_H₃₄)
                  = SHA-256(d4e5 ∥ b2a1) = f7c8  ✓

  Step 4: Compare
    computed_Root == expected_root?
    f7c8 == f7c8?  ✅ YES!

  CONCLUSION: Chunk "EF" is authentically part of this file.
  We verified this using:
    - The chunk itself (2 bytes)
    - 2 sibling hashes (64 bytes)
    - The known root CID
  We did NOT need to download the other 3 chunks!

═══════════════════════════════════════════════════════════════
THE POSITION BIT TRICK
═══════════════════════════════════════════════════════════════

  How do we know if our hash goes on the LEFT or RIGHT when combining?

  Answer: Use the binary representation of the chunk index!

    Chunk index 2 = binary "10"
    
    Level 0 (bit 0 = 0): our hash goes LEFT  → H(ours ∥ sibling)
    Level 1 (bit 1 = 1): our hash goes RIGHT → H(sibling ∥ ours)

  This is a standard Merkle proof technique.
  The prover sends: [sibling_hashes], verifier uses index bits for ordering.
```

### Proof Size Analysis: Why This is Incredibly Efficient

```
═══════════════════════════════════════════════════════════════
PROOF SIZE = O(log₂ n) × 32 bytes
═══════════════════════════════════════════════════════════════

  For a binary tree with n leaves:
    Proof = log₂(n) sibling hashes × 32 bytes each

  ┌──────────────┬────────────┬──────────────┬─────────────────┐
  │ File Size    │ # Chunks   │ Tree Depth   │ Proof Size      │
  ├──────────────┼────────────┼──────────────┼─────────────────┤
  │ 1 MB         │ 4          │ 2            │ 64 bytes        │
  │ 256 MB       │ 1,024      │ 10           │ 320 bytes       │
  │ 1 GB         │ 4,096      │ 12           │ 384 bytes       │
  │ 4 GB         │ 16,384     │ 14           │ 448 bytes       │
  │ 1 TB         │ 4,194,304  │ 22           │ 704 bytes       │
  └──────────────┴────────────┴──────────────┴─────────────────┘

  Verify 1 chunk of a 1 TB file using only 704 bytes of proof!
  File doubles in size → proof grows by only 32 bytes.

  This logarithmic growth is the mathematical magic of Merkle trees.

═══════════════════════════════════════════════════════════════
SECURITY: Can a Merkle proof be forged?
═══════════════════════════════════════════════════════════════

  To forge a proof for fake chunk C₃':
    Need: SHA-256(fake_path_hashes) = known_root

  This requires finding a pre-image of the root hash
    = breaking SHA-256 pre-image resistance
    = computationally impossible (2²⁵⁶ work)

  Therefore: a valid Merkle proof is UNFORGEABLE.
  If the proof verifies, the chunk is authentic. Period.
```

---

## 6. Kademlia DHT — Finding Nodes with XOR Distance

You have a CID. But which computer among millions on the network actually HAS the data? IPFS uses the **Kademlia Distributed Hash Table (DHT)** to find peers.

### The XOR Distance Metric

```
═══════════════════════════════════════════════════════════════
DEFINITION
═══════════════════════════════════════════════════════════════

  Every IPFS node has a 256-bit Node ID (randomly generated).
  Every CID is also 256 bits.
  
  The "distance" between any two 256-bit values is defined as:
  
    d(x, y) = x ⊕ y    (XOR of corresponding bits)

═══════════════════════════════════════════════════════════════
XOR TRUTH TABLE
═══════════════════════════════════════════════════════════════

  Bit A │ Bit B │ A ⊕ B
  ──────┼───────┼──────
    0   │   0   │   0    (same bits → 0)
    0   │   1   │   1    (different bits → 1)
    1   │   0   │   1    (different bits → 1)
    1   │   1   │   0    (same bits → 0)

  XOR outputs 1 when bits DIFFER, 0 when they're the SAME.
  More differing bits = larger XOR value = greater "distance."

═══════════════════════════════════════════════════════════════
EXAMPLE (4-bit IDs for simplicity)
═══════════════════════════════════════════════════════════════

  Node A = 1010
  Node B = 1100
  Node C = 1011

  d(A, B) = 1010 ⊕ 1100 = 0110 = 6 (decimal)
  d(A, C) = 1010 ⊕ 1011 = 0001 = 1 (decimal)

  Node C is "closer" to A (distance 1) than Node B (distance 6).
```

### Three Mathematical Properties of XOR Distance

```
═══════════════════════════════════════════════════════════════
PROPERTY 1: d(x,x) = 0 and d(x,y) > 0 for x ≠ y
═══════════════════════════════════════════════════════════════

  Proof: x ⊕ x = 0 (XOR of identical bits always gives 0)
  If x ≠ y, at least one bit differs → at least one 1 in XOR → d > 0

═══════════════════════════════════════════════════════════════
PROPERTY 2: SYMMETRY — d(x,y) = d(y,x)
═══════════════════════════════════════════════════════════════

  Proof: x ⊕ y = y ⊕ x (XOR is commutative)
  
  Meaning: "If I'm close to you, you're close to me."

═══════════════════════════════════════════════════════════════
PROPERTY 3: TRIANGLE INEQUALITY — d(x,z) ≤ d(x,y) + d(y,z)
═══════════════════════════════════════════════════════════════

  Proof: For XOR, an even stronger property holds:
    d(x,z) ≤ d(x,y) ⊕ d(y,z)    (ultrametric inequality)
  
  Since a ⊕ b ≤ a + b for all non-negative integers:
    d(x,z) ≤ d(x,y) + d(y,z)

  Meaning: Direct route is always shortest. No detour can be shorter.

═══════════════════════════════════════════════════════════════
PROPERTY 4: UNIQUENESS — For any x and distance D, exactly one y
═══════════════════════════════════════════════════════════════

  Given x and D: y = x ⊕ D is the UNIQUE point at distance D from x.
  
  Proof: x ⊕ y = D → y = x ⊕ D (XOR both sides with x, using x ⊕ x = 0)
  
  Meaning: routing decisions have no ambiguity. For any target distance,
  there's exactly one node — routing always converges.
```

### k-Buckets: How Each Node Organizes Its Contacts

```
═══════════════════════════════════════════════════════════════
ROUTING TABLE STRUCTURE
═══════════════════════════════════════════════════════════════

  Each node maintains 256 "k-buckets" (one per bit position).
  Bucket i contains nodes whose distance from you has the highest
  set bit at position i.

  For a 4-bit ID system (my ID = 1010):

    Bucket 0: distance 0001 (bit 0 differs)  → nodes like 1011
    Bucket 1: distance 001x (bit 1 differs)  → nodes like 1000, 1001
    Bucket 2: distance 01xx (bit 2 differs)  → nodes like 1100, 1110
    Bucket 3: distance 1xxx (bit 3 differs)  → nodes like 0010, 0110

  Each bucket holds up to k contacts (k = 20 in IPFS).

═══════════════════════════════════════════════════════════════
THE EXPONENTIAL COVERAGE PATTERN
═══════════════════════════════════════════════════════════════

  Bucket i covers 2ⁱ possible nodes:
    Bucket 0: 2⁰ = 1 node     ← know ALL very-close nodes
    Bucket 1: 2¹ = 2 nodes    ← know most nearby nodes
    Bucket 2: 2² = 4 nodes    ← know some
    Bucket 3: 2³ = 8 nodes    ← know a few
    ...
    Bucket 255: 2²⁵⁵ nodes   ← know very few of the farthest nodes

  You know MORE about nearby nodes, LESS about far ones.
  This is EXACTLY what you need for efficient routing!
```

### Why XOR? Why Not OR, AND, or Other Bit Operations?

```
═══════════════════════════════════════════════════════════════
TESTING EVERY BIT OPERATION AS A "DISTANCE" METRIC
═══════════════════════════════════════════════════════════════

A valid distance metric d(x,y) MUST satisfy:
  (1) d(x,x) = 0           (distance to yourself is zero)
  (2) d(x,y) > 0 if x ≠ y  (different points have positive distance)
  (3) d(x,y) = d(y,x)      (symmetry)
  (4) d(x,z) ≤ d(x,y) + d(y,z)  (triangle inequality)

Let's test each bit operation with 4-bit examples:

═══════════════════════════════════════════════════════════════
AND (∧) — FAILS property (1) and (2)
═══════════════════════════════════════════════════════════════

  d(x,y) = x ∧ y

  Test (1): d(x,x) = x ∧ x = x ← NOT ZERO (unless x = 0)!
    d(1010, 1010) = 1010 ∧ 1010 = 1010 = 10 ≠ 0  ✗ FAILS

  Test (2): d(1010, 0000) = 1010 ∧ 0000 = 0000 = 0
    But 1010 ≠ 0000, yet distance = 0!  ✗ FAILS

  AND measures "overlap" not "difference."
  Two completely different numbers (1010 and 0101) give AND = 0000.
  But identical numbers give non-zero AND. Useless as distance.

═══════════════════════════════════════════════════════════════
OR (∨) — FAILS property (1) and (2)
═══════════════════════════════════════════════════════════════

  d(x,y) = x ∨ y

  Test (1): d(x,x) = x ∨ x = x ← NOT ZERO (unless x = 0)!
    d(1010, 1010) = 1010 ∨ 1010 = 1010 = 10 ≠ 0  ✗ FAILS

  Test (2): d(1111, 1010) = 1111 ∨ 1010 = 1111 = 15
            d(1111, 0101) = 1111 ∨ 0101 = 1111 = 15
    Two completely different nodes (1010 vs 0101) are "same distance"
    from 1111. OR can't distinguish them.  ✗ USELESS for routing

  OR grows monotonically — more 1-bits means larger OR.
  It doesn't measure "how different" two values are.

═══════════════════════════════════════════════════════════════
NAND (¬(x ∧ y)) — FAILS property (1)
═══════════════════════════════════════════════════════════════

  d(x,x) = ¬(x ∧ x) = ¬x ← NOT ZERO for most x  ✗ FAILS

═══════════════════════════════════════════════════════════════
NOR (¬(x ∨ y)) — FAILS property (1) and (3)
═══════════════════════════════════════════════════════════════

  d(x,x) = ¬(x ∨ x) = ¬x ← NOT ZERO  ✗ FAILS

═══════════════════════════════════════════════════════════════
SUBTRACTION (|x - y|) — Works as metric but FAILS for routing
═══════════════════════════════════════════════════════════════

  d(x,y) = |x - y| (absolute difference)

  Test (1): d(x,x) = 0 ✓
  Test (2): d(x,y) > 0 if x ≠ y ✓
  Test (3): d(x,y) = d(y,x) ✓ (absolute value)
  Test (4): triangle inequality ✓

  So subtraction IS a valid metric. Why not use it?

  PROBLEM: No unique closest point!
    d(1010, 1001) = |10 - 9| = 1
    d(1010, 1011) = |10 - 11| = 1
    Two DIFFERENT nodes at the SAME distance!

  With XOR:
    d(1010, 1001) = 1010 ⊕ 1001 = 0011 = 3
    d(1010, 1011) = 1010 ⊕ 1011 = 0001 = 1
    Different distances! XOR can distinguish them.

  Also: subtraction doesn't split the space evenly by bit prefixes.
  With XOR, flipping bit i creates distance 2ⁱ — perfect for k-buckets.
  With subtraction, the relationship between bits and distance is messy.

═══════════════════════════════════════════════════════════════
XOR (⊕) — PERFECT for all properties
═══════════════════════════════════════════════════════════════

  Test (1): d(x,x) = x ⊕ x = 0  ✓ (always zero)
  Test (2): If x ≠ y → at least 1 bit differs → XOR > 0  ✓
  Test (3): x ⊕ y = y ⊕ x  ✓ (commutative)
  Test (4): d(x,z) ≤ d(x,y) + d(y,z)  ✓ (proven above)

  BONUS properties unique to XOR:
  
  (5) UNIQUENESS: For any x and D, exactly one y: x ⊕ y = D → y = x ⊕ D
      No two different nodes can be at the same XOR distance!
      Routing ALWAYS converges — no ambiguity.

  (6) BIT-PREFIX PARTITIONING: 
      d(x,y) has highest bit at position i ⟺ x and y share
      the first (255-i) bits and differ at bit i.
      This naturally creates the k-bucket structure!

  (7) UNIFORM DISTRIBUTION:
      If node IDs are random, XOR distances are uniformly distributed.
      Each k-bucket has roughly equal chance of containing nodes.

═══════════════════════════════════════════════════════════════
SUMMARY TABLE
═══════════════════════════════════════════════════════════════

  ┌────────────┬─────────┬─────────┬──────────┬───────────┬─────────┐
  │ Operation  │ d(x,x)=0│ d>0 x≠y │ Symmetric│ Triangle  │ Unique  │
  ├────────────┼─────────┼─────────┼──────────┼───────────┼─────────┤
  │ AND        │    ✗    │    ✗    │    ✓    │    ✗     │   ✗     │
  │ OR         │    ✗    │    ✗    │    ✓    │    ✓     │   ✗     │
  │ NAND       │    ✗    │    ✗    │    ✓    │    ✗     │   ✗     │
  │ NOR        │    ✗    │    ✗    │    ✓    │    ✗     │   ✗     │
  │ |x - y|    │    ✓    │    ✓    │    ✓    │    ✓     │   ✗     │
  │ XOR (⊕)   │    ✓    │    ✓    │    ✓    │    ✓     │   ✓     │
  └────────────┴─────────┴─────────┴──────────┴──────────┴──────────┘

  XOR is the ONLY bit operation that satisfies ALL required properties
  for an efficient, unambiguous routing metric.
```

### Finding a File: The Iterative Lookup Algorithm

```
═══════════════════════════════════════════════════════════════
SETUP: 8 nodes with 4-bit IDs
═══════════════════════════════════════════════════════════════

  Nodes: 0010, 0100, 0110, 0111, 1000, 1010(me), 1100, 1110
  I am Node 1010. I want CID 0110.

  d(me, target) = 1010 ⊕ 0110 = 1100 = 12

═══════════════════════════════════════════════════════════════
ITERATION 1: Find closest known node to target
═══════════════════════════════════════════════════════════════

  In my routing table, the node closest to 0110:
    d(0010, 0110) = 0100 = 4
  → Ask Node 0010: "Who do you know close to 0110?"

═══════════════════════════════════════════════════════════════
ITERATION 2: Node 0010 responds
═══════════════════════════════════════════════════════════════

  Node 0010 knows Node 0100:
    d(0100, 0110) = 0010 = 2 ← CLOSER!
  → Ask Node 0100

═══════════════════════════════════════════════════════════════
ITERATION 3: Node 0100 responds
═══════════════════════════════════════════════════════════════

  Node 0100 knows Node 0111:
    d(0111, 0110) = 0001 = 1 ← EVEN CLOSER!
  → Ask Node 0111

═══════════════════════════════════════════════════════════════
ITERATION 4: Node 0111 responds
═══════════════════════════════════════════════════════════════

  Node 0111 knows Node 0110:
    d(0110, 0110) = 0 ← FOUND IT!
  → Node 0110 has the data (or a provider record pointing to it).

  Hops: 4 (for 8 nodes). In general: O(log₂ n).

  Distance halved each step: 12 → 4 → 2 → 1 → 0
  This exponential convergence is guaranteed by k-bucket structure.

  ┌────────────────────┬──────────────┐
  │ Network Size       │ Hops needed  │
  ├────────────────────┼──────────────┤
  │ 1,000 nodes        │ ~10          │
  │ 1,000,000 nodes    │ ~20          │
  │ 1,000,000,000      │ ~30          │
  └────────────────────┴──────────────┘
```

### Provider Records: How Nodes Announce What They Have

```
WHEN YOU UPLOAD A FILE:
  1. Compute CID of the file
  2. Find the k=20 nodes whose IDs are XOR-closest to the CID
  3. Send each a provider record: "I (peer:12345) have CID bafybeig..."
  4. Records expire after 24 hours → must re-publish

WHEN SOMEONE WANTS YOUR FILE:
  1. They look up the CID in the DHT (iterative lookup above)
  2. They reach one of those 20 nodes storing the provider record
  3. That node replies: "peer:12345 has this CID"
  4. They connect directly to peer:12345 via libp2p
  5. Download begins via Bitswap (Section 7)
```

---

## 7. Bitswap — Parallel Data Transfer from Multiple Nodes

Once you've found peers via DHT, **Bitswap** handles the actual block-by-block data exchange. This is where **parallel multi-node download** happens.

### The Bitswap Protocol: Step-by-Step

```
═══════════════════════════════════════════════════════════════
SCENARIO: You want a file with 4 blocks: B₁, B₂, B₃, B₄
═══════════════════════════════════════════════════════════════

  DHT told you:
    Peer X has: B₁, B₂, B₃, B₄ (complete file)
    Peer Y has: B₁, B₂          (partial — maybe cached from earlier)
    Peer Z has: B₃, B₄          (partial)

═══════════════════════════════════════════════════════════════
STEP 1: BROADCAST WANTLIST
═══════════════════════════════════════════════════════════════

  You create a "wantlist" — a list of block CIDs you need:
    wantlist = [CID(B₁), CID(B₂), CID(B₃), CID(B₄)]

  You send this wantlist to all connected peers:
    You → Peer X: "WANT [B₁, B₂, B₃, B₄]"
    You → Peer Y: "WANT [B₁, B₂, B₃, B₄]"
    You → Peer Z: "WANT [B₁, B₂, B₃, B₄]"

═══════════════════════════════════════════════════════════════
STEP 2: PEERS RESPOND WITH BLOCKS THEY HAVE
═══════════════════════════════════════════════════════════════

  Peer Y (fastest, closest): sends B₁ (arrives first)
  Peer Z: sends B₃ (arrives second)
  Peer X: was about to send B₁ but you already have it → sends B₂ instead
  Peer Z: sends B₄
  
  Result: B₁ from Y, B₂ from X, B₃ from Z, B₄ from Z

  KEY INSIGHT: Different blocks came from DIFFERENT peers!
  This is parallel download — like BitTorrent.

═══════════════════════════════════════════════════════════════
STEP 3: VERIFY EACH BLOCK INDEPENDENTLY
═══════════════════════════════════════════════════════════════

  For each received block Bᵢ:
    computed_CID = SHA-256(Bᵢ) wrapped in CID format
    Does computed_CID match the CID in the Merkle tree? 

    SHA-256(B₁_received) == CID(B₁)? ✓ (authentic)
    SHA-256(B₂_received) == CID(B₂)? ✓ (authentic)
    SHA-256(B₃_received) == CID(B₃)? ✓ (authentic)
    SHA-256(B₄_received) == CID(B₄)? ✓ (authentic)

  If ANY block fails verification → discard it, re-request from another peer.
  You don't need to trust ANY peer — math verifies every block.

═══════════════════════════════════════════════════════════════
STEP 4: REASSEMBLE AND VERIFY ROOT
═══════════════════════════════════════════════════════════════

  Reassemble: File = B₁ ∥ B₂ ∥ B₃ ∥ B₄
  
  Rebuild Merkle tree from blocks → compute root hash
  Does computed root == file's CID?  ✅ File is complete and authentic!
```

### Wantlist Update: Real-Time Deduplication

```
  As blocks arrive, you UPDATE your wantlist:

  Time 0: wantlist = [B₁, B₂, B₃, B₄]  → broadcast to all peers
  Time 1: B₁ arrives from Peer Y
          wantlist = [B₂, B₃, B₄]       → send CANCEL B₁ to all peers
  Time 2: B₃ arrives from Peer Z
          wantlist = [B₂, B₄]           → send CANCEL B₃ to all peers
  Time 3: B₂ arrives from Peer X
          wantlist = [B₄]               → send CANCEL B₂ to all peers
  Time 4: B₄ arrives from Peer Z
          wantlist = []                  → DONE!

  The CANCEL messages prevent duplicate transfers.
  No bandwidth is wasted downloading the same block twice.
```

### Anti-Freeloading: The Debt Ratio

```
═══════════════════════════════════════════════════════════════
LEDGER: Each peer pair tracks bytes exchanged
═══════════════════════════════════════════════════════════════

  For peers A ↔ B:
    bytes_sent(A→B) = total bytes A has sent to B
    bytes_recv(A←B) = total bytes A has received from B

  debt_ratio(A,B) = bytes_recv(A←B) / bytes_sent(A→B)

═══════════════════════════════════════════════════════════════
PROBABILITY OF SERVING: Sigmoid function
═══════════════════════════════════════════════════════════════

  P(serve peer) = 1 - 1/(1 + e^(6 - 3r))

  Where r = debt_ratio

  ┌──────────────────────┬──────────┬──────────────────────┐
  │ Behavior             │ r        │ P(serve)             │
  ├──────────────────────┼──────────┼──────────────────────┤
  │ Very generous (2:1)  │ 0.5      │ 98.9%                │
  │ Fair exchange (1:1)  │ 1.0      │ 95.3%                │
  │ Slight freeloader    │ 2.0      │ 50.0%                │
  │ Heavy freeloader     │ 3.0      │ 4.7%                 │
  │ Total freeloader     │ 5.0      │ 0.01%                │
  └──────────────────────┴──────────┴──────────────────────┘

  Share generously → get served first. Freeload → get ignored.
```

---

## 8. The Mathematics of Multi-Node Parallel Download

This is the core question: **how can a file stored across 2+ nodes be assembled correctly from pieces downloaded in parallel?**

### The Mathematical Framework

```
═══════════════════════════════════════════════════════════════
SETUP
═══════════════════════════════════════════════════════════════

  File F is split into n blocks: F = B₁ ∥ B₂ ∥ ... ∥ Bₙ
  
  The Merkle DAG gives us:
    Root CID = R
    Block CIDs: CID₁, CID₂, ..., CIDₙ
    Where CIDᵢ = SHA-256(Bᵢ)

  There are m peers: P₁, P₂, ..., Pₘ
  Each peer has a SUBSET of the blocks.

  Define availability matrix A[i,j]:
    A[i,j] = 1 if peer Pⱼ has block Bᵢ
    A[i,j] = 0 otherwise

  Example (4 blocks, 3 peers):
  
              Peer₁  Peer₂  Peer₃
    Block B₁ [  1      1      0  ]
    Block B₂ [  1      0      1  ]
    Block B₃ [  0      1      1  ]
    Block B₄ [  1      0      1  ]

  File is downloadable iff for every block Bᵢ:
    ∃j : A[i,j] = 1   (at least one peer has each block)

  Equivalently: every ROW of A has at least one 1.

═══════════════════════════════════════════════════════════════
THE DOWNLOAD ASSIGNMENT PROBLEM
═══════════════════════════════════════════════════════════════

  For each block Bᵢ, choose ONE peer to download from.
  
  Define assignment function: f(i) = j  (download block i from peer j)
  Constraint: A[i, f(i)] = 1 (peer must actually have the block)

  Optimization goal: minimize total download time.

  Let:
    latency(j)    = network round-trip time to peer j (ms)
    bandwidth(j)  = download speed from peer j (MB/s)
    chunk_size    = S bytes (256 KB)
    
    time(i,j) = latency(j) + chunk_size / bandwidth(j)

  Total time (parallel):
    T = max over all peers j of: Σ(time(i,j) for all i where f(i)=j)

  In plain English: total time = the time the SLOWEST peer finishes,
  since all peers download in parallel.

═══════════════════════════════════════════════════════════════
EXAMPLE: 4 blocks, 3 peers, parallel download
═══════════════════════════════════════════════════════════════

  Peer₁: bandwidth = 10 MB/s, latency = 20 ms, has B₁,B₂,B₄
  Peer₂: bandwidth = 5 MB/s,  latency = 50 ms, has B₁,B₃
  Peer₃: bandwidth = 8 MB/s,  latency = 30 ms, has B₂,B₃,B₄

  Each block = 256 KB = 0.256 MB

  Transfer time per block:
    From Peer₁: 20 + 256/10 = 20 + 25.6 = 45.6 ms
    From Peer₂: 50 + 256/5  = 50 + 51.2 = 101.2 ms
    From Peer₃: 30 + 256/8  = 30 + 32.0 = 62.0 ms

  STRATEGY A: Download everything from Peer₁ (sequential)
    Peer₁ has B₁,B₂,B₄ → 3 × 45.6 = 136.8 ms
    But Peer₁ doesn't have B₃ → must get from Peer₂: 101.2 ms
    Total (sequential from Peer₁ then B₃ from Peer₂):
      T = 136.8 + 101.2 = 238.0 ms

  STRATEGY B: Parallel from multiple peers
    B₁ from Peer₁: 45.6 ms     ┐
    B₂ from Peer₃: 62.0 ms     ├── all in PARALLEL
    B₃ from Peer₂: 101.2 ms    │
    B₄ from Peer₁: 45.6 ms     ┘
    
    Peer₁ handles B₁ then B₄: 45.6 + 45.6 = 91.2 ms
    Peer₂ handles B₃: 101.2 ms
    Peer₃ handles B₂: 62.0 ms
    
    T = max(91.2, 101.2, 62.0) = 101.2 ms

  Speedup: 238.0 / 101.2 = 2.35× faster!

═══════════════════════════════════════════════════════════════
THE VERIFICATION GUARANTEE
═══════════════════════════════════════════════════════════════

  Even though blocks came from 3 different (untrusted) peers:

  Block B₁ from Peer₁: SHA-256(B₁) == CID₁? ✓
  Block B₂ from Peer₃: SHA-256(B₂) == CID₂? ✓
  Block B₃ from Peer₂: SHA-256(B₃) == CID₃? ✓
  Block B₄ from Peer₁: SHA-256(B₄) == CID₄? ✓

  Then rebuild Merkle tree:
    H₁₂ = SHA-256(CID₁ ∥ CID₂)
    H₃₄ = SHA-256(CID₃ ∥ CID₄)
    Root = SHA-256(H₁₂ ∥ H₃₄) == R?  ✅ YES!

  NOBODY was trusted. MATH verified everything.
  Peer₁ could be a hacker. Peer₂ could be malicious. Peer₃ could be broken.
  Doesn't matter — if the hashes match, the data is authentic.
```

---

## 9. Deduplication — How Shared Chunks Save Space

Because IPFS identifies every block by its **content hash (CID)**, identical data is automatically stored only once — no matter how many files reference it.

```
═══════════════════════════════════════════════════════════════
THE CORE IDEA
═══════════════════════════════════════════════════════════════

  In traditional systems (HTTP, local filesystems):
    File A = "ABCDEFGH"  → stored as 8 bytes
    File B = "ABCDWXYZ"  → stored as 8 bytes
    Total storage: 16 bytes (even though "ABCD" is duplicated)

  In IPFS (chunk size = 2 bytes for this example):
    File A chunks: "AB" "CD" "EF" "GH"
    File B chunks: "AB" "CD" "WX" "YZ"

    Unique chunks stored:
      "AB" → CID_ab  (shared by A and B)
      "CD" → CID_cd  (shared by A and B)
      "EF" → CID_ef  (only in A)
      "GH" → CID_gh  (only in A)
      "WX" → CID_wx  (only in B)
      "YZ" → CID_yz  (only in B)

    Total unique chunks: 6 (not 8)
    Storage saved: 2 chunks = 25%

═══════════════════════════════════════════════════════════════
WHY THIS WORKS AUTOMATICALLY
═══════════════════════════════════════════════════════════════

  SHA-256 is DETERMINISTIC:
    SHA-256("AB") always = CID_ab, no matter who computes it.

  When File B is added:
    1. IPFS chunks it: "AB", "CD", "WX", "YZ"
    2. Computes CID for each chunk
    3. Checks blockstore: "Do I already have CID_ab?" → YES
    4. Skips storing "AB" again — it's already there!
    5. Same for "CD" → already exists → skip
    6. "WX" → NEW → store it
    7. "YZ" → NEW → store it

  The Merkle DAG for both files:

    File A root ─┬─► CID_ab ("AB")  ◄─┬─ File B root
                 ├─► CID_cd ("CD")  ◄─┤
                 ├─► CID_ef ("EF")    ├─► CID_wx ("WX")
                 └─► CID_gh ("GH")    └─► CID_yz ("YZ")

  CID_ab and CID_cd are stored ONCE but have TWO parents.
  This is why IPFS uses a DAG (Directed Acyclic Graph), not a tree —
  a node can have multiple parents.

═══════════════════════════════════════════════════════════════
REAL-WORLD SAVINGS
═══════════════════════════════════════════════════════════════

  Scenario: Software release v2.1 and v2.2

  v2.1 = 500 MB, split into 2,000 chunks of 256 KB each
  v2.2 = 500 MB, but only 50 MB changed (bug fixes)

  Without deduplication:
    Total storage: 500 + 500 = 1,000 MB

  With IPFS deduplication:
    Unchanged chunks: 1,800 (already stored from v2.1)
    New chunks: 200 (the changed 50 MB)
    Additional storage for v2.2: only 50 MB!
    Total storage: 500 + 50 = 550 MB

    Savings: 450 MB = 45% reduction

  For 10 minor versions of the same software:
    Without dedup: 10 × 500 = 5,000 MB
    With dedup: 500 + 9 × 50 = 950 MB (81% savings!)

═══════════════════════════════════════════════════════════════
MATHEMATICAL FORMULATION
═══════════════════════════════════════════════════════════════

  Given files F₁, F₂, ..., Fₖ, each split into chunk sets:
    chunks(Fᵢ) = { c : c is a chunk of Fᵢ }

  Without dedup: total blocks = Σᵢ |chunks(Fᵢ)|
  With dedup:    total blocks = | ∪ᵢ chunks(Fᵢ) |  (set union)

  Dedup ratio = 1 - |union| / |sum|

  The more overlap between files, the higher the savings.
  Identical files: 100% dedup (stored once regardless of copies).
  Completely unique files: 0% dedup (no shared chunks).

═══════════════════════════════════════════════════════════════
NETWORK-LEVEL DEDUPLICATION
═══════════════════════════════════════════════════════════════

  Dedup isn't just local — it works across the ENTIRE network!

  If 1,000 users upload the same file:
    → All 1,000 get the SAME CID
    → The network stores the chunks once (per node that has them)
    → Any node with the chunks can serve ANY of the 1,000 users

  This is fundamentally different from Dropbox/Google Drive:
    Dropbox: 1,000 users × 1 copy each = 1,000 copies (on their servers)
    IPFS: same content = same CID = naturally deduplicated
```

---

## 10. libp2p — The Networking Layer That Connects Everything

Kademlia DHT finds **who** has the data. Bitswap decides **which blocks** to exchange. But **libp2p** is the layer that actually establishes the network connection between two machines — handling all the messy real-world networking problems.

```
═══════════════════════════════════════════════════════════════
WHAT IS libp2p?
═══════════════════════════════════════════════════════════════

  libp2p is a modular networking stack — a library of protocols
  that handles everything between "I know Peer X exists" and
  "I am sending bytes to Peer X."

  IPFS without libp2p:
    "I know Peer X has my file."
    "But... how do I actually CONNECT to Peer X?"
    "Is Peer X behind a firewall? A NAT? Using IPv6? On mobile?"
    "What transport? TCP? UDP? WebSocket? QUIC?"
    "How do I even know Peer X is who they claim to be?"

  libp2p answers ALL of these questions.

═══════════════════════════════════════════════════════════════
THE LAYERED ARCHITECTURE
═══════════════════════════════════════════════════════════════

  ┌─────────────────────────────────────────────────┐
  │  APPLICATION (IPFS Bitswap, DHT, Pubsub)        │  ← Your app
  ├─────────────────────────────────────────────────┤
  │  MULTIPLEXING (yamux / mplex)                   │  ← Many streams
  │  Multiple logical streams over one connection   │     on one wire
  ├─────────────────────────────────────────────────┤
  │  SECURITY (TLS 1.3 / Noise)                     │  ← Encryption +
  │  Encrypted + authenticated channel              │     identity proof
  ├─────────────────────────────────────────────────┤
  │  TRANSPORT (TCP / QUIC / WebSocket / WebRTC)    │  ← Raw bytes
  │  The actual wire protocol                       │     on the network
  ├─────────────────────────────────────────────────┤
  │  PEER DISCOVERY (mDNS / DHT / Bootstrap)        │  ← "Who's out
  │  Finding peers on the network                   │     there?"
  ├─────────────────────────────────────────────────┤
  │  NAT TRAVERSAL (Hole Punching / Relay)          │  ← Getting past
  │  Connecting through firewalls                   │     firewalls
  └─────────────────────────────────────────────────┘
```

### Peer Identity: Every Node Has a Cryptographic ID

```
═══════════════════════════════════════════════════════════════
HOW PEER IDs WORK
═══════════════════════════════════════════════════════════════

  When an IPFS node starts for the first time:
    1. Generate an Ed25519 key pair: (private_key, public_key)
    2. PeerID = Multihash(public_key) = SHA-256(public_key)

  Example:
    PeerID: 12D3KooWA7r9gP4bJ...  (base58-encoded hash of public key)

  This means:
    ✅ PeerID is derived from the public key (verifiable)
    ✅ Only the owner has the matching private key
    ✅ Nobody can impersonate a PeerID without the private key
    ✅ Two nodes can verify each other's identity by exchanging keys

═══════════════════════════════════════════════════════════════
MULTIADDRESS: WHERE + HOW to reach a peer
═══════════════════════════════════════════════════════════════

  Traditional address: 192.168.1.5:4001 (IP + port — that's it)
  
  libp2p Multiaddress: self-describing, layered address

  Examples:
    /ip4/192.168.1.5/tcp/4001/p2p/12D3KooWA7r9gP4bJ...
    ─────────────── ──────── ───────────────────────────
    │               │        └─ Peer identity
    │               └─ Transport: TCP port 4001
    └─ Network: IPv4 address

    /ip6/::1/udp/4001/quic-v1/p2p/12D3KooWA7r9gP4bJ...
    (IPv6 + UDP + QUIC transport)

    /dns4/node.example.com/tcp/443/wss/p2p/12D3KooW...
    (DNS name + WebSocket Secure — works in browsers!)

  WHY MULTIADDRESS?
    A single peer might be reachable via MULTIPLE paths:
      - TCP on their home network
      - QUIC on their public IP
      - WebSocket through a web browser
      - Relay through another peer (if behind NAT)
    
    Multiaddress encodes ALL of this in a single string.
```

### Transport Protocols: How Bytes Actually Move

```
═══════════════════════════════════════════════════════════════
SUPPORTED TRANSPORTS
═══════════════════════════════════════════════════════════════

  ┌─────────────┬──────────────────────────────────────────────┐
  │ Transport   │ How it works                                 │
  ├─────────────┼──────────────────────────────────────────────┤
  │ TCP         │ Standard reliable connection (like HTTP)      │
  │             │ /ip4/1.2.3.4/tcp/4001                        │
  │             │ Reliable, works everywhere, but slow setup    │
  ├─────────────┼──────────────────────────────────────────────┤
  │ QUIC        │ UDP-based, built-in encryption (TLS 1.3)     │
  │             │ /ip4/1.2.3.4/udp/4001/quic-v1                │
  │             │ Faster setup (0-RTT), multiplexed natively   │
  │             │ PREFERRED in modern IPFS nodes               │
  ├─────────────┼──────────────────────────────────────────────┤
  │ WebSocket   │ HTTP-compatible (works in browsers)           │
  │             │ /dns4/node.com/tcp/443/wss                    │
  │             │ Lets browser-based IPFS nodes connect         │
  ├─────────────┼──────────────────────────────────────────────┤
  │ WebRTC      │ Browser-to-browser direct connections         │
  │             │ Supports NAT traversal natively               │
  │             │ Used for browser-to-browser IPFS              │
  └─────────────┴──────────────────────────────────────────────┘

  libp2p is TRANSPORT AGNOSTIC:
    The application (Bitswap, DHT) doesn't know or care
    whether bytes travel over TCP, QUIC, or WebSocket.
    libp2p abstracts it all behind the same interface.
```

### Connection Security: Encrypted and Authenticated

```
═══════════════════════════════════════════════════════════════
THE SECURITY HANDSHAKE
═══════════════════════════════════════════════════════════════

  When two peers connect, libp2p runs a security handshake:

  1. TRANSPORT CONNECT: raw TCP/QUIC/WebSocket connection established
  
  2. PROTOCOL NEGOTIATION: peers agree on security protocol
     "I support: [TLS 1.3, Noise]"
     "I support: [Noise, TLS 1.3]"
     → Both support Noise → use Noise

  3. KEY EXCHANGE (Noise XX handshake):
     Peer A → Peer B: ephemeral public key (eA)
     Peer B → Peer A: ephemeral public key (eB) + static key + proof
     Peer A → Peer B: static key + proof

     Shared secret = DH(eA, eB) combined with DH(static_A, static_B)

  4. RESULT:
     ✅ Encrypted channel (AES-256-GCM or ChaCha20-Poly1305)
     ✅ Peer A proved they own PeerID_A (signed with private key)
     ✅ Peer B proved they own PeerID_B (signed with private key)
     ✅ Man-in-the-middle IMPOSSIBLE (authenticated key exchange)

  After handshake: every byte is encrypted and authenticated.
  An eavesdropper sees only random bytes.
```

### Stream Multiplexing: Many Conversations, One Connection

```
═══════════════════════════════════════════════════════════════
THE PROBLEM
═══════════════════════════════════════════════════════════════

  IPFS needs to do MANY things with the same peer simultaneously:
    - Bitswap: "Send me blocks B₁, B₃, B₇"
    - DHT: "Who's close to CID QmXyz...?"
    - Identify: "What protocols do you support?"
    - Ping: "Are you still alive?"

  Opening a new TCP connection for each = slow and wasteful.

═══════════════════════════════════════════════════════════════
THE SOLUTION: MULTIPLEXING
═══════════════════════════════════════════════════════════════

  ONE physical connection → MANY logical streams

  Physical wire: ──────────────────────────────────────
                  │ Stream 1 │ Stream 2 │ Stream 3 │ ...
                  │ Bitswap  │ DHT      │ Ping     │
                  ──────────────────────────────────────

  Each stream is independent:
    - Stream 1 can send large blocks (Bitswap)
    - Stream 2 can do quick DHT queries
    - Stream 3 can ping every 15 seconds
    All SIMULTANEOUSLY, no blocking!

  Protocols:
    yamux: lightweight, fast (preferred)
    mplex: older, simpler
    QUIC: has multiplexing built-in (no extra layer needed!)
```

### NAT Traversal: Connecting When Firewalls Block You

```
═══════════════════════════════════════════════════════════════
THE PROBLEM: MOST COMPUTERS ARE BEHIND NAT
═══════════════════════════════════════════════════════════════

  NAT (Network Address Translation):
    Your home router gives you a private IP (192.168.1.x)
    The outside world sees your router's public IP (e.g., 103.45.67.89)
    
    You can CONNECT OUT (you initiated it, router remembers)
    Others CANNOT connect IN (router doesn't know where to send it)

  For IPFS this is critical:
    If both Peer A and Peer B are behind NAT,
    NEITHER can initiate a connection to the other!

═══════════════════════════════════════════════════════════════
SOLUTION 1: HOLE PUNCHING (peer-to-peer, no middleman)
═══════════════════════════════════════════════════════════════

  Uses a coordination server to help, but data flows directly.

  1. Peer A tells Relay R: "I'm behind NAT, my address is 192.168.1.5"
  2. Peer B tells Relay R: "I'm behind NAT, my address is 10.0.0.3"
  3. Relay R tells both: "Try connecting to each other NOW"
  4. Peer A sends packet to Peer B's public IP:port
     (A's router creates an outbound mapping)
  5. Peer B sends packet to Peer A's public IP:port
     (B's router creates an outbound mapping)
  6. The packets "punch holes" through both NATs
  7. Direct connection established! Relay R is no longer needed.

  Success rate: ~70-80% (depends on NAT type)

═══════════════════════════════════════════════════════════════
SOLUTION 2: RELAY (when hole punching fails)
═══════════════════════════════════════════════════════════════

  If both peers have "strict" NATs that can't be punched:

    Peer A ←→ Relay R ←→ Peer B

  Relay R forwards bytes between A and B.
  Slower (extra hop) but ALWAYS works.

  The relay address looks like:
    /ip4/1.2.3.4/tcp/4001/p2p/RelayPeerID/p2p-circuit/p2p/PeerB_ID
    
  "/p2p-circuit" means: "connect to PeerB via the relay"

═══════════════════════════════════════════════════════════════
SOLUTION 3: AutoNAT (automatic detection)
═══════════════════════════════════════════════════════════════

  libp2p automatically detects your NAT situation:

  1. Ask other peers: "Can you connect to me directly?"
  2. If YES → you're publicly reachable (no NAT problem)
  3. If NO → you're behind NAT → enable hole punching + relay
  
  This happens automatically — the user doesn't configure anything.
```

### Peer Discovery: Finding Other Nodes

```
═══════════════════════════════════════════════════════════════
HOW A NEW NODE FINDS ITS FIRST PEERS
═══════════════════════════════════════════════════════════════

  1. BOOTSTRAP NODES (hardcoded well-known nodes)
     New IPFS nodes come with a list of ~4 bootstrap peers.
     These are long-running, publicly reachable servers.
     → Connect to bootstrap → learn about other peers → build routing table

  2. mDNS (Local Network Discovery)
     Broadcasts on local network: "Any IPFS nodes here?"
     Peers on the same WiFi/LAN discover each other instantly.
     No internet needed — works fully offline on a local network!

  3. DHT RANDOM WALKS
     After connecting to a few peers, the node does random
     DHT lookups for random IDs. This populates k-buckets
     with diverse peers across the entire network.

  Typical node after 5 minutes:
    Connected peers: 50-200
    Known peers (routing table): 200-1000
    Can reach any CID in ~10 DHT hops
```

### How It All Fits Together: The Complete Connection Flow

```
═══════════════════════════════════════════════════════════════
EXAMPLE: Peer A wants block B₃ from Peer B
═══════════════════════════════════════════════════════════════

  1. DHT LOOKUP (Kademlia)
     A looks up CID(B₃) → finds provider record → "Peer B has it"
     Gets Peer B's multiaddress: /ip4/203.0.113.5/udp/4001/quic-v1/p2p/12D3KooWB...

  2. TRANSPORT (libp2p)
     A opens QUIC connection to 203.0.113.5:4001
     If B is behind NAT → try hole punching → if fails → use relay

  3. SECURITY (libp2p)
     Noise handshake: A and B prove their PeerIDs, derive shared key
     All further communication is encrypted

  4. MULTIPLEXING (libp2p)
     Open Stream 1 for Bitswap protocol "/ipfs/bitswap/1.2.0"

  5. BITSWAP (application)
     A sends on Stream 1: WANT CID(B₃)
     B sends on Stream 1: BLOCK B₃ (the actual bytes)

  6. VERIFICATION (IPFS)
     A computes: SHA-256(received_bytes) == CID(B₃)? ✅

  Total time: ~50-200 ms for a peer on the same continent.
  
  libp2p handled steps 2-4 transparently.
  Bitswap and DHT never worried about TCP vs QUIC,
  NAT traversal, or encryption — libp2p did it all.
```

---

## 11. The Complete Journey: How a File is PUT and GET

**This section explains the entire flow like a story — so even a 12th-class student can follow.**

### PART A: UPLOADING (Putting a File into IPFS)

```
═══════════════════════════════════════════════════════════════
STORY: User-X wants to store her project report (1 MB) on IPFS
═══════════════════════════════════════════════════════════════

User has a file: report.pdf (1 MB)
She runs an IPFS node on User-X's laptop.

STEP 1: CHUNKING (User-X's laptop/machine does this automatically)
─────────────────────────────────────────────────
  User-X's IPFS node splits the file into 4 chunks of 256 KB each:
    C₁ = first 256 KB
    C₂ = next 256 KB
    C₃ = next 256 KB
    C₄ = last 256 KB

  Think of it like tearing a book into 4 chapters.

STEP 2: HASHING (fingerprinting each chunk)
─────────────────────────────────────────────────
  User-X's node computes SHA-256 hash of each chunk:
    CID₁ = SHA-256(C₁) = "Qm1111..."
    CID₂ = SHA-256(C₂) = "Qm2222..."
    CID₃ = SHA-256(C₃) = "Qm3333..."
    CID₄ = SHA-256(C₄) = "Qm4444..."

  Think of it like: each chapter gets a unique fingerprint.

STEP 3: BUILDING MERKLE TREE (creating the file's identity)
─────────────────────────────────────────────────
  User-X's node builds the tree:
    H₁₂ = SHA-256(CID₁ + CID₂) = "Qm12ab..."
    H₃₄ = SHA-256(CID₃ + CID₄) = "Qm34cd..."
    ROOT = SHA-256(H₁₂ + H₃₄)  = "QmROOT..."

  The ROOT is the file's CID — the permanent address.
  User-X gets: "Your file CID is QmROOT..."

  Think of it like: the book gets an ISBN number computed from ALL chapters.

STEP 4: STORING LOCALLY (chunks saved on user machine)
─────────────────────────────────────────────────
  Her IPFS node stores all 4 chunks + the tree structure
  in a local database (the "blockstore").

  It's like putting the 4 chapters in User-X's personal filing cabinet.

STEP 5: ANNOUNCING TO THE NETWORK (telling the world)
─────────────────────────────────────────────────
  User-X's node uses Kademlia DHT to find the 20 nodes whose
  IDs are closest to "QmROOT..." (XOR distance).

  She sends each a "provider record":
    "Hey, I (User-X's node, IP: 192.168.1.5) have CID QmROOT..."

  Think of it like: User calls 20 phone operators and says
  "If anyone asks for ISBN-12345, tell them to call me."

  These 20 nodes are like phone book entries.
  They DON'T have the file — they just know WHO has it.

═══════════════════════════════════════════════════════════════
UPLOAD IS DONE! The file is:
  ✅ Chunked (4 pieces)
  ✅ Hashed (each piece has a unique CID)
  ✅ Tree-structured (Merkle DAG with root CID)
  ✅ Stored locally (on User's machine)
  ✅ Announced (20 DHT nodes know User-X has it)
═══════════════════════════════════════════════════════════════
```

### PART B: DOWNLOADING (Getting the File from IPFS)

```
═══════════════════════════════════════════════════════════════
STORY: User-Y wants to download User-X's report
═══════════════════════════════════════════════════════════════

User-Y  has: the CID "QmROOT..." (User-X shared it with him)
User-Y  runs his own IPFS node.

STEP 1: DHT LOOKUP (finding who has the file)
─────────────────────────────────────────────────
  User-Y's node queries the DHT:
    "Who has CID QmROOT...?"

  Using Kademlia iterative lookup (Section 6):
    Hop 1: Ask (User-Y's) nearest node → gets a closer node
    Hop 2: Ask that node → gets an even closer node
    ...
    Hop ~10: Reaches one of the 20 nodes storing User-X's provider record
    → "User-X (IP: 192.168.1.5) has QmROOT..."

  Think of it like: User-Y calls phone operators asking
  "Who has ISBN-12345?" Each operator points him closer
  until User-Y finds one that says "User-X has it, her number is..."

STEP 2: CONNECT TO User-X (direct peer connection)
─────────────────────────────────────────────────
  User-Y's node connects to User-X's node via libp2p.
  (TCP connection, possibly with NAT hole-punching)

STEP 3: DOWNLOAD THE MERKLE TREE (get the structure first)
─────────────────────────────────────────────────
  User-Y requests the root block: "WANT QmROOT..."
  User-X sends the root block, which contains:
    - Link to H₁₂ (CID: Qm12ab...)
    - Link to H₃₄ (CID: Qm34cd...)

  User-Y then requests H₁₂ and H₃₄, which contain:
    - Links to CID₁, CID₂, CID₃, CID₄

  Now User-Y knows ALL the chunk CIDs he needs.

STEP 4: PARALLEL DOWNLOAD (the magic!)
─────────────────────────────────────────────────
  User-Y's wantlist: [CID₁, CID₂, CID₃, CID₄]

  Maybe by now, User-Y also found:
    - Peer User-A has CID₁ and CID₂ 
    - UserX has all 4 chunks

  Bitswap kicks in:
    CID₁ ← from User-A (User-X's closer, faster)
    CID₂ ← from User-A
    CID₃ ← from User-X
    CID₄ ← from User-X

  ALL FOUR download IN PARALLEL from different peers!

STEP 5: VERIFY EVERY CHUNK (trust nobody, verify everything)
─────────────────────────────────────────────────
  For each chunk received:
    SHA-256(chunk_data) == expected CID?

    SHA-256(C₁_from_User-A) == CID₁? ✅ Yes → keep it
    SHA-256(C₂_from_User-B) == CID₂? ✅ Yes → keep it
    SHA-256(C₃_from_User-X)  == CID₃? ✅ Yes → keep it
    SHA-256(C₄_from_User-X)  == CID₄? ✅ Yes → keep it

  If User-A was malicious and sent fake data:
    SHA-256(fake_data) ≠ CID₁ → ❌ REJECT
    → Re-download CID₁ from Riya instead

STEP 6: REASSEMBLE (put the chapters back together)
─────────────────────────────────────────────────
  File = C₁ ∥ C₂ ∥ C₃ ∥ C₄  (concatenate in order)

  Final verification: rebuild Merkle tree from chunks
    → computed root == QmROOT...? ✅ Perfect!

  User-Y now has User-X's exact report. Not a single bit is different.

STEP 7: User-Y BECOMES A PROVIDER (paying it forward)
─────────────────────────────────────────────────
  Now User-Y's node ALSO has all 4 chunks.
  His node announces to the DHT:
    "I (User-Y) also have CID QmROOT..."

  Next person who wants the file can download from
  BOTH Riya AND User-Y — even faster!

  The more people download, the MORE available the file becomes.
  (Opposite of HTTP where more downloads = more server load!)

═══════════════════════════════════════════════════════════════
DOWNLOAD IS DONE! User-Y verified:
  ✅ Each chunk individually (SHA-256 hash)
  ✅ The complete tree (root CID matches)
  ✅ No trust needed in Riya or Meera — math proved it
  ✅ User-Y is now also a provider of the file
═══════════════════════════════════════════════════════════════
```

---

## 12. Why "InterPlanetary"? The Name Explained

```
═══════════════════════════════════════════════════════════════
THE MARS PROBLEM
═══════════════════════════════════════════════════════════════

  Distance from Earth to Mars: 55 to 400 million km
  Speed of light: 300,000 km/s
  
  One-way signal delay: 3 to 22 MINUTES
  Round-trip (request + response): 6 to 44 MINUTES

  With HTTP:
    1. Mars colonist requests website from Earth server
    2. Request travels 22 minutes to Earth
    3. Server processes (1 ms)
    4. Response travels 22 minutes back
    5. Total: 44 MINUTES for ONE web page!
    6. And if the Earth server is down? No page at all.

  With IPFS:
    1. Mars colonist requests CID bafybeig...
    2. Checks: does ANY node on Mars have this CID?
    3. Yes! Another Mars colonist downloaded it yesterday.
    4. Download from Mars peer: ~100 ms (local network speed)
    5. Verify: SHA-256(data) == CID? ✅ Guaranteed authentic!

═══════════════════════════════════════════════════════════════
WHY IPFS WORKS ACROSS PLANETS
═══════════════════════════════════════════════════════════════

  HTTP requires: a specific server at a specific location
    → Doesn't work when the server is 400 million km away

  IPFS requires: ANY node that has the content
    → Works perfectly! Content migrates to where it's needed.
    → First Mars download: slow (from Earth, 44 min round trip)
    → Every subsequent Mars request: fast (from local Mars cache)
    → The content's IDENTITY (CID) doesn't change regardless of planet.

  This is why Juan Benet (IPFS creator) named it
  "InterPlanetary File System" — it's designed to work
  even if nodes are on different planets with huge latency.

═══════════════════════════════════════════════════════════════
THE DEEPER PRINCIPLE
═══════════════════════════════════════════════════════════════

  Content addressing separates WHAT from WHERE.

  HTTP says: "I want data FROM earth-server.com"
    → Tied to a location (Earth)
    → If location unreachable, data unavailable

  IPFS says: "I want data WITH fingerprint bafybeig..."
    → Independent of location
    → Can come from Earth, Mars, Moon, or your neighbor
    → Same CID = same data, guaranteed by mathematics
    → Location is irrelevant — content identity is everything
```

---

## 13. The Persistence Problem — Pinning and Storage

```
═══════════════════════════════════════════════════════════════
THE PROBLEM: IPFS DOESN'T GUARANTEE FILES STAY AVAILABLE
═══════════════════════════════════════════════════════════════

  IPFS guarantees:
    ✅ INTEGRITY — the CID mathematically proves the content is authentic
    ✅ VERIFICATION — anyone can check any block using just the hash
    ❌ AVAILABILITY — nobody promises the file will stay online!

  Example:
    Day 1: Riya uploads report.pdf → CID: QmROOT...
           Riya's laptop is the only node with this file.
    Day 2: Riya closes her laptop and goes on vacation.
           Nobody has the file anymore.
           CID still exists, but nobody can serve the data.

  It's like having an ISBN for a book, but every library
  that had a copy burned down. The ISBN is valid, but
  you can't get the book.

═══════════════════════════════════════════════════════════════
GARBAGE COLLECTION: Why files disappear
═══════════════════════════════════════════════════════════════

  IPFS nodes have limited disk space.
  When space runs low, the node removes ("garbage collects")
  blocks it doesn't need — blocks it only has because it
  helped relay them for someone else.

  "Pinning" = telling your node: "NEVER delete this block"
  Unpinned blocks may be garbage collected at any time.

═══════════════════════════════════════════════════════════════
THREE SOLUTIONS TO PERSISTENCE
═══════════════════════════════════════════════════════════════

  1. RUN YOUR OWN NODE 24/7
     You keep your computer on forever, pin your files.
     ✅ Free, full control
     ❌ Your electricity bill, your hardware, your maintenance
     ❌ If your machine dies, files are gone

  2. PINNING SERVICE (remote pinning)
     Pay a service to run IPFS nodes that pin YOUR files.
     ✅ They're online 24/7 (professional servers)
     ✅ Simple API (just upload, they handle everything)
     ✅ Your files are always available via any IPFS gateway
     ❌ You trust the service to keep running
     ❌ Centralized (single provider)

  3. FILECOIN (decentralized storage)
     Pay storage providers using cryptocurrency.
     ✅ Decentralized, no single company
     ❌ Complex, expensive, requires crypto

═══════════════════════════════════════════════════════════════
WHAT A PINNING SERVICE ACTUALLY DOES
═══════════════════════════════════════════════════════════════

  A pinning service is like a 24/7 librarian for IPFS.

  Without a pinning service:
    You (the author) must be online for anyone to get your file.
    You go to sleep → file unavailable.

  With a pinning service:
    You upload file → they pin it on their IPFS nodes
    You go to sleep → their servers are still online
    Anyone can still download the file via the CID

  CRITICAL POINT:
    A pinning service doesn't change HOW IPFS works!
    The CID is still computed by SHA-256.
    The file is still verified by hash comparison.
    The service just keeps the data AVAILABLE.

    Pinning service = AVAILABILITY layer
    IPFS            = INTEGRITY + VERIFICATION layer

  If the service sent you fake data:
    SHA-256(fake_data) ≠ CID → you'd instantly detect it
    No pinning service CAN tamper with files — the math catches it
```

---

## 14. How Sherlock Uses IPFS (with Local Kubo Node)

```
═══════════════════════════════════════════════════════════════
WHAT SHERLOCK STORES ON IPFS
═══════════════════════════════════════════════════════════════

  1. Digital Signature Files (.sig)
     The cryptographic signature of software binaries.

  2. Public Key Files (.pem)
     The signer's public key for verification.

  3. Provenance Records
     JSON containing scan results, timestamps, signer identity.

═══════════════════════════════════════════════════════════════
THE UPLOAD FLOW (Local Kubo RPC API)
═══════════════════════════════════════════════════════════════

  Developer signs software → Sherlock app creates signature.sig

  1. Sherlock → Local Kubo RPC API:
     POST http://127.0.0.1:5001/api/v0/add?pin=true
     Body (FormData):
       file: signature.sig

  2. Local IPFS node (Kubo via IPFS Desktop):
     a. Chunks the file
     b. Computes Merkle tree → CID
     c. Stores and pins all blocks locally (~/.ipfs/blocks/)
     d. Announces CID to IPFS DHT (peers can discover it)

  3. Kubo responds:
     {
       "Name": "signature.sig",
       "Hash": "QmTYA2QSRMsPeyGAmGp1nXGKyhQCZo7rvM86TZof6Tfwsm",
       "Size": "256"
     }

  4. Sherlock inscribes on Hedera blockchain:
     { signatureCID: "QmTYA2QSRMs...", productId: "app-v2.1" }

  5. File is visible in IPFS Desktop → Files tab.

═══════════════════════════════════════════════════════════════
VIEWING UPLOADED FILES
═══════════════════════════════════════════════════════════════

  Your files are stored locally and accessible via:
    • IPFS Desktop → Files tab (shows all pinned files)
    • Local gateway: http://127.0.0.1:8080/ipfs/<CID>
    • Public gateway: https://ipfs.io/ipfs/<CID> (if node is online)
    • Any IPFS-compatible tool using the CID

═══════════════════════════════════════════════════════════════
LOCAL NODE vs REMOTE PINNING SERVICE: Key Differences
═══════════════════════════════════════════════════════════════

  ┌─────────────────────┬─────────────────────┬─────────────────────┐
  │ Feature             │ Cloud pin service   │ Local Kubo Node     │
  ├─────────────────────┼─────────────────────┼─────────────────────┤
  │ Storage location    │ Provider's servers  │ Your machine        │
  │ Availability        │ Always online       │ When IPFS Desktop   │
  │                     │ (managed service)   │ is running          │
  │ Cost                │ Free tier / paid    │ Free (your disk)    │
  │ Privacy             │ Data on their cloud │ Data stays local    │
  │ API keys needed     │ Yes (JWT token)     │ No (CORS only)      │
  │ Same CID?           │ ✅ Yes              │ ✅ Yes             │
  │ Same IPFS protocol? │ ✅ Yes              │ ✅ Yes             │
  │ Remote support      │ Built-in (cloud)    │ Via env vars        │
  └─────────────────────┴─────────────────────┴─────────────────────┘

  IMPORTANT: The IPFS protocol is IDENTICAL in both cases.
  Same file → same CID → same verification → same integrity guarantees.
  Only the STORAGE LOCATION differs.

═══════════════════════════════════════════════════════════════
REMOTE NODE CONFIGURATION
═══════════════════════════════════════════════════════════════

  To point Sherlock at an IPFS node on another machine,
  update .env:

    VITE_IPFS_RPC_URL=http://192.168.1.100:5001
    VITE_IPFS_GATEWAY_URL=http://192.168.1.100:8080

  The remote machine must:
    1. Have IPFS Desktop (or Kubo daemon) running
    2. Have CORS configured (see setup section in .env.example)
    3. Have ports 5001 and 8080 accessible

═══════════════════════════════════════════════════════════════
THE VERIFICATION FLOW
═══════════════════════════════════════════════════════════════

  Verifier wants to check if software is authentic:

  1. Read Hedera blockchain → get signatureCID: "QmTYA2QSRMs..."
  2. Fetch from IPFS (local gateway or any public gateway):
     GET http://127.0.0.1:8080/ipfs/QmTYA2QSRMs...
     — or —
     GET https://ipfs.io/ipfs/QmTYA2QSRMs...
  3. IPFS guarantees: SHA-256(received_data) == CID? ✅
  4. Use the signature + public key to verify the software binary
  5. If valid → software is authentic, untampered ✅

═══════════════════════════════════════════════════════════════
THE TRUST MODEL
═══════════════════════════════════════════════════════════════

  The verifier trusts NOBODY — only mathematics:
    ✗ Don't trust Sherlock → verify the signature yourself
    ✗ Don't trust the IPFS node → CID hash verification catches tampering
    ✗ Don't trust any gateway → same CID check applies
    ✗ Don't trust Hedera → it's a public blockchain, verify yourself

  Trust chain: Mathematics → SHA-256 → CID → Merkle verification
```

---

## 15. References

1. Benet, J. (2014). "IPFS - Content Addressed, Versioned, P2P File System." *arXiv:1407.3561*
2. Maymounkov, P. & Mazières, D. (2002). "Kademlia: A Peer-to-peer Information System Based on the XOR Metric." *IPTPS 2002*
3. Merkle, R. (1987). "A Digital Signature Based on a Conventional Encryption Function." *CRYPTO 1987*
4. NIST. (2015). "SHA-256: Secure Hash Standard." *FIPS PUB 180-4*
5. Protocol Labs. (2026). "IPFS Documentation." *https://docs.ipfs.tech*

---


