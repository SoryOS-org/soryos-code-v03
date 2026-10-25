
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export interface ExecInCodespaceOptions {
    codespaceName: string;
    command: string;
    cwd?: string;
}

export interface ExecInCodespaceResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}

export async function execInCodespace(options: ExecInCodespaceOptions): Promise<ExecInCodespaceResult> {
    const ghBin = process.env.GH_CLI_PATH || 'gh';
    // gh has no `exec` subcommand: run the command over `gh codespace ssh`
    // inside the workspace directory (default SSH cwd is the container home).
    const remote = options.cwd ? `cd ${options.cwd} && ${options.command}` : options.command;
    const ghCommand = `${ghBin} codespace ssh -c ${options.codespaceName} -- ${JSON.stringify(remote)}`;

    try {
        // GH_TOKEN + bundled ssh (GH_SSH_PATH via PATH) are picked up from env
        const { stdout, stderr } = await execAsync(ghCommand, { env: process.env });
        return { stdout, stderr, exitCode: 0 };
    } catch (error) {
        // execAsync throws an error that includes stdout, stderr and exit code
        const execError = error as Error & { stdout?: string; stderr?: string; code?: number };
        console.error(`Error executing in codespace: ${execError.message}`);
        // Even on error, stdout and stderr can contain useful information
        return {
            stdout: execError.stdout || "",
            stderr: execError.stderr || execError.message,
            exitCode: typeof execError.code === "number" ? execError.code : 1,
        };
    }
}
