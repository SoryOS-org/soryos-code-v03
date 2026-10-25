/**
 * @soryos/dev-runner
 * Dev Runner - Orchestrateur de serveurs de développement
 */

import { ExecutionProvider, LocalExecutionProvider } from '@soryos/execution';
import { ShellTools, CommonCommands } from '@soryos/tool/shell-tools';
import { FilesystemTools } from '@soryos/tool/filesystem-tools';
import { PreviewManager } from './preview';

export * from './preview';

export interface ProjectType {
  type: string;
  name: string;
  devCommand: string;
  port: number;
}

export class DevRunner {
  private shellTools: ShellTools;
  public previewManager: PreviewManager;

  constructor(private provider: ExecutionProvider) {
    this.shellTools = new ShellTools(provider);
    this.previewManager = new PreviewManager(provider);
  }

  async startDevServer(path: string = '.'): Promise<{ success: boolean; port: number }> {
    // Simulation simple de démarrage pour l'exemple
    const command = "npm run dev";
    await this.shellTools.backgroundCommand(command, { cwd: path });
    return { success: true, port: 3000 };
  }
}

export const devRunner = new DevRunner(new LocalExecutionProvider());
