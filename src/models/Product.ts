/* ======================================================
   PRODUCT MODEL
====================================================== */

export type ProductStatus =
  | "Pending"
  | "Approved"
  | "Rejected"
  | "Signed"
  | "Released";

export type ScanStatus = "idle" | "running" | "success" | "failed";

// ------------------------------------------------------------------
// SCAN RESULT MODELS
// ------------------------------------------------------------------

// Common base for all scan results
export interface BaseScanResult {
  status: ScanStatus;
  timestamp?: string; 
  logs?: string[];    
}

// 1. Signature Verification (Tool: GPG)
export interface SignatureVerificationResult extends BaseScanResult {
  summary?: {
    totalCommits: number;
    goodSignatures: number;
  };
}

// 2. Secret Detection (Tool : Gitleaks)
export interface SecretLeakDetectionResult extends BaseScanResult {
  summary?: {
    findings: number;
  };
}

// 3. Vulnerability Scan (Tool: Vulnerability-Scanner)
export interface VulnerabilityScanResult extends BaseScanResult {
  summary?: {
    vulnerabilities: number; // Total CVEs
    critical?: number;
    high?: number;
    medium?: number;
    low?: number;
  };
}



// Container for all scans on a single repo
export interface RepoScanResults {
  signatureVerification?: SignatureVerificationResult; 
  secretLeakDetection?: SecretLeakDetectionResult;             
  vulnerabilityScan?: VulnerabilityScanResult;         
             
}

// ------------------------------------------------------------------
// CORE ENTITIES
// ------------------------------------------------------------------

// Repository details
export interface RepoDetails {
  repoUrl: string;
  branch: string;
  
  // Centralized scan results for this repo
  scans?: RepoScanResults;
}

// Main Product entity
export interface Product {
  id: string;

  // Basic Info
  name: string;
  version: string;
  isOpenSource:boolean;
  description?: string;

  // Stakeholders
  productDirector?: string | null;
  securityHead?: string | null;
  releaseEngineers: string[];

  // Technical Details
  repos: RepoDetails[];           
  dependencies?: string[];        

  // Audit Trail
  createdBy: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt?: string;

  // Approval Workflow
  status: ProductStatus;
  remark?: string;
  securityScanReportPath?:string;
  signingReportPath?:string;
  releaseReportPath?:string;
  signatureFilePath?:string;
  publicKeyFilePath?:string;
}



// ------------------------------------------------------------------
// Product Management Service : ProductStatsResponseDTOs
// ------------------------------------------------------------------

export interface ProductStatsResponse {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  signed: number;
  released: number;
  openSource: number;
}