import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { HttpClientModule } from "@angular/common/http";
import { MatCardModule } from "@angular/material/card";
import { MatButtonModule } from "@angular/material/button";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { GithubService } from "../../services/github/github.service";
import { XmlService } from "../../services/xml.service";
import { EnvironmentService } from "../../services/environment.service";
import { Environment } from "../../models/environment.model";
import { finalize } from "rxjs/operators";

@Component({
  selector: "app-repository-manager",
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    HttpClientModule,
    MatCardModule,
    MatButtonModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatProgressBarModule,
  ],
  templateUrl: "./repository-manager.component.html",
  styleUrls: ["./repository-manager.component.scss"],
  providers: [GithubService, XmlService, EnvironmentService],
})
export class RepositoryManagerComponent implements OnInit {
  githubForm!: FormGroup;
  selectedEnv: Environment | null = null;
  loading = false;
  message = "";
  error = "";
  currentStep = 1;

  constructor(
    private fb: FormBuilder,
    private githubService: GithubService,
    private xmlService: XmlService,
    public envService: EnvironmentService
  ) {
    this.initForm();
  }

  ngOnInit(): void {}

  private initForm(): void {
    this.githubForm = this.fb.group({
      githubUsername: ["", Validators.required],
      githubToken: ["", Validators.required],
      githubUrl: ["", [Validators.required, Validators.pattern("https?://.+")]],
      apiUrl: [""],
    });
  }

  selectEnvironment(env: Environment): void {
    this.selectedEnv = env;
    if (env.apiUrl) {
      this.githubForm.patchValue({ apiUrl: env.apiUrl });
    }
  }

  updateApiUrl(): void {
    if (this.selectedEnv && this.githubForm.get("apiUrl")?.valid) {
      const apiUrl = this.githubForm.get("apiUrl")?.value;
      this.envService.updateEnvironment(this.selectedEnv.name, { apiUrl });
      this.message = `API URL updated for ${this.selectedEnv.name}`;
      setTimeout(() => (this.message = ""), 3000);
    }
  }

  setGithubToken(): void {
    if (this.githubForm.valid) {
      const token = this.githubForm.get("githubToken")?.value;
      if (token) {
        this.githubService.setToken(token);
        this.message = "GitHub token set successfully";
        setTimeout(() => (this.message = ""), 3000);
      }
    }
  }

  createRepositories(): void {
    if (!this.githubService.getToken()) {
      this.error = "Please set GitHub token first";
      setTimeout(() => (this.error = ""), 5000);
      return;
    }

    const username = this.githubForm.get("githubUsername")?.value;
    if (!username) {
      this.error = "Please enter GitHub username";
      setTimeout(() => (this.error = ""), 5000);
      return;
    }

    this.loading = true;
    this.message = "Creating repositories...";

    const environments = this.envService.getEnvironments();
    let completed = 0;

    environments.forEach((env) => {
      if (!env.repoName) {
        this.error = `Repository name not set for ${env.name}`;
        setTimeout(() => (this.error = ""), 5000);
        return;
      }

      // Format repository name with owner
      const fullRepoName = `${username}/${env.repoName}`;

      this.githubService
        .createRepository(
          fullRepoName,
          `Configuration repository for ${env.name} environment`
        )
        .pipe(
          finalize(() => {
            completed++;
            if (completed === environments.length) {
              this.loading = false;
              this.message = "All repositories created successfully!";
              setTimeout(() => (this.message = ""), 5000);
            }
          })
        )
        .subscribe({
          next: (repo) => {
            this.envService.updateEnvironment(env.name, {
              githubUrl: repo.html_url,
              repoName: fullRepoName, // Save the full owner/repo name
              status: "created",
            });
          },
          error: (err) => {
            this.envService.updateEnvironment(env.name, {
              status: "error",
              errorMessage: err.message,
            });
            this.error = `Error creating ${env.name} repository: ${err.message}`;
            setTimeout(() => (this.error = ""), 5000);
          },
        });
    });
  }

  fetchAndCommitXmls(env: Environment): void {
    if (!this.githubService.getToken()) {
      this.error = "Please set GitHub token first";
      setTimeout(() => (this.error = ""), 5000);
      return;
    }

    if (!env.apiUrl) {
      this.error = `API URL for ${env.name} is not set`;
      setTimeout(() => (this.error = ""), 5000);
      return;
    }

    if (!env.repoName) {
      this.error = `Repository name not set for ${env.name}`;
      setTimeout(() => (this.error = ""), 5000);
      return;
    }

    // Extract owner and repo from the full repo name
    const [owner, repo] = env.repoName.split("/");
    if (!owner || !repo) {
      this.error = `Invalid repository format for ${env.name}. Expected format: owner/repo`;
      setTimeout(() => (this.error = ""), 5000);
      return;
    }

    this.loading = true;
    this.message = `Fetching XMLs for ${env.name}...`;

    this.githubService
      .commitFiles(
        owner,
        repo,
        this.xmlService.mockFetchXmls(env.name.toLowerCase()),
        `Adding ${env.name} configuration files`
      )
      .pipe(
        finalize(() => {
          this.loading = false;
          this.message = `XMLs committed to ${env.name} repository`;
          setTimeout(() => (this.message = ""), 5000);
        })
      )
      .subscribe({
        next: (results) => {
          const successfulCommits = results.filter((r) => !r.error).length;
          this.envService.updateEnvironment(env.name, {
            status: "xmlsAdded",
            xmlCount: successfulCommits,
          });
          this.message = `Successfully committed ${successfulCommits} XMLs to ${env.name} repository`;
        },
        error: (err) => {
          this.envService.updateEnvironment(env.name, {
            status: "error",
            errorMessage: err.message,
          });
          this.error = `Error committing XMLs to ${env.name} repository: ${err.message}`;
          setTimeout(() => (this.error = ""), 5000);
        },
      });
  }

  createV1Tag(env: Environment): void {
    if (!this.githubService.getToken()) {
      this.error = "Please set GitHub token first";
      setTimeout(() => (this.error = ""), 5000);
      return;
    }

    if (!env.repoName) {
      this.error = `Repository name not set for ${env.name}`;
      setTimeout(() => (this.error = ""), 5000);
      return;
    }

    // Extract owner and repo from the full repo name
    const [owner, repo] = env.repoName.split("/");
    if (!owner || !repo) {
      this.error = `Invalid repository format for ${env.name}. Expected format: owner/repo`;
      setTimeout(() => (this.error = ""), 5000);
      return;
    }

    this.loading = true;
    this.message = `Creating V1 tag for ${env.name}...`;

    this.githubService
      .createTag(
        owner,
        repo,
        "v1.0.0",
        `Initial release for ${env.name} environment`
      )
      .pipe(
        finalize(() => {
          this.loading = false;
          this.message = `V1 tag created for ${env.name} repository`;
          setTimeout(() => (this.message = ""), 5000);
        })
      )
      .subscribe({
        next: () => {
          this.envService.updateEnvironment(env.name, { status: "completed" });
        },
        error: (err) => {
          this.envService.updateEnvironment(env.name, {
            status: "error",
            errorMessage: err.message,
          });
          this.error = `Error creating V1 tag for ${env.name} repository: ${err.message}`;
          setTimeout(() => (this.error = ""), 5000);
        },
      });
  }
}
