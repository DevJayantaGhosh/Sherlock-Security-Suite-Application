//----------------------------------------------------------
// PROJECT RELEASE SERVICE
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
  time?: string;
}

export interface ReleaseRun {
  id: string;
  projectId: string;
  createdAt: string;
  steps: ReleaseStepState[];
}

/* ---------------- IN-MEMORY DB ---------------- */
const releases: ReleaseRun[] = [];

/* ---------------- PIPELINE -------------------- */
export const PIPELINE_STEPS: PipelineStep[] = [
  "Scan Repo",
  "Build",
  "Digital Signature",
  "Add to Blockchain",
  "Publish"
];

/* ------------------------------------------------
   BACKEND VERSION (WHEN READY)
---------------------------------------------------

export async function startRelease(projectId:string){
  return await api.post("/releases/start",{projectId})
}

export async function runStep(releaseId:string, step:PipelineStep){
  return await api.post("/releases/step",{releaseId, step})
}

export async function fetchReleases(projectId:string){
  return await api.get(`/releases/${projectId}`)
}

------------------------------------------------*/


/* ---------------- LOCAL MOCK ------------------ */

export function startRelease(projectId: string): ReleaseRun {
  const run: ReleaseRun = {
    id: crypto.randomUUID(),
    projectId,
    createdAt: new Date().toISOString(),
    steps: PIPELINE_STEPS.map(s => ({
      step: s,
      status: "pending",
      logs: []
    }))
  };

  releases.unshift(run);

  return run;
}

export function getReleases(projectId: string) {
  return releases.filter(r => r.projectId === projectId);
}

export function runStep(
  releaseId: string,
  step: PipelineStep,
  userId: string
) {
  const r = releases.find(x => x.id === releaseId);
  if (!r) return;

  const s = r.steps.find(x => x.step === step);
  if (!s) return;

  s.status = "running";
  s.executedBy = userId;
  s.time = new Date().toISOString();

  // mimic logs streaming
  s.logs.push(`Starting ${step}...`);
  s.logs.push("Connecting...");
  s.logs.push("Processing...");
  s.logs.push("✅ Completed successfully");

  s.status = "success";
}

export function retryStep(releaseId: string, step: PipelineStep, userId: string) {
  runStep(releaseId, step, userId);
}
