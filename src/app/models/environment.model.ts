export interface Environment {
  name: string;
  url?: string;
  apiUrl?: string;
  repoName?: string;
  repoUrl?: string;
  githubUrl?: string;
  status?: 'pending' | 'created' | 'error' | 'completed' | 'xmlsAdded' | 'v1Created' | 'promoting';
  xmlCount?: number;
  version?: string;
  errorMessage?: string;
  availableFolders?: string[];
  selectedFolder?: string;
  sourceEnvironment?: string; // For fallback mechanism
}

export const ENVIRONMENTS = ['Dev', 'QA', 'UAT', 'Prod'];

export interface PromotionResult {
  success: boolean;
  message: string;
  sourceRepo?: string;
  targetRepo?: string;
  folderName?: string;
}
