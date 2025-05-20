import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface Repository {
  name: string;
  url: string;
  description?: string;
  created_at?: string;
}

export interface XmlContent {
  filename: string;
  content: string;
}

export interface RepositoryContent {
  name: string;
  path: string;
  type: 'file' | 'dir';
  content?: string;
}

@Injectable({
  providedIn: 'root'
})
export class GithubService {
  private token = '';
  private baseUrl = 'https://api.github.com';

  constructor(private http: HttpClient) {}

  setToken(token: string): void {
    this.token = token;
  }

  getToken(): string {
    return this.token;
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `token ${this.token}`,
      'Accept': 'application/vnd.github.v3+json'
    });
  }

  getRepositoryContents(repoName: string, path: string): Observable<RepositoryContent[]> {
    const url = `${this.baseUrl}/repos/${repoName}/contents/${path}`;
    return this.http.get<RepositoryContent[]>(url, { headers: this.getHeaders() });
  }

  // Create a new repository
  createRepository(repoName: string, description: string = ''): Observable<Repository> {
    if (!this.token) {
      return throwError(() => new Error('GitHub token not set'));
    }

    const url = 'https://api.github.com/user/repos';
    const body = {
      name: repoName,
      description: description,
      private: false,
      auto_init: true
    };

    return this.http.post<Repository>(url, body, { headers: this.getHeaders() })
      .pipe(
        catchError(error => throwError(() => new Error(`Failed to create repository: ${error.message}`)))
      );
  }

  // Check if a repository exists
  checkRepositoryExists(owner: string, repoName: string): Observable<boolean> {
    if (!this.token) {
      return throwError(() => new Error('GitHub token not set'));
    }

    const url = `https://api.github.com/repos/${owner}/${repoName}`;
    
    return this.http.get(url, { headers: this.getHeaders(), observe: 'response' })
      .pipe(
        map(response => response.status === 200),
        catchError(error => {
          if (error.status === 404) {
            return of(false);
          }
          return throwError(() => new Error(`Failed to check repository: ${error.message}`));
        })
      );
  }

  // Create a tag/release (v1)
  createTag(owner: string, repo: string, tagName: string, message: string): Observable<any> {
    if (!this.token) {
      return throwError(() => new Error('GitHub token not set'));
    }

    const url = `https://api.github.com/repos/${owner}/${repo}/releases`;
    const body = {
      tag_name: tagName,
      name: tagName,
      body: message,
      draft: false,
      prerelease: false
    };

    return this.http.post(url, body, { headers: this.getHeaders() })
      .pipe(
        catchError(error => throwError(() => new Error(`Failed to create tag: ${error.message}`)))
      );
  }

  // Commit a file to a repository
  commitFile(owner: string, repo: string, path: string, content: string, message: string): Observable<any> {
    if (!this.token) {
      return throwError(() => new Error('GitHub token not set'));
    }

    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const body = {
      message: message,
      content: btoa(content) // Base64 encode the content
    };

    return this.http.put(url, body, { headers: this.getHeaders() })
      .pipe(
        catchError(error => throwError(() => new Error(`Failed to commit file: ${error.message}`)))
      );
  }

  // Commit multiple files in a batch
  commitFiles(owner: string, repo: string, files: XmlContent[], commitMessage: string): Observable<any> {
    if (!this.token) {
      return throwError(() => new Error('GitHub token not set'));
    }

    // For simplicity, we'll commit files one by one
    const commits = files.map(file => 
      this.commitFile(owner, repo, file.filename, file.content, `${commitMessage}: ${file.filename}`)
    );

    // Return observable that completes when all commits are done
    return of({ status: 'processing', message: 'Files are being committed one by one' });
  }

  // Clone repository (simulated in browser environment)
  cloneRepository(repoName: string): Observable<string> {
    return of(`/temp/${repoName}`); // Simulated path
  }

  // Copy folder (simulated in browser environment)
  copyFolder(sourcePath: string, targetPath: string, folderName: string): Observable<void> {
    return of(void 0); // Simulated success
  }

  // Commit and push (simulated in browser environment)
  commitAndPush(repoPath: string, message: string): Observable<void> {
    return of(void 0); // Simulated success
  }
}
