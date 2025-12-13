// electron/preload.ts
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

// --------- SECURITY SCAN API ----------
contextBridge.exposeInMainWorld("electronAPI", {
  verifyGPG: (payload: { repoUrl: string; branch: string; scanId: string }) =>
    ipcRenderer.invoke("scan:verify-gpg", payload),
  
  runGitleaks: (payload: { repoUrl: string; branch: string; scanId: string }) =>
    ipcRenderer.invoke("scan:gitleaks", payload),
  
  runTrivy: (payload: { repoUrl: string; branch: string; scanId: string }) =>
    ipcRenderer.invoke("scan:trivy", payload),
  
  runCodeQL: (payload: { repoUrl: string; branch: string; scanId: string }) =>
    ipcRenderer.invoke("scan:codeql", payload),
  
  // ✅ Non-blocking cancel - returns immediately
  cancelScan: (payload: { scanId: string }) => {
    ipcRenderer.send("scan:cancel-async", payload);
    return Promise.resolve({ cancelled: true });
  },
  
  onScanLog: (scanId: string, callback: (data: any) => void) => {
    const channel = `scan-log:${scanId}`;
    ipcRenderer.on(channel, (_event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners(channel);
  },
  
  onScanComplete: (scanId: string, callback: (data: any) => void) => {
    const channel = `scan-complete:${scanId}`;
    ipcRenderer.on(channel, (_event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners(channel);
  },
});
