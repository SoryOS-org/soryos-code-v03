"use client";

import { useState } from "react";
import { GitHubAuthConnector } from "./github-auth-connector";
import {
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  Layers,
  GitBranch,
  GitCommit,
  GitPullRequest,
  Loader2,
  Check,
} from "lucide-react";

export type EnvironmentType = "sandbox" | "local";

export type ProviderId =
  | "e2b"
  | "vercel"
  | "google-cloud-run"
  | "github-codespaces"
  | "github-repository"
  | "local";

export interface ProviderMeta {
  id: ProviderId;
  name: string;
  configured: boolean;
  capabilities: {
    terminal: boolean;
    files: boolean;
    processes: boolean;
    build: boolean;
    heavyJobs: boolean;
    git: boolean;
  };
  description: string;
}

export const PROVIDER_METADATA: Record<ProviderId, ProviderMeta> = {
  e2b: {
    id: "e2b",
    name: "E2B",
    configured: true,
    capabilities: {
      terminal: true,
      files: true,
      processes: true,
      build: true,
      heavyJobs: false,
      git: true,
    },
    description: "Interactive cloud sandbox for terminal, filesystem, and processes.",
  },
  vercel: {
    id: "vercel",
    name: "Vercel Sandbox",
    configured: true,
    capabilities: {
      terminal: true,
      files: true,
      processes: false,
      build: true,
      heavyJobs: false,
      git: true,
    },
    description: "Serverless build and execution runtime.",
  },
  "google-cloud-run": {
    id: "google-cloud-run",
    name: "Google Cloud Run",
    configured: false,
    capabilities: {
      terminal: false,
      files: true,
      processes: true,
      build: true,
      heavyJobs: true,
      git: true,
    },
    description: "Cloud Run Job for heavy builds (cargo, cmake, gcc, ISO creation).",
  },
  "github-codespaces": {
    id: "github-codespaces",
    name: "GitHub Codespaces",
    configured: true,
    capabilities: {
      terminal: true,
      files: true,
      processes: true,
      build: true,
      heavyJobs: false,
      git: true,
    },
    description: "Remote dev container workspace on session branch.",
  },
  "github-repository": {
    id: "github-repository",
    name: "GitHub Repository",
    configured: true,
    capabilities: {
      terminal: true,
      files: true,
      processes: false,
      build: false,
      heavyJobs: false,
      git: true,
    },
    description: "Direct Git tree repository filesystem & live workspace.",
  },
  local: {
    id: "local",
    name: "Local Machine",
    configured: true,
    capabilities: {
      terminal: true,
      files: true,
      processes: true,
      build: true,
      heavyJobs: true,
      git: true,
    },
    description: "Direct local filesystem and process runner (LocalProvider).",
  },
};

interface SandboxSelectorProps {
  sessionId?: string;
  currentEnvironment?: EnvironmentType;
  currentProviderId?: ProviderId;
  onSelectEnvironmentAndProvider: (
    environment: EnvironmentType,
    providerId: ProviderId
  ) => void;
  onWorkspaceReady?: (info: {
    repository: string;
    branch: string;
    codespaceId?: string;
  }) => void;
  disabled?: boolean;
}

export function SandboxSelector({
  sessionId = "session",
  currentEnvironment = "local",
  currentProviderId = "local",
  onSelectEnvironmentAndProvider,
  onWorkspaceReady,
  disabled = false,
}: SandboxSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncDone, setSyncDone] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [gitStatus, setGitStatus] = useState<{
    isClean: boolean;
    currentBranch: string;
    currentCommit: string;
    uncommittedFilesCount: number;
  } | null>(null);

  const [pendingChange, setPendingChange] = useState<{
    env: EnvironmentType;
    prov: ProviderId;
  } | null>(null);

  const activeEnv = currentEnvironment;
  const activeProvId = currentEnvironment === "local" ? "local" : currentProviderId;
  const activeProvMeta = PROVIDER_METADATA[activeProvId] || PROVIDER_METADATA.e2b;

  const getDiscreetBadgeLabel = () => {
    if (activeEnv === "local") {
      return "💻 Local";
    }
    return `☁️ Sandbox · ${activeProvMeta.name}`;
  };

  const checkGitAndInitiateTransition = async (env: EnvironmentType, prov: ProviderId) => {
    setPendingChange({ env, prov });
    setSyncError(null);
    setIsOpen(false);

    try {
      const res = await fetch(`/api/sessions/${sessionId}/git-sync`);
      if (res.ok) {
        const data = await res.json();
        if (data.gitStatus) {
          setGitStatus(data.gitStatus);
        }
      } else {
        setGitStatus(null);
      }
    } catch {
      setGitStatus(null);
    }

    setSyncModalOpen(true);
  };

  const handleCommitAndPushThenSwitch = async () => {
    if (!pendingChange) return;
    setSyncing(true);
    setSyncError(null);

    try {
      const syncRes = await fetch(`/api/sessions/${sessionId}/git-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "commit_and_push",
          providerId: activeProvId,
          commitMessage: `soryos-code: checkpoint before switching to ${pendingChange.prov}`,
        }),
      });
      if (!syncRes.ok) {
        const errData = await syncRes.json().catch(() => ({}));
        throw new Error(errData.error || "Le commit & push a échoué");
      }

      if (pendingChange.env === "sandbox") {
        const cloudRes = await fetch(`/api/sessions/${sessionId}/git-sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "sync_cloud",
            providerId: pendingChange.prov,
          }),
        });
        if (!cloudRes.ok) {
          const errData = await cloudRes.json().catch(() => ({}));
          throw new Error(errData.error || "La synchronisation cloud a échoué");
        }
      }

      setSyncDone(true);
      setTimeout(() => {
        onSelectEnvironmentAndProvider(pendingChange.env, pendingChange.prov);
        setSyncModalOpen(false);
        setSyncing(false);
        setSyncDone(false);
        setPendingChange(null);
      }, 800);
    } catch (e) {
      setSyncError((e as Error)?.message || "Synchronisation impossible");
      setSyncing(false);
    }
  };

  return (
    <div className="relative inline-block text-left">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-2.5 py-1.5 text-xs font-semibold text-[var(--foreground)] shadow-2xs transition hover:bg-[var(--surface-hover)] hover:border-[var(--primary)]/50 focus:outline-none ${
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
        }`}
        title="Environment & Sandbox Selector"
      >
        <span className="flex items-center gap-1 text-[var(--foreground)] font-medium">
          <span>{getDiscreetBadgeLabel()}</span>
        </span>
        <ChevronDown className="h-3 w-3 text-[var(--muted-foreground)]" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          <div className="absolute right-0 z-50 mt-1.5 w-92 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-3.5 shadow-xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-150 text-[var(--foreground)]">
            <div className="px-1 pb-2 border-b border-[var(--border)] mb-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--foreground)] flex items-center gap-1">
                  <Layers className="h-3.5 w-3.5 text-[var(--primary)]" />
                  Execution Environment
                </span>
                <span className="text-[10px] text-[var(--muted-foreground)] font-mono">
                  SoryOS-Code
                </span>
              </div>
            </div>

            <div className="space-y-4">
              {/* 1. FIRST SELECTOR: ENVIRONMENT */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider">
                  Environment
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (activeEnv !== "sandbox") {
                        checkGitAndInitiateTransition("sandbox", currentProviderId === "local" ? "github-codespaces" : currentProviderId);
                      }
                    }}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-lg border transition cursor-pointer ${
                      activeEnv === "sandbox"
                        ? "bg-[var(--primary)]/15 border-[var(--primary)] text-[var(--foreground)] shadow-2xs"
                        : "bg-[var(--surface)] border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    <span>☁️ Sandbox</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (activeEnv !== "local") {
                        checkGitAndInitiateTransition("local", "local");
                      }
                    }}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-lg border transition cursor-pointer ${
                      activeEnv === "local"
                        ? "bg-[var(--primary)]/15 border-[var(--primary)] text-[var(--foreground)] shadow-2xs"
                        : "bg-[var(--surface)] border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    <span>💻 Local</span>
                  </button>
                </div>
              </div>

              {/* 2. SECOND SELECTOR: SANDBOX PROVIDER */}
              {activeEnv === "sandbox" ? (
                <div className="space-y-2 border-t border-[var(--border)] pt-3">
                  <label className="block text-[11px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider">
                    Sandbox Provider
                  </label>
                  <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
                    {(["e2b", "vercel", "google-cloud-run", "github-codespaces"] as ProviderId[]).map((pId) => {
                      const meta = PROVIDER_METADATA[pId];
                      const isSelected = activeProvId === pId;

                      return (
                        <button
                          key={pId}
                          type="button"
                          onClick={() => {
                            if (pId !== activeProvId) {
                              checkGitAndInitiateTransition("sandbox", pId);
                            }
                          }}
                          className={`w-full text-left rounded-lg p-2 transition border flex items-start gap-2.5 cursor-pointer ${
                            isSelected
                              ? "bg-[var(--primary)]/10 border-[var(--primary)] text-[var(--foreground)] font-medium"
                              : "bg-[var(--surface)] border-[var(--border)] hover:bg-[var(--surface-hover)] text-[var(--foreground)]"
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold">☁️ {meta.name}</span>
                              {meta.configured ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                                  <CheckCircle2 className="h-2.5 w-2.5" />
                                  Configured
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                                  <AlertTriangle className="h-2.5 w-2.5" />
                                  Not configured
                                </span>
                              )}
                            </div>

                            <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5 line-clamp-1">
                              {meta.description}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* 3. GITHUB AUTHENTICATION & CODESPACES CONNECTOR */}
                  {activeProvId === "github-codespaces" && (
                    <div className="mt-3">
                      <GitHubAuthConnector
                        sessionId={sessionId}
                        onCodespaceSelected={(repo, branch, codespaceId) => {
                          onWorkspaceReady?.({ repository: repo, branch, codespaceId });
                          onSelectEnvironmentAndProvider("sandbox", "github-codespaces");
                          setIsOpen(false);
                        }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="border-t border-[var(--border)] pt-3">
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2.5 text-xs text-[var(--foreground)] space-y-1">
                    <p className="font-bold text-[var(--foreground)]">💻 Mode Local Autonome Active</p>
                    <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed">
                      L&apos;Agent et le Terminal fonctionnent directement sur votre système de fichiers local (`LocalProvider`). Aucune connexion GitHub requise.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* GitHub Sync Transition Modal */}
      {syncModalOpen && pendingChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5 shadow-2xl space-y-4 text-[var(--foreground)]">
            <div className="flex items-center gap-2 text-[var(--foreground)] font-bold text-base">
              <GitBranch className="h-5 w-5 text-[var(--primary)]" />
              <span>Changement d&apos;environnement d&apos;exécution</span>
            </div>

            <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
              Transition de <strong>{activeEnv === "local" ? "💻 Local" : `☁️ ${activeProvMeta.name}`}</strong> vers <strong>{pendingChange.env === "local" ? "💻 Local" : `☁️ ${PROVIDER_METADATA[pendingChange.prov]?.name}`}</strong>.
            </p>

            {gitStatus && !gitStatus.isClean ? (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-600 dark:text-amber-400 space-y-2">
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Modifications non enregistrées
                  </span>
                  <span className="font-mono text-[10px] bg-amber-500/20 px-1.5 py-0.5 rounded">
                    {gitStatus.uncommittedFilesCount} fichier(s)
                  </span>
                </div>
                <p className="text-[11px] leading-snug">
                  Votre espace de travail contient des fichiers non commités. Pour retrouver exactement le même état dans <strong>{pendingChange.prov}</strong>, nous recommandons de commiter et pusher vers la branche de session GitHub.
                </p>
              </div>
            ) : gitStatus ? (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-600 dark:text-emerald-400 space-y-1">
                <div className="flex items-center gap-1 font-bold">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Espace de travail propre (Clean Git Status)
                </div>
                <p className="text-[11px]">
                  Branche : <code className="font-mono">{gitStatus.currentBranch || `soryos-code/${sessionId.slice(0, 8)}`}</code>
                </p>
              </div>
            ) : (
              <div className="p-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-xs text-[var(--muted-foreground)] space-y-1">
                <div className="flex items-center gap-1 font-bold text-[var(--foreground)]">
                  <GitBranch className="h-4 w-4 text-[var(--muted-foreground)]" />
                  Statut Git indisponible
                </div>
                <p className="text-[11px]">
                  Branche cible : <code className="font-mono">{`soryos-code/${sessionId.slice(0, 8)}`}</code> — vous pouvez commiter & pusher ou changer directement.
                </p>
              </div>
            )}

            {syncError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-600 dark:text-red-400 space-y-1">
                <div className="flex items-center gap-1 font-bold">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <span>Échec de la synchronisation</span>
                </div>
                <p className="text-[11px] leading-snug">{syncError}</p>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                disabled={syncing}
                onClick={handleCommitAndPushThenSwitch}
                className="w-full py-2 px-3 text-xs font-bold text-[var(--primary-foreground)] bg-[var(--primary)] hover:opacity-90 rounded-lg shadow-2xs transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {syncing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Synchronisation avec GitHub en cours...</span>
                  </>
                ) : syncDone ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Synchronisé !</span>
                  </>
                ) : (
                  <>
                    <GitPullRequest className="h-4 w-4" />
                    <span>Commit & Push vers GitHub puis basculer</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={syncing}
                onClick={() => {
                  onSelectEnvironmentAndProvider(pendingChange.env, pendingChange.prov);
                  setSyncModalOpen(false);
                  setPendingChange(null);
                }}
                className="w-full py-2 px-3 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--surface-hover)] rounded-lg border border-[var(--border)] transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <GitCommit className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                <span>Changer directement (Sans pousser)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
