# GitHub Environment Manager

A standalone Angular 16 application that allows you to manage GitHub repositories across different environments (Dev, QA, Stage, and Prod) and supports XML configuration file management.

## Features

- Create repositories per environment (Dev, QA, Stage, Prod)
- Fetch XML configuration files from an API or generate mock data
- Commit XML files to the appropriate environment repositories
- Create V1 releases/tags for each repository

## Requirements

- Node.js 14+
- Angular 16
- GitHub Personal Access Token with `repo` scope
- .NET Core Web API backend (included in the solution)

## Usage Instructions

### Step 1: Configure GitHub Settings

1. Enter your GitHub URL (e.g., https://github.com/yourusername)
2. Enter your GitHub Personal Access Token
   - You can create a new token at [GitHub Settings > Developer Settings > Personal Access Tokens](https://github.com/settings/tokens/new)
   - Ensure the token has the `repo` scope permissions
3. Click "Save GitHub Settings"

### Step 2: Configure Environment Settings

For each environment (Dev, QA, Stage, Prod):

1. Enter the API URL for XMLs 
   - This is the endpoint that will provide XML files for each environment
   - If no actual API is available, the system will use mock data
2. Enter the Repository Name for each environment
   - Default names like `config-dev-repo` are provided, but you can customize them
3. Click "Save Environment Settings"

### Step 3: Create Repositories

1. Click "Step 1: Create Repositories"
2. The system will create one repository per environment in your GitHub account
3. You can track the status of each repository creation

### Step 4: Add XMLs to Repositories

1. Click "Step 2: Add XMLs to Repositories"
2. The system will:
   - Fetch XMLs from the API URL provided for each environment
   - If the API fails or returns no XMLs, it will generate mock XML data
   - Commit all XMLs to the appropriate environment repository
3. You can track the status and count of XMLs added to each repository

### Step 5: Create V1 Versions

1. Click "Step 3: Create V1 Tags"
2. The system will create a V1.0.0 tag/release for each repository
3. You can track the status of each version creation

## Implementation Details

- The frontend is built with Angular 16 and uses Angular Material UI components
- Communication with GitHub uses the GitHub REST API via a .NET Core backend
- XML file handling is managed through the .NET Core backend
- Mock XML generation is provided for testing purposes

## Running the Application

1. Start the backend:
   ```
   cd GitHubEnvManager
   dotnet run
   ```

2. Start the Angular application:
   ```
   cd angular16-app
   npm install
   ng serve
   ```

3. Navigate to `http://localhost:4200/env-manager` in your browser
