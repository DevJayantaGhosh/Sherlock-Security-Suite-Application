/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * The built directory structure
     *
     * ```tree
     * ├─┬─┬ dist
     * │ │ └── index.html
     * │ │
     * │ ├─┬ dist-electron
     * │ │ ├── main.js
     * │ │ └── preload.js
     * │
     * ```
     */
    APP_ROOT: string
    /** /dist/ or /public/ */
    VITE_PUBLIC: string
  }
}

// Used in Renderer process, expose in `preload.ts`
interface Window {
  ipcRenderer: import('electron').IpcRenderer

  electronWindow: {
    minimize: () => void
    maximize: () => void
    close: () => void
  }
  electronAPI: {
    runRepoScan: (payload: { projectId: string; repoIndex: number; repoUrl: string }) => Promise<{ runId: string }>;
    onScanProgress: (cb: (data: any) => void) => () => void;
    llmQuery: (payload: { sessionId: string; prompt: string }) => Promise<{ streamId: string }>;
    onLLMStream: (cb: (data: any) => void) => () => void;
    ping: () => Promise<string>;
  };
}
