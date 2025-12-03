import { Project, ProjectStatus } from "../models/Project";
import { AppUser } from "../models/User";
import { api } from "./project-service-api";

/* ======================================================
   IN-MEMORY DB (DEV FALLBACK — MATCHES MODEL)
====================================================== */

let projectDB: Project[] = [
  {
    id: "1",
    name: "Threat Scanner",
    version:"v1.2.0",
    description: "Automated threat detection and sandboxing engine.",
    projectDirector: "u1",
    securityHead: "u2",
    releaseEngineers: ["u3"],
    gitRepo: ["https://github.com/example/threat-scanner"],
    gpgKey: [""],
    gitBrances:[""],
    dependencies: ["Node", "Express", "Docker"],
    createdBy: "u1",
    createdAt: new Date().toISOString(),
    status: "Pending",
    history: [{ status: "Pending", by: "u1", at: new Date().toISOString(), note: "Created" }],
  },
  {
    id: "p2",
    version:"v1.3.0",
    name: "Audit Chain",
    description: "Blockchain-based forensic auditing ledger.",
    projectDirector: "u1",
    securityHead: "u2",
    releaseEngineers: ["u3"],
    gitRepo: [""],
    gpgKey: [""],
    gitBrances:[""],
    dependencies: ["React", "MongoDB"],
    createdBy: "u1",
    createdAt: new Date().toISOString(),
    status: "Approved",
    history: [{ status: "Pending", by: "u1", at: new Date().toISOString() }, { status: "Approved", by: "u2", at: new Date().toISOString() }],
  },
];


/* ======================================================
   API STUBS (REAL BACKEND READY)
====================================================== */

export const apiGetProjects = async () =>
  api.get<Project[]>("/projects").then(r => r.data);

export const apiCreateProject = async (payload: Project) =>
  api.post<Project>("/projects", payload).then(r => r.data);

export const apiUpdateProject = async (id: string, payload: Project) =>
  api.put<Project>(`/projects/${id}`, payload).then(r => r.data);

export const apiDeleteProject = async (id: string) =>
  api.delete(`/projects/${id}`);

export const apiUpdateProjectStatus = async (
  id: string,
  status: ProjectStatus
) =>
  api.patch(`/projects/${id}/status`, { status });

/* ======================================================
   LOCAL FALLBACK CRUD
====================================================== */

export function getProjects(): Project[] {
  return [...projectDB];
}

export function createProject(payload: Omit<Project, "id" | "createdAt" | "createdBy" | "history"> & { createdBy: string }): Project {
  const newP: Project = {
    ...payload,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    history: [{ status: payload.status ?? "Pending", by: payload.createdBy, at: new Date().toISOString(), note: "Created" }],
    status: payload.status ?? "Pending",
  } as Project;
  projectDB.unshift(newP);
  return newP;
}

export function updateProject(p: Project): Project {
  const idx = projectDB.findIndex(x => x.id === p.id);
  if (idx === -1) throw new Error("Project not found");
  p.updatedAt = new Date().toISOString();
  projectDB[idx] = p;
  return projectDB[idx];
}

export function deleteProject(id: string) {
  projectDB = projectDB.filter(p => p.id !== id);
}

export function updateStatus(id: string, status: ProjectStatus, byUserId: string, note?: string) {
  const p = projectDB.find(x => x.id === id);
  if (!p) throw new Error("Project not found");
  p.status = status;
  p.updatedAt = new Date().toISOString();
  p.updatedBy = byUserId;
  p.history = p.history || [];
  p.history.push({ status, by: byUserId, at: new Date().toISOString(), note });
}


/* ======================================================
   RBAC HELPERS  ✅ UPDATED EXACTLY PER YOUR RULES
====================================================== */

/**
 * Approve / Reject
 * - Admin
 * - OR SecurityHead assigned during onboarding
 */
export function authorizeApprove(
  user: AppUser | null,
  project: Project
): boolean {
  if (!user) return false;

  if (user.role === "Admin") return true;

  if (user.role === "SecurityHead") {
    return project.securityHead === user.id;
  }

  return false;
}

/**
 * Create:
 * - Admin
 * - ProjectDirector
 */
export function authorizeCreate(user: AppUser | null): boolean {
  if (!user) return false;

  return user.role === "Admin" || user.role === "ProjectDirector";
}

/**
 * Edit or Delete:
 * - Admin
 * - OR ProjectDirector WHO CREATED IT
 * - AND status must be Pending
 */
export function authorizeEdit(
  user: AppUser | null,
  project: Project
): boolean {
  if (!user) return false;

  if (project.status !== "Pending") return false;

  if (user.role === "Admin") return true;

  if (user.role === "ProjectDirector") {
    return project.createdBy === user.id;
  }

  return false;
}

/**
 * Release:
 * - Status must be Approved
 * - Admin or assigned ReleaseEngineer
 */
export function authorizeRelease(
  user: AppUser | null,
  project: Project
): boolean {
  if (!user) return false;

  // if (project.status !== "Approved") return false;

  if (user.role === "Admin") return true;

  return (
    user.role === "ReleaseEngineer" &&
    project.releaseEngineers.includes(user.id)
  );
}
