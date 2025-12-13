/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    APP_ROOT: string;
    VITE_PUBLIC: string;
  }
}

interface Window {
  ipcRenderer: {
    on(channel: string, fn: (...args: any[]) => void): void;
    off(channel: string, fn: (...args: any[]) => void): void;
    invoke(channel: string, payload?: any): Promise<any>;
  };

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
      vulns?: number;
    }>;

    runCodeQL(payload: { 
      repoUrl: string; 
      branch: string; 
      scanId: string 
    }): Promise<{
      success: boolean;
      cancelled?: boolean;
      error?: string;
    }>;

    // ✅ Non-blocking - returns immediately
    cancelScan(payload: { scanId: string }): Promise<{ cancelled: boolean }>;

    onScanLog(
      scanId: string,
      callback: (data: {
        tool: string;
        log: string;
        progress: number;
        repoUrl?: string;
        step?: string;
      }) => void
    ): () => void;

    onScanComplete(
      scanId: string,
      callback: (data: {
        tool: string;
        success: boolean;
        findings?: number;
        vulns?: number;
        totalCommits?: number;
        goodSignatures?: number;
        repoUrl?: string;
        step?: string;
      }) => void
    ): () => void;
  };
}
