import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { Environment, PromotionResult, ENVIRONMENTS } from '../models/environment.model';
import { GithubService } from './github.service';
import { EnvironmentService } from './environment.service';

@Injectable({
  providedIn: 'root'
})
export class PromotionService {
  constructor(
    private http: HttpClient,
    private githubService: GithubService,
    private environmentService: EnvironmentService
  ) {}

  getAvailableFolders(environment: Environment): Observable<string[]> {
    if (!environment.repoName) {
      return of([]);
    }

    return this.githubService.getRepositoryContents(environment.repoName, '')
      .pipe(
        map(contents => contents.filter(item => item.type === 'dir').map(dir => dir.name)),
        catchError(error => {
          console.error(`Error fetching folders for ${environment.name}:`, error);
          return of([]);
        })
      );
  }

  promoteFolder(sourceEnv: Environment, targetEnv: Environment, folderName: string): Observable<PromotionResult> {
    if (!sourceEnv.repoName || !targetEnv.repoName) {
      return throwError(() => new Error('Source or target repository not configured'));
    }

    const [targetOwner, targetRepo] = targetEnv.repoName.split('/');
    if (!targetOwner || !targetRepo) {
      return throwError(() => new Error('Invalid target repository format. Expected format: owner/repo'));
    }

    // Get folder contents from source repository
    return this.githubService.getRepositoryContents(sourceEnv.repoName, folderName)
      .pipe(
        switchMap(contents => {
          // Create the folder in target repository
          const createFolderPromise = this.githubService.commitFile(
            targetOwner,
            targetRepo,
            `${folderName}/.gitkeep`,
            '',
            `Create ${folderName} folder`
          ).toPromise();

          return createFolderPromise.then(() => contents);
        }),
        switchMap(contents => {
          // Copy all files from source to target
          const filePromises = contents.map(file => {
            if (file.type === 'file') {
              return this.githubService.commitFile(
                targetOwner,
                targetRepo,
                `${folderName}/${file.name}`,
                file.content || '',
                `Copy ${file.name} from ${sourceEnv.name} to ${targetEnv.name}`
              ).toPromise();
            }
            return Promise.resolve();
          });

          return Promise.all(filePromises).then(() => ({
            success: true,
            message: `Successfully promoted ${folderName} from ${sourceEnv.name} to ${targetEnv.name}`,
            sourceRepo: sourceEnv.repoName,
            targetRepo: targetEnv.repoName,
            folderName
          }));
        }),
        catchError(error => {
          console.error('Error during promotion:', error);
          return of({
            success: false,
            message: `Failed to promote folder: ${error.message}`,
            sourceRepo: sourceEnv.repoName,
            targetRepo: targetEnv.repoName,
            folderName
          });
        })
      );
  }

  getSourceEnvironment(targetEnv: Environment): Environment | undefined {
    const envIndex = ENVIRONMENTS.indexOf(targetEnv.name);
    if (envIndex <= 0) return undefined;

    // Try to find the previous environment with a repository
    for (let i = envIndex - 1; i >= 0; i--) {
      const prevEnv = this.environmentService.getEnvironment(ENVIRONMENTS[i]);
      if (prevEnv?.repoName) {
        return prevEnv;
      }
    }
    return undefined;
  }
} 