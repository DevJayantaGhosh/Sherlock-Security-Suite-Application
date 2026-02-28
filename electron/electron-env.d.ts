/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    APP_ROOT: string;
    VITE_PUBLIC: string;
  }
}


interface Window {
  electronWindow: {
    minimize(): void;
    maximize(): void;
    close(): void;
  };

  electronAPI: {
    verifyGPG(payload: {
      repoUrl: string;
      branch: string;
      isQuickScan: boolean;
      githubToken : string;
      scanId: string
    }): Promise<{
      success: boolean;
      cancelled?: boolean;
      error?: string;
      totalCommits?: number;
      goodSignatures?: number;
    }>;

    runGitleaks(payload: {
      repoUrl: string;
      branch: string;
      isQuickScan: boolean;
      githubToken : string;
      scanId: string
    }): Promise<{
      success: boolean;
      cancelled?: boolean;
      error?: string;
      findings?: number;
    }>;

    runTrivy(payload: {
      repoUrl: string;
      branch: string;
      isQuickScan: boolean;
      githubToken : string;
      scanId: string
    }): Promise<{
      success: boolean;
      cancelled?: boolean;
      error?: string;
      vulnerabilities?: number;
    }>;

    runOpenGrep(payload: {
      repoUrl: string;
      branch: string;
      isQuickScan: boolean;
      githubToken : string;
      scanId: string;
    }): Promise<{
      success: boolean;
      cancelled?: boolean;
      error?: string;
      totalIssues?: number;
      passedChecks?: number;
      failedChecks?: number;
    }>;

    selectFolder(): Promise<string | null>;
    selectFile(): Promise<string | null>;
    openFilePath: (filePath: string) => Promise<void>;
    // Key Generation
    generateKeys(payload: {
      type: "rsa" | "ecdsa";
      size?: number;     // Optional (for RSA)
      curve?: string;    // Optional (for ECDSA)
      password?: string;
      outputDir: string;
      scanId: string;
    }): Promise<{ success: boolean; error?: string }>;

    // Artifact Signing (UPDATED)
    signArtifact(payload: {
      repoUrl: string;       
      branch: string;
      privateKeyPath: string;
      password?: string;
      isQuickScan: booleanl
      githubToken: string
      scanId: string;
    }): Promise<{ success: boolean; error?: string }>;


    // GitHub Release Creation
    createGitHubRelease(payload: {
      repoUrl: string;
      branch: string;
      version: string;
      scanId: string;
    }): Promise<{ success: boolean; error?: string }>;

    //Repo Signature Verification
    verifySignature(payload: {
      repoUrl: string;
      branch: string;
      version: string;
      publicKeyPath: string;
      signaturePath: string;
      isQuickScan: boolean;
      localRepoLocation: string;
      githubToken : string;
      scanId: string;
    }): Promise<{ 
      success: boolean; 
      verified: boolean;
      error?: string;
    }>;


    cancelScan(payload: { scanId: string }): Promise<{ cancelled: boolean }>;

    onScanLog(
      scanId: string,
      callback: (data: {
        log: string;
        progress: number;
      }) => void
    ): () => void;

    onScanComplete(
      scanId: string,
      callback: (data: {
        success: boolean;
        totalCommits?: number;
        goodSignatures?: number;
        findings?: number;
        vulnerabilities?: number;
        totalIssues?: number;
        passedChecks?: number;
        failedChecks?: number;
        error?: string;
      }) => void
    ): () => void;
  };
}
