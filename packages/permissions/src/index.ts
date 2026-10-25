/**
 * @soryos/permissions
 * Granular role-based security & tool execution policy manager.
 */

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
}

export type PermissionDecision = 'allow-once' | 'allow-always' | 'deny-once' | 'deny-always';

/** Tools that can trigger an interactive "ask" in build mode when confirmDangerous is enabled. */
export const DANGEROUS_TOOLS = new Set(['shell_command', 'delete_file', 'git_commit']);

export const PERMISSION_ASK_TIMEOUT_MS = 30_000;

interface PendingPermissionRequest {
  resolve: (decision: PermissionDecision) => void;
  timer: ReturnType<typeof setTimeout>;
}

const pendingPermissionRequests = new Map<string, PendingPermissionRequest>();

/**
 * Creates a pending permission request. The decision promise resolves with the
 * user's choice, or 'deny-once' after timeoutMs (safe default — never hang forever).
 * Callers emit a `permission.request` bus event carrying the requestId; a UI/route
 * answers via resolvePermissionRequest().
 */
export function createPermissionRequest(
  sessionId: string,
  toolName: string,
  args: object | undefined,
  timeoutMs: number = PERMISSION_ASK_TIMEOUT_MS
): { requestId: string; decision: Promise<PermissionDecision> } {
  const requestId = `perm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const decision = new Promise<PermissionDecision>((resolve) => {
    const timer = setTimeout(() => {
      pendingPermissionRequests.delete(requestId);
      resolve('deny-once');
    }, timeoutMs);
    pendingPermissionRequests.set(requestId, { resolve, timer });
  });
  return { requestId, decision };
}

/** Resolves a pending request. Returns false if the request is unknown/expired. */
export function resolvePermissionRequest(requestId: string, decision: PermissionDecision): boolean {
  const pending = pendingPermissionRequests.get(requestId);
  if (!pending) return false;
  clearTimeout(pending.timer);
  pendingPermissionRequests.delete(requestId);
  pending.resolve(decision);
  return true;
}

export function hasPendingPermissionRequest(requestId: string): boolean {
  return pendingPermissionRequests.has(requestId);
}

export class PermissionsManager {
  private static readonly READ_ONLY_TOOLS = new Set([
    "read_file",
    "list_files",
    "glob_files",
    "grep_search",
    "search_files",
    "todoread",
    "todowrite",
    "plan_exit",
    "websearch",
    "webfetch",
    "vision_analyze",
    "voice_transcribe",
    "image_info",
  ]);

  private static readonly WRITE_TOOLS = new Set([
    "write_file",
    "edit_file",
    "apply_patch",
    "delete_file",
    "create_file",
  ]);

  private static readonly EXEC_TOOLS = new Set([
    "shell",
    "shell_command",
    "run_command",
    "process",
    "git",
  ]);

  public checkPermission(agentMode: string, toolName: string, args?: object): PermissionCheckResult {
    const mode = (agentMode || "build").toLowerCase();
    const rawArgs = (args ?? {}) as Record<string, unknown>;

    // 1. Build Agent: Full Autonomous Access
    if (mode === "build") {
      return { allowed: true };
    }

    // 2. Plan Agent: Architect Mode (Strictly Non-Destructive)
    if (mode === "plan") {
      if (PermissionsManager.READ_ONLY_TOOLS.has(toolName)) {
        return { allowed: true };
      }
      if (PermissionsManager.WRITE_TOOLS.has(toolName)) {
        return {
          allowed: false,
          reason: `L'agent 'Plan' est en mode architecte en lecture seule. Pour modifier des fichiers, basculez sur l'agent 'Build'.`,
        };
      }
      if (PermissionsManager.EXEC_TOOLS.has(toolName)) {
        const cmd = String(rawArgs.command || rawArgs.CommandLine || "").trim().toLowerCase();
        if (cmd === "pwd" || cmd.startsWith("ls") || cmd === "git status" || cmd.startsWith("git log")) {
          return { allowed: true };
        }
        return {
          allowed: false,
          reason: `L'agent 'Plan' n'exécute pas de commandes de compilation ou de modification. Utilisez l'agent 'Build'.`,
        };
      }
      return { allowed: false, reason: `Outil non autorisé en mode Plan : ${toolName}` };
    }

    // 3. Explore Agent: Codebase Navigation
    if (mode === "explore") {
      if (
        toolName === "read_file" ||
        toolName === "list_files" ||
        toolName === "glob_files" ||
        toolName === "grep_search" ||
        toolName === "search_files"
      ) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: `L'agent 'Explore' est strictement dédié à la recherche dans le codebase. Modification refusée.`,
      };
    }

    // 4. Code Reviewer Agent
    if (mode === "code-reviewer") {
      if (
        PermissionsManager.READ_ONLY_TOOLS.has(toolName) ||
        toolName === "shell_command" ||
        toolName === "shell"
      ) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: `L'agent 'Code Reviewer' effectue uniquement des revues et l'exécution de tests.`,
      };
    }

    return { allowed: true };
  }
}

export const permissionsManager = new PermissionsManager();
