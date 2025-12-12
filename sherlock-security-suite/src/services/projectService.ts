import { Project, ProjectStatus } from "../models/Project";
import { AppUser } from "../models/User";
import { api } from "./project-service-api";

/* ======================================================
   IN-MEMORY DB
====================================================== */

let projectDB: Project[] = [
  {
    id: "1",
    name: "Threat Scanner",
    version: "1.2.0",
    description:
      "Automated threat detection and sandboxing engine.",
    projectDirector: "u1",
    securityHead: "u2",
    releaseEngineers: ["u3"],
    repos: [
      {
        repoUrl:
          "https://github.com/example/threat-scanner",
        branch: "main",
        gpgKey: "",
      },
    ],
    dependencies: ["Node", "Express", "Docker"],
    createdBy: "u1",
    createdAt: new Date().toISOString(),
    status: "Pending",
    history: [
      {
        status: "Pending",
        by: "u1",
        at: new Date().toISOString(),
        note: "Created",
      },
    ],
  },
  {
    id: "2",
    name: "Sherlock App",
    version: "1.2.0",
    description:
      "Automated threat detection and sandboxing engine.",
    projectDirector: "u1",
    securityHead: "u2",
    releaseEngineers: ["u3"],
    repos: [
      {
        repoUrl:
          "https://github.com/DevJayantaGhosh/Sherlock-Security-Suite-Services.git",
        branch: "main",
        gpgKey: "",
      },
    ],
    dependencies: ["Node", "Express", "Docker"],
    createdBy: "u1",
    createdAt: new Date().toISOString(),
    status: "Pending",
    history: [
      {
        status: "Pending",
        by: "u1",
        at: new Date().toISOString(),
        note: "Created",
      },
    ],
  },

  {
    id: "3",
    name: "Fileupload App",
    version: "1.2.0",
    description:
      "Automated threat detection and sandboxing engine.",
    projectDirector: "u1",
    securityHead: "u2",
    releaseEngineers: ["u3"],
    repos: [
      {
        repoUrl:
          "https://github.com/DevJayantaGhosh/large-fileupload-poc.git",
        branch: "main",
        gpgKey: "",
      },
    ],
    dependencies: ["Node", "Express", "Docker"],
    createdBy: "u1",
    createdAt: new Date().toISOString(),
    status: "Pending",
    history: [
      {
        status: "Pending",
        by: "u1",
        at: new Date().toISOString(),
        note: "Created",
      },
    ],
  },


  
];

/* ======================================================
   API STUBS
====================================================== */

export const apiGetProjects = async () =>
  api.get<Project[]>("/projects").then((r) => r.data);

export const apiCreateProject = async (
  payload: Project
) => api.post<Project>("/projects", payload);

export const apiUpdateProject = async (
  id: string,
  payload: Project
) => api.put<Project>(`/projects/${id}`, payload);

export const apiDeleteProject = async (id: string) =>
  api.delete(`/projects/${id}`);

/* ======================================================
   LOCAL CRUD
====================================================== */

export function getProjects(): Project[] {
  return [...projectDB];
}

export function createProject(
  payload: Omit<Project, "id" | "createdAt" | "history">
): Project {
  const newProject: Project = {
    ...payload,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: payload.status ?? "Pending",
    history: [
      {
        status: payload.status ?? "Pending",
        by: payload.createdBy,
        at: new Date().toISOString(),
        note: "Created",
      },
    ],
  };

  // ✅ ACTUAL INSERT
  projectDB.unshift(newProject);

  return newProject;
}

export function updateProject(
  project: Project
): Project {
  const idx = projectDB.findIndex(
    (p) => p.id === project.id
  );
  if (idx === -1)
    throw new Error(
      "Project not found"
    );

  projectDB[idx] = {
    ...project,
    updatedAt: new Date().toISOString(),
  };

  return projectDB[idx];
}

export function deleteProject(id: string) {
  projectDB = projectDB.filter(
    (p) => p.id !== id
  );
}

export function updateStatus(
  id: string,
  status: ProjectStatus,
  byUserId: string,
  note?: string
) {
  const p = projectDB.find(
    (x) => x.id === id
  );
  if (!p)
    throw new Error(
      "Project not found"
    );

  p.status = status;
  p.updatedAt = new Date().toISOString();
  p.updatedBy = byUserId;

  p.history = p.history || [];
  p.history.push({
    status,
    by: byUserId,
    at: new Date().toISOString(),
    note,
  });
}

/* ======================================================
   RBAC
====================================================== */

export function authorizeApprove(
  user: AppUser | null,
  project: Project
): boolean {
  if (!user) return false;
  if (user.role === "Admin") return true;
  if (user.role === "SecurityHead")
    return (
      project.securityHead === user.id
    );
  return false;
}

export function authorizeCreate(
  user: AppUser | null
): boolean {
  if (!user) return false;
  return (
    user.role === "Admin" ||
    user.role === "ProjectDirector"
  );
}

export function authorizeEdit(
  user: AppUser | null,
  project: Project
): boolean {
  if (!user) return false;
  if (project.status !== "Pending")
    return false;

  if (user.role === "Admin")
    return true;

  if (user.role === "ProjectDirector")
    return (
      project.createdBy === user.id
    );

  return false;
}

export function authorizeRelease(
  user: AppUser | null,
  project: Project
): boolean {
  if (!user) return false;
  if (user.role === "Admin")
    return true;

  return (
    user.role ===
      "ReleaseEngineer" &&
    project.releaseEngineers.includes(
      user.id
    )
  );
}
