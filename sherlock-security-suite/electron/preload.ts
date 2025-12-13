// electron/preload.ts
import { ipcRenderer, contextBridge } from "electron";

// --------- WINDOW CONTROLS ----------
contextBridge.exposeInMainWorld("electronWindow", {
  minimize: () => ipcRenderer.invoke("window:minimize"),
  maximize: () => ipcRenderer.invoke("window:maximize"),
  close: () => ipcRenderer.invoke("window:close"),
});

// --------- SECURITY SCAN API ----------
contextBridge.exposeInMainWorld("electronAPI", {
  // GPG Verification
  verifyGPG: (payload: { repoUrl: string; branch: string; scanId: string }) =>
    ipcRenderer.invoke("scan:verify-gpg", payload),
  
  // Gitleaks Scan
  runGitleaks: (payload: { repoUrl: string; branch: string; scanId: string }) =>
    ipcRenderer.invoke("scan:gitleaks", payload),
  
  // Cancel scan
  cancelScan: (payload: { scanId: string }) =>
    ipcRenderer.invoke("scan:cancel", payload),
  
  // Listen to logs
  onScanLog: (scanId: string, callback: (data: any) => void) => {
    const channel = `scan-log:${scanId}`;
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
  
  // Listen to completion
  onScanComplete: (scanId: string, callback: (data: any) => void) => {
    const channel = `scan-complete:${scanId}`;
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
});
