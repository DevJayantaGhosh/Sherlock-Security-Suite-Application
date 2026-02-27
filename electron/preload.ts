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
  verifyGPG: (payload: { repoUrl: string; branch: string; isQuickScan: boolean; githubToken : string; scanId: string  }) =>
    ipcRenderer.invoke("scan:verify-gpg", payload),
  
  // Gitleaks Scan
  runGitleaks: (payload: { repoUrl: string; branch: string; isQuickScan: boolean; githubToken : string; scanId: string }) =>
    ipcRenderer.invoke("scan:gitleaks", payload),
  
  // Trivy Scan
  runTrivy: (payload: { repoUrl: string; branch: string; isQuickScan: boolean; githubToken : string; scanId: string }) =>
    ipcRenderer.invoke("scan:trivy", payload),
  
  // OpenGrep SAST Scan
  runOpenGrep: (payload: { 
    repoUrl: string; 
    branch: string; 
    isQuickScan: boolean;
    githubToken : string;
    scanId: string;
  }) =>
    ipcRenderer.invoke("scan:opengrep", payload),
  
  // Cryptographic Signing Workflow
  selectFolder: () => ipcRenderer.invoke("dialog:select-folder"),
  selectFile: () => ipcRenderer.invoke("dialog:select-file"),
  
  generateKeys: (payload: any) => ipcRenderer.invoke("crypto:generate-keys", payload),
  signArtifact: (payload: any) => ipcRenderer.invoke("crypto:sign-artifact", payload),

   // GitHub Release Creation
  createGitHubRelease: (payload: any) => ipcRenderer.invoke("release:github-create", payload),

  // Signature Verification
  verifySignature: (payload: any) => ipcRenderer.invoke("verify:signature", payload),

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
