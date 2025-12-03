import { ipcRenderer, contextBridge } from "electron";

// --------- Expose IPC + Window Controls to Renderer ---------
contextBridge.exposeInMainWorld("ipcRenderer", {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args;
    return ipcRenderer.on(channel, (event, ...args) =>
      listener(event, ...args)
    );
  },

  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args;
    return ipcRenderer.off(channel, ...omit);
  },

  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args;
    return ipcRenderer.send(channel, ...omit);
  },

  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args;
    return ipcRenderer.invoke(channel, ...omit);
  },
});



// WINDOW CONTROLS
contextBridge.exposeInMainWorld("electronWindow", {
  minimize: () => ipcRenderer.invoke("window:minimize"),
  maximize: () => ipcRenderer.invoke("window:maximize"),
  close: () => ipcRenderer.invoke("window:close"),
});

// ---------------- SECURITY API ----------------
/* Higher level helpers for scans */
contextBridge.exposeInMainWorld("electronAPI", {
  runRepoScan: (payload: any) => ipcRenderer.invoke("scan:run", payload),
  // subscribe to scan progress
  onScanProgress: (cb: (arg0: any) => any) => {
    const wrapped = (_event: any, data: any) => cb(data);
    ipcRenderer.on("scan:progress", wrapped);
    return () => ipcRenderer.off("scan:progress", wrapped);
  },
  // LLM: streaming helper
  llmQuery: (payload: any) => ipcRenderer.invoke("llm:query", payload),
  onLLMStream: (cb: (arg0: any) => any) => {
    const wrapped = (_event: any, data: any) => cb(data);
    ipcRenderer.on("llm:stream", wrapped);
    return () => ipcRenderer.off("llm:stream", wrapped);
  },

  ping: () => ipcRenderer.invoke("ping"),
});