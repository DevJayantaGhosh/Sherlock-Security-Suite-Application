import { Project } from "../models/project";

// ------------------------------------------
// IN-MEMORY DATABASE WITH SAMPLE PROJECTS
// ------------------------------------------
let projectDB: Project[] = [
  {
    id: "p1",
    name: "Threat Scanner",
    description: "Automated threat detection and sandboxing engine.",
    teamLead: "John Doe",
    projectDirectorId: "u1",
    securityHeadId: "u2",
    releaseEngineersIds: ["u3"],
    gitRepo: "https://github.com/example/threat-scanner",
    gpgKey: "",
    dependencies: ["Node", "Express", "Docker"],
    createdAt: new Date().toISOString(),
    status: "Pending",
  },
    {
    id: "p1",
    name: "Threat Scanner",
    description: "Automated threat detection and sandboxing engine.",
    teamLead: "John Doe",
    projectDirectorId: "u1",
    securityHeadId: "u2",
    releaseEngineersIds: ["u3"],
    gitRepo: "https://github.com/example/threat-scanner",
    gpgKey: "",
    dependencies: ["Node", "Express", "Docker"],
    createdAt: new Date().toISOString(),
    status: "Pending",
  },
    {
    id: "p1",
    name: "Threat Scanner",
    description: "Automated threat detection and sandboxing engine.",
    teamLead: "John Doe",
    projectDirectorId: "u1",
    securityHeadId: "u2",
    releaseEngineersIds: ["u3"],
    gitRepo: "https://github.com/example/threat-scanner",
    gpgKey: "",
    dependencies: ["Node", "Express", "Docker"],
    createdAt: new Date().toISOString(),
    status: "Pending",
  },
    {
    id: "p1",
    name: "Threat Scanner",
    description: "Automated threat detection and sandboxing engine.",
    teamLead: "John Doe",
    projectDirectorId: "u1",
    securityHeadId: "u2",
    releaseEngineersIds: ["u3"],
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
    teamLead: "Emma Watson",
    projectDirectorId: "u1",
    securityHeadId: "u2",
    releaseEngineersIds: ["u3"],
    gitRepo: "",
    gpgKey: "",
    dependencies: ["React", "MongoDB"],
    createdAt: new Date().toISOString(),
    status: "Approved",
  }
];

// ------------------------------------------
// IN-MEMORY CRUD
// ------------------------------------------

export function getProjects(): Project[] {
  return [...projectDB];
}

export function createProject(p: Omit<Project, "id" | "createdAt">): Project {
  const newProj: Project = {
    ...p,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };

  projectDB.push(newProj);
  return newProj;
}

export function updateProject(p: Project): Project {
  const idx = projectDB.findIndex(x => x.id === p.id);
  if (idx !== -1) {
    projectDB[idx] = { ...p, updatedAt: new Date().toISOString() };
  }
  return projectDB[idx];
}

export function deleteProject(id: string) {
  projectDB = projectDB.filter(p => p.id !== id);
}

// ------------------------------------------
// REAL BACKEND API (COMMENTED OUT)
// ------------------------------------------
/*
export async function apiGetProjects() {
  const res = await fetch("/api/projects");
  return res.json();
}

export async function apiCreateProject(data: any) {
  return fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }).then(r => r.json());
}

export async function apiUpdateProject(id: string, data: any) {
  return fetch(`/api/projects/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }).then(r => r.json());
}

export async function apiDeleteProject(id: string) {
  return fetch(`/api/projects/${id}`, { method: "DELETE" });
}
*/
