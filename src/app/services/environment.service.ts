import { Injectable } from "@angular/core";
import { Environment } from "../models/environment.model";

@Injectable({
  providedIn: "root",
})
export class EnvironmentService {
  private environments: Environment[] = [];

  constructor() {
    // Initialize with default environments
    // Note: repoName will be set to owner/repo when GitHub username is provided
    this.environments = [
      {
        name: "Dev",
        apiUrl: "",
        repoName: "config-dev-repo",
        status: "pending",
      },
      { name: "QA", apiUrl: "", repoName: "config-qa-repo", status: "pending" },
      {
        name: "Stage",
        apiUrl: "",
        repoName: "config-stage-repo",
        status: "pending",
      },
      {
        name: "Prod",
        apiUrl: "",
        repoName: "config-prod-repo",
        status: "pending",
      },
    ];
  }

  getEnvironments(): Environment[] {
    return this.environments;
  }

  getEnvironment(name: string): Environment | undefined {
    return this.environments.find((env) => env.name === name);
  }

  updateEnvironment(name: string, updates: Partial<Environment>): void {
    const index = this.environments.findIndex((env) => env.name === name);
    if (index !== -1) {
      // Parse owner/repo from repoName if provided
      if (updates.repoName) {
        const [owner, repo] = updates.repoName.split("/");
        if (owner && repo) {
          updates.owner = owner;
          updates.repo = repo;
        }
      }
      this.environments[index] = { ...this.environments[index], ...updates };
    }
  }

  addEnvironment(env: Environment): void {
    const exists = this.environments.some((e) => e.name === env.name);
    if (!exists) {
      // Parse owner/repo from repoName if provided
      if (env.repoName) {
        const [owner, repo] = env.repoName.split("/");
        if (owner && repo) {
          env.owner = owner;
          env.repo = repo;
        }
      }
      this.environments.push(env);
    }
  }

  removeEnvironment(name: string): void {
    const index = this.environments.findIndex((env) => env.name === name);
    if (index !== -1) {
      this.environments.splice(index, 1);
    }
  }

  // Helper method to format repository name with owner
  formatRepoName(githubUsername: string, env: Environment): string {
    const baseRepoName =
      env.repo ||
      env.repoName?.split("/").pop() ||
      `config-${env.name.toLowerCase()}-repo`;
    return `${githubUsername}/${baseRepoName}`;
  }
}
