export type ProjectStatus =
  | "Pending"
  | "Approved"
  | "Rejected"
  | "Released";

export interface RepoConfig {
  repoUrl: string;
  branch: string;
  gpgKey: string;
}

export interface Project {
  id: string;

  name: string;
  version: string;
  description?: string;

  projectDirector?: string | null;
  securityHead?: string | null;
  releaseEngineers: string[];

  repos: RepoConfig[];

  dependencies?: string[];

  createdBy: string;
  createdAt: string;

  updatedBy?: string;
  updatedAt?: string;

  status: ProjectStatus;

  remark?: string;

  history?: {
    status: ProjectStatus;
    by: string;
    at: string;
    note?: string;
  }[];
}
