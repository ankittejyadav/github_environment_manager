import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatStepperModule } from '@angular/material/stepper';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { GithubService } from '../../services/github/github.service';
import { Environment, ENVIRONMENTS } from '../../models/environment.model';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize, switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-github-repo-manager',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatCardModule,
    MatProgressBarModule,
    MatStepperModule,
    MatIconModule,
    MatSnackBarModule,
    MatDividerModule,
    MatTableModule,
    MatChipsModule
  ],
  templateUrl: './github-repo-manager.component.html',
  styleUrls: ['./github-repo-manager.component.scss']
})
export class GithubRepoManagerComponent implements OnInit {
  basicInfoForm!: FormGroup;
  githubInfoForm!: FormGroup;
  apiInfoForm!: FormGroup;
  
  environments: Environment[] = [];
  envList = ENVIRONMENTS;
  isLoading = false;
  currentStep = 0;
  
  displayedColumns: string[] = ['name', 'url', 'repoName', 'status', 'xmlCount', 'version', 'actions'];

  constructor(
    private fb: FormBuilder,
    private githubService: GithubService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.initForms();
  }

  initForms(): void {
    this.basicInfoForm = this.fb.group({
      devUrl: ['https://dev-api.example.com', [Validators.required, Validators.pattern('https?://.+')]],
      qaUrl: ['https://qa-api.example.com', [Validators.required, Validators.pattern('https?://.+')]],
      stageUrl: ['https://stage-api.example.com', [Validators.required, Validators.pattern('https?://.+')]],
      prodUrl: ['https://prod-api.example.com', [Validators.required, Validators.pattern('https?://.+')]]
    });

    this.githubInfoForm = this.fb.group({
      baseRepoUrl: ['https://github.com/username', [Validators.required, Validators.pattern('https?://.+')]],
      githubToken: ['', [Validators.required]],
      githubUsername: ['', [Validators.required]]
    });

    this.apiInfoForm = this.fb.group({
      xmlApiUrl: ['https://api.example.com/xmls', [Validators.required, Validators.pattern('https?://.+')]]
    });
  }

  setupEnvironments(): void {
    this.environments = [];
    
    this.environments.push({
      name: 'Dev',
      url: this.basicInfoForm.get('devUrl')?.value,
      repoName: 'xml-repo-dev',
      status: 'pending'
    });
    
    this.environments.push({
      name: 'QA',
      url: this.basicInfoForm.get('qaUrl')?.value,
      repoName: 'xml-repo-qa',
      status: 'pending'
    });
    
    this.environments.push({
      name: 'Stage',
      url: this.basicInfoForm.get('stageUrl')?.value,
      repoName: 'xml-repo-stage',
      status: 'pending'
    });
    
    this.environments.push({
      name: 'Prod',
      url: this.basicInfoForm.get('prodUrl')?.value,
      repoName: 'xml-repo-prod',
      status: 'pending'
    });
    
    this.currentStep = 1;
  }

  createRepositories(): void {
    const username = this.githubInfoForm.get('githubUsername')?.value;
    const token = this.githubInfoForm.get('githubToken')?.value;
    
    this.isLoading = true;
    
    // Track completion of all repository creations
    let completedCount = 0;
    
    // Create repositories one by one
    for (const env of this.environments) {
      env.status = 'pending';
      
      this.githubService.createRepository(
        env.repoName as string, 
        `Repository for ${env.name} XML files`, 
        token
      ).pipe(
        catchError(error => {
          env.status = 'error';
          this.showMessage(`Failed to create ${env.name} repository: ${error.message}`);
          return of(null);
        }),
        finalize(() => {
          // Track completion of this repository creation
          completedCount++;
          
          // Check if all repositories have been processed
          if (completedCount === this.environments.length) {
            this.isLoading = false;
            this.currentStep = 2;
          }
        })
      ).subscribe(repo => {
        if (repo) {
          env.status = 'created';
          env.repoUrl = repo.html_url;
          this.showMessage(`Created ${env.name} repository successfully`);
        }
      });
    }
  }

  fetchAndCommitXmls(): void {
    const username = this.githubInfoForm.get('githubUsername')?.value;
    const token = this.githubInfoForm.get('githubToken')?.value;
    const xmlApiUrl = this.apiInfoForm.get('xmlApiUrl')?.value;
    
    this.isLoading = true;
    
    for (const env of this.environments) {
      if (env.status !== 'created') continue;
      
      env.status = 'pending';
      
      // First fetch XMLs for this environment
      this.githubService.fetchXmlsFromApi(`${xmlApiUrl}/${env.name.toLowerCase()}`)
        .pipe(
          switchMap(xmls => {
            env.xmlCount = xmls.length;
            
            // Create an array of observables for committing each XML
            const commitObservables = xmls.map((xml, index) => {
              return this.githubService.addFileToRepo(
                username,
                env.repoName as string,
                `xml-${index + 1}.xml`,
                xml,
                `Adding XML file ${index + 1}`,
                token
              ).pipe(
                catchError(error => {
                  console.error(`Failed to commit XML ${index + 1} to ${env.name} repo:`, error);
                  return of(null);
                })
              );
            });
            
            // Execute all commits and return when all are done
            return forkJoin(commitObservables);
          }),
          catchError(error => {
            env.status = 'error';
            this.showMessage(`Failed to fetch XMLs for ${env.name}: ${error.message}`);
            return of([]);
          }),
          finalize(() => {
            if (env.status === 'pending') {
              env.status = 'completed';
            }
          })
        )
        .subscribe(results => {
          const successfulCommits = results.filter(r => r !== null).length;
          if (successfulCommits > 0) {
            this.showMessage(`Committed ${successfulCommits} XML files to ${env.name} repository`);
          }
        });
    }
    
    this.isLoading = false;
    this.currentStep = 3;
  }

  createVersions(): void {
    const username = this.githubInfoForm.get('githubUsername')?.value;
    const token = this.githubInfoForm.get('githubToken')?.value;
    
    this.isLoading = true;
    
    for (const env of this.environments) {
      if (env.status !== 'completed') continue;
      
      env.status = 'pending';
      
      this.githubService.createTag(
        username,
        env.repoName as string,
        'v1.0.0',
        `Initial version for ${env.name}`,
        token
      ).pipe(
        catchError(error => {
          env.status = 'error';
          this.showMessage(`Failed to create version for ${env.name}: ${error.message}`);
          return of(null);
        }),
        finalize(() => {
          if (env.status === 'pending') {
            env.status = 'completed';
            env.version = 'v1.0.0';
          }
        })
      ).subscribe(tag => {
        if (tag) {
          this.showMessage(`Created version v1.0.0 for ${env.name} repository`);
        }
      });
    }
    
    this.isLoading = false;
  }

  nextStep(): void {
    switch (this.currentStep) {
      case 0:
        if (this.basicInfoForm.valid) {
          this.setupEnvironments();
        } else {
          this.showMessage('Please fill in all environment URLs correctly');
        }
        break;
      case 1:
        if (this.githubInfoForm.valid) {
          this.createRepositories();
        } else {
          this.showMessage('Please fill in all GitHub information correctly');
        }
        break;
      case 2:
        if (this.apiInfoForm.valid) {
          this.fetchAndCommitXmls();
        } else {
          this.showMessage('Please provide a valid API URL');
        }
        break;
      case 3:
        this.createVersions();
        break;
    }
  }

  reset(): void {
    this.environments = [];
    this.currentStep = 0;
    this.initForms();
  }

  private showMessage(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000
    });
  }
}