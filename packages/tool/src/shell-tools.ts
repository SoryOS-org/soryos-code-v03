/**
 * @soryos/tool
 * Shell Tools - Extrait et adapté de Vibra Code
 * 
 * Fonctionnalités:
 * - shell_command: Exécution de commandes shell avec capture stdout/stderr/exitCode
 * - background_command: Exécution de commandes en arrière-plan
 * - process_manager: Gestion des processus (start, stop, status)
 * 
 * Règle: NO REAL EXECUTION = NO SUCCESS
 */

import { ExecutionProvider } from '@soryos/execution';
import { SessionData } from '@soryos/schema';
import { globalEventBus } from '@soryos/bus';
import { permissionsManager } from '@soryos/permissions';

export interface ShellCommandOptions {
  command?: string;
  cwd?: string;
  timeoutMs?: number;
  env?: Record<string, string>;
  background?: boolean;
  continueOnError?: boolean;
}

export interface ShellCommandResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  durationMs?: number;
  command?: string;
  pid?: number;
  error?: string;
  verified?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ProcessInfo {
  pid: number;
  command: string;
  status: 'running' | 'stopped' | 'completed' | 'failed';
  startTime: number;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
}

export interface ProcessManager {
  start(command: string, options?: ShellCommandOptions): Promise<ProcessInfo>;
  stop(pid: number): Promise<boolean>;
  getStatus(pid: number): Promise<ProcessInfo | null>;
  listProcesses(): Promise<ProcessInfo[]>;
  killAll(): Promise<void>;
}

/**
 * Shell Tools Implementation
 * 
 * Ces outils exécutent des commandes shell réelles et capturent:
 * - stdout
 * - stderr
 * - exit code
 * - durée d'exécution
 */
export class ShellTools {
  private provider: ExecutionProvider;
  private processes: Map<number, ProcessInfo> = new Map();
  private nextPid: number = 1000;

  constructor(provider: ExecutionProvider) {
    this.provider = provider;
  }

  /**
   * Exécuter une commande shell
   * 
   * @param command - Commande à exécuter
   * @param options - Options d'exécution
   * @returns Résultat avec stdout, stderr, exitCode, duration
   */
  async shellCommand(
    command: string,
    options: ShellCommandOptions = {}
  ): Promise<ShellCommandResult> {
    const callId = `shell-${Date.now()}`;
    const {
      cwd,
      timeoutMs = 60000,
      env = {},
      background = false
    } = options;
    
    // Vérifier que command est fourni
    if (!command) {
      const result: ShellCommandResult = {
        success: false,
        error: 'Command parameter is required'
      };
      
      globalEventBus.emit('tool.failed', { 
        toolName: 'shell_command', 
        error: result.error,
        callId 
      });
      
      return result;
    }

    try {
      // Vérifier les permissions
      const perm = permissionsManager.checkPermission('build', 'shell_command', { 
        command,
        cwd
      });
      if (!perm.allowed) {
        globalEventBus.emit('permission.denied', { 
          toolName: 'shell_command', 
          reason: perm.reason,
          callId 
        });
        return {
          success: false,
          error: `PERMISSION DENIED: ${perm.reason}`
        };
      }

      globalEventBus.emit('tool.started', { 
        toolName: 'shell_command', 
        input: { command, cwd, timeoutMs },
        callId 
      });

      globalEventBus.emit('process.started', { 
        command,
        cwd,
        callId
      });

      const startTime = Date.now();
      
      // Exécuter la commande via le provider
      const result = await this.provider.executeCommand(command, {
        cwd,
        timeoutMs,
        env
      });
      
      const durationMs = Date.now() - startTime;

      // Déterminer si c'est une erreur
      const isError = result.exitCode !== 0 && result.exitCode !== undefined;

      globalEventBus.emit('process.exited', {
        command,
        exitCode: result.exitCode || 0,
        durationMs,
        callId
      });

      // Construire le résultat
      const shellResult: ShellCommandResult = {
        success: !isError,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        durationMs,
        command,
        verified: true
      };

      if (isError) {
        shellResult.error = `Command failed with exit code ${result.exitCode}`;
        globalEventBus.emit('tool.failed', { 
          toolName: 'shell_command', 
          error: shellResult.error,
          callId 
        });
      } else {
        globalEventBus.emit('tool.completed', { 
          toolName: 'shell_command', 
          output: shellResult.stdout,
          callId,
          metadata: {
            exitCode: shellResult.exitCode,
            durationMs: shellResult.durationMs
          } 
        });
      }

      return shellResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const durationMs = Date.now() - (Date.now() - (options.timeoutMs || 60000));
      
      globalEventBus.emit('tool.failed', { 
        toolName: 'shell_command', 
        error: errorMessage,
        callId 
      });

      globalEventBus.emit('process.exited', {
        command,
        exitCode: 1,
        durationMs,
        callId,
        error: errorMessage
      });

      return {
        success: false,
        error: `Command execution failed: ${errorMessage}`,
        command,
        durationMs
      };
    }
  }

  /**
   * Exécuter une commande en arrière-plan
   * 
   * @param command - Commande à exécuter
   * @param options - Options d'exécution
   * @returns ProcessInfo
   */
  async backgroundCommand(
    command: string,
    options: ShellCommandOptions = {}
  ): Promise<ProcessInfo> {
    const callId = `bg-${Date.now()}`;
    const {
      cwd,
      timeoutMs = 0, // Pas de timeout pour les commandes en arrière-plan
      env = {}
    } = options;
    
    if (!command) {
      throw new Error('Command parameter is required');
    }

    try {
      // Vérifier les permissions
      const perm = permissionsManager.checkPermission('build', 'shell_command', { 
        command,
        cwd
      });
      if (!perm.allowed) {
        throw new Error(`PERMISSION DENIED: ${perm.reason}`);
      }

      globalEventBus.emit('tool.started', { 
        toolName: 'background_command', 
        input: { command, cwd },
        callId 
      });

      const pid = this.nextPid++;
      const startTime = Date.now();
      
      // Exécuter la commande en arrière-plan
      const result = await this.provider.executeCommand(command, {
        cwd,
        timeoutMs,
        env,
        background: true
      });
      
      // Créer l'info du processus
      const processInfo: ProcessInfo = {
        pid,
        command,
        status: 'running',
        startTime
      };
      
      // Stocker le processus
      this.processes.set(pid, processInfo);

      globalEventBus.emit('process.started', { 
        command,
        pid,
        cwd,
        callId
      });

      return processInfo;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to start background command: ${errorMessage}`);
    }
  }

  /**
   * Arrêter un processus en cours
   * 
   * @param pid - ID du processus
   * @returns true si le processus a été arrêté
   */
  async stopProcess(pid: number): Promise<boolean> {
    try {
      const processInfo = this.processes.get(pid);
      
      if (!processInfo) {
        return false;
      }

      // Mettre à jour le statut
      processInfo.status = 'stopped';
      this.processes.set(pid, processInfo);

      globalEventBus.emit('process.stopped', { 
        pid,
        command: processInfo.command
      });

      return true;

    } catch (error) {
      console.error(`[ShellTools] Failed to stop process ${pid}:`, error);
      return false;
    }
  }

  /**
   * Obtenir le statut d'un processus
   * 
   * @param pid - ID du processus
   * @returns ProcessInfo ou null
   */
  async getProcessStatus(pid: number): Promise<ProcessInfo | null> {
    return this.processes.get(pid) || null;
  }

  /**
   * Lister tous les processus en cours
   * 
   * @returns Liste des processus
   */
  async listProcesses(): Promise<ProcessInfo[]> {
    return Array.from(this.processes.values());
  }

  /**
   * Tuer tous les processus
   */
  async killAllProcesses(): Promise<void> {
    const pids = Array.from(this.processes.keys());
    
    for (const pid of pids) {
      await this.stopProcess(pid);
    }
    
    this.processes.clear();
    globalEventBus.emit('process.all_stopped', {});
  }

  /**
   * Exécuter une commande avec gestion avancée des erreurs
   * 
   * @param command - Commande à exécuter
   * @param options - Options d'exécution
   * @returns Résultat avec analyse des erreurs
   */
  async executeWithErrorHandling(
    command: string,
    options: ShellCommandOptions = {}
  ): Promise<ShellCommandResult> {
    const result = await this.shellCommand(command, options);
    
    if (!result.success) {
      // Analyser l'erreur
      const analysis = this.analyzeCommandError(result);
      
      // Ajouter l'analyse au résultat
      return {
        ...result,
        error: `${result.error}\n\nAnalysis: ${analysis.message}`,
        metadata: {
          ...result,
          analysis
        }
      };
    }
    
    return result;
  }

  /**
   * Analyser une erreur de commande
   */
  private analyzeCommandError(result: ShellCommandResult): {
    type: string;
    message: string;
    suggestions: string[];
    isRetryable: boolean;
  } {
    const exitCode = result.exitCode || 0;
    const stdout = result.stdout || '';
    const stderr = result.stderr || '';
    const command = result.command || '';
    
    const lowerOutput = (stdout + stderr).toLowerCase();
    
    // Erreurs courantes
    if (exitCode === 127) {
      // Command not found
      return {
        type: 'command_not_found',
        message: `Command not found: ${command.split(' ')[0]}`,
        suggestions: [
          `Verify that the command is installed: ${command.split(' ')[0]}`,
          'Check your PATH environment variable',
          'Try using the full path to the command'
        ],
        isRetryable: false
      };
    }
    
    if (lowerOutput.includes('permission denied') || exitCode === 13) {
      return {
        type: 'permission_denied',
        message: 'Permission denied. You may need elevated privileges.',
        suggestions: [
          'Try running with sudo (if appropriate)',
          'Check file permissions',
          'Verify that you have write access to the target location'
        ],
        isRetryable: false
      };
    }
    
    if (lowerOutput.includes('no such file or directory') || exitCode === 2) {
      return {
        type: 'file_not_found',
        message: 'File or directory not found.',
        suggestions: [
          'Verify that the file/directory exists',
          'Check the path for typos',
          'Use absolute paths if relative paths are not working'
        ],
        isRetryable: false
      };
    }
    
    if (lowerOutput.includes('timeout') || lowerOutput.includes('timed out')) {
      return {
        type: 'timeout',
        message: 'Command timed out.',
        suggestions: [
          'Increase the timeout value',
          'Try breaking the command into smaller steps',
          'Check if the command is hanging'
        ],
        isRetryable: true
      };
    }
    
    if (lowerOutput.includes('out of memory') || lowerOutput.includes('memory')) {
      return {
        type: 'out_of_memory',
        message: 'Command ran out of memory.',
        suggestions: [
          'Try running with less data',
          'Increase available memory',
          'Optimize the command to use less memory'
        ],
        isRetryable: true
      };
    }
    
    if (lowerOutput.includes('disk full') || lowerOutput.includes('no space')) {
      return {
        type: 'disk_full',
        message: 'Disk is full.',
        suggestions: [
          'Free up disk space',
          'Delete unnecessary files',
          'Increase disk capacity'
        ],
        isRetryable: false
      };
    }
    
    // Erreur générique
    return {
      type: 'unknown',
      message: `Command failed with exit code ${exitCode}.`,
      suggestions: [
        'Check the command output for details',
        'Verify that all parameters are correct',
        'Try running the command manually'
      ],
      isRetryable: true
    };
  }

  /**
   * Exécuter plusieurs commandes en séquence
   * 
   * @param commands - Liste de commandes à exécuter
   * @param options - Options communes
   * @returns Résultats de toutes les commandes
   */
  async executeSequence(
    commands: string[],
    options: Omit<ShellCommandOptions, 'command'> = {}
  ): Promise<ShellCommandResult[]> {
    const results: ShellCommandResult[] = [];
    
    for (const command of commands) {
      const result = await this.shellCommand(command, { ...options, command });
      results.push(result);
      
      // Arrêter si une commande échoue (sauf si continueOnError)
      if (!result.success && !options.continueOnError) {
        break;
      }
    }
    
    return results;
  }

  /**
   * Exécuter des commandes en parallèle
   * 
   * @param commands - Liste de commandes à exécuter
   * @param options - Options communes
   * @returns Résultats de toutes les commandes
   */
  async executeParallel(
    commands: string[],
    options: Omit<ShellCommandOptions, 'command'> = {}
  ): Promise<ShellCommandResult[]> {
    const promises = commands.map(command => 
      this.shellCommand(command, { ...options, command })
    );
    
    return Promise.all(promises);
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
  }
}

/**
 * Créer une instance des Shell Tools
 */
export function createShellTools(provider: ExecutionProvider): ShellTools {
  return new ShellTools(provider);
}

/**
 * Commandes utilitaires courantes
 */
export const CommonCommands = {
  // Détection de projet
  detectProjectType: 'ls -la | head -20',
  checkPackageJson: 'test -f package.json && echo "Node.js" || echo "Not Node.js"',
  checkPython: 'test -f requirements.txt || test -f setup.py || test -f pyproject.toml && echo "Python" || echo "Not Python"',
  checkRust: 'test -f Cargo.toml && echo "Rust" || echo "Not Rust"',
  checkGo: 'test -f go.mod && echo "Go" || echo "Not Go"',
  
  // Package Managers
  npmInstall: 'npm install',
  npmInstallCi: 'npm ci',
  yarnInstall: 'yarn install',
  pnpmInstall: 'pnpm install',
  pipInstall: 'pip install -r requirements.txt',
  cargoBuild: 'cargo build',
  goModTidy: 'go mod tidy',
  
  // Build
  npmRunBuild: 'npm run build',
  npmRunDev: 'npm run dev',
  cargoRun: 'cargo run',
  goRun: 'go run main.go',
  pythonRun: 'python main.py',
  
  // Tests
  npmTest: 'npm test',
  npmRunTest: 'npm run test',
  cargoTest: 'cargo test',
  goTest: 'go test ./...',
  pytest: 'pytest',
  
  // Git
  gitStatus: 'git status',
  gitLog: 'git log --oneline -10',
  gitBranch: 'git branch -a',
  gitDiff: 'git diff',
  
  // Système
  pwd: 'pwd',
  ls: 'ls -la',
  df: 'df -h',
  free: 'free -h',
  
  // Port detection
  checkPort: (port: number) => `lsof -i :${port} || netstat -tuln | grep ${port}`,
  findProcessOnPort: (port: number) => `lsof -i :${port} | awk 'NR!=1 {print $2}'`
};
