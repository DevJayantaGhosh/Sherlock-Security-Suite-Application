"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronWindow", {
  minimize: () => electron.ipcRenderer.invoke("window:minimize"),
  maximize: () => electron.ipcRenderer.invoke("window:maximize"),
  close: () => electron.ipcRenderer.invoke("window:close")
});
electron.contextBridge.exposeInMainWorld("electronAPI", {
  // GPG Verification
  verifyGPG: (payload) => electron.ipcRenderer.invoke("scan:verify-gpg", payload),
  // Gitleaks Scan
  runGitleaks: (payload) => electron.ipcRenderer.invoke("scan:gitleaks", payload),
  // Trivy Scan
  runTrivy: (payload) => electron.ipcRenderer.invoke("scan:trivy", payload),
  // CodeQL Scan with Component Configurations
  runCodeQL: (payload) => electron.ipcRenderer.invoke("scan:codeql", payload),
  // Cancel scan
  cancelScan: (payload) => electron.ipcRenderer.invoke("scan:cancel", payload),
  // Listen to logs
  onScanLog: (scanId, callback) => {
    const channel = `scan-log:${scanId}`;
    const handler = (_event, data) => callback(data);
    electron.ipcRenderer.on(channel, handler);
    return () => electron.ipcRenderer.removeListener(channel, handler);
  },
  // Listen to completion
  onScanComplete: (scanId, callback) => {
    const channel = `scan-complete:${scanId}`;
    const handler = (_event, data) => callback(data);
    electron.ipcRenderer.on(channel, handler);
    return () => electron.ipcRenderer.removeListener(channel, handler);
  }
});
