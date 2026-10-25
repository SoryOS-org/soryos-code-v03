/**
 * @soryos/git
 * Git operations executed on the active ExecutionProvider.
 */

import { ExecutionProvider } from "@soryos/execution";

export interface GitStatusResult {
  branch: string;
  isClean: boolean;
  modifiedFiles: string[];
  untrackedFiles: string[];
}

export class GitManager {
  public async getStatus(provider: ExecutionProvider): Promise<GitStatusResult> {
    const res = await provider.executeCommand("git status --porcelain -b");
    if (res.exitCode !== 0) {
      return { branch: "main", isClean: true, modifiedFiles: [], untrackedFiles: [] };
    }

    const lines = res.stdout.split("\n");
    let branch = "main";
    const modifiedFiles: string[] = [];
    const untrackedFiles: string[] = [];

    for (const line of lines) {
      if (line.startsWith("## ")) {
        branch = line.slice(3).split("...")[0].trim();
      } else if (line.startsWith(" M ") || line.startsWith("M ")) {
        modifiedFiles.push(line.slice(3).trim());
      } else if (line.startsWith("?? ")) {
        untrackedFiles.push(line.slice(3).trim());
      }
    }

    return {
      branch,
      isClean: modifiedFiles.length === 0 && untrackedFiles.length === 0,
      modifiedFiles,
      untrackedFiles,
    };
  }

  public async commit(provider: ExecutionProvider, message: string): Promise<boolean> {
    await provider.executeCommand("git add .");
    const res = await provider.executeCommand(`git commit -m "${message.replace(/"/g, '\\"')}"`);
    return res.exitCode === 0;
  }
}

export const gitManager = new GitManager();
