export type ProjectStatus = 'Pending' | 'Approved' | 'Rejected' | 'Released';

export interface Project {
  id: string;
  name: string;
  description?: string;
  projectDirectorId?: string | null;
  securityHeadId?: string | null;
  releaseEngineersIds: string[]; 
  gitRepo?: string;
  gpgKey?: string;
  dependencies?: string[];
  createdAt: string;
  updatedAt?: string;
  status: ProjectStatus;
}
