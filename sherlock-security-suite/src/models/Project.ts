// src/models/project.ts
export type ProjectStatus = "Pending" | "Approved" | "Rejected" | "Released";

export interface Project {
  id: string;
  name: string;
  description?: string;
  projectDirector?: string | null; 
  securityHead?: string | null;    
  releaseEngineers: string[];      
  gitRepo?: string;
  gpgKey?: string;
  dependencies?: string[];
  createdAt: string;
  updatedAt?: string;
  status: ProjectStatus;
}
