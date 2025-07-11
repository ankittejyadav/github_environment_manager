import { Injectable } from "@angular/core";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Observable, throwError, of, forkJoin } from "rxjs";
import { catchError, map, retry, delay, switchMap } from "rxjs/operators";

export interface XmlContent {
  filename: string;
  content: string;
}

export interface GithubContent {
  type: string;
  name: string;
  content?: string;
  path?: string;
  sha?: string;
  download_url?: string;
}

interface GitTag {
  object: {
    sha: string;
  };
}

@Injectable({
  providedIn: "root",
})
export class GithubService {
  private token = "";
  private storageKey = "github_token";
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 second

  constructor(private http: HttpClient) {
    // Try to load token from localStorage
    const storedToken = localStorage.getItem(this.storageKey);
    if (storedToken) {
      this.token = storedToken;
    }
  }

  setToken(token: string): void {
    this.token = token;
    // Save token to localStorage for persistence
    localStorage.setItem(this.storageKey, token);
  }

  getToken(): string {
    return this.token;
  }

  private getHeaders(token: string = this.token): HttpHeaders {
    if (!token) {
      throw new Error("GitHub token not set");
    }

    return new HttpHeaders({
      Authorization: `token ${token}`,
      "Content-Type": "application/json",
      Accept: "application/vnd.github.v3+json",
    });
  }

  // Helper to normalize XML content
  private normalizeXmlContent(data: any): XmlContent {
    let content =
      typeof data === "string"
        ? data
        : data.content || data.xml || JSON.stringify(data);
    let filename = data.filename || data.name || `config-${Date.now()}.xml`;

    if (!filename.toLowerCase().endsWith(".xml")) {
      filename += ".xml";
    }

    if (!content.includes("<?xml")) {
      content = `<?xml version="1.0" encoding="UTF-8"?>\n${content}`;
    }

    return { filename, content };
  }

  // Create mock XML data
  private createMockXmls(count: number = 5): XmlContent[] {
    const xmls: XmlContent[] = [];
    for (let i = 1; i <= count; i++) {
      const xml: XmlContent = {
        filename: `config-${i}.xml`,
        content: `<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <setting id="${i}">
    <n>Setting ${i}<n>
    <value>Value ${i}</value>
    <description>Test configuration ${i}</description>
    <timestamp>${new Date().toISOString()}</timestamp>
  </setting>
</configuration>`,
      };
      xmls.push(xml);
    }
    return xmls;
  }

  // Add a file to a repository
  addFileToRepo(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    token: string = this.token
  ): Observable<any> {
    if (!token) {
      return throwError(() => new Error("GitHub token not set"));
    }

    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const headers = this.getHeaders(token);
    const body = {
      message,
      content: btoa(unescape(encodeURIComponent(content))), // Handle UTF-8
      branch: "main",
    };

    return this.http.put(url, body, { headers }).pipe(
      retry(this.MAX_RETRIES),
      catchError((error) => {
        console.error(`Error committing file ${path}:`, error);
        if (error.status === 401) {
          throw new Error("GitHub token is invalid or expired");
        }
        throw new Error(`Failed to commit file: ${error.message}`);
      })
    );
  }

  // Create a repository
  createRepository(
    repoName: string,
    description: string = "",
    token: string = this.token
  ): Observable<any> {
    try {
      const headers = this.getHeaders(token);

      // Extract owner and repo name
      let owner: string;
      let repo: string;

      const parts = repoName.split("/");
      if (parts.length === 2) {
        [owner, repo] = parts;
      } else {
        // If no owner specified, use the authenticated user
        repo = repoName;
      }

      const body = {
        name: repo,
        description: description,
        auto_init: true,
        private: false,
      };

      return this.http
        .post(`https://api.github.com/user/repos`, body, { headers })
        .pipe(
          retry(this.MAX_RETRIES),
          catchError((error) => {
            console.error("Error creating repository:", error);
            if (error.status === 401) {
              throw new Error("GitHub token is invalid or expired");
            }
            throw new Error(`Failed to create repository: ${error.message}`);
          })
        );
    } catch (error) {
      return throwError(() => error);
    }
  }

  // Commit multiple files in a batch
  commitFiles(
    owner: string,
    repo: string,
    files: XmlContent[],
    message: string,
    token: string = this.token
  ): Observable<any[]> {
    try {
      if (!files.length) {
        return throwError(() => new Error("No files to commit"));
      }

      const headers = this.getHeaders(token);
      const batchSize = 5;
      const fileCommits: Observable<any>[] = [];

      // Process files in batches
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        const batchCommits = batch.map((file) => {
          const url = `https://api.github.com/repos/${owner}/${repo}/contents/${file.filename}`;
          const body = {
            message: `${message}: ${file.filename}`,
            content: btoa(unescape(encodeURIComponent(file.content))), // Handle UTF-8 characters properly
            branch: "main",
          };

          return this.http.put(url, body, { headers }).pipe(
            retry(this.MAX_RETRIES),
            catchError((error) => {
              console.error(`Error committing ${file.filename}:`, error);
              return of({ error, filename: file.filename });
            })
          );
        });

        fileCommits.push(...batchCommits);
      }

      return forkJoin(fileCommits).pipe(
        delay(this.RETRY_DELAY), // Add delay between batches
        catchError((error) => throwError(() => error))
      );
    } catch (error) {
      return throwError(() => error);
    }
  }

  // Create a tag/version
  createTag(
    owner: string,
    repo: string,
    tagName: string,
    message: string,
    token: string = this.token
  ): Observable<any> {
    try {
      return this.getLatestCommitSha(owner, repo, token).pipe(
        retry(this.MAX_RETRIES),
        map((sha) => {
          const headers = this.getHeaders(token);
          const body = {
            tag: tagName,
            message: message,
            object: sha,
            type: "commit",
          };

          return this.http
            .post<GitTag>(
              `https://api.github.com/repos/${owner}/${repo}/git/tags`,
              body,
              { headers }
            )
            .pipe(
              catchError((error) => {
                console.error("Error creating tag:", error);
                if (error.status === 401) {
                  throw new Error("GitHub token is invalid or expired");
                }
                throw new Error(`Failed to create tag: ${error.message}`);
              })
            );
        })
      );
    } catch (error) {
      return throwError(() => error);
    }
  }

  // Get latest commit SHA
  private getLatestCommitSha(
    owner: string,
    repo: string,
    token: string = this.token
  ): Observable<string> {
    try {
      const headers = this.getHeaders(token);

      return this.http
        .get<any[]>(`https://api.github.com/repos/${owner}/${repo}/commits`, {
          headers,
        })
        .pipe(
          map((commits) => {
            if (commits && commits.length > 0) {
              return commits[0].sha;
            }
            throw new Error("No commits found");
          }),
          catchError((error) => {
            console.error("Error getting latest commit SHA:", error);
            if (error.status === 401) {
              throw new Error("GitHub token is invalid or expired");
            }
            throw new Error(
              `Failed to get latest commit SHA: ${error.message}`
            );
          })
        );
    } catch (error) {
      return throwError(() => error);
    }
  }

  // Get repository contents
  getRepositoryContents(
    ownerAndRepo: string,
    path: string = ""
  ): Observable<GithubContent[]> {
    const [owner, repo] = ownerAndRepo.split("/");
    if (!owner || !repo) {
      return throwError(
        () =>
          new Error(
            "Invalid repository name format. Expected format: owner/repo"
          )
      );
    }

    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const headers = this.getHeaders();

    return this.http.get<GithubContent[]>(url, { headers }).pipe(
      retry(this.MAX_RETRIES),
      catchError((error) => {
        console.error(`Error fetching repository contents:`, error);
        if (error.status === 401) {
          throw new Error("GitHub token is invalid or expired");
        }
        throw new Error(
          `Failed to fetch repository contents: ${error.message}`
        );
      })
    );
  }

  // Commit a single file (alias for addFileToRepo for backward compatibility)
  commitFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string
  ): Observable<any> {
    return this.addFileToRepo(owner, repo, path, content, message);
  }

  // Check if a repository exists
  checkRepositoryExists(owner: string, repo: string): Observable<boolean> {
    if (!owner || !repo) {
      return of(false);
    }

    const url = `https://api.github.com/repos/${owner}/${repo}`;
    const headers = this.getHeaders();

    return this.http.get(url, { headers }).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  // Add files to repository with version folder (API-only)
  addFilesToRepo(
    owner: string,
    repo: string,
    files: XmlContent[],
    version: string = "V1",
    token: string = this.token
  ): Observable<any> {
    // Commit each file to the version folder in the repo using the GitHub API
    const commits: Observable<any>[] = files.map((file) => {
      const normalized = this.normalizeXmlContent(file);
      const path = `${version}/${normalized.filename}`;
      return this.addFileToRepo(
        owner,
        repo,
        path,
        normalized.content,
        `Add ${normalized.filename} to ${version}`,
        token
      );
    });
    return forkJoin(commits);
  }

  // Promote folder from source to target repo (API-only)
  promoteFolder(
    sourceOwner: string,
    sourceRepo: string,
    targetOwner: string,
    targetRepo: string,
    folderName: string,
    token: string = this.token
  ): Observable<any> {
    return this.getRepositoryContents(
      `${sourceOwner}/${sourceRepo}`,
      folderName
    ).pipe(
      map((contents: GithubContent[]) =>
        contents.filter((item) => item.type === "file")
      ),
      switchMap((files: GithubContent[]) => {
        if (!files.length) {
          return throwError(
            () => new Error(`No files found in folder ${folderName}`)
          );
        }
        const downloads = files.map((file) =>
          this.http
            .get(file.download_url || "", { responseType: "text" })
            .pipe(map((content) => ({ filename: file.name, content })))
        );
        return forkJoin(downloads);
      }),
      switchMap((xmls: XmlContent[]) =>
        this.addFilesToRepo(targetOwner, targetRepo, xmls, folderName, token)
      ),
      catchError((error) => {
        console.error("Error promoting folder:", error);
        return throwError(
          () =>
            new Error(
              `Failed to promote folder: ${
                error && error.message ? error.message : error
              }`
            )
        );
      })
    );
  }

  // Get available version folders in a repository (API-only)
  getFolders(
    owner: string,
    repo: string,
    token: string = this.token
  ): Observable<string[]> {
    return this.getRepositoryContents(`${owner}/${repo}`, "").pipe(
      map((contents: GithubContent[]) =>
        contents
          .filter((item) => item.type === "dir" && /^V\d+$/i.test(item.name))
          .map((item) => item.name)
          .sort((a, b) => {
            const verA = parseInt(a.replace(/[^\d]/g, "")) || 0;
            const verB = parseInt(b.replace(/[^\d]/g, "")) || 0;
            return verB - verA;
          })
      ),
      catchError((error) => {
        console.error("Error getting folders:", error);
        return throwError(
          () =>
            new Error(
              `Failed to get folders: ${
                error && error.message ? error.message : error
              }`
            )
        );
      })
    );
  }

  // Fallback logic for missing repos
  resolveRepo(envRepos: { [env: string]: string }, env: string): string {
    const order = ["prod", "stage", "qa", "dev"];
    const idx = order.indexOf(env.toLowerCase());
    for (let i = idx; i >= 0; i--) {
      const repo = envRepos[order[i]];
      if (repo) return repo;
    }
    throw new Error(`No repository found for environment: ${env}`);
  }
}
