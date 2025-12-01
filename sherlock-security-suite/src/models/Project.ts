export type ProjectStatus = "Pending" | "Approved" | "Rejected" | "Released";

export interface Project {
  id: string;
  name: string;
  description?: string;
  projectDirector?: string | null;
  securityHead?: string | null;
  releaseEngineers: string[]; // user ids
  gitRepo?: string[]; // list of repo URLs
  gpgKey?: string[];  // parallel list to gitRepo
  dependencies?: string[];
  createdBy: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt?: string;
  status: ProjectStatus;
  remark?: string;
  history?: { status: ProjectStatus; by: string; at: string; note?: string }[];
}
