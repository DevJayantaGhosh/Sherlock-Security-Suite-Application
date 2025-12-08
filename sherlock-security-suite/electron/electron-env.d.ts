/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    APP_ROOT: string;
    VITE_PUBLIC: string;
  }
}

interface Window {
  electronAPI: {
    runRepoScan: (payload: {
      projectId: string;
      repoIndex: number;
      repoUrl: string;
      branch: string;
    }) => Promise<{ ok: boolean }>;

    onScanProgress: (
      cb: (data: any) => void
    ) => () => void;

    llmQuery: (payload: {
      sessionId: string;
      prompt: string;
    }) => Promise<any>;

    onLLMStream: (
      cb: (data: any) => void
    ) => () => void;
  };

  electronWindow: {
    minimize(): void;
    maximize(): void;
    close(): void;
  };

  ipcRenderer: {
    on(channel: string, fn: (...args: any[]) => void): void;
    off(channel: string, fn: (...args: any[]) => void): void;
    invoke(channel: string, payload?: any): Promise<any>;
  };
}
