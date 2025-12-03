"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("ipcRenderer", {
  on(...args) {
    const [channel, listener] = args;
    return electron.ipcRenderer.on(
      channel,
      (event, ...args2) => listener(event, ...args2)
    );
  },
  off(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.off(channel, ...omit);
  },
  send(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.send(channel, ...omit);
  },
  invoke(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.invoke(channel, ...omit);
  }
});
electron.contextBridge.exposeInMainWorld("electronWindow", {
  minimize: () => electron.ipcRenderer.invoke("window:minimize"),
  maximize: () => electron.ipcRenderer.invoke("window:maximize"),
  close: () => electron.ipcRenderer.invoke("window:close")
});
electron.contextBridge.exposeInMainWorld("electronAPI", {
  runRepoScan: (payload) => electron.ipcRenderer.invoke("scan:run", payload),
  // subscribe to scan progress
  onScanProgress: (cb) => {
    const wrapped = (_event, data) => cb(data);
    electron.ipcRenderer.on("scan:progress", wrapped);
    return () => electron.ipcRenderer.off("scan:progress", wrapped);
  },
  // LLM: streaming helper
  llmQuery: (payload) => electron.ipcRenderer.invoke("llm:query", payload),
  onLLMStream: (cb) => {
    const wrapped = (_event, data) => cb(data);
    electron.ipcRenderer.on("llm:stream", wrapped);
    return () => electron.ipcRenderer.off("llm:stream", wrapped);
  },
  ping: () => electron.ipcRenderer.invoke("ping")
});
