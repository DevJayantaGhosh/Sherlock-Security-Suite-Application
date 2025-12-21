//----------------------------------------------------------
// PRODUCT RELEASE SERVICE
//----------------------------------------------------------

// 🟢 CURRENT MODE: In-memory simulation
// 🔴 LATER: Replace array operations with real API calls

export type PipelineStep =
  | "Scan Repo"
  | "Build"
  | "Digital Signature"
  | "Add to Blockchain"
  | "Publish";

export interface ReleaseStepState {
  step: PipelineStep;
  status: "pending" | "running" | "success" | "failed";
  logs: string[];
  executedBy?: string;
  executedAt?: string;  // ✅ Changed from 'time' for clarity
}

export interface ReleaseRun {
  id: string;
  productId: string;  // ✅ Changed from projectId
  createdAt: string;
  steps: ReleaseStepState[];
}

/* ---------------- IN-MEMORY DB ---------------- */
let releases: ReleaseRun[] = [];  // ✅ Changed to let for easier testing

/* ---------------- PIPELINE -------------------- */
export const PIPELINE_STEPS: PipelineStep[] = [
  "Scan Repo",
  "Build",
  "Digital Signature",
  "Add to Blockchain",
  "Publish",
];

/* ------------------------------------------------
   BACKEND VERSION (WHEN READY)
---------------------------------------------------

export async function startRelease(productId: string) {
  return await api.post("/releases/start", { productId });
}

export async function runStep(releaseId: string, step: PipelineStep, userId: string) {
  return await api.post("/releases/step", { releaseId, step, userId });
}

export async function retryStep(releaseId: string, step: PipelineStep, userId: string) {
  return await api.post("/releases/retry", { releaseId, step, userId });
}

export async function fetchReleases(productId: string) {
  return await api.get(`/releases/${productId}`);
}

export async function getReleaseById(releaseId: string) {
  return await api.get(`/releases/details/${releaseId}`);
}

------------------------------------------------*/

/* ---------------- LOCAL MOCK ------------------ */

/**
 * Start a new release run for a product
 */
export function startRelease(productId: string): ReleaseRun {
  const run: ReleaseRun = {
    id: crypto.randomUUID(),
    productId,  // ✅ Changed from projectId
    createdAt: new Date().toISOString(),
    steps: PIPELINE_STEPS.map((s) => ({
      step: s,
      status: "pending",
      logs: [],
    })),
  };

  releases.unshift(run);

  return run;
}

/**
 * Get all releases for a specific product
 */
export function getReleases(productId: string): ReleaseRun[] {
  return releases.filter((r) => r.productId === productId);  // ✅ Changed from projectId
}

/**
 * Get a specific release by ID
 */
export function getReleaseById(releaseId: string): ReleaseRun | undefined {
  return releases.find((r) => r.id === releaseId);
}

/**
 * Execute a pipeline step
 */
export function runStep(
  releaseId: string,
  step: PipelineStep,
  userId: string
): void {
  const r = releases.find((x) => x.id === releaseId);
  if (!r) {
    console.error(`Release ${releaseId} not found`);
    return;
  }

  const s = r.steps.find((x) => x.step === step);
  if (!s) {
    console.error(`Step ${step} not found in release ${releaseId}`);
    return;
  }

  // ✅ Prevent re-running successful steps
  if (s.status === "success") {
    console.warn(`Step ${step} already completed successfully`);
    return;
  }

  // ✅ Set to running state
  s.status = "running";
  s.executedBy = userId;
  s.executedAt = new Date().toISOString();  // ✅ Changed from 'time'
  s.logs = [];  // Clear previous logs

  // ✅ Simulate async operation with setTimeout
  setTimeout(() => {
    simulateStepExecution(s, step);
  }, 100);
}

/**
 * Retry a failed step
 */
export function retryStep(
  releaseId: string,
  step: PipelineStep,
  userId: string
): void {
  const r = releases.find((x) => x.id === releaseId);
  if (!r) {
    console.error(`Release ${releaseId} not found`);
    return;
  }

  const s = r.steps.find((x) => x.step === step);
  if (!s) {
    console.error(`Step ${step} not found in release ${releaseId}`);
    return;
  }

  // ✅ Reset step state before retry
  s.status = "pending";
  s.logs = [];
  s.executedBy = undefined;
  s.executedAt = undefined;

  // ✅ Re-run the step
  runStep(releaseId, step, userId);
}

/**
 * Simulate step execution with realistic logs
 */
function simulateStepExecution(s: ReleaseStepState, step: PipelineStep): void {
  // ✅ Step-specific logs
  switch (step) {
    case "Scan Repo":
      s.logs.push(`[${new Date().toISOString()}] 🔍 Starting repository scan...`);
      s.logs.push(`[${new Date().toISOString()}] 📂 Cloning repository...`);
      s.logs.push(`[${new Date().toISOString()}] 🔎 Running CodeQL analysis...`);
      s.logs.push(`[${new Date().toISOString()}] 📊 Analyzing dependencies...`);
      s.logs.push(`[${new Date().toISOString()}] ✅ Scan completed: 0 vulnerabilities found`);
      break;

    case "Build":
      s.logs.push(`[${new Date().toISOString()}] 🔨 Starting build process...`);
      s.logs.push(`[${new Date().toISOString()}] 📦 Installing dependencies...`);
      s.logs.push(`[${new Date().toISOString()}] ⚙️  Compiling source code...`);
      s.logs.push(`[${new Date().toISOString()}] 🧪 Running unit tests...`);
      s.logs.push(`[${new Date().toISOString()}] ✅ Build successful`);
      break;

    case "Digital Signature":
      s.logs.push(`[${new Date().toISOString()}] 🔐 Generating digital signature...`);
      s.logs.push(`[${new Date().toISOString()}] 🔑 Loading signing key...`);
      s.logs.push(`[${new Date().toISOString()}] ✍️  Signing artifact...`);
      s.logs.push(`[${new Date().toISOString()}] 🔒 Verifying signature...`);
      s.logs.push(`[${new Date().toISOString()}] ✅ Artifact signed successfully`);
      break;

    case "Add to Blockchain":
      s.logs.push(`[${new Date().toISOString()}] ⛓️  Connecting to blockchain...`);
      s.logs.push(`[${new Date().toISOString()}] 📝 Creating transaction...`);
      s.logs.push(`[${new Date().toISOString()}] ⏳ Waiting for confirmation...`);
      s.logs.push(`[${new Date().toISOString()}] 🔗 Transaction hash: 0x${Math.random().toString(16).slice(2, 18)}`);
      s.logs.push(`[${new Date().toISOString()}] ✅ Added to blockchain`);
      break;

    case "Publish":
      s.logs.push(`[${new Date().toISOString()}] 🚀 Starting deployment...`);
      s.logs.push(`[${new Date().toISOString()}] 📤 Uploading artifacts...`);
      s.logs.push(`[${new Date().toISOString()}] 🌐 Updating registry...`);
      s.logs.push(`[${new Date().toISOString()}] 📢 Notifying stakeholders...`);
      s.logs.push(`[${new Date().toISOString()}] ✅ Published successfully`);
      break;

    default:
      s.logs.push(`[${new Date().toISOString()}] ▶️  Starting ${step}...`);
      s.logs.push(`[${new Date().toISOString()}] ⏳ Processing...`);
      s.logs.push(`[${new Date().toISOString()}] ✅ Completed successfully`);
  }

  // ✅ Mark as success
  s.status = "success";

  // ✅ Simulate occasional failures (10% chance)
  if (Math.random() < 0.1) {
    s.status = "failed";
    s.logs.push(`[${new Date().toISOString()}] ❌ ERROR: Step failed`);
    s.logs.push(`[${new Date().toISOString()}] 💡 Hint: Click 'Retry' to run again`);
  }
}

/**
 * Clear all releases (for testing)
 */
export function clearReleases(): void {
  releases = [];
}

/**
 * Get all releases (for admin view)
 */
export function getAllReleases(): ReleaseRun[] {
  return [...releases];
}
