import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Environment, ENVIRONMENTS } from '../../models/environment.model';
import { EnvironmentService } from '../../services/environment.service';
import { GithubService, XmlContent } from '../../services/github.service';
import { XmlService } from '../../services/xml.service';
import { PromotionService } from '../../services/promotion.service';
import { HttpClient } from '@angular/common/http';
import { catchError, finalize, of } from 'rxjs';

@Component({
  selector: 'app-github-env-manager',
  templateUrl: './github-env-manager.component.html',
  styleUrls: ['./github-env-manager.component.scss']
})
export class GithubEnvManagerComponent implements OnInit {
  environmentForm: FormGroup;
  githubForm: FormGroup;
  environments: Environment[] = [];
  isCreatingRepos = false;
  isAddingXmls = false;
  isCreatingVersions = false;
  githubUsername = '';
  errorMessage = '';
  successMessage = '';

  constructor(
    private fb: FormBuilder,
    private environmentService: EnvironmentService,
    public githubService: GithubService,
    private xmlService: XmlService,
    private promotionService: PromotionService,
    private http: HttpClient
  ) {
    this.environmentForm = this.fb.group({});
    this.githubForm = this.fb.group({
      githubUrl: ['', Validators.required],
      githubToken: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.environments = this.environmentService.getEnvironments();
    this.initializeEnvironmentForm();
    this.loadAvailableFolders();
  }

  private initializeEnvironmentForm(): void {
    const group: { [key: string]: any } = {};
    this.environments.forEach(env => {
      group[env.name + 'ApiUrl'] = [env.apiUrl || '', Validators.required];
      group[env.name + 'RepoName'] = [env.repoName || '', Validators.required];
    });
    this.environmentForm = this.fb.group(group);
  }

  private loadAvailableFolders(): void {
    this.environments.forEach(env => {
      if (env.name !== 'Dev' && env.repoName) {
        this.promotionService.getAvailableFolders(env).subscribe(
          folders => {
            env.availableFolders = folders;
            const sourceEnv = this.promotionService.getSourceEnvironment(env);
            if (sourceEnv) {
              env.sourceEnvironment = sourceEnv.name;
            }
          }
        );
      }
    });
  }

  promoteFolder(targetEnv: Environment): void {
    if (!targetEnv.selectedFolder || !targetEnv.repoName) {
      this.errorMessage = 'Please select a folder to promote';
      return;
    }

    const sourceEnv = this.promotionService.getSourceEnvironment(targetEnv);
    if (!sourceEnv) {
      this.errorMessage = 'No source environment found for promotion';
      return;
    }

    targetEnv.status = 'promoting';
    this.errorMessage = '';
    this.successMessage = '';

    this.promotionService.promoteFolder(sourceEnv, targetEnv, targetEnv.selectedFolder)
      .subscribe({
        next: (result) => {
          if (result.success) {
            this.successMessage = result.message;
            targetEnv.status = 'completed';
            // Refresh available folders after promotion
            this.loadAvailableFolders();
          } else {
            this.errorMessage = result.message;
            targetEnv.status = 'error';
          }
        },
        error: (error) => {
          this.errorMessage = `Error during promotion: ${error.message}`;
          targetEnv.status = 'error';
        }
      });
  }

  saveEnvironmentSettings(): void {
    if (this.environmentForm.invalid) {
      this.errorMessage = 'Please fill in all required environment fields';
      return;
    }

    ENVIRONMENTS.forEach(envName => {
      const apiUrl = this.environmentForm.get(`${envName}ApiUrl`)?.value;
      const repoName = this.environmentForm.get(`${envName}RepoName`)?.value;
      
      this.environmentService.updateEnvironment(envName, {
        apiUrl,
        repoName,
        status: 'pending'
      });
    });

    this.environments = this.environmentService.getEnvironments();
    this.successMessage = 'Environment settings saved successfully';
    setTimeout(() => this.successMessage = '', 3000);
  }

  saveGithubSettings(): void {
    if (this.githubForm.invalid) {
      this.errorMessage = 'Please fill in all required GitHub fields';
      return;
    }

    const githubUrl = this.githubForm.get('githubUrl')?.value;
    const githubToken = this.githubForm.get('githubToken')?.value;
    
    // Extract username from GitHub URL
    const urlMatch = githubUrl.match(/github\.com\/([^\/]+)/);
    if (urlMatch && urlMatch[1]) {
      this.githubUsername = urlMatch[1];
    } else {
      this.errorMessage = 'Invalid GitHub URL format';
      return;
    }

    this.githubService.setToken(githubToken);
    this.successMessage = 'GitHub settings saved successfully';
    setTimeout(() => this.successMessage = '', 3000);
  }

  createRepositories(): void {
    if (!this.githubService.getToken()) {
      this.errorMessage = 'GitHub token not set. Please save GitHub settings first.';
      return;
    }

    this.isCreatingRepos = true;
    this.errorMessage = '';
    let completed = 0;

    this.environments.forEach(env => {
      if (!env.repoName) return;

      this.environmentService.updateEnvironment(env.name, { status: 'pending' }); 
      
      // Check if repo exists first
      this.githubService.checkRepositoryExists(this.githubUsername, env.repoName)
        .pipe(
          catchError(error => {
            this.environmentService.updateEnvironment(env.name, { 
              status: 'error',
              errorMessage: `Error checking repository: ${error.message}`
            });
            return of(false);
          }),
          finalize(() => {
            completed++;
            if (completed === this.environments.length) {
              this.isCreatingRepos = false;
            }
          })
        )
        .subscribe(exists => {
          if (exists) {
            this.environmentService.updateEnvironment(env.name, { 
              status: 'created',
              repoUrl: `https://github.com/${this.githubUsername}/${env.repoName}`
            });
          } else {
            // Create repo if it doesn't exist
            this.githubService.createRepository(env.repoName!, `Configuration repository for ${env.name} environment`)
              .pipe(
                catchError(error => {
                  this.environmentService.updateEnvironment(env.name, { 
                    status: 'error',
                    errorMessage: `Error creating repository: ${error.message}`
                  });
                  return of(null);
                })
              )
              .subscribe(repo => {
                if (repo) {
                  this.environmentService.updateEnvironment(env.name, { 
                    status: 'created',
                    repoUrl: repo.url
                  });
                }
              });
          }
        });
    });
  }

  addXmlsToRepositories(): void {
    if (!this.githubService.getToken()) {
      this.errorMessage = 'GitHub token not set. Please save GitHub settings first.';
      return;
    }

    this.isAddingXmls = true;
    this.errorMessage = '';
    let completed = 0;

    this.environments.forEach(env => {
      if (!env.repoName || !env.apiUrl || env.status !== 'created') {
        completed++;
        if (completed === this.environments.length) {
          this.isAddingXmls = false;
        }
        return;
      }

      this.environmentService.updateEnvironment(env.name, { status: 'pending' });
      
      // Try to fetch XMLs from API
      this.http.get<XmlContent[]>(env.apiUrl)
        .pipe(
          catchError(error => {
            console.warn(`Failed to fetch XMLs from API for ${env.name}: ${error.message}`);
            console.log('Using mock data instead');
            // Use mock data if API fails
            return of(this.xmlService.mockFetchXmls(env.name.toLowerCase(), 50));
          }),
          finalize(() => {
            completed++;
            if (completed === this.environments.length) {
              this.isAddingXmls = false;
            }
          })
        )
        .subscribe(xmls => {
          if (xmls && xmls.length > 0) {
            // Commit XMLs to repository
            this.githubService.commitFiles(
              this.githubUsername, 
              env.repoName!, 
              xmls, 
              `Adding configuration XMLs for ${env.name} environment`
            )
            .pipe(
              catchError(error => {
                this.environmentService.updateEnvironment(env.name, { 
                  status: 'error',
                  errorMessage: `Error adding XMLs: ${error.message}`
                });
                return of(null);
              })
            )
            .subscribe(result => {
              if (result) {
                this.environmentService.updateEnvironment(env.name, { 
                  status: 'xmlsAdded',
                  xmlCount: xmls.length
                });
              }
            });
          } else {
            this.environmentService.updateEnvironment(env.name, { 
              status: 'error',
              errorMessage: 'No XMLs found for this environment'
            });
          }
        });
    });
  }

  createV1Versions(): void {
    if (!this.githubService.getToken()) {
      this.errorMessage = 'GitHub token not set. Please save GitHub settings first.';
      return;
    }

    this.isCreatingVersions = true;
    this.errorMessage = '';
    let completed = 0;

    this.environments.forEach(env => {
      if (!env.repoName || env.status !== 'xmlsAdded') {
        completed++;
        if (completed === this.environments.length) {
          this.isCreatingVersions = false;
        }
        return;
      }

      this.environmentService.updateEnvironment(env.name, { status: 'pending' });
      
      // Create v1 tag/release
      this.githubService.createTag(
        this.githubUsername,
        env.repoName!,
        'v1.0.0',
        `Initial release for ${env.name} environment configuration`
      )
      .pipe(
        catchError(error => {
          this.environmentService.updateEnvironment(env.name, { 
            status: 'error',
            errorMessage: `Error creating version: ${error.message}`
          });
          return of(null);
        }),
        finalize(() => {
          completed++;
          if (completed === this.environments.length) {
            this.isCreatingVersions = false;
          }
        })
      )
      .subscribe(result => {
        if (result) {
          this.environmentService.updateEnvironment(env.name, { 
            status: 'v1Created',
            version: 'v1.0.0'
          });
        }
      });
    });
  }

  resetStatus(): void {
    this.errorMessage = '';
    this.successMessage = '';
  }
}