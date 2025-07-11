import { Component, OnInit } from "@angular/core";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { EnvironmentService } from "../../services/environment.service";
import {
  GithubService,
  XmlContent,
} from "../../services/github/github.service";
import { Environment } from "../../models/environment.model";
import { forkJoin, Observable, of } from "rxjs";
import { catchError, finalize, map, switchMap } from "rxjs/operators";
import { PromotionService } from "../../services/promotion.service";
import { XmlService } from "../../services/xml.service";

interface EnvFormConfig {
  apiUrl: string;
  repoName: string;
  selectedFolder?: string;
  availableFolders?: string[];
  sourceEnvironment?: string;
}

interface EnvFormConfig {
  apiUrl: string;
  repoName: string;
  selectedFolder?: string;
  availableFolders?: string[];
  sourceEnvironment?: string;
}

@Component({
  selector: "app-github-env-manager",
  templateUrl: "./github-env-manager.component.html",
  styleUrls: ["./github-env-manager.component.scss"],
})
export class GithubEnvManagerComponent implements OnInit {
  // Forms
  githubForm!: FormGroup;
  environmentForm!: FormGroup;

  // Status flags
  isCreatingRepos = false;
  isAddingXmls = false;
  isCreatingVersions = false;

  // Messages
  errorMessage = "";
  successMessage = "";

  // Environment data
  environments: Environment[] = [];
  envFormConfig: { [key: string]: EnvFormConfig } = {};

  constructor(
    private formBuilder: FormBuilder,
    public githubService: GithubService,
    private envService: EnvironmentService,
    private promotionService: PromotionService,
    private xmlService: XmlService
  ) {
    this.initForms();
  }

  ngOnInit(): void {
    this.loadEnvironments();

    // Set token if previously saved
    const token = localStorage.getItem("github_token");
    if (token) {
      this.githubForm.patchValue({ githubToken: token });
      this.githubService.setToken(token);
    }
  }

  private initForms(): void {
    this.githubForm = this.formBuilder.group({
      githubUrl: ["", [Validators.required, Validators.pattern("https?://.+")]],
      githubToken: ["", [Validators.required]],
    });

    this.environmentForm = this.formBuilder.group({});
  }

  private loadEnvironments(): void {
    this.environments = this.envService.getEnvironments();

    // Set up form controls for each environment
    this.environments.forEach((env) => {
      this.envFormConfig[env.name] = {
        apiUrl: env.url || "",
        repoName: env.repoName || "",
      };

      // Add form controls
      const envGroup = this.formBuilder.group({
        [`${env.name}ApiUrl`]: [
          env.url,
          [Validators.required, Validators.pattern("https?://.+")],
        ],
        [`${env.name}RepoName`]: [env.repoName, [Validators.required]],
        [`${env.name}SelectedFolder`]: [""],
      });

      Object.keys(envGroup.controls).forEach((key) => {
        this.environmentForm.addControl(key, envGroup.get(key)!);
      });

      // Load available folders for non-Dev environments
      if (env.name !== "Dev" && env.repoName) {
        this.loadAvailableFolders(env);
      }
    });
  }

  private loadAvailableFolders(env: Environment): void {
    const sourceEnv = this.promotionService.getSourceEnvironment(env);
    if (!sourceEnv) return;

    this.envFormConfig[env.name].sourceEnvironment = sourceEnv.name;
    this.promotionService
      .getAvailableFolders(sourceEnv)
      .subscribe((folders) => {
        this.envFormConfig[env.name].availableFolders = folders;
      });
  }

  resetStatus(): void {
    this.errorMessage = "";
    this.successMessage = "";
  }

  saveGithubSettings(): void {
    if (this.githubForm.valid) {
      const token = this.githubForm.get("githubToken")?.value;
      if (token) {
        this.githubService.setToken(token);
        localStorage.setItem("github_token", token);
        this.successMessage = "GitHub settings saved successfully";
      }
    } else {
      this.errorMessage = "Please fill in all GitHub information correctly";
    }
  }

  private setupEnvRepository(envName: string, baseRepoName: string): string {
    const username = this.githubForm.get("githubUrl")?.value?.split("/").pop();
    return username ? `${username}/${baseRepoName}` : baseRepoName;
  }

  saveEnvironmentSettings(): void {
    if (this.environmentForm.valid) {
      const githubUsername = this.githubForm
        .get("githubUrl")
        ?.value?.split("/")
        .pop();

      this.environments.forEach((env) => {
        const apiUrl = this.environmentForm.get(`${env.name}ApiUrl`)?.value;
        const baseRepoName = this.environmentForm.get(
          `${env.name}RepoName`
        )?.value;

        // Format repository name with owner/repo format
        const repoName = githubUsername
          ? this.envService.formatRepoName(githubUsername, {
              ...env,
              repoName: baseRepoName,
            })
          : baseRepoName;

        this.envService.updateEnvironment(env.name, {
          ...env,
          url: apiUrl,
          repoName: repoName,
        });
      });

      this.loadEnvironments();
      this.successMessage = "Environment settings saved successfully";
    } else {
      this.errorMessage = "Please fill in all environment settings correctly";
    }
  }

  promoteFolder(env: Environment): void {
    const selectedFolder = this.environmentForm.get(
      `${env.name}SelectedFolder`
    )?.value;
    if (!selectedFolder) {
      this.errorMessage = "Please select a folder to promote";
      return;
    }

    const sourceEnv = this.promotionService.getSourceEnvironment(env);
    if (!sourceEnv) {
      this.errorMessage = `No source environment found for ${env.name}`;
      return;
    }

    env.status = "promoting";
    this.promotionService
      .promoteFolder(sourceEnv, env, selectedFolder)
      .subscribe({
        next: (result) => {
          if (result.success) {
            this.successMessage = result.message;
            env.status = "completed";
          } else {
            this.errorMessage = result.message;
            env.status = "error";
          }
        },
        error: (error: Error) => {
          this.errorMessage = error.message;
          env.status = "error";
        },
      });
  }

  createRepositories(): void {
    if (!this.githubService.getToken()) {
      this.errorMessage = "GitHub token is required";
      return;
    }

    const githubUsername =
      this.githubForm.get("githubUrl")?.value?.split("/").pop() || "";
    if (!githubUsername) {
      this.errorMessage = "Invalid GitHub URL format";
      return;
    }

    this.isCreatingRepos = true;
    this.resetStatus();

    const repoCreations = this.environments.map((env) => {
      env.status = "pending";
      const repoName = `${githubUsername}/config-${env.name.toLowerCase()}-repo`;

      return this.githubService
        .createRepository(repoName, `Repository for ${env.name} XML files`)
        .pipe(
          map((repo) => ({ env, repo })),
          catchError((error) => {
            env.status = "error";
            console.error(
              `Failed to create repository for ${env.name}:`,
              error
            );
            this.errorMessage = `Failed to create ${env.name} repository: ${error.message}`;
            return of(null);
          })
        );
    });

    forkJoin(repoCreations)
      .pipe(finalize(() => (this.isCreatingRepos = false)))
      .subscribe((results) => {
        const successCount = results.filter((r) => r !== null).length;
        results.forEach((result) => {
          if (result) {
            result.env.status = "created";
            result.env.repoUrl = result.repo.html_url;
          }
        });

        if (successCount > 0) {
          this.successMessage = `Successfully created ${successCount} repositories`;
        } else {
          this.errorMessage = "Failed to create any repositories";
        }
      });
  }

  addXmlsToRepositories(): void {
    if (!this.githubService.getToken()) {
      this.errorMessage = "GitHub token is required";
      return;
    }

    const githubUsername =
      this.githubForm.get("githubUrl")?.value?.split("/").pop() || "";
    if (!githubUsername) {
      this.errorMessage = "Invalid GitHub URL format";
      return;
    }

    this.isAddingXmls = true;
    this.resetStatus();

    const xmlAdditions = this.environments.map((env) => {
      if (env.status !== "created") return of(null);

      env.status = "pending";
      const apiUrl = this.environmentForm.get(`${env.name}ApiUrl`)?.value;

      return this.xmlService.fetchXmlsFromApi(apiUrl || "").pipe(
        map((xmls: XmlContent[]) => {
          env.xmlCount = xmls.length;
          return { env, xmls };
        }),
        switchMap(({ env, xmls }) => {
          const repoName = `config-${env.name.toLowerCase()}-repo`;
          return this.githubService
            .commitFiles(
              githubUsername,
              repoName,
              xmls,
              `Adding XML files for ${env.name}`
            )
            .pipe(map(() => ({ env, success: true })));
        }),
        catchError((error) => {
          env.status = "error";
          this.errorMessage = `Failed to process XMLs for ${env.name}: ${error.message}`;
          return of(null);
        })
      );
    });

    forkJoin(xmlAdditions)
      .pipe(finalize(() => (this.isAddingXmls = false)))
      .subscribe((results) => {
        const successfulEnvs = results.filter((r) => r !== null);
        successfulEnvs.forEach((result) => {
          if (result) {
            result.env.status = "completed";
          }
        });

        if (successfulEnvs.length > 0) {
          this.successMessage = `Successfully added XMLs to ${successfulEnvs.length} repositories`;
        } else {
          this.errorMessage = "Failed to add XMLs to any repositories";
        }
      });
  }
  createV1Versions(): void {
    if (!this.githubService.getToken()) {
      this.errorMessage = "GitHub token is required";
      return;
    }

    const githubUsername =
      this.githubForm.get("githubUrl")?.value?.split("/").pop() || "";
    if (!githubUsername) {
      this.errorMessage = "Invalid GitHub URL format";
      return;
    }

    this.isCreatingVersions = true;
    this.resetStatus();

    const versionCreations = this.environments.map((env) => {
      if (env.status !== "completed") return of(null);

      env.status = "pending";
      const repoName = `config-${env.name.toLowerCase()}-repo`;

      return this.githubService
        .createTag(
          githubUsername,
          repoName,
          "v1.0.0",
          `Initial version for ${env.name}`
        )
        .pipe(
          map((tag) => ({ env, tag })),
          catchError((error) => {
            env.status = "error";
            console.error(`Failed to create version for ${env.name}:`, error);
            return of(null);
          })
        );
    });

    forkJoin(versionCreations)
      .pipe(finalize(() => (this.isCreatingVersions = false)))
      .subscribe((results) => {
        const successfulEnvs = results.filter((r) => r !== null);
        successfulEnvs.forEach((result) => {
          if (result) {
            result.env.status = "completed";
            result.env.version = "v1.0.0";
          }
        });

        if (successfulEnvs.length > 0) {
          this.successMessage = `Successfully created versions for ${successfulEnvs.length} repositories`;
        } else {
          this.errorMessage = "Failed to create versions for any repositories";
        }
      });
  }
}
