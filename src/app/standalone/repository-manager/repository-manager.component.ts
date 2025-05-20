import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { GithubService } from '../../services/github/github.service';
import { XmlContent } from '../../services/github.service';
import { XmlService } from '../../services/xml.service';
import { EnvironmentService } from '../../services/environment.service';
import { Environment } from '../../models/environment.model';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-repository-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule, MatCardModule, MatButtonModule, MatInputModule, MatSelectModule, MatIconModule, MatProgressBarModule],
  templateUrl: './repository-manager.component.html',
  styleUrls: ['./repository-manager.component.scss'],
  providers: [GithubService, XmlService, EnvironmentService]
})
export class RepositoryManagerComponent {
  githubUsername = '';
  githubToken = '';
  githubUrl = '';
  
  selectedEnv: Environment | null = null;
  apiUrl = '';
  loading = false;
  message = '';
  error = '';
  
  constructor(
    private githubService: GithubService,
    private xmlService: XmlService,
    public envService: EnvironmentService
  ) {}

  selectEnvironment(env: Environment): void {
    this.selectedEnv = env;
    this.apiUrl = env.apiUrl;
  }

  updateApiUrl(): void {
    if (this.selectedEnv) {
      this.envService.updateEnvironment(this.selectedEnv.name, { apiUrl: this.apiUrl });
      this.message = `API URL updated for ${this.selectedEnv.name}`;
      setTimeout(() => this.message = '', 3000);
    }
  }

  setGithubToken(): void {
    this.githubService.setToken(this.githubToken);
    this.message = 'GitHub token set successfully';
    setTimeout(() => this.message = '', 3000);
  }

  parseGithubUrl(): { owner: string, repo: string } | null {
    try {
      // Extract owner and repo from URL like https://github.com/owner/repo
      const urlParts = this.githubUrl.split('/');
      const owner = urlParts[urlParts.length - 2];
      const repo = urlParts[urlParts.length - 1];
      return { owner, repo };
    } catch (e) {
      this.error = 'Invalid GitHub URL format. Expected format: https://github.com/owner/repo';
      setTimeout(() => this.error = '', 5000);
      return null;
    }
  }

  createRepositories(): void {
    if (!this.githubService.getToken()) {
      this.error = 'Please set GitHub token first';
      setTimeout(() => this.error = '', 5000);
      return;
    }

    if (!this.githubUsername) {
      this.error = 'Please enter GitHub username';
      setTimeout(() => this.error = '', 5000);
      return;
    }

    this.loading = true;
    this.message = 'Creating repositories...';
    
    // Process each environment
    const environments = this.envService.getEnvironments();
    let completed = 0;

    environments.forEach(env => {
      const repoName = env.repoName;
      
      this.githubService.createRepository(repoName, `Configuration repository for ${env.name} environment`)
        .pipe(
          finalize(() => {
            completed++;
            if (completed === environments.length) {
              this.loading = false;
              this.message = 'All repositories created successfully!';
              setTimeout(() => this.message = '', 5000);
            }
          })
        )
        .subscribe({
          next: (repo) => {
            this.envService.updateEnvironment(env.name, { 
              githubUrl: repo.url,
              status: 'created' 
            });
          },
          error: (err) => {
            this.envService.updateEnvironment(env.name, { 
              status: 'error',
              errorMessage: err.message 
            });
            this.error = `Error creating ${env.name} repository: ${err.message}`;
            setTimeout(() => this.error = '', 5000);
          }
        });
    });
  }

  fetchAndCommitXmls(env: Environment): void {
    if (!this.githubService.getToken()) {
      this.error = 'Please set GitHub token first';
      setTimeout(() => this.error = '', 5000);
      return;
    }

    if (!env.apiUrl) {
      this.error = `API URL for ${env.name} is not set`;
      setTimeout(() => this.error = '', 5000);
      return;
    }

    this.loading = true;
    this.message = `Fetching XMLs for ${env.name}...`;

    // For demo purposes, we'll use mock data
    // In a real app, you would use: this.xmlService.fetchXmlsFromApi(env.apiUrl)
    const xmls = this.xmlService.mockFetchXmls(env.name.toLowerCase());
    
    this.githubService.commitFiles(this.githubUsername, env.repoName, xmls, `Adding ${env.name} configuration files`)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.message = `XMLs committed to ${env.name} repository`;
          setTimeout(() => this.message = '', 5000);
        })
      )
      .subscribe({
        next: () => {
          this.envService.updateEnvironment(env.name, { status: 'xmlsAdded' });
        },
        error: (err) => {
          this.envService.updateEnvironment(env.name, { 
            status: 'error',
            errorMessage: err.message 
          });
          this.error = `Error committing XMLs to ${env.name} repository: ${err.message}`;
          setTimeout(() => this.error = '', 5000);
        }
      });
  }

  createV1Tag(env: Environment): void {
    if (!this.githubService.getToken()) {
      this.error = 'Please set GitHub token first';
      setTimeout(() => this.error = '', 5000);
      return;
    }

    this.loading = true;
    this.message = `Creating V1 tag for ${env.name}...`;

    this.githubService.createTag(
      this.githubUsername, 
      env.repoName, 
      'v1.0.0', 
      `Initial release for ${env.name} environment`
    )
    .pipe(
      finalize(() => {
        this.loading = false;
        this.message = `V1 tag created for ${env.name} repository`;
        setTimeout(() => this.message = '', 5000);
      })
    )
    .subscribe({
      next: () => {
        this.envService.updateEnvironment(env.name, { status: 'v1Created' });
      },
      error: (err) => {
        this.envService.updateEnvironment(env.name, { 
          status: 'error',
          errorMessage: err.message 
        });
        this.error = `Error creating V1 tag for ${env.name} repository: ${err.message}`;
        setTimeout(() => this.error = '', 5000);
      }
    });
  }
}
