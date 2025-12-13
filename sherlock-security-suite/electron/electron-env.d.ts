/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    APP_ROOT: string;
    VITE_PUBLIC: string;
  }
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
        error?: string;
      }) => void
    ): () => void;
  };
}
