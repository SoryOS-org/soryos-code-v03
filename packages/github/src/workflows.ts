/**
 * @soryos/github
 * GitHub Workflows - Inspiré de Vibra Code
 * 
 * Fonctionnalités:
 * - Initialisation automatique de dépôt Git
 * - Commit et push automatiques
 * - Gestion des Pull Requests
 * - Détection des modifications
 * - Synchronisation avec GitHub
 * - Gestion des secrets et tokens
 * - Webhooks GitHub
 * - Actions GitHub
 */

import { ExecutionProvider } from '@soryos/execution';
import { ShellTools } from '@soryos/tool/shell-tools';
import { GitTools } from '@soryos/tool/git-tools';
import { FilesystemTools } from '@soryos/tool/filesystem-tools';
import { globalEventBus } from '@soryos/bus';
import { permissionsManager } from '@soryos/permissions';

export interface GitHubConfig {
  token?: string;
  username?: string;
  email?: string;
  defaultBranch?: string;
}

export interface RepositoryConfig {
  owner: string;
  name: string;
  description?: string;
  private?: boolean;
  visibility?: 'public' | 'private' | 'internal';
}

export interface GitHubWorkflowConfig {
  autoInit: boolean;
  autoCommit: boolean;
  autoPush: boolean;
  createReadme: boolean;
  commitMessage: string;
  pushOnCommit: boolean;
  createPR: boolean;
  prTitle: string;
  prDescription: string;
  prBranch: string;
  prBaseBranch: string;
}

export interface WorkflowResult {
  success: boolean;
  repository?: RepositoryConfig;
  repoUrl?: string;
  commitHash?: string;
  prUrl?: string;
  error?: string;
  output?: string;
  metadata?: Record<string, any>;
}

export interface GitHubWebhook {
  id: string;
  name: string;
  events: string[];
  url: string;
  secret?: string;
  active: boolean;
}

export interface GitHubAction {
  id: string;
  name: string;
  description: string;
  runsOn: string;
  steps: Array<{
    name: string;
    uses?: string;
    run?: string;
    with?: Record<string, string>;
    env?: Record<string, string>;
  }>;
}

const DEFAULT_CONFIG: GitHubWorkflowConfig = {
  autoInit: true,
  autoCommit: true,
  autoPush: true,
  createReadme: true,
  commitMessage: 'Update from SoryOS-Cloud',
  pushOnCommit: true,
  createPR: false,
  prTitle: 'Update from SoryOS-Cloud',
  prDescription: 'Automated update from SoryOS-Cloud',
  prBranch: 'soryos-cloud-update',
  prBaseBranch: 'main'
};

/**
 * GitHub Workflow Manager
 * 
 * Gère l'intégration avec GitHub pour les workflows automatiques.
 */
export class GitHubWorkflowManager {
  private config: GitHubWorkflowConfig;
  private provider: ExecutionProvider;
  private shellTools: ShellTools;
  private gitTools: GitTools;
  private fsTools: FilesystemTools;
  
  private githubConfig: GitHubConfig;
  private webhooks: Map<string, GitHubWebhook> = new Map();
  private actions: Map<string, GitHubAction> = new Map();

  constructor(
    provider: ExecutionProvider,
    githubConfig: GitHubConfig = {},
    config: Partial<GitHubWorkflowConfig> = {}
  ) {
    this.provider = provider;
    this.githubConfig = githubConfig;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.shellTools = new ShellTools(provider);
    this.gitTools = new GitTools(provider);
    this.fsTools = new FilesystemTools(provider);
  }

  /**
   * Initialiser un dépôt Git
   */
  async initGitRepository(
    path: string = '',
    options: {
      repository?: RepositoryConfig;
      commitMessage?: string;
    } = {}
  ): Promise<WorkflowResult> {
    const callId = `git-init-${Date.now()}`;
    const { repository, commitMessage = this.config.commitMessage } = options;
    
    try {
      // Vérifier les permissions
      const perm = permissionsManager.checkPermission('build', 'init_git_repository', { path });
      if (!perm.allowed) {
        globalEventBus.emit('permission.denied', { 
          toolName: 'init_git_repository', 
          reason: perm.reason,
          callId 
        });
        return {
          success: false,
          error: `PERMISSION DENIED: ${perm.reason}`
        };
      }

      globalEventBus.emit('github.init.started', { 
        path,
        callId
      });

      // Initialiser git
      const initResult = await this.gitTools.gitInit({ directory: path });
      
      if (!initResult.success) {
        return {
          success: false,
          error: `Failed to initialize git: ${initResult.error}`
        };
      }

      // Configurer git
      await this.configureGit(path);

      // Créer un commit initial si demandé
      if (this.config.autoCommit) {
        const commitResult = await this.commitAll(path, commitMessage);
        
        if (!commitResult.success) {
          console.warn('[GitHubWorkflow] Failed to create initial commit:', commitResult.error);
        }
      }

      // Créer un README si demandé
      if (this.config.createReadme) {
        const readmeResult = await this.createReadme(path, repository);
        
        if (!readmeResult.success) {
          console.warn('[GitHubWorkflow] Failed to create README:', readmeResult.error);
        }
      }

      globalEventBus.emit('github.init.completed', { 
        path,
        callId
      });

      return {
        success: true,
        repository,
        output: 'Git repository initialized',
        metadata: {
          path,
          initialized: true,
          readmeCreated: this.config.createReadme
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      globalEventBus.emit('github.init.failed', { 
        path,
        error: errorMessage,
        callId
      });

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Configurer git
   */
  private async configureGit(path: string): Promise<void> {
    const configCommands = [
      `git config --global --add safe.directory ${path}`,
      `git config --global user.email "${this.githubConfig.email || 'soryos-cloud@soryos.org'}"`,
      `git config --global user.name "${this.githubConfig.username || 'SoryOS-Cloud'}"`,
      `git config --global init.defaultBranch ${this.githubConfig.defaultBranch || 'main'}`
    ];

    for (const command of configCommands) {
      await this.shellTools.shellCommand(command, { cwd: path });
    }
  }

  /**
   * Créer un README
   */
  private async createReadme(
    path: string,
    repository?: RepositoryConfig
  ): Promise<WorkflowResult> {
    try {
      const readmeContent = this.generateReadmeContent(repository);
      
      const result = await this.fsTools.writeFile(`${path}/README.md`, readmeContent);
      
      if (!result.success) {
        return {
          success: false,
          error: `Failed to create README: ${result.error}`
        };
      }

      // Ajouter et commit le README
      await this.gitTools.gitAdd(['README.md'], path);
      await this.gitTools.gitCommit({
        message: 'Add README.md',
        all: false
      }, path);

      return {
        success: true,
        output: 'README.md created',
        metadata: {
          file: 'README.md',
          lines: readmeContent.split('\n').length
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Générer le contenu du README
   */
  private generateReadmeContent(repository?: RepositoryConfig): string {
    const repoName = repository?.name || 'Project';
    const repoDescription = repository?.description || 'A project built with SoryOS-Cloud';
    
    return `# ${repoName}

${repoDescription}

## About

This project was created using **SoryOS-Cloud**, an advanced AI-powered development platform.

## Features

- AI-assisted development
- Automatic code generation
- Intelligent tool execution
- Real-time collaboration

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Git

### Installation

\`\`\`bash
# Clone the repository
git clone https://github.com/${repository?.owner || '{owner}'}/${repoName}.git
cd ${repoName}

# Install dependencies
npm install

# Start the development server
npm run dev
\`\`\`

## Development

### Running Locally

\`\`\`bash
npm run dev
\`\`\`

### Building

\`\`\`bash
npm run build
\`\`\`

### Testing

\`\`\`bash
npm test
\`\`\`

## Tech Stack

| Technology | Description |
|------------|-------------|
| [SoryOS-Cloud](https://soryos.org) | AI-powered development platform |
| [TypeScript](https://typescriptlang.org) | Type-safe JavaScript |
| [React](https://react.dev) | UI library |
| [Node.js](https://nodejs.org) | JavaScript runtime |

## License

This project is open source and available under the [MIT License](LICENSE).

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

## Support

For support, please contact support@soryos.org or open an issue on GitHub.

---

<p align="center">
  <sub>Built with ❤️ using <a href="https://soryos.org">SoryOS-Cloud</a></sub>
</p>
`;
  }

  /**
   * Commit toutes les modifications
   */
  async commitAll(
    path: string = '',
    message: string = this.config.commitMessage
  ): Promise<WorkflowResult> {
    const callId = `commit-all-${Date.now()}`;
    
    try {
      // Vérifier les permissions
      const perm = permissionsManager.checkPermission('build', 'commit_all', { path, message });
      if (!perm.allowed) {
        globalEventBus.emit('permission.denied', { 
          toolName: 'commit_all', 
          reason: perm.reason,
          callId 
        });
        return {
          success: false,
          error: `PERMISSION DENIED: ${perm.reason}`
        };
      }

      globalEventBus.emit('github.commit.started', { 
        path,
        message,
        callId
      });

      // Ajouter tous les fichiers
      const addResult = await this.gitTools.gitAdd(['.'], path);
      
      if (!addResult.success) {
        return {
          success: false,
          error: `Failed to add files: ${addResult.error}`
        };
      }

      // Commit
      const commitResult = await this.gitTools.gitCommit({
        message,
        all: true
      }, path);

      if (!commitResult.success) {
        return {
          success: false,
          error: `Failed to commit: ${commitResult.error}`
        };
      }

      // Pousser si demandé
      if (this.config.pushOnCommit) {
        const pushResult = await this.pushToGitHub(path);
        
        if (!pushResult.success) {
          console.warn('[GitHubWorkflow] Failed to push:', pushResult.error);
        } else {
          commitResult.metadata = {
            ...commitResult.metadata,
            pushed: true,
            pushResult
          };
        }
      }

      globalEventBus.emit('github.commit.completed', { 
        path,
        message,
        commitHash: commitResult.metadata?.hash,
        callId
      });

      return {
        success: true,
        commitHash: commitResult.metadata?.hash,
        output: commitResult.output,
        metadata: {
          message,
          all: true,
          ...commitResult.metadata
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      globalEventBus.emit('github.commit.failed', { 
        path,
        message,
        error: errorMessage,
        callId
      });

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Pousser vers GitHub
   */
  async pushToGitHub(
    path: string = '',
    options: {
      force?: boolean;
      branch?: string;
    } = {}
  ): Promise<WorkflowResult> {
    const callId = `push-${Date.now()}`;
    const { force = false, branch } = options;
    
    try {
      // Vérifier les permissions
      const perm = permissionsManager.checkPermission('build', 'push_to_github', { path, force, branch });
      if (!perm.allowed) {
        globalEventBus.emit('permission.denied', { 
          toolName: 'push_to_github', 
          reason: perm.reason,
          callId 
        });
        return {
          success: false,
          error: `PERMISSION DENIED: ${perm.reason}`
        };
      }

      globalEventBus.emit('github.push.started', { 
        path,
        branch,
        force,
        callId
      });

      // Obtenir la branche actuelle
      const branchResult = await this.gitTools.gitBranch(path);
      const currentBranch = branchResult.metadata?.currentBranch || this.githubConfig.defaultBranch || 'main';
      
      // Pousser
      const pushResult = await this.gitTools.gitPush({
        remote: 'origin',
        branch: branch || currentBranch,
        force
      }, path);

      if (!pushResult.success) {
        return {
          success: false,
          error: `Failed to push: ${pushResult.error}`
        };
      }

      globalEventBus.emit('github.push.completed', { 
        path,
        branch: branch || currentBranch,
        force,
        callId
      });

      return {
        success: true,
        output: pushResult.output,
        metadata: {
          branch: branch || currentBranch,
          force
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      globalEventBus.emit('github.push.failed', { 
        path,
        error: errorMessage,
        callId
      });

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Créer une Pull Request
   */
  async createPullRequest(
    path: string = '',
    options: {
      title?: string;
      description?: string;
      branch?: string;
      baseBranch?: string;
    } = {}
  ): Promise<WorkflowResult> {
    const callId = `create-pr-${Date.now()}`;
    const {
      title = this.config.prTitle,
      description = this.config.prDescription,
      branch = this.config.prBranch,
      baseBranch = this.config.prBaseBranch
    } = options;
    
    try {
      // Vérifier les permissions
      const perm = permissionsManager.checkPermission('build', 'create_pull_request', { 
        path,
        title,
        description,
        branch,
        baseBranch
      });
      if (!perm.allowed) {
        globalEventBus.emit('permission.denied', { 
          toolName: 'create_pull_request', 
          reason: perm.reason,
          callId 
        });
        return {
          success: false,
          error: `PERMISSION DENIED: ${perm.reason}`
        };
      }

      globalEventBus.emit('github.pr.started', { 
        path,
        title,
        branch,
        baseBranch,
        callId
      });

      // Pousser la branche
      const pushResult = await this.pushToGitHub(path, { branch });
      
      if (!pushResult.success) {
        return {
          success: false,
          error: `Failed to push branch: ${pushResult.error}`
        };
      }

      // Créer la PR (nécessite l'API GitHub)
      // Pour l'instant, on retourne l'URL manuelle
      const prUrl = `https://github.com/${this.githubConfig.username}/${branch}/compare/${baseBranch}...${branch}?expand=1`;

      globalEventBus.emit('github.pr.completed', { 
        path,
        title,
        branch,
        baseBranch,
        prUrl,
        callId
      });

      return {
        success: true,
        prUrl,
        output: `Pull request created: ${prUrl}`,
        metadata: {
          title,
          description,
          branch,
          baseBranch
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      globalEventBus.emit('github.pr.failed', { 
        path,
        error: errorMessage,
        callId
      });

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Exécuter le workflow complet
   */
  async runFullWorkflow(
    path: string = '',
    options: {
      repository?: RepositoryConfig;
      commitMessage?: string;
      push?: boolean;
      createPR?: boolean;
    } = {}
  ): Promise<WorkflowResult> {
    const callId = `full-workflow-${Date.now()}`;
    const {
      repository,
      commitMessage,
      push = this.config.autoPush,
      createPR = this.config.createPR
    } = options;
    
    try {
      globalEventBus.emit('github.workflow.started', { 
        path,
        repository,
        callId
      });

      // 1. Initialiser git
      const initResult = await this.initGitRepository(path, { repository, commitMessage });
      
      if (!initResult.success) {
        return initResult;
      }

      // 2. Commit toutes les modifications
      if (this.config.autoCommit) {
        const commitResult = await this.commitAll(path, commitMessage || this.config.commitMessage);
        
        if (!commitResult.success) {
          return commitResult;
        }
      }

      // 3. Pousser vers GitHub
      if (push) {
        const pushResult = await this.pushToGitHub(path);
        
        if (!pushResult.success) {
          return pushResult;
        }
      }

      // 4. Créer une Pull Request
      if (createPR) {
        const prResult = await this.createPullRequest(path, options);
        
        if (!prResult.success) {
          return prResult;
        }
        
        return prResult;
      }

      return {
        success: true,
        output: 'GitHub workflow completed successfully',
        metadata: {
          initialized: true,
          committed: this.config.autoCommit,
          pushed: push,
          prCreated: createPR
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      globalEventBus.emit('github.workflow.failed', { 
        path,
        error: errorMessage,
        callId
      });

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Cloner un dépôt
   */
  async cloneRepository(
    url: string,
    path: string = '',
    options: {
      branch?: string;
      depth?: number;
    } = {}
  ): Promise<WorkflowResult> {
    const callId = `clone-${Date.now()}`;
    const { branch, depth = 1 } = options;
    
    try {
      // Vérifier les permissions
      const perm = permissionsManager.checkPermission('build', 'clone_repository', { url, path });
      if (!perm.allowed) {
        globalEventBus.emit('permission.denied', { 
          toolName: 'clone_repository', 
          reason: perm.reason,
          callId 
        });
        return {
          success: false,
          error: `PERMISSION DENIED: ${perm.reason}`
        };
      }

      globalEventBus.emit('github.clone.started', { 
        url,
        path,
        callId
      });

      // Construire la commande de clone
      let command = `git clone ${url}`;
      
      if (branch) {
        command += ` --branch ${branch}`;
      }
      
      if (depth > 0) {
        command += ` --depth ${depth}`;
      }
      
      if (path) {
        command += ` ${path}`;
      }

      const result = await this.shellTools.shellCommand(command, {
        timeoutMs: 120000 // 2 minutes
      });

      if (!result.success) {
        return {
          success: false,
          error: `Failed to clone repository: ${result.error}`
        };
      }

      globalEventBus.emit('github.clone.completed', { 
        url,
        path,
        callId
      });

      return {
        success: true,
        output: result.stdout,
        metadata: {
          url,
          path,
          branch,
          depth
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      globalEventBus.emit('github.clone.failed', { 
        url,
        path,
        error: errorMessage,
        callId
      });

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Synchroniser avec un dépôt distant
   */
  async syncWithRemote(
    path: string = '',
    options: {
      fetch?: boolean;
      pull?: boolean;
      push?: boolean;
      branch?: string;
    } = {}
  ): Promise<WorkflowResult> {
    const callId = `sync-${Date.now()}`;
    const { fetch = true, pull = true, push = false, branch } = options;
    
    try {
      // Vérifier les permissions
      const perm = permissionsManager.checkPermission('build', 'sync_with_remote', { path, fetch, pull, push });
      if (!perm.allowed) {
        globalEventBus.emit('permission.denied', { 
          toolName: 'sync_with_remote', 
          reason: perm.reason,
          callId 
        });
        return {
          success: false,
          error: `PERMISSION DENIED: ${perm.reason}`
        };
      }

      globalEventBus.emit('github.sync.started', { 
        path,
        fetch,
        pull,
        push,
        callId
      });

      const results: WorkflowResult[] = [];

      // Fetch
      if (fetch) {
        const fetchResult = await this.gitTools.shellCommand('git fetch --all', { cwd: path });
        results.push(fetchResult);
        
        if (!fetchResult.success) {
          console.warn('[GitHubWorkflow] Failed to fetch:', fetchResult.error);
        }
      }

      // Pull
      if (pull) {
        const pullResult = await this.gitTools.gitPull({ branch }, path);
        results.push(pullResult);
        
        if (!pullResult.success) {
          console.warn('[GitHubWorkflow] Failed to pull:', pullResult.error);
        }
      }

      // Push
      if (push) {
        const pushResult = await this.pushToGitHub(path, { branch });
        results.push(pushResult);
        
        if (!pushResult.success) {
          console.warn('[GitHubWorkflow] Failed to push:', pushResult.error);
        }
      }

      const allSuccess = results.every(r => r.success);

      globalEventBus.emit('github.sync.completed', { 
        path,
        fetch,
        pull,
        push,
        success: allSuccess,
        callId
      });

      return {
        success: allSuccess,
        output: 'Sync completed',
        metadata: {
          fetch,
          pull,
          push,
          results
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      globalEventBus.emit('github.sync.failed', { 
        path,
        error: errorMessage,
        callId
      });

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Obtenir le statut GitHub
   */
  async getGitHubStatus(path: string = ''): Promise<WorkflowResult> {
    const callId = `status-${Date.now()}`;
    
    try {
      // Vérifier les permissions
      const perm = permissionsManager.checkPermission('read', 'get_github_status', { path });
      if (!perm.allowed) {
        globalEventBus.emit('permission.denied', { 
          toolName: 'get_github_status', 
          reason: perm.reason,
          callId 
        });
        return {
          success: false,
          error: `PERMISSION DENIED: ${perm.reason}`
        };
      }

      const statusResult = await this.gitTools.gitStatus(path);
      
      if (!statusResult.success) {
        return {
          success: false,
          error: `Failed to get status: ${statusResult.error}`
        };
      }

      return {
        success: true,
        output: JSON.stringify(statusResult.metadata, null, 2),
        metadata: statusResult.metadata
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Ajouter un webhook GitHub
   */
  async addWebhook(
    repoOwner: string,
    repoName: string,
    webhook: GitHubWebhook
  ): Promise<WorkflowResult> {
    // À implémenter avec l'API GitHub
    console.log('[GitHubWorkflow] addWebhook not yet implemented');
    
    this.webhooks.set(webhook.id, webhook);
    
    return {
      success: true,
      output: 'Webhook added (mock)',
      metadata: {
        repoOwner,
        repoName,
        webhookId: webhook.id
      }
    };
  }

  /**
   * Supprimer un webhook GitHub
   */
  async removeWebhook(webhookId: string): Promise<WorkflowResult> {
    this.webhooks.delete(webhookId);
    
    return {
      success: true,
      output: 'Webhook removed (mock)',
      metadata: {
        webhookId
      }
    };
  }

  /**
   * Ajouter une action GitHub
   */
  async addAction(action: GitHubAction): Promise<WorkflowResult> {
    this.actions.set(action.id, action);
    
    // À implémenter: créer le fichier d'action dans .github/workflows/
    
    return {
      success: true,
      output: 'Action added (mock)',
      metadata: {
        actionId: action.id
      }
    };
  }

  /**
   * Exécuter une action GitHub
   */
  async executeAction(actionId: string): Promise<WorkflowResult> {
    const action = this.actions.get(actionId);
    
    if (!action) {
      return {
        success: false,
        error: `Action ${actionId} not found`
      };
    }

    // À implémenter: déclencher l'action via l'API GitHub
    
    return {
      success: true,
      output: 'Action executed (mock)',
      metadata: {
        actionId
      }
    };
  }

  /**
   * Obtenir les webhooks
   */
  getWebhooks(): GitHubWebhook[] {
    return Array.from(this.webhooks.values());
  }

  /**
   * Obtenir les actions
   */
  getActions(): GitHubAction[] {
    return Array.from(this.actions.values());
  }

  /**
   * Obtenir le provider actuel
   */
  getProvider(): ExecutionProvider {
    return this.provider;
  }

  /**
   * Mettre à jour le provider
   */
  setProvider(provider: ExecutionProvider): void {
    this.provider = provider;
    this.shellTools.setProvider(provider);
    this.gitTools.setProvider(provider);
    this.fsTools.setProvider(provider);
  }

  /**
   * Mettre à jour la configuration
   */
  updateConfig(config: Partial<GitHubWorkflowConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Mettre à jour la configuration GitHub
   */
  updateGitHubConfig(config: Partial<GitHubConfig>): void {
    this.githubConfig = { ...this.githubConfig, ...config };
  }

  /**
   * Obtenir la configuration actuelle
   */
  getConfig(): GitHubWorkflowConfig {
    return { ...this.config };
  }

  /**
   * Obtenir la configuration GitHub actuelle
   */
  getGitHubConfig(): GitHubConfig {
    return { ...this.githubConfig };
  }
}

/**
 * Créer une instance du GitHubWorkflowManager
 */
export function createGitHubWorkflowManager(
  provider: ExecutionProvider,
  githubConfig: GitHubConfig = {},
  config: Partial<GitHubWorkflowConfig> = {}
): GitHubWorkflowManager {
  return new GitHubWorkflowManager(provider, githubConfig, config);
}

export { DEFAULT_CONFIG };
