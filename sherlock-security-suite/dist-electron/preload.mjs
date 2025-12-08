"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("ipcRenderer", {
  on(channel, listener) {
    electron.ipcRenderer.on(channel, listener);
  },
  off(channel, listener) {
    electron.ipcRenderer.off(channel, listener);
  },
  invoke(channel, payload) {
    return electron.ipcRenderer.invoke(channel, payload);
  }
});
electron.contextBridge.exposeInMainWorld("electronWindow", {
  minimize: () => electron.ipcRenderer.invoke("window:minimize"),
  maximize: () => electron.ipcRenderer.invoke("window:maximize"),
  close: () => electron.ipcRenderer.invoke("window:close")
});
electron.contextBridge.exposeInMainWorld("electronAPI", {
  runRepoScan: (payload) => electron.ipcRenderer.invoke("scan:run", payload),
  onScanProgress: (cb) => {
    const listener = (_, data) => cb(data);
    electron.ipcRenderer.on("scan:progress", listener);
    return () => {
      electron.ipcRenderer.off("scan:progress", listener);
    };
  },
  llmQuery: (payload) => electron.ipcRenderer.invoke("llm:query", payload),
  onLLMStream: (cb) => {
    const listener = (_, data) => cb(data);
    electron.ipcRenderer.on("llm:stream", listener);
    return () => {
      electron.ipcRenderer.off("llm:stream", listener);
    };
  }
});
