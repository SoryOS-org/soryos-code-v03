/**
 * @soryos/web
 * Types spécifiques pour l'application web.
 * 
 * Ce fichier contient UNIQUEMENT des types pour l'UI.
 * Tous les types métier doivent être dans @soryos/schema.
 */

// Réexporter les types de base depuis @soryos/schema
export * from "@soryos/schema";

// Types spécifiques à l'application web
import type { MessageBlock } from "@soryos/schema";

export interface GitHubSessionContext {
  username?: string;
  avatarUrl?: string;
  connected: boolean;
  repository?: string;
  branch?: string;
  codespaceId?: string;
  codespaceState?: "Running" | "Stopped" | "Building" | "Failed";
}

export interface GetSessionResponse {
  id: string;
  title: string;
  sandbox_id: string | null;
  sandbox_state: "running" | "paused" | "dead";
  environment?: "sandbox" | "local";
  providerId?: string;
  model?: string;
  provider?: string;
  github?: GitHubSessionContext;
  repository?: string;
  branch?: string;
  codespaceId?: string;
  workspaceState?: "NO_WORKSPACE" | "WORKSPACE_LOADING" | "WORKSPACE_READY" | "WORKSPACE_ERROR" | string;
  workspaceError?: string;
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    blocks?: MessageBlock[];
    created_at: string;
  }>;
  preview_url: string | null;
  needs_run: boolean;
  agent_running: boolean;
}

// Types pour l'UI
export interface ChatMessageUI {
  id: string;
  role: "user" | "assistant";
  content: string;
  blocks?: MessageBlock[];
  created_at?: string;
}

// Types pour les composants UI
// Ces types sont déjà exportés depuis @soryos/schema
// export type EnvironmentType = "sandbox" | "local";
// export type ProviderId = "e2b" | "vercel" | "google-cloud-run" | "github-codespaces" | "github-repository" | "local";
