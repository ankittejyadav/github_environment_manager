export interface Environment {
  name: string;
  url?: string;
  apiUrl?: string;
  repoName?: string; // Should be in format owner/repo
  repoUrl?: string;
  githubUrl?: string;
  status?:
    | "pending"
    | "created"
    | "error"
    | "completed"
    | "xmlsAdded"
    | "v1Created"
    | "promoting";
  xmlCount?: number;
  version?: string;
  errorMessage?: string;
  availableFolders?: string[];
  selectedFolder?: string;
  sourceEnvironment?: string;
  owner?: string; // GitHub username
  repo?: string; // Repository name without owner
}

export const ENVIRONMENTS = ["Dev", "QA", "UAT", "Prod"];

export interface PromotionResult {
  success: boolean;
  message: string;
  sourceRepo?: string;
  targetRepo?: string;
  folderName?: string;
}
