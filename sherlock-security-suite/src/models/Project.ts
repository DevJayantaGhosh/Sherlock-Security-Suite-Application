// src/models/project.ts
export type ProjectStatus = "Pending" | "Approved" | "Rejected" | "Released";

export interface Project {
  id: string;
  name: string;
  description?: string;
  projectDirector?: string | null; // user id
  securityHead?: string | null;    // user id
  releaseEngineers: string[];      // user ids
  gitRepo?: string;
  gpgKey?: string;
  dependencies?: string[];
  createdAt: string;
  updatedAt?: string;
  status: ProjectStatus;
}
