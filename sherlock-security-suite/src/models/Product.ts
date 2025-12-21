/* ======================================================
   PRODUCT MODEL
====================================================== */

export type ProductStatus =
  | "Pending"
  | "Approved"
  | "Rejected"
  | "Released";

// Component configuration for monorepos/multi-component repos
export interface ComponentConfiguration {
  language: string;              // "java", "csharp", "python", etc.
  buildCommand?: string;         // "mvn clean compile -DskipTests"
  workingDirectory?: string;     // "backend-service-1" (relative to repo root)
}

// Repository details with component configurations
export interface RepoDetails {
  repoUrl: string;
  branch: string;
  componentConfigs?: ComponentConfiguration[];  // Multiple components per repo
}

// Main Product entity
export interface Product {
  id: string;

  // Basic Info
  name: string;
  version: string;
  description?: string;

  // Stakeholders
  productDirector?: string | null;
  securityHead?: string | null;
  releaseEngineers: string[];

  // Technical Details
  repos: RepoDetails[];           // Multiple repos per product
  dependencies?: string[];        // External dependencies

  // Audit Trail
  createdBy: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt?: string;

  // Approval Workflow
  status: ProductStatus;
  remark?: string;
}
