import { Injectable } from '@angular/core';
import { Environment } from '../models/environment.model';

@Injectable({
  providedIn: 'root'
})
export class EnvironmentService {
  private environments: Environment[] = [];

  constructor() {
    // Initialize with default environments
    this.environments = [
      { name: 'Dev', apiUrl: '', repoName: 'config-dev-repo', status: 'pending' },
      { name: 'QA', apiUrl: '', repoName: 'config-qa-repo', status: 'pending' },
      { name: 'Stage', apiUrl: '', repoName: 'config-stage-repo', status: 'pending' },
      { name: 'Prod', apiUrl: '', repoName: 'config-prod-repo', status: 'pending' }
    ];
  }

  getEnvironments(): Environment[] {
    return this.environments;
  }

  getEnvironment(name: string): Environment | undefined {
    return this.environments.find(env => env.name === name);
  }

  updateEnvironment(name: string, updates: Partial<Environment>): void {
    const index = this.environments.findIndex(env => env.name === name);
    if (index !== -1) {
      this.environments[index] = { ...this.environments[index], ...updates };
    }
  }

  addEnvironment(env: Environment): void {
    const exists = this.environments.some(e => e.name === env.name);
    if (!exists) {
      this.environments.push(env);
    }
  }

  removeEnvironment(name: string): void {
    const index = this.environments.findIndex(env => env.name === name);
    if (index !== -1) {
      this.environments.splice(index, 1);
    }
  }
}
