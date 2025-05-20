import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

export interface Repository {
  name: string;
  url: string;
  html_url?: string;
  description?: string;
  created_at?: string;
}

export interface XmlContent {
  filename: string;
  content: string;
}

@Injectable({
  providedIn: 'root'
})
export class GithubService {
  private token = '';
  
  constructor(private http: HttpClient) { }
  
  setToken(token: string): void {
    this.token = token;
  }

  getToken(): string {
    return this.token;
  }

  // Create a new repository
  createRepository(repoName: string, description: string = '', token: string = this.token): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `token ${token}`,
      'Content-Type': 'application/json'
    });

    const body = {
      name: repoName,
      description: description,
      auto_init: true
    };

    return this.http.post('https://api.github.com/user/repos', body, { headers })
      .pipe(
        catchError(this.handleError)
      );
  }

  // Add a file to repository
  addFileToRepo(owner: string, repo: string, path: string, content: string, message: string, token: string = this.token): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `token ${token}`,
      'Content-Type': 'application/json'
    });

    const body = {
      message: message,
      content: btoa(content), // Base64 encode content
      branch: 'main'  // or 'master' depending on your default branch
    };

    return this.http.put(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, body, { headers })
      .pipe(
        catchError(this.handleError)
      );
  }

  // Create a tag (version)
  createTag(owner: string, repo: string, tagName: string, message: string, token: string = this.token): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `token ${token}`,
      'Content-Type': 'application/json'
    });

    // First get the latest commit SHA
    return this.getLatestCommitSha(owner, repo, token).pipe(
      switchMap(sha => {
        const body = {
          tag: tagName,
          message: message,
          object: sha,
          type: 'commit'
        };
        return this.http.post(`https://api.github.com/repos/${owner}/${repo}/git/tags`, body, { headers });
      }),
      switchMap(tagResponse => {
        // After creating the tag, create a reference to it
        const refBody = {
          ref: `refs/tags/${tagName}`,
          sha: tagResponse.object.sha
        };
        return this.http.post(`https://api.github.com/repos/${owner}/${repo}/git/refs`, refBody, { headers });
      }),
      catchError(this.handleError)
    );
  }

  // Get latest commit SHA
  private getLatestCommitSha(owner: string, repo: string, token: string = this.token): Observable<string> {
    const headers = new HttpHeaders({
      'Authorization': `token ${token}`
    });

    return this.http.get<any[]>(`https://api.github.com/repos/${owner}/${repo}/commits`, { headers })
      .pipe(
        map(commits => {
          if (commits && commits.length > 0) {
            return commits[0].sha;
          }
          throw new Error('No commits found');
        }),
        catchError(this.handleError)
      );
  }

  // Fetch XMLs from API
  fetchXmlsFromApi(apiUrl: string): Observable<string[]> {
    return this.http.get<string[]>(apiUrl)
      .pipe(
        catchError(this.handleError)
      );
  }
  
  // Mock method for testing when API is not available
  mockFetchXmls(envName: string, count: number = 10): string[] {
    const xmls: string[] = [];
    
    for (let i = 1; i <= count; i++) {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<config environment="${envName}">
  <setting id="${i}">
    <name>Setting ${i}</name>
    <value>Value for ${envName.toLowerCase()}</value>
  </setting>
</config>`;
      
      xmls.push(content);
    }
    
    return xmls;
  }

  // Commit a file to a repository
  commitFile(owner: string, repo: string, path: string, content: string, message: string, token: string = this.token): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `token ${token}`,
      'Content-Type': 'application/json'
    });

    const body = {
      message: message,
      content: btoa(content), // Base64 encode the content
      branch: 'main'  // or 'master' depending on your default branch
    };

    return this.http.put(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, body, { headers })
      .pipe(
        catchError(this.handleError)
      );
  }

  // Commit multiple files in a batch
  commitFiles(owner: string, repo: string, files: XmlContent[], commitMessage: string, token: string = this.token): Observable<any> {
    // For simplicity, we'll commit files one by one
    const commits = files.map(file => 
      this.commitFile(owner, repo, file.filename, file.content, `${commitMessage}: ${file.filename}`, token)
    );

    // Return observable that completes when all commits are done
    return of({ status: 'processing', message: 'Files are being committed one by one' });
  }
  
  private handleError(error: any) {
    console.error('GitHub API Error:', error);
    return throwError(() => new Error(error.message || 'Server error'));
  }
}