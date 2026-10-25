
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { sessionStore } from '@soryos/session';
import { workspaceManager } from '@soryos/workspace';
import { fileManager } from '@soryos/filesystem';
import { BuiltContext, ContextItem, ContextOptions } from './types';

const MAX_CONTEXT_ITEMS = 20;
const MAX_FILE_CHARS = 2000;
const MAX_INSTRUCTION_CHARS = 4000;
const MAX_TREE_ENTRIES = 60;
const TREE_MAX_DEPTH = 2;

const INSTRUCTION_FILES = ['AGENTS.md', 'CONVENTIONS.md', 'README.md'];
const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.turbo', 'coverage', '.cache']);

async function buildTreeOverview(root: string): Promise<string> {
  const lines: string[] = [];

  async function walk(dir: string, depth: number, prefix: string): Promise<void> {
    if (depth > TREE_MAX_DEPTH || lines.length >= MAX_TREE_ENTRIES) return;
    let entries: Array<{ name: string; isDirectory: boolean }> = [];
    try {
      const raw = await fs.readdir(dir, { withFileTypes: true });
      entries = raw
        .filter((e) => !e.name.startsWith('.') || e.name === '.env.example')
        .filter((e) => !(e.isDirectory() && IGNORED_DIRS.has(e.name)))
        .map((e) => ({ name: e.name, isDirectory: e.isDirectory() }))
        .sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (lines.length >= MAX_TREE_ENTRIES) {
        lines.push(`${prefix}…`);
        return;
      }
      lines.push(`${prefix}${entry.isDirectory ? entry.name + '/' : entry.name}`);
      if (entry.isDirectory) {
        await walk(path.join(dir, entry.name), depth + 1, `${prefix}  `);
      }
    }
  }

  await walk(root, 1, '');
  if (lines.length === 0) return '';
  return `Workspace overview (${path.basename(root) || root}):\n${lines.join('\n')}`;
}

export class ContextBuilder {
  async buildContext(options: { sessionId: string, userRequest: string }): Promise<BuiltContext> {
    const session = sessionStore.get(options.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${options.sessionId}`);
    }

    const workspace = workspaceManager.getWorkspace(options.sessionId);
    if (!workspace) {
      throw new Error(`Workspace not found for session: ${options.sessionId}`);
    }

    const contextItems: ContextItem[] = [];

    // Add the user's request to the context
    contextItems.push({ type: 'user_request', content: options.userRequest, source: 'user' });

    // Project instruction files (AGENTS.md / CONVENTIONS.md / README.md)
    const root = workspace.workspacePath || process.cwd();
    for (const name of INSTRUCTION_FILES) {
      const content = await fileManager.readFile(path.join(root, name));
      if (content.trim()) {
        contextItems.push({
          type: 'instructions',
          content: `${name}:\n${content.substring(0, MAX_INSTRUCTION_CHARS)}`,
          source: name,
        });
      }
    }

    // Shallow workspace tree overview
    const tree = await buildTreeOverview(root);
    if (tree) {
      contextItems.push({ type: 'tree', content: tree, source: 'workspace' });
    }

    // Add open files to the context
    for (const filePath of session.openFiles || []) {
      try {
        const content = await fileManager.readFile(filePath);
        const truncatedContent = content.substring(0, MAX_FILE_CHARS);
        contextItems.push({ type: 'file', content: `File: ${filePath}\n\n${truncatedContent}`, source: filePath });
      } catch (error) {
        if (error instanceof Error) {
          console.warn(`Could not read file ${filePath} for context: ${error.message}`);
        } else {
          console.warn(`Could not read file ${filePath} for context: ${String(error)}`);
        }
      }
    }

    // Add the currently active file to the context
    if (session.activeFile) {
      try {
        const content = await fileManager.readFile(session.activeFile);
        const truncatedContent = content.substring(0, MAX_FILE_CHARS);
        contextItems.push({ type: 'active_file', content: `Active File: ${session.activeFile}\n\n${truncatedContent}`, source: session.activeFile });
      } catch (error) {
        if (error instanceof Error) {
          console.warn(`Could not read active file ${session.activeFile} for context: ${error.message}`);
        } else {
          console.warn(`Could not read active file ${session.activeFile} for context: ${String(error)}`);
        }
      }
    }

    const capped = contextItems.slice(0, MAX_CONTEXT_ITEMS);
    const tokenCount = capped.reduce((sum, item) => sum + item.content.length, 0); // Rough token count

    return {
      messages: [], // The messages will be constructed by the planner
      contextItems: capped,
      tokenCount,
    };
  }
}

export const contextBuilder = new ContextBuilder();
