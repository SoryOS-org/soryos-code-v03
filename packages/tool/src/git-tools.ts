/**
 * @soryos/tool
 * Git Tools - Extrait et adapté de Vibra Code
 * 
 * Fonctionnalités:
 * - git_status: Statut git complet
 * - git_diff: Diff des modifications
 * - git_log: Historique des commits
 * - git_branch: Liste des branches
 * - git_commit: Commit des modifications
 * - git_push: Push vers remote
 * - git_pull: Pull depuis remote
 * - git_init: Initialisation d'un dépôt
 * - git_add: Ajout de fichiers
 * - git_reset: Reset des modifications
 * - git_checkout: Checkout d'une branche ou fichier
 * - git_merge: Merge de branches
 * - github_pr: Création de Pull Request (via API)
 * 
 * Règle: NO REAL EXECUTION = NO SUCCESS
 */

import { ExecutionProvider } from '@soryos/execution';
import { SessionData } from '@soryos/schema';
import { globalEventBus } from '@soryos/bus';
import { permissionsManager } from '@soryos/permissions';
import { ShellTools } from './shell-tools';

export interface GitStatus {
  branch: string;
  commitsAhead: number;
  commitsBehind: number;
  changedFiles: string[];
  stagedFiles: string[];
  untrackedFiles: string[];
  deletedFiles: string[];
  isClean: boolean;
}

export interface GitLogEntry {
  hash: string;
  author: string;
  date: string;
  message: string;
  filesChanged: number;
}

export interface GitBranch {
  name: string;
  current: boolean;
  remote?: string;
  ahead?: number;
  behind?: number;
}

export interface GitDiff {
  file: string;
  additions: number;
  deletions: number;
  hunks: Array<{
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    content: string;
  }>;
}

export interface GitCommitOptions {
  message: string;
  files?: string[];
  all?: boolean;
  amend?: boolean;
}

export interface GitPushOptions {
  remote?: string;
  branch?: string;
  force?: boolean;
}

export interface GitPullOptions {
  remote?: string;
  branch?: string;
  rebase?: boolean;
}

export interface GitInitOptions {
  directory?: string;
  bare?: boolean;
}

export interface GitToolResult {
  success: boolean;
  output?: string;
  error?: string;
  metadata?: Record<string, any>;
  verified?: boolean;
}

export interface GitHubPRResult {
  success: boolean;
  url?: string;
  error?: string;
  prNumber?: number;
}

/**
 * Git Tools Implementation
 * 
 * Ces outils exécutent des commandes Git réelles et fournissent des informations
 * structurées sur l'état du dépôt.
 */
export class GitTools {
  private provider: ExecutionProvider;
  private shellTools: ShellTools;

  constructor(provider: ExecutionProvider) {
    this.provider = provider;
    this.shellTools = new ShellTools(provider);
  }

  /**
   * Obtenir le statut git
   * 
   * @param path - Répertoire du dépôt (optionnel, racine par défaut)
   * @returns Statut git structuré
   */
  async gitStatus(path: string = ''): Promise<GitToolResult> {
    const callId = `git-status-${Date.now()}`;
    
    try {
      // Vérifier les permissions
      const perm = permissionsManager.checkPermission('read', 'git_status', { path });
      if (!perm.allowed) {
        globalEventBus.emit('permission.denied', { 
          toolName: 'git_status', 
          reason: perm.reason,
          callId 
        });
        return {
          success: false,
          error: `PERMISSION DENIED: ${perm.reason}`
        };
      }

      globalEventBus.emit('tool.started', { 
        toolName: 'git_status', 
        input: { path },
        callId 
      });

      // Exécuter git status
      const result = await this.shellTools.shellCommand('git status --porcelain --branch', {
        cwd: path
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to get git status'
        };
      }

      // Parser le résultat
      const status = this.parseGitStatus(result.stdout || '');
      
      const gitResult: GitToolResult = {
        success: true,
        output: JSON.stringify(status, null, 2),
        metadata: status,
        verified: true
      };

      globalEventBus.emit('tool.completed', { 
        toolName: 'git_status', 
        output: gitResult.output,
        callId,
        metadata: gitResult.metadata 
      });

      return gitResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      globalEventBus.emit('tool.failed', { 
        toolName: 'git_status', 
        error: errorMessage,
        callId 
      });

      return {
        success: false,
        error: `Git status failed: ${errorMessage}`
      };
    }
  }

  /**
   * Parser le résultat de git status
   */
  private parseGitStatus(output: string): GitStatus {
    const status: GitStatus = {
      branch: '',
      commitsAhead: 0,
      commitsBehind: 0,
      changedFiles: [],
      stagedFiles: [],
      untrackedFiles: [],
      deletedFiles: [],
      isClean: true
    };

    const lines = output.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Branch info
      if (trimmed.startsWith('## ')) {
        const branchMatch = trimmed.match(/##\s+([^\s,]+)(?:,\s*([^\s]+))?/);
        if (branchMatch) {
          status.branch = branchMatch[1];
          
          // Ahead/behind info
          if (branchMatch[2]) {
            const aheadBehind = branchMatch[2].split('/');
            status.commitsAhead = parseInt(aheadBehind[0]) || 0;
            status.commitsBehind = parseInt(aheadBehind[1]) || 0;
          }
        }
      }
      // Changed files (not staged)
      else if (trimmed.startsWith('??')) {
        const file = trimmed.substring(3).trim();
        status.untrackedFiles.push(file);
        status.isClean = false;
      }
      else if (trimmed.startsWith(' A')) {
        const file = trimmed.substring(3).trim();
        status.stagedFiles.push(file);
        status.isClean = false;
      }
      else if (trimmed.startsWith(' M')) {
        const file = trimmed.substring(3).trim();
        if (trimmed.startsWith('MM')) {
          status.changedFiles.push(file);
        } else {
          status.stagedFiles.push(file);
        }
        status.isClean = false;
      }
      else if (trimmed.startsWith(' D')) {
        const file = trimmed.substring(3).trim();
        status.deletedFiles.push(file);
        status.isClean = false;
      }
      else if (trimmed.startsWith('!!')) {
        // Ignorer les lignes de statut
      }
      else if (trimmed && !trimmed.startsWith('??')) {
        // Autres fichiers modifiés
        if (trimmed.match(/^[AMD][AMD]?\s/)) {
          const file = trimmed.substring(3).trim();
          status.changedFiles.push(file);
          status.isClean = false;
        }
      }
    }

    return status;
  }

  /**
   * Obtenir le diff git
   * 
   * @param file - Fichier spécifique (optionnel)
   * @param path - Répertoire du dépôt (optionnel)
   * @returns Diff structuré
   */
  async gitDiff(file?: string, path: string = ''): Promise<GitToolResult> {
    const callId = `git-diff-${Date.now()}`;
    
    try {
      // Vérifier les permissions
      const perm = permissionsManager.checkPermission('read', 'git_diff', { file, path });
      if (!perm.allowed) {
        globalEventBus.emit('permission.denied', { 
          toolName: 'git_diff', 
          reason: perm.reason,
          callId 
        });
        return {
          success: false,
          error: `PERMISSION DENIED: ${perm.reason}`
        };
      }

      globalEventBus.emit('tool.started', { 
        toolName: 'git_diff', 
        input: { file, path },
        callId 
      });

      const command = file ? `git diff -- ${file}` : 'git diff';
      
      const result = await this.shellTools.shellCommand(command, {
        cwd: path
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to get git diff'
        };
      }

      // Parser le diff
      const diffs = this.parseGitDiff(result.stdout || '');
      
      const gitResult: GitToolResult = {
        success: true,
        output: JSON.stringify(diffs, null, 2),
        metadata: {
          files: diffs.map(d => d.file),
          totalAdditions: diffs.reduce((sum, d) => sum + d.additions, 0),
          totalDeletions: diffs.reduce((sum, d) => sum + d.deletions, 0)
        },
        verified: true
      };

      globalEventBus.emit('tool.completed', { 
        toolName: 'git_diff', 
        output: gitResult.output,
        callId,
        metadata: gitResult.metadata 
      });

      return gitResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      globalEventBus.emit('tool.failed', { 
        toolName: 'git_diff', 
        error: errorMessage,
        callId 
      });

      return {
        success: false,
        error: `Git diff failed: ${errorMessage}`
      };
    }
  }

  /**
   * Parser le résultat de git diff
   */
  private parseGitDiff(output: string): GitDiff[] {
    const diffs: GitDiff[] = [];
    const lines = output.split('\n');
    
    let currentDiff: GitDiff | null = null;
    let currentHunk: GitDiff['hunks'][0] | null = null;
    let inHunk = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Début d'un diff de fichier
      if (line.startsWith('diff --git')) {
        const fileMatch = line.match(/diff --git a\/(.+) b\/(.+)/);
        if (fileMatch) {
          currentDiff = {
            file: fileMatch[1] || fileMatch[2],
            additions: 0,
            deletions: 0,
            hunks: []
          };
          diffs.push(currentDiff);
        }
      }
      // Début d'un hunk
      else if (line.startsWith('@@')) {
        const hunkMatch = line.match(/@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/);
        if (hunkMatch && currentDiff) {
          currentHunk = {
            oldStart: parseInt(hunkMatch[1]),
            oldLines: hunkMatch[2] ? parseInt(hunkMatch[2]) : 1,
            newStart: parseInt(hunkMatch[3]),
            newLines: hunkMatch[4] ? parseInt(hunkMatch[4]) : 1,
            content: ''
          };
          currentDiff.hunks.push(currentHunk);
          inHunk = true;
        }
      }
      // Contenu du hunk
      else if (inHunk && currentHunk) {
        if (line.startsWith('+') && !line.startsWith('+++')) {
          currentHunk.content += line + '\n';
          currentDiff!.additions++;
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          currentHunk.content += line + '\n';
          currentDiff!.deletions++;
        } else if (line.startsWith(' ')) {
          currentHunk.content += line + '\n';
        } else {
          inHunk = false;
        }
      }
    }

    return diffs;
  }

  /**
   * Obtenir l'historique des commits
   * 
   * @param maxCount - Nombre max de commits (optionnel)
   * @param path - Répertoire du dépôt (optionnel)
   * @returns Historique des commits
   */
  async gitLog(maxCount: number = 10, path: string = ''): Promise<GitToolResult> {
    const callId = `git-log-${Date.now()}`;
    
    try {
      // Vérifier les permissions
      const perm = permissionsManager.checkPermission('read', 'git_log', { maxCount, path });
      if (!perm.allowed) {
        globalEventBus.emit('permission.denied', { 
          toolName: 'git_log', 
          reason: perm.reason,
          callId 
        });
        return {
          success: false,
          error: `PERMISSION DENIED: ${perm.reason}`
        };
      }

      globalEventBus.emit('tool.started', { 
        toolName: 'git_log', 
        input: { maxCount, path },
        callId 
      });

      const result = await this.shellTools.shellCommand(
        `git log --oneline --pretty=format:"%H|%an|%ad|%s" -n ${maxCount}`,
        { cwd: path }
      );

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to get git log'
        };
      }

      // Parser le résultat
      const entries = this.parseGitLog(result.stdout || '');
      
      const gitResult: GitToolResult = {
        success: true,
        output: JSON.stringify(entries, null, 2),
        metadata: {
          count: entries.length,
          totalCommits: entries.length
        },
        verified: true
      };

      globalEventBus.emit('tool.completed', { 
        toolName: 'git_log', 
        output: gitResult.output,
        callId,
        metadata: gitResult.metadata 
      });

      return gitResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      globalEventBus.emit('tool.failed', { 
        toolName: 'git_log', 
        error: errorMessage,
        callId 
      });

      return {
        success: false,
        error: `Git log failed: ${errorMessage}`
      };
    }
  }

  /**
   * Parser le résultat de git log
   */
  private parseGitLog(output: string): GitLogEntry[] {
    const entries: GitLogEntry[] = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      const parts = trimmed.split('|');
      if (parts.length >= 4) {
        entries.push({
          hash: parts[0],
          author: parts[1],
          date: parts[2],
          message: parts.slice(3).join('|'),
          filesChanged: 0 // à calculer si nécessaire
        });
      }
    }

    return entries;
  }

  /**
   * Obtenir la liste des branches
   * 
   * @param path - Répertoire du dépôt (optionnel)
   * @returns Liste des branches
   */
  async gitBranch(path: string = ''): Promise<GitToolResult> {
    const callId = `git-branch-${Date.now()}`;
    
    try {
      // Vérifier les permissions
      const perm = permissionsManager.checkPermission('read', 'git_branch', { path });
      if (!perm.allowed) {
        globalEventBus.emit('permission.denied', { 
          toolName: 'git_branch', 
          reason: perm.reason,
          callId 
        });
        return {
          success: false,
          error: `PERMISSION DENIED: ${perm.reason}`
        };
      }

      globalEventBus.emit('tool.started', { 
        toolName: 'git_branch', 
        input: { path },
        callId 
      });

      const result = await this.shellTools.shellCommand('git branch -vv', {
        cwd: path
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to get git branches'
        };
      }

      // Parser le résultat
      const branches = this.parseGitBranches(result.stdout || '');
      
      const gitResult: GitToolResult = {
        success: true,
        output: JSON.stringify(branches, null, 2),
        metadata: {
          count: branches.length,
          currentBranch: branches.find(b => b.current)?.name
        },
        verified: true
      };

      globalEventBus.emit('tool.completed', { 
        toolName: 'git_branch', 
        output: gitResult.output,
        callId,
        metadata: gitResult.metadata 
      });

      return gitResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      globalEventBus.emit('tool.failed', { 
        toolName: 'git_branch', 
        error: errorMessage,
        callId 
      });

      return {
        success: false,
        error: `Git branch failed: ${errorMessage}`
      };
    }
  }

  /**
   * Parser le résultat de git branch
   */
  private parseGitBranches(output: string): GitBranch[] {
    const branches: GitBranch[] = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      const current = trimmed.startsWith('*');
      const branchName = current ? trimmed.substring(2).split(' ')[0] : trimmed.split(' ')[0];
      
      branches.push({
        name: branchName,
        current,
        remote: this.extractRemoteBranch(trimmed),
        ahead: this.extractAheadBehind(trimmed, 'ahead'),
        behind: this.extractAheadBehind(trimmed, 'behind')
      });
    }

    return branches;
  }

  /**
   * Extraire le nom de la branche remote
   */
  private extractRemoteBranch(line: string): string | undefined {
    const match = line.match(/\[([^:\]]+):/);
    return match ? match[1] : undefined;
  }

  /**
   * Extraire le nombre de commits ahead/behind
   */
  private extractAheadBehind(line: string, type: 'ahead' | 'behind'): number | undefined {
    const match = line.match(/\b${type}\s+(\d+)\b/i);
    return match ? parseInt(match[1]) : undefined;
  }

  /**
   * Commit des modifications
   * 
   * @param options - Options de commit
   * @param path - Répertoire du dépôt (optionnel)
   * @returns Résultat du commit
   */
  async gitCommit(options: GitCommitOptions, path: string = ''): Promise<GitToolResult> {
    const callId = `git-commit-${Date.now()}`;
    const { message, files, all = false, amend = false } = options;
    
    if (!message) {
      const result: GitToolResult = {
        success: false,
        error: 'Commit message is required'
      };
      
      globalEventBus.emit('tool.failed', { 
        toolName: 'git_commit', 
        error: result.error,
        callId 
      });
      
      return result;
    }

    try {
      // Vérifier les permissions
      const perm = permissionsManager.checkPermission('build', 'git_commit', options);
      if (!perm.allowed) {
        globalEventBus.emit('permission.denied', { 
          toolName: 'git_commit', 
          reason: perm.reason,
          callId 
        });
        return {
          success: false,
          error: `PERMISSION DENIED: ${perm.reason}`
        };
      }

      globalEventBus.emit('tool.started', { 
        toolName: 'git_commit', 
        input: { message, files, all, amend, path },
        callId 
      });

      // Construire la commande
      let command = 'git commit';
      
      if (amend) {
        command += ' --amend';
      }
      
      if (all) {
        command += ' -a';
      } else if (files && files.length > 0) {
        command += ` ${files.map(f => `"${f}"`).join(' ')}`;
      }
      
      // Ajouter le message
      command += ` -m "${message.replace(/\"/g, '\\\"')}"`;
      
      const result = await this.shellTools.shellCommand(command, {
        cwd: path
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to commit'
        };
      }

      const gitResult: GitToolResult = {
        success: true,
        output: result.stdout || 'Commit successful',
        metadata: {
          message,
          hash: this.extractCommitHash(result.stdout || '')
        },
        verified: true
      };

      globalEventBus.emit('tool.completed', { 
        toolName: 'git_commit', 
        output: gitResult.output,
        callId,
        metadata: gitResult.metadata 
      });

      return gitResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      globalEventBus.emit('tool.failed', { 
        toolName: 'git_commit', 
        error: errorMessage,
        callId 
      });

      return {
        success: false,
        error: `Git commit failed: ${errorMessage}`
      };
    }
  }

  /**
   * Extraire le hash du commit
   */
  private extractCommitHash(output: string): string | undefined {
    const match = output.match(/\b([a-f0-9]{7,})\b/);
    return match ? match[1] : undefined;
  }

  /**
   * Push vers remote
   * 
   * @param options - Options de push
   * @param path - Répertoire du dépôt (optionnel)
   * @returns Résultat du push
   */
  async gitPush(options: GitPushOptions = {}, path: string = ''): Promise<GitToolResult> {
    const callId = `git-push-${Date.now()}`;
    const { remote = 'origin', branch, force = false } = options;
    
    try {
      // Vérifier les permissions
      const perm = permissionsManager.checkPermission('build', 'git_push', options);
      if (!perm.allowed) {
        globalEventBus.emit('permission.denied', { 
          toolName: 'git_push', 
          reason: perm.reason,
          callId 
        });
        return {
          success: false,
          error: `PERMISSION DENIED: ${perm.reason}`
        };
      }

      globalEventBus.emit('tool.started', { 
        toolName: 'git_push', 
        input: { remote, branch, force, path },
        callId 
      });

      let command = `git push ${remote}`;
      
      if (branch) {
        command += ` ${branch}`;
      }
      
      if (force) {
        command += ' --force';
      }
      
      const result = await this.shellTools.shellCommand(command, {
        cwd: path
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to push'
        };
      }

      const gitResult: GitToolResult = {
        success: true,
        output: result.stdout || 'Push successful',
        metadata: {
          remote,
          branch,
          force
        },
        verified: true
      };

      globalEventBus.emit('tool.completed', { 
        toolName: 'git_push', 
        output: gitResult.output,
        callId,
        metadata: gitResult.metadata 
      });

      return gitResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      globalEventBus.emit('tool.failed', { 
        toolName: 'git_push', 
        error: errorMessage,
        callId 
      });

      return {
        success: false,
        error: `Git push failed: ${errorMessage}`
      };
    }
  }

  /**
   * Pull depuis remote
   * 
   * @param options - Options de pull
   * @param path - Répertoire du dépôt (optionnel)
   * @returns Résultat du pull
   */
  async gitPull(options: GitPullOptions = {}, path: string = ''): Promise<GitToolResult> {
    const callId = `git-pull-${Date.now()}`;
    const { remote = 'origin', branch, rebase = false } = options;
    
    try {
      // Vérifier les permissions
      const perm = permissionsManager.checkPermission('build', 'git_pull', options);
      if (!perm.allowed) {
        globalEventBus.emit('permission.denied', { 
          toolName: 'git_pull', 
          reason: perm.reason,
          callId 
        });
        return {
          success: false,
          error: `PERMISSION DENIED: ${perm.reason}`
        };
      }

      globalEventBus.emit('tool.started', { 
        toolName: 'git_pull', 
        input: { remote, branch, rebase, path },
        callId 
      });

      let command = `git pull ${remote}`;
      
      if (branch) {
        command += ` ${branch}`;
      }
      
      if (rebase) {
        command += ' --rebase';
      }
      
      const result = await this.shellTools.shellCommand(command, {
        cwd: path
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to pull'
        };
      }

      const gitResult: GitToolResult = {
        success: true,
        output: result.stdout || 'Pull successful',
        metadata: {
          remote,
          branch,
          rebase
        },
        verified: true
      };

      globalEventBus.emit('tool.completed', { 
        toolName: 'git_pull', 
        output: gitResult.output,
        callId,
        metadata: gitResult.metadata 
      });

      return gitResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      globalEventBus.emit('tool.failed', { 
        toolName: 'git_pull', 
        error: errorMessage,
        callId 
      });

      return {
        success: false,
        error: `Git pull failed: ${errorMessage}`
      };
    }
  }

  /**
   * Initialiser un dépôt git
   * 
   * @param options - Options d'initialisation
   * @returns Résultat de l'initialisation
   */
  async gitInit(options: GitInitOptions = {}): Promise<GitToolResult> {
    const callId = `git-init-${Date.now()}`;
    const { directory = '', bare = false } = options;
    
    try {
      // Vérifier les permissions
      const perm = permissionsManager.checkPermission('build', 'git_init', options);
      if (!perm.allowed) {
        globalEventBus.emit('permission.denied', { 
          toolName: 'git_init', 
          reason: perm.reason,
          callId 
        });
        return {
          success: false,
          error: `PERMISSION DENIED: ${perm.reason}`
        };
      }

      globalEventBus.emit('tool.started', { 
        toolName: 'git_init', 
        input: { directory, bare },
        callId 
      });

      let command = 'git init';
      
      if (bare) {
        command += ' --bare';
      }
      
      if (directory) {
        command += ` ${directory}`;
      }
      
      const result = await this.shellTools.shellCommand(command);

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to initialize git repository'
        };
      }

      const gitResult: GitToolResult = {
        success: true,
        output: result.stdout || 'Git repository initialized',
        metadata: {
          directory,
          bare
        },
        verified: true
      };

      globalEventBus.emit('tool.completed', { 
        toolName: 'git_init', 
        output: gitResult.output,
        callId,
        metadata: gitResult.metadata 
      });

      return gitResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      globalEventBus.emit('tool.failed', { 
        toolName: 'git_init', 
        error: errorMessage,
        callId 
      });

      return {
        success: false,
        error: `Git init failed: ${errorMessage}`
      };
    }
  }

  /**
   * Ajouter des fichiers au staging
   * 
   * @param files - Fichiers à ajouter
   * @param path - Répertoire du dépôt (optionnel)
   * @returns Résultat de l'ajout
   */
  async gitAdd(files: string[], path: string = ''): Promise<GitToolResult> {
    const callId = `git-add-${Date.now()}`;
    
    if (!files || files.length === 0) {
      const result: GitToolResult = {
        success: false,
        error: 'No files specified'
      };
      
      globalEventBus.emit('tool.failed', { 
        toolName: 'git_add', 
        error: result.error,
        callId 
      });
      
      return result;
    }

    try {
      // Vérifier les permissions
      const perm = permissionsManager.checkPermission('build', 'git_add', { files, path });
      if (!perm.allowed) {
        globalEventBus.emit('permission.denied', { 
          toolName: 'git_add', 
          reason: perm.reason,
          callId 
        });
        return {
          success: false,
          error: `PERMISSION DENIED: ${perm.reason}`
        };
      }

      globalEventBus.emit('tool.started', { 
        toolName: 'git_add', 
        input: { files, path },
        callId 
      });

      const command = `git add ${files.map(f => `"${f}"`).join(' ')}`;
      
      const result = await this.shellTools.shellCommand(command, {
        cwd: path
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to add files'
        };
      }

      const gitResult: GitToolResult = {
        success: true,
        output: result.stdout || 'Files added to staging',
        metadata: {
          files,
          count: files.length
        },
        verified: true
      };

      globalEventBus.emit('tool.completed', { 
        toolName: 'git_add', 
        output: gitResult.output,
        callId,
        metadata: gitResult.metadata 
      });

      return gitResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      globalEventBus.emit('tool.failed', { 
        toolName: 'git_add', 
        error: errorMessage,
        callId 
      });

      return {
        success: false,
        error: `Git add failed: ${errorMessage}`
      };
    }
  }

  /**
   * Reset des modifications
   * 
   * @param files - Fichiers à reset (optionnel, tous si non spécifié)
   * @param hard - Reset hard (optionnel)
   * @param path - Répertoire du dépôt (optionnel)
   * @returns Résultat du reset
   */
  async gitReset(files?: string[], hard: boolean = false, path: string = ''): Promise<GitToolResult> {
    const callId = `git-reset-${Date.now()}`;
    
    try {
      // Vérifier les permissions
      const perm = permissionsManager.checkPermission('build', 'git_reset', { files, hard, path });
      if (!perm.allowed) {
        globalEventBus.emit('permission.denied', { 
          toolName: 'git_reset', 
          reason: perm.reason,
          callId 
        });
        return {
          success: false,
          error: `PERMISSION DENIED: ${perm.reason}`
        };
      }

      globalEventBus.emit('tool.started', { 
        toolName: 'git_reset', 
        input: { files, hard, path },
        callId 
      });

      let command = 'git reset';
      
      if (hard) {
        command += ' --hard';
      }
      
      if (files && files.length > 0) {
        command += ` ${files.map(f => `"${f}"`).join(' ')}`;
      }
      
      const result = await this.shellTools.shellCommand(command, {
        cwd: path
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to reset'
        };
      }

      const gitResult: GitToolResult = {
        success: true,
        output: result.stdout || 'Reset successful',
        metadata: {
          files,
          hard
        },
        verified: true
      };

      globalEventBus.emit('tool.completed', { 
        toolName: 'git_reset', 
        output: gitResult.output,
        callId,
        metadata: gitResult.metadata 
      });

      return gitResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      globalEventBus.emit('tool.failed', { 
        toolName: 'git_reset', 
        error: errorMessage,
        callId 
      });

      return {
        success: false,
        error: `Git reset failed: ${errorMessage}`
      };
    }
  }

  /**
   * Checkout d'une branche ou fichier
   * 
   * @param target - Branche ou fichier à checker out
   * @param create - Créer une nouvelle branche (optionnel)
   * @param path - Répertoire du dépôt (optionnel)
   * @returns Résultat du checkout
   */
  async gitCheckout(target: string, create: boolean = false, path: string = ''): Promise<GitToolResult> {
    const callId = `git-checkout-${Date.now()}`;
    
    if (!target) {
      const result: GitToolResult = {
        success: false,
        error: 'Target is required'
      };
      
      globalEventBus.emit('tool.failed', { 
        toolName: 'git_checkout', 
        error: result.error,
        callId 
      });
      
      return result;
    }

    try {
      // Vérifier les permissions
      const perm = permissionsManager.checkPermission('build', 'git_checkout', { target, create, path });
      if (!perm.allowed) {
        globalEventBus.emit('permission.denied', { 
          toolName: 'git_checkout', 
          reason: perm.reason,
          callId 
        });
        return {
          success: false,
          error: `PERMISSION DENIED: ${perm.reason}`
        };
      }

      globalEventBus.emit('tool.started', { 
        toolName: 'git_checkout', 
        input: { target, create, path },
        callId 
      });

      let command = `git checkout ${target}`;
      
      if (create) {
        command += ' -b';
      }
      
      const result = await this.shellTools.shellCommand(command, {
        cwd: path
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to checkout'
        };
      }

      const gitResult: GitToolResult = {
        success: true,
        output: result.stdout || 'Checkout successful',
        metadata: {
          target,
          create
        },
        verified: true
      };

      globalEventBus.emit('tool.completed', { 
        toolName: 'git_checkout', 
        output: gitResult.output,
        callId,
        metadata: gitResult.metadata 
      });

      return gitResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      globalEventBus.emit('tool.failed', { 
        toolName: 'git_checkout', 
        error: errorMessage,
        callId 
      });

      return {
        success: false,
        error: `Git checkout failed: ${errorMessage}`
      };
    }
  }

  /**
   * Merge de branches
   * 
   * @param branch - Branche à merger
   * @param options - Options de merge
   * @param path - Répertoire du dépôt (optionnel)
   * @returns Résultat du merge
   */
  async gitMerge(
    branch: string,
    options: { noCommit?: boolean; squash?: boolean; noFf?: boolean } = {},
    path: string = ''
  ): Promise<GitToolResult> {
    const callId = `git-merge-${Date.now()}`;
    const { noCommit = false, squash = false, noFf = false } = options;
    
    if (!branch) {
      const result: GitToolResult = {
        success: false,
        error: 'Branch is required'
      };
      
      globalEventBus.emit('tool.failed', { 
        toolName: 'git_merge', 
        error: result.error,
        callId 
      });
      
      return result;
    }

    try {
      // Vérifier les permissions
      const perm = permissionsManager.checkPermission('build', 'git_merge', { branch, ...options, path });
      if (!perm.allowed) {
        globalEventBus.emit('permission.denied', { 
          toolName: 'git_merge', 
          reason: perm.reason,
          callId 
        });
        return {
          success: false,
          error: `PERMISSION DENIED: ${perm.reason}`
        };
      }

      globalEventBus.emit('tool.started', { 
        toolName: 'git_merge', 
        input: { branch, ...options, path },
        callId 
      });

      let command = `git merge ${branch}`;
      
      if (noCommit) {
        command += ' --no-commit';
      }
      
      if (squash) {
        command += ' --squash';
      }
      
      if (noFf) {
        command += ' --no-ff';
      }
      
      const result = await this.shellTools.shellCommand(command, {
        cwd: path
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to merge'
        };
      }

      const gitResult: GitToolResult = {
        success: true,
        output: result.stdout || 'Merge successful',
        metadata: {
          branch,
          ...options
        },
        verified: true
      };

      globalEventBus.emit('tool.completed', { 
        toolName: 'git_merge', 
        output: gitResult.output,
        callId,
        metadata: gitResult.metadata 
      });

      return gitResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      globalEventBus.emit('tool.failed', { 
        toolName: 'git_merge', 
        error: errorMessage,
        callId 
      });

      return {
        success: false,
        error: `Git merge failed: ${errorMessage}`
      };
    }
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
  }
}

/**
 * Créer une instance des Git Tools
 */
export function createGitTools(provider: ExecutionProvider): GitTools {
  return new GitTools(provider);
}
