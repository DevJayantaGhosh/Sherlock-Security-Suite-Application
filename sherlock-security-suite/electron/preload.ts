import { ipcRenderer, contextBridge } from "electron";

// --------- IPC Wrapper ----------
contextBridge.exposeInMainWorld("ipcRenderer", {
  on(channel: string, listener: (...args: any[]) => void) {
    ipcRenderer.on(channel, listener);
  },

  off(channel: string, listener: (...args: any[]) => void) {
    ipcRenderer.off(channel, listener);
  },

  invoke(channel: string, payload?: any) {
    return ipcRenderer.invoke(channel, payload);
  },
});

// --------- WINDOW CONTROLS ----------
contextBridge.exposeInMainWorld("electronWindow", {
  minimize: () => ipcRenderer.invoke("window:minimize"),
  maximize: () => ipcRenderer.invoke("window:maximize"),
  close: () => ipcRenderer.invoke("window:close"),
});

// --------- SECURITY API ----------
contextBridge.exposeInMainWorld("electronAPI", {
  runRepoScan: (payload: {
    projectId: string;
    repoIndex: number;
    repoUrl: string;
    branch: string;
  }) =>
    ipcRenderer.invoke("scan:run", payload),

  onScanProgress: (cb: (p: any) => void) => {
    const listener = (_: any, data: any) => cb(data);
    ipcRenderer.on("scan:progress", listener);

    // ✅ Unsubscribe FIX
    return () => {
      ipcRenderer.off("scan:progress", listener);
    };
  },

  llmQuery: (payload: { sessionId: string; prompt: string }) =>
    ipcRenderer.invoke("llm:query", payload),

  onLLMStream: (cb: (d: any) => void) => {
    const listener = (_: any, data: any) => cb(data);
    ipcRenderer.on("llm:stream", listener);

    // ✅ Unsubscribe FIX
    return () => {
      ipcRenderer.off("llm:stream", listener);
    };
  },
});
