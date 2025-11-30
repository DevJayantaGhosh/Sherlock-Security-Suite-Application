// src/services/projectService.ts
import { Project, ProjectStatus } from "../models/project";
import { AppUser } from "../models/User";

/**
 * In-memory DB
 * NOTE: fixed unique ids
 */
let projectDB: Project[] = [
  {
    id: "p1",
    name: "Threat Scanner",
    description: "Automated threat detection and sandboxing engine.",
    projectDirector: "u2",
    securityHead: "u3",
    releaseEngineers: ["u4"],
    gitRepo: "https://github.com/example/threat-scanner",
    gpgKey: "",
    dependencies: ["Node", "Express", "Docker"],
    createdAt: new Date().toISOString(),
    status: "Pending",
  },
  {
    id: "p2",
    name: "Audit Chain",
    description: "Blockchain-based forensic auditing ledger.",
    projectDirector: "u2",
    securityHead: "u3",
    releaseEngineers: ["u4"],
    gitRepo: "",
    gpgKey: "",
    dependencies: ["React", "MongoDB"],
    createdAt: new Date().toISOString(),
    status: "Approved",
  },
  {
    id: "p3",
    name: "Infra Monitor",
    description: "Infrastructure health & anomaly dashboard.",
    projectDirector: "u2",
    securityHead: "u3",
    releaseEngineers: ["u4"],
    gitRepo: "",
    gpgKey: "",
    dependencies: ["Prometheus", "Grafana"],
    createdAt: new Date().toISOString(),
    status: "Rejected",
  },
];

/* ===========================
   API stubs (commented)
   ===========================
const API = "/api/projects";

export async function apiGetProjects() {
  return fetch(API).then(r => r.json());
}
export async function apiCreateProject(payload) { ... }
export async function apiUpdateProject(id,payload) { ... }
export async function apiDeleteProject(id) { ... }
*/

/* ===========================
   Local implementations
   =========================== */

export function getProjects(): Project[] {
  return [...projectDB];
}

export function createProject(payload: Omit<Project, "id" | "createdAt">): Project {
  const newP: Project = {
    ...payload,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  projectDB.push(newP);
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

/* ===========================
   RBAC helpers (client-side enforcement)
   - authorizeApprove: only SecurityHead or Admin
   - authorizeCreate: ProjectDirector or Admin
   - authorizeEdit: ProjectDirector who created it (or Admin)
   - authorizeRelease: ReleaseEngineer assigned + status Approved
   NOTE: Real enforcement must exist on server.
   =========================== */

export function authorizeApprove(user: AppUser | null, project: Project): boolean {
  if (!user) return false;
  if (user.role === "Admin") return true;
  if (user.role === "SecurityHead") {
    // either assigned security head or global security head
    return project.securityHead ? project.securityHead === user.id : true;
  }
  return false;
}

export function authorizeCreate(user: AppUser | null): boolean {
  if (!user) return false;
  return user.role === "Admin" || user.role === "ProjectDirector";
}

export function authorizeEdit(user: AppUser | null, project: Project): boolean {
  if (!user) return false;
  if (user.role === "Admin") return true;
  if (user.role === "ProjectDirector") {
    return project.projectDirector === user.id;
  }
  return false;
}

export function authorizeRelease(user: AppUser | null, project: Project): boolean {
  if (!user) return false;
  if (project.status !== "Approved") return false;
  // release if user is Admin (global) or assigned release engineer
  if (user.role === "Admin") return true;
  return project.releaseEngineers.includes(user.id) && user.role === "ReleaseEngineer";
}
