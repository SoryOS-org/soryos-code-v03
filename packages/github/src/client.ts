
/**
 * @soryos/github
 * GitHub API Client - Robust GitHub integration with retries and error handling
 */

import {
  GitHubConfig,
  RepositoryVisibility,
  PullRequestState,
  RepositoryInfo,
  BranchInfo,
  CommitInfo,
  FileInfo,
  PullRequestInfo,
  GitHubOperationResult,
  CreateRepositoryOptions,
  CommitOptions,
  PushOptions,
  PullRequestOptions,
  MergePullRequestOptions,
  CreateBranchOptions,
  WebhookConfig,
  WebhookEventType,
  SoryOSCommitMetadata,
  Codespace,
  CreateCodespaceOptions,
} from './types';

/**
 * GitHub API Client with comprehensive error handling
 */
export class GitHubClient {
  private config: GitHubConfig;
  private baseUrl: string;
  private userAgent: string;
  private token: string;

  constructor(config: GitHubConfig) {
    this.config = config;
    this.token = config.token;
    this.baseUrl = config.baseUrl || 'https://api.github.com';
    this.userAgent = config.userAgent || 'SoryOS-Code';

    if (!this.token) {
      throw new Error('GitHub token is required');
    }
  }

  /**
   * Create a new GitHub client
   */
  static create(config: GitHubConfig): GitHubClient {
    return new GitHubClient(config);
  }

  /**
   * Get auth token
   */
  getToken(sessionId?: string): string | null {
    return this.token || null;
  }

  /**
   * Make a request to GitHub API with retries
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    endpoint: string,
    data?: unknown,
    retries: number = 3
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.token}`,
      'User-Agent': this.userAgent,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    };

    const options: RequestInit = {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
    };

    try {
      const response = await fetch(url, options);

      // Handle rate limiting
      if (response.status === 403) {
        const resetTime = response.headers.get('x-ratelimit-reset');
        if (resetTime) {
          const waitTime = parseInt(resetTime) * 1000 - Date.now();
          if (waitTime > 0 && retries > 0) {
            console.warn(`[GitHub] Rate limited. Waiting ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            return this.request(method, endpoint, data, retries - 1);
          }
        }
      }

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(
          `GitHub API error ${response.status}: ${errorData.message || response.statusText}`
        );
      }

      if (response.status === 204) {
        return {} as T;
      }

      return response.json() as Promise<T>;

    } catch (error) {
      if (retries > 0) {
        console.warn(`[GitHub] Request failed, retrying... (${retries} left)`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.request(method, endpoint, data, retries - 1);
      }
      throw error;
    }
  }

  // ... [existing methods]

  /**
   * List codespaces for the authenticated user
   */
  async listCodespacesForUser(): Promise<GitHubOperationResult<Codespace[]>> {
    try {
      const data = await this.request<{ codespaces: Codespace[] }>('GET', '/user/codespaces');
      return { success: true, data: data.codespaces, timestamp: Date.now() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      };
    }
  }

  /**
   * List codespaces in a repository
   */
  async listCodespacesInRepo(owner: string, repo: string): Promise<GitHubOperationResult<Codespace[]>> {
    try {
      const data = await this.request<{ codespaces: Codespace[] }>(
        'GET',
        `/repos/${owner}/${repo}/codespaces`
      );
      return { success: true, data: data.codespaces, timestamp: Date.now() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Create a new codespace
   */
  async createCodespace(
    owner: string,
    repo: string,
    options: CreateCodespaceOptions
  ): Promise<GitHubOperationResult<Codespace>> {
    try {
      const data = await this.request<Codespace>(
        'POST',
        `/repos/${owner}/${repo}/codespaces`,
        {
          ref: options.branch,
          machine: options.machine,
          location: options.location || 'WestUs2',
        }
      );
      return { success: true, data, timestamp: Date.now() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Get codespace details
   */
  async getCodespace(codespaceName: string): Promise<GitHubOperationResult<Codespace>> {
    try {
      const data = await this.request<Codespace>(
        'GET',
        `/user/codespaces/${codespaceName}`
      );
      return { success: true, data, timestamp: Date.now() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Start a codespace
   */
  async startCodespace(codespaceName: string): Promise<GitHubOperationResult<Codespace>> {
    try {
      const data = await this.request<Codespace>(
        'POST',
        `/user/codespaces/${codespaceName}/start`
      );
      return { success: true, data, timestamp: Date.now() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Stop a codespace
   */
  async stopCodespace(codespaceName: string): Promise<GitHubOperationResult<Codespace>> {
    try {
      const data = await this.request<Codespace>(
        'POST',
        `/user/codespaces/${codespaceName}/stop`
      );
      return { success: true, data, timestamp: Date.now() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      };
    }
  }
  /**
   * Get repository information
   */
  async getRepository(owner: string, repo: string): Promise<GitHubOperationResult<RepositoryInfo>> {
    try {
      const data = await this.request<RepositoryInfo>(
        'GET',
        `/repos/${owner}/${repo}`
      );
      return { success: true, data, timestamp: Date.now() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Create a new repository
   */
  async createRepository(
    options: CreateRepositoryOptions
  ): Promise<GitHubOperationResult<RepositoryInfo>> {
    try {
      const data = await this.request<RepositoryInfo>(
        'POST',
        `/user/repos`,
        {
          name: options.name,
          description: options.description,
          private: options.private,
          visibility: options.visibility,
          auto_init: options.autoInit,
          license_template: options.licenseTemplate,
          gitignore_template: options.gitignoreTemplate,
          allow_squash_merge: options.allowSquashMerge,
          allow_merge_commit: options.allowMergeCommit,
          allow_rebase_merge: options.allowRebaseMerge,
          delete_branch_on_merge: options.deleteBranchOnMerge,
          has_issues: options.hasIssues,
          has_projects: options.hasProjects,
          has_wiki: options.hasWiki,
          has_downloads: options.hasDownloads,
          default_branch: options.defaultBranch,
        }
      );
      return { success: true, data, timestamp: Date.now() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      };
    }
  }

  /**
   * List repositories for authenticated user
   */
  async listRepositories(
    visibility?: RepositoryVisibility,
    affiliation?: string
  ): Promise<GitHubOperationResult<RepositoryInfo[]>> {
    try {
      const query = new URLSearchParams();
      if (visibility) query.set('visibility', visibility);
      if (affiliation) query.set('affiliation', affiliation);

      const endpoint = `/user/repos?${query.toString()}`;
      const data = await this.request<RepositoryInfo[]>( 'GET', endpoint );
      return { success: true, data, timestamp: Date.now() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Get branch information
   */
  async getBranch(
    owner: string,
    repo: string,
    branch: string = 'main'
  ): Promise<GitHubOperationResult<BranchInfo>> {
    try {
      const data = await this.request<BranchInfo>(
        'GET',
        `/repos/${owner}/${repo}/branches/${branch}`
      );
      return { success: true, data, timestamp: Date.now() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      };
    }
  }

  /**
   * List all branches
   */
  async listBranches(
    owner: string,
    repo: string
  ): Promise<GitHubOperationResult<BranchInfo[]>> {
    try {
      const data = await this.request<BranchInfo[]>(
        'GET',
        `/repos/${owner}/${repo}/branches`
      );
      return { success: true, data, timestamp: Date.now() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Create a new branch
   */
  async createBranch(
    owner: string,
    repo: string,
    options: CreateBranchOptions
  ): Promise<GitHubOperationResult<BranchInfo>> {
    try {
      const data = await this.request<BranchInfo>(
        'POST',
        `/repos/${owner}/${repo}/git/refs`,
        {
          ref: `refs/heads/${options.branch}`,
          sha: options.sha,
        }
      );
      return { success: true, data, timestamp: Date.now() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Delete a branch
   */
  async deleteBranch(
    owner: string,
    repo: string,
    branch: string
  ): Promise<GitHubOperationResult<void>> {
    try {
      await this.request<void>(
        'DELETE',
        `/repos/${owner}/${repo}/branches/${branch}`
      );
      return { success: true, timestamp: Date.now() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Get commit information
   */
  async getCommit(
    owner: string,
    repo: string,
    sha: string
  ): Promise<GitHubOperationResult<CommitInfo>> {
    try {
      const data = await this.request<CommitInfo>(
        'GET',
        `/repos/${owner}/${repo}/commits/${sha}`
      );
      return { success: true, data, timestamp: Date.now() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      };
    }
  }

  /**
   * List commits
   */
  async listCommits(
    owner: string,
    repo: string,
    sha?: string,
    path?: string,
    since?: string,
    until?: string,
    author?: string,
    perPage: number = 30
  ): Promise<GitHubOperationResult<CommitInfo[]>> {
    try {
      const query = new URLSearchParams();
      if (sha) query.set('sha', sha);
      if (path) query.set('path', path);
      if (since) query.set('since', since);
      if (until) query.set('until', until);
      if (author) query.set('author', author);
      query.set('per_page', perPage.toString());

      const endpoint = `/repos/${owner}/${repo}/commits?${query.toString()}`;
      const data = await this.request<CommitInfo[]>( 'GET', endpoint );
      return { success: true, data, timestamp: Date.now() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Create a commit
   */
  async createCommit(
    owner: string,
    repo: string,
    options: CommitOptions
  ): Promise<GitHubOperationResult<CommitInfo>> {
    try {
      const data = await this.request<CommitInfo>(
        'POST',
        `/repos/${owner}/${repo}/git/commits`,
        {
          message: options.message,
          tree: options.tree,
          parents: options.parents,
          author: options.author,
          committer: options.committer,
        }
      );
      return { success: true, data, timestamp: Date.now() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Get file information
   */
  async getFile(
    owner: string,
    repo: string,
    path: string,
    ref?: string
  ): Promise<GitHubOperationResult<FileInfo>> {
    try {
      const query = ref ? `?ref=${ref}` : '';
      const data = await this.request<FileInfo>(
        'GET',
        `/repos/${owner}/${repo}/contents/${path}${query}`
      );
      return { success: true, data, timestamp: Date.now() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Create or update a file
   */
  async createOrUpdateFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    branch: string = 'main',
    sha?: string
  ): Promise<GitHubOperationResult<FileInfo>> {
    try {
      const data = await this.request<FileInfo>(
        'PUT',
        `/repos/${owner}/${repo}/contents/${path}`,
        {
          message,
          content: Buffer.from(content).toString('base64'),
          branch,
          sha,
        }
      );
      return { success: true, data, timestamp: Date.now() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(
    owner: string,
    repo: string,
    path: string,
    message: string,
    branch: string = 'main',
    sha: string
  ): Promise<GitHubOperationResult<void>> {
    try {
      await this.request<void>(
        'DELETE',
        `/repos/${owner}/${repo}/contents/${path}`,
        {
          message,
          branch,
          sha,
        }
      );
      return { success: true, timestamp: Date.now() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      };
    }
  }

  /**
   * List files in a directory
   */
  async listFiles(
    owner: string,
    repo: string,
    path: string = '',
    ref?: string
  ): Promise<GitHubOperationResult<FileInfo[]>> {
    try {
      const query = ref ? `?ref=${ref}` : '';
      const endpoint = `/repos/${owner}/${repo}/contents/${path}${query}`;
      const data = await this.request<FileInfo[]>( 'GET', endpoint );
      return { success: true, data, timestamp: Date.now() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Create a pull request
   */
  async createPullRequest(
    owner: string,
    repo: string,
    options: PullRequestOptions
  ): Promise<GitHubOperationResult<PullRequestInfo>> {
    try {
      const data = await this.request<PullRequestInfo>(
        'POST',
        `/repos/${owner}/${repo}/pulls`,
        {
          title: options.title,
          body: options.body,
          head: options.head,
          base: options.base,
          maintainer_can_modify: options.maintainerCanModify,
          draft: options.draft,
        }
      );
      return { success: true, data, timestamp: Date.now() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Get pull request information
   */
  async getPullRequest(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<GitHubOperationResult<PullRequestInfo>> {
    try {
      const data = await this.request<PullRequestInfo>(
        'GET',
        `/repos/${owner}/${repo}/pulls/${prNumber}`
      );
      return { success: true, data, timestamp: Date.now() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      };
    }
  }

  /**
   * List pull requests
   */
  async listPullRequests(
    owner: string,
    repo: string,
    state?: PullRequestState
  ): Promise<GitHubOperationResult<PullRequestInfo[]>> {
    try {
      const query = state ? `?state=${state}` : '';
      const endpoint = `/repos/${owner}/${repo}/pulls${query}`;
      const data = await this.request<PullRequestInfo[]>( 'GET', endpoint );
      return { success: true, data, timestamp: Date.now() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Merge a pull request
   */
  async mergePullRequest(
    owner: string,
    repo: string,
    prNumber: number,
    options?: MergePullRequestOptions
  ): Promise<GitHubOperationResult<PullRequestInfo>> {
    try {
      const data = await this.request<PullRequestInfo>(
        'PUT',
        `/repos/${owner}/${repo}/pulls/${prNumber}/merge`,
        {
          commit_title: options?.commitTitle,
          commit_message: options?.commitMessage,
          merge_method: options?.mergeMethod,
          sha: options?.sha,
        }
      );
      return { success: true, data, timestamp: Date.now() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Create a webhook
   */
  async createWebhook(
    owner: string,
    repo: string,
    config: WebhookConfig
  ): Promise<GitHubOperationResult<{ id: number }>> {
    try {
      const data = await this.request<{ id: number }>(
        'POST',
        `/repos/${owner}/${repo}/hooks`,
        {
          name: 'web',
          active: config.active !== false,
          events: config.events || ['push', 'pull_request'],
          config: {
            url: config.url,
            content_type: config.contentType || 'json',
            secret: config.secret,
            insecure_ssl: config.insecureSsl || '0',
          },
        }
      );
      return { success: true, data, timestamp: Date.now() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      };
    }
  }

  /**
   * List webhooks
   */
  async listWebhooks(
    owner: string,
    repo: string
  ): Promise<GitHubOperationResult<WebhookConfig[]>> {
    try {
      const data = await this.request<WebhookConfig[]>(
        'GET',
        `/repos/${owner}/${repo}/hooks`
      );
      return { success: true, data, timestamp: Date.now() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(
    owner: string,
    repo: string,
    hookId: number
  ): Promise<GitHubOperationResult<void>> {
    try {
      await this.request<void>(
        'DELETE',
        `/repos/${owner}/${repo}/hooks/${hookId}`
      );
      return { success: true, timestamp: Date.now() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Get authenticated user information
   */
  async getAuthenticatedUser(): Promise<GitHubOperationResult<{
    login: string;
    id: number;
    name: string;
    email: string;
  }>> {
    try {
      const data = await this.request<{
        login: string;
        id: number;
        name: string;
        email: string;
      }>('GET', '/user');
      return { success: true, data, timestamp: Date.now() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Get rate limit status
   */
  async getRateLimit(): Promise<GitHubOperationResult<{
    rate: { limit: number; used: number; remaining: number; reset: number };
    core: { limit: number; used: number; remaining: number; reset: number };
  }>> {
    try {
      const data = await this.request<{
        rate: { limit: number; used: number; remaining: number; reset: number };
        core: { limit: number; used: number; remaining: number; reset: number };
      }>('GET', '/rate_limit');
      return { success: true, data, timestamp: Date.now() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Add SoryOS metadata to commit message
   */
  formatCommitMessage(
    message: string,
    metadata?: SoryOSCommitMetadata
  ): string {
    if (!metadata) return message;

    const metaParts: string[] = [];
    
    if (metadata.agent) metaParts.push(`Agent: ${metadata.agent}`);
    if (metadata.model) metaParts.push(`Model: ${metadata.model}`);
    if (metadata.provider) metaParts.push(`Provider: ${metadata.provider}`);
    if (metadata.sessionId) metaParts.push(`Session: ${metadata.sessionId}`);
    if (metadata.workspaceId) metaParts.push(`Workspace: ${metadata.workspaceId}`);
    if (metadata.projectId) metaParts.push(`Project: ${metadata.projectId}`);
    if (metadata.sandboxId) metaParts.push(`Sandbox: ${metadata.sandboxId}`);
    if (metadata.environment) metaParts.push(`Env: ${metadata.environment}`);
    if (metadata.toolsUsed?.length) metaParts.push(`Tools: ${metadata.toolsUsed.join(', ')}`);
    if (metadata.commandsExecuted) metaParts.push(`Commands: ${metadata.commandsExecuted}`);
    if (metadata.filesModified) metaParts.push(`Files: ${metadata.filesModified}`);

    if (metaParts.length > 0) {
      return `${message}\n\n---\nBuilt with SoryOS Code\n${metaParts.join('\n')}`;
    }
    
    return message;
  }
}

/**
 * Create a new GitHub client with token
 */
export function createGitHubClient(token: string, owner?: string): GitHubClient {
  return new GitHubClient({
    token,
    owner: owner || '',
    userAgent: 'SoryOS-Code',
  });
}

/**
 * Singleton GitHub client
 */
let globalGitHubClient: GitHubClient | null = null;

/**
 * Get or create the global GitHub client
 */
export function getGitHubClient(config?: GitHubConfig): GitHubClient {
  if (!globalGitHubClient && config) {
    globalGitHubClient = new GitHubClient(config);
  }
  if (!globalGitHubClient) {
    throw new Error('GitHub client not initialized. Call createGitHubClient first.');
  }
  return globalGitHubClient;
}

/**
 * Set the global GitHub client
 */
export function setGitHubClient(client: GitHubClient): void {
  globalGitHubClient = client;
}

