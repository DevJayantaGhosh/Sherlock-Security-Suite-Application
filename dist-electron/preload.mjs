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
  // OpenGrep SAST Scan
  runOpenGrep: (payload) => electron.ipcRenderer.invoke("scan:opengrep", payload),
  // Cryptographic Signing Workflow
  selectFolder: () => electron.ipcRenderer.invoke("dialog:select-folder"),
  selectFile: () => electron.ipcRenderer.invoke("dialog:select-file"),
  openFilePath: (filePath) => electron.ipcRenderer.invoke("dialog:open-file-path", filePath),
  generateKeys: (payload) => electron.ipcRenderer.invoke("crypto:generate-keys", payload),
  signArtifact: (payload) => electron.ipcRenderer.invoke("crypto:sign-artifact", payload),
  // GitHub Release Creation
  createGitHubRelease: (payload) => electron.ipcRenderer.invoke("release:github-create", payload),
  // Signature Verification
  verifySignature: (payload) => electron.ipcRenderer.invoke("verify:signature", payload),
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
