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
  verifyGPG: (payload) => electron.ipcRenderer.invoke("scan:verify-gpg", payload),
  runGitleaks: (payload) => electron.ipcRenderer.invoke("scan:gitleaks", payload),
  runTrivy: (payload) => electron.ipcRenderer.invoke("scan:trivy", payload),
  runCodeQL: (payload) => electron.ipcRenderer.invoke("scan:codeql", payload),
  // ✅ Non-blocking cancel - returns immediately
  cancelScan: (payload) => {
    electron.ipcRenderer.send("scan:cancel-async", payload);
    return Promise.resolve({ cancelled: true });
  },
  onScanLog: (scanId, callback) => {
    const channel = `scan-log:${scanId}`;
    electron.ipcRenderer.on(channel, (_event, data) => callback(data));
    return () => electron.ipcRenderer.removeAllListeners(channel);
  },
  onScanComplete: (scanId, callback) => {
    const channel = `scan-complete:${scanId}`;
    electron.ipcRenderer.on(channel, (_event, data) => callback(data));
    return () => electron.ipcRenderer.removeAllListeners(channel);
  }
});
