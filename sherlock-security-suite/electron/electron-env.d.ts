/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    APP_ROOT: string;
    VITE_PUBLIC: string;
  }
}

interface ComponentConfig {
  language: string;
  buildCommand?: string;
  workingDirectory?: string;
}

interface Window {
  electronWindow: {
    minimize(): void;
    maximize(): void;
    close(): void;
  };

  electronAPI: {
    verifyGPG(payload: { 
      repoUrl: string; 
      branch: string; 
      scanId: string 
    }): Promise<{
      success: boolean;
      cancelled?: boolean;
      error?: string;
      totalCommits?: number;
      goodSignatures?: number;
    }>;

    runGitleaks(payload: { 
      repoUrl: string; 
      branch: string; 
      scanId: string 
    }): Promise<{
      success: boolean;
      cancelled?: boolean;
      error?: string;
      findings?: number;
    }>;

    runTrivy(payload: { 
      repoUrl: string; 
      branch: string; 
      scanId: string 
    }): Promise<{
      success: boolean;
      cancelled?: boolean;
      error?: string;
      vulnerabilities?: number;
    }>;

    runOpenGrep(payload: { 
      repoUrl: string; 
      branch: string; 
      scanId: string;
      componentConfigs?: ComponentConfig[];
    }): Promise<{
      success: boolean;
      cancelled?: boolean;
      error?: string;
      totalIssues?: number;
      passedChecks?: number;
      failedChecks?: number;
    }>;

    cancelScan(payload: { scanId: string }): Promise<{ cancelled: boolean }>;

    onScanLog(
      scanId: string,
      callback: (data: {
        log: string;
        progress: number;
      }) => void
    ): () => void;

    onScanComplete(
      scanId: string,
      callback: (data: {
        success: boolean;
        totalCommits?: number;
        goodSignatures?: number;
        findings?: number;
        vulnerabilities?: number;
        totalIssues?: number;
        passedChecks?: number;
        failedChecks?: number;
        error?: string;
      }) => void
    ): () => void;
  };
}
