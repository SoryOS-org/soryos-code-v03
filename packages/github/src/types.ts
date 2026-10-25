/**
 * @soryos/github
 * GitHub Integration Types and Interfaces
 */

/**
 * GitHub provider types
 */
export type GitHubProvider = 'github' | 'github-enterprise';

/**
 * Repository visibility
 */
export type RepositoryVisibility = 'public' | 'private' | 'internal';

/**
 * Pull request state
 */
export type PullRequestState = 'open' | 'closed' | 'merged' | 'draft';

/**
 * Pull request merge method
 */
export type PullRequestMergeMethod = 'merge' | 'squash' | 'rebase';

/**
 * Branch protection rule types
 */
export type BranchProtectionRule = {
  requiredStatusChecks?: string[];
  enforceAdmins?: boolean;
  requiredPullRequestReviews?: {
    requiredApprovingReviewCount?: number;
    dismissStaleReviews?: boolean;
    requireCodeOwnerReviews?: boolean;
  };
  restrictions?: {
    users?: string[];
    teams?: string[];
  };
  requiredLinearHistory?: boolean;
  allowForcePushes?: boolean;
  allowDeletions?: boolean;
  blockCreations?: boolean;
  requiredSignatures?: boolean;
};

/**
 * GitHub configuration
 */
export interface GitHubConfig {
  token: string;
  owner: string;
  repository?: string;
  baseUrl?: string; // For GitHub Enterprise
  userAgent?: string;
  timeout?: number;
}

/**
 * Repository information
 */
export interface RepositoryInfo {
  id: number;
  name: string;
  fullName: string;
  owner: {
    login: string;
    id: number;
  };
  private: boolean;
  htmlUrl: string;
  cloneUrl: string;
  sshUrl: string;
  defaultBranch: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
  size: number;
  stargazersCount: number;
  watchersCount: number;
  forksCount: number;
  openIssuesCount: number;
  language?: string;
  topics?: string[];
  visibility?: RepositoryVisibility;
}

/**
 * Branch information
 */
export interface BranchInfo {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
  protection?: BranchProtectionRule;
}

/**
 * Commit information
 */
export interface CommitInfo {
  sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    date: string;
  };
  committer: {
    name: string;
    email: string;
    date: string;
  };
  parents: { sha: string }[];
  url: string;
}

/**
 * File information
 */
export interface FileInfo {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  htmlUrl: string;
  gitUrl: string;
  downloadUrl: string;
  type: 'file' | 'dir' | 'symlink' | 'submodule';
}

/**
 * Pull request information
 */
export interface PullRequestInfo {
  id: number;
  number: number;
  title: string;
  body: string;
  state: PullRequestState;
  open: boolean;
  closed: boolean;
  merged: boolean;
  mergeable: boolean | null;
  rebaseable: boolean | null;
  mergeableState: string;
  head: {
    label: string;
    ref: string;
    sha: string;
    repo: RepositoryInfo;
  };
  base: {
    label: string;
    ref: string;
    sha: string;
    repo: RepositoryInfo;
  };
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  mergedAt: string | null;
  user: {
    login: string;
    id: number;
  };
  assignee?: {
    login: string;
    id: number;
  };
  assignees?: {
    login: string;
    id: number;
  }[];
  requestedReviewers?: {
    login: string;
    id: number;
  }[];
  labels?: {
    name: string;
    color: string;
  }[];
  milestone?: {
    number: number;
    title: string;
  };
  commentsCount: number;
  reviewCommentsCount: number;
  commitsCount: number;
  additions: number;
  deletions: number;
  changedFiles: number;
}

/**
 * Webhook configuration
 */
export interface WebhookConfig {
  url: string;
  secret?: string;
  contentType?: 'json' | 'form';
  insecureSsl?: boolean;
  active?: boolean;
  events?: string[];
}

/**
 * Webhook event types
 */
export type WebhookEventType =
  | 'push'
  | 'pull_request'
  | 'issues'
  | 'issue_comment'
  | 'commit_comment'
  | 'create'
  | 'delete'
  | 'fork'
  | 'gollum' // Wiki
  | 'label'
  | 'member'
  | 'membership'
  | 'milestone'
  | 'organization'
  | 'org_block'
  | 'page_build'
  | 'project'
  | 'project_card'
  | 'project_column'
  | 'public'
  | 'pull_request_review'
  | 'pull_request_review_comment'
  | 'release'
  | 'repository'
  | 'repository_import'
  | 'repository_vulnerability_alert'
  | 'status'
  | 'team'
  | 'team_add';

/**
 * Webhook event payload
 */
export interface WebhookEventPayload {
  action?: string;
  repository?: RepositoryInfo;
  sender?: {
    login: string;
    id: number;
  };
  installation?: {
    id: number;
  };
  [key: string]: unknown;
}

/**
 * Create repository options
 */
export interface CreateRepositoryOptions {
  name: string;
  description?: string;
  private?: boolean;
  visibility?: RepositoryVisibility;
  autoInit?: boolean;
  licenseTemplate?: string;
  gitignoreTemplate?: string;
  allowSquashMerge?: boolean;
  allowMergeCommit?: boolean;
  allowRebaseMerge?: boolean;
  deleteBranchOnMerge?: boolean;
  hasIssues?: boolean;
  hasProjects?: boolean;
  hasWiki?: boolean;
  hasDownloads?: boolean;
  defaultBranch?: string;
  squashMergeCommitTitle?: string;
  squashMergeCommitMessage?: string;
  mergeCommitTitle?: string;
  mergeCommitMessage?: string;
}

/**
 * Commit options
 */
export interface CommitOptions {
  message: string;
  tree?: string;
  parents?: string[];
  author?: {
    name: string;
    email: string;
    date?: string;
  };
  committer?: {
    name: string;
    email: string;
    date?: string;
  };
}

/**
 * Push options
 */
export interface PushOptions {
  force?: boolean;
  tags?: boolean;
}

/**
 * Pull request options
 */
export interface PullRequestOptions {
  title: string;
  body?: string;
  head: string;
  base: string;
  maintainerCanModify?: boolean;
  draft?: boolean;
}

/**
 * Merge pull request options
 */
export interface MergePullRequestOptions {
  commitTitle?: string;
  commitMessage?: string;
  mergeMethod?: PullRequestMergeMethod;
  sha?: string;
}

/**
 * Branch creation options
 */
export interface CreateBranchOptions {
  branch: string;
  sha?: string;
}

/**
 * README template types
 */
export type READMETemplateType = 
  | 'nodejs'
  | 'react'
  | 'nextjs'
  | 'typescript'
  | 'python'
  | 'go'
  | 'rust'
  | 'java'
  | 'csharp'
  | 'php'
  | 'ruby'
  | 'swift'
  | 'kotlin'
  | 'generic';

/**
 * README template configuration
 */
export interface READMETemplateConfig {
  type: READMETemplateType;
  projectName: string;
  description?: string;
  author?: string;
  version?: string;
  license?: string;
  dependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  features?: string[];
  installation?: string;
  usage?: string;
  contributing?: string;
  /** Custom content appended to README (e.g., generated docs). */
  customContent?: string;
  /** Map of custom section titles to their markdown content. */
  customSections?: Record<string, string>;
}

/**
 * Auto README generation options
 */
export interface AutoREADMEOptions {
  template?: READMETemplateType | READMETemplateConfig;
  projectName: string;
  description?: string;
  repository?: string;
  owner?: string;
  technologies?: string[];
  features?: string[];
  installation?: string;
  usage?: string;
  contributing?: string;
  /** Map of custom section titles to their markdown content. */
  customSections?: Record<string, string>;
  license?: string;
  author?: string;
  version?: string;
  customContent?: string;
}

/**
 * Commit template configuration
 */
export interface CommitTemplateConfig {
  scope?: string;
  type: 'feat' | 'fix' | 'docs' | 'style' | 'refactor' | 'perf' | 'test' | 'chore' | 'revert' | 'custom';
  description: string;
  breakingChange?: boolean;
  issue?: string;
  customTemplate?: string;
}

/**
 * GitHub operations result
 */
export interface GitHubOperationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: number;
}

/**
 * GitHub session state
 */
export interface GitHubSessionState {
  sessionId: string;
  repository?: string;
  owner?: string;
  branch?: string;
  lastCommit?: string;
  lastOperation?: string;
  lastError?: string;
  isAuthenticated: boolean;
}

/**
 * SoryOS Code metadata for commits
 */
export interface SoryOSCommitMetadata {
  soryosVersion?: string;
  agent?: string;
  model?: string;
  provider?: string;
  sessionId?: string;
  workspaceId?: string;
  projectId?: string;
  sandboxId?: string;
  environment?: string;
  toolsUsed?: string[];
  commandsExecuted?: number;
  filesModified?: number;
}

/**
 * Codespace information
 */
export interface Codespace {
  id: number;
  name: string;
  owner: {
    login: string;
    id: number;
  };
  repository: RepositoryInfo;
  machine: {
    display_name: string;
    name: string;
    storage_in_bytes: number;
    cpus: number;
    memory_in_bytes: number;
  };
  state: 'Unknown' | 'Created' | 'Queued' | 'Provisioning' | 'Available' | 'Awaiting' | 'Unavailable' | 'Deleted' | 'Moved' | 'Shutdown' | 'Archived' | 'Starting' | 'ShuttingDown' | 'Failed' | 'Exporting' | 'Updating' | 'Rebuilding';
  created_at: string;
  updated_at: string;
  last_used_at: string;
  billable_owner: {
    login: string;
    id: number;
  };
  location: string;
  git_status: {
    ahead?: number;
    behind?: number;
    has_unpushed_changes?: boolean;
    has_uncommitted_changes?: boolean;
    ref?: string;
  };
  connection_url: string;
  web_url: string;
  environment_id: string;
}

/**
 * Options for creating a codespace
 */
export interface CreateCodespaceOptions {
  branch: string;
  machine?: string;
  location?: string;
}

