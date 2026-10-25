"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Laptop,
  Cloud,
  FolderOpen,
  Github,
  Boxes,
  Plus,
  Loader2,
  FolderGit2,
  CheckCircle2,
  ArrowRight,
  Layers,
  Terminal,
  ShieldCheck,
  Search,
  LogOut,
  Key,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { useGitHubAuth } from "@/hooks/use-github-auth";
import { createSession } from "@/lib/api";
import { EnvironmentType, ProviderId, PROVIDER_METADATA } from "@/components/sandbox-selector";

interface WorkspaceLauncherProps {
  onWorkspaceOpened?: (sessionId: string, env: EnvironmentType, providerId: ProviderId) => void;
}

export type EnvironmentMode = "local" | "remote" | null;

export function WorkspaceLauncher({ onWorkspaceOpened }: WorkspaceLauncherProps) {
  const router = useRouter();

  // Environment & Provider Selection State (defaults to "local" so options are interactive immediately)
  const [environmentMode, setEnvironmentMode] = useState<EnvironmentMode>("local");
  const [remoteProvider, setRemoteProvider] = useState<ProviderId | null>(null);

  // Local folder input
  const [localFolderPath, setLocalFolderPath] = useState("./");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // GitHub Auth hook for GitHub Codespaces (Connecting to real GitHub API)
  const {
    account,
    repos,
    selectedRepo,
    setSelectedRepo,
    branches,
    selectedBranch,
    setSelectedBranch,
    codespaces,
    loading: githubLoading,
    deviceFlow,
    connectWithToken,
    startDeviceFlow,
    cancelDeviceFlow,
    disconnect: disconnectGithub,
    createCodespace,
  } = useGitHubAuth("launcher");

  // GitHub token input state for direct user login
  const [githubTokenInput, setGithubTokenInput] = useState("");
  const [githubAuthError, setGithubAuthError] = useState<string | null>(null);

  // Repository search query in GitHub Codespaces
  const [repoSearch, setRepoSearch] = useState("");
  const [selectedMachine, setSelectedMachine] = useState("standardLinux32gb");
  const [showNewCodespaceForm, setShowNewCodespaceForm] = useState(false);

  // Optional API key for other cloud providers
  const [cloudApiKey, setCloudApiKey] = useState("");

  // Filtered repositories
  const filteredRepos = repos.filter((r) =>
    r.name.toLowerCase().includes(repoSearch.toLowerCase()) ||
    r.fullName.toLowerCase().includes(repoSearch.toLowerCase())
  );

  // Handle Real GitHub Login via User Token
  const handleConnectRealGithub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubTokenInput.trim()) return;
    setGithubAuthError(null);
    try {
      const res = await connectWithToken(githubTokenInput.trim());
      if (res.success) {
        setGithubTokenInput("");
      } else {
        setGithubAuthError(res.error || "Token GitHub invalide ou expiré");
      }
    } catch {
      setGithubAuthError("Erreur lors de la validation du token GitHub");
    }
  };

  // Handle Open Local Folder (100% autonomous, no cloud sandbox, no GitHub required)
  const handleOpenLocalFolder = async () => {
    if (loading) return;
    if (!localFolderPath.trim()) {
      setErrorMessage("Indiquez le chemin du dossier à ouvrir.");
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    setStatusMessage("Ouverture du Workspace Local sur le système de fichiers réel...");

    try {
      const folderName = localFolderPath.split("/").filter(Boolean).pop() || "local-project";
      const session = await createSession(
        `Local Project: ${folderName}`,
        `Working copy at ${localFolderPath}`,
        "opencode/zen-coder-free",
        "local",
        "local"
      );

      // Set session environment to local
      const response = await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        signal: AbortSignal.timeout(30000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ environment: "local", providerId: "local" }),
      });
      if (!response.ok) throw new Error("Impossible de configurer le projet local. Réessayez.");

      if (onWorkspaceOpened) {
        onWorkspaceOpened(session.id, "local", "local");
      } else {
        router.push(`/chat/${session.id}`);
      }
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Impossible d'ouvrir le dossier local. Vérifiez les permissions d'accès.");
      setLoading(false);
    }
  };

  // Handle Connect Existing Codespace
  const handleOpenExistingCodespace = async (codespaceId: string, repo: string, branch: string) => {
    setLoading(true);
    setErrorMessage(null);
    setStatusMessage(`1/3 Connexion au Codespace ${codespaceId} (${repo})...`);

    try {
      const session = await createSession(
        `Codespace: ${repo}`,
        `Remote workspace attached to ${repo} on branch ${branch}`,
        "opencode/zen-coder-free",
        "github-codespaces",
        "sandbox",
        { codespaceId, repository: repo, branch }
      );

      setStatusMessage("2/3 Initialisation du Remote Filesystem & démarrage de la machine...");

      const initRes = await fetch(`/api/sessions/${session.id}/init-workspace`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codespaceId,
          repository: repo,
          branch,
          providerId: "github-codespaces",
        }),
      });

      const initData = await initRes.json();
      if (!initRes.ok || initData.error) {
        throw new Error(initData.error || "Impossible de connecter le Remote Filesystem du Codespace.");
      }

      if (initData.syncError) throw new Error(`Synchronisation GitHub échouée : ${initData.syncError}`);
      setStatusMessage(`3/3 ${initData.filesCount ?? 0} fichier(s) chargé(s). Ouverture du Workspace...`);

      if (onWorkspaceOpened) {
        onWorkspaceOpened(session.id, "sandbox", "github-codespaces");
      } else {
        router.push(`/chat/${session.id}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Échec de connexion au Codespace.";
      setErrorMessage(msg);
      setLoading(false);
    }
  };

  // Handle Create New Codespace
  const handleCreateNewCodespace = async () => {
    if (!selectedRepo) return;
    setLoading(true);
    setErrorMessage(null);
    setStatusMessage(`1/3 Création du GitHub Codespace pour ${selectedRepo} (${selectedBranch})...`);

    try {
      const cs = await createCodespace(selectedRepo, selectedBranch, selectedMachine);
      const codespaceId = cs?.name || cs?.id || `cs-${selectedRepo.replace("/", "-")}`;

      const session = await createSession(
        `Codespace: ${selectedRepo}`,
        `Remote workspace created for ${selectedRepo} on ${selectedBranch}`,
        "opencode/zen-coder-free",
        "github-codespaces",
        "sandbox",
        { codespaceId, repository: selectedRepo, branch: selectedBranch }
      );

      setStatusMessage("2/3 Initialisation du Remote Filesystem & chargement des fichiers...");

      const initRes = await fetch(`/api/sessions/${session.id}/init-workspace`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codespaceId,
          repository: selectedRepo,
          branch: selectedBranch,
          providerId: "github-codespaces",
        }),
      });

      const initData = await initRes.json();
      if (!initRes.ok || initData.error) {
        throw new Error(initData.error || "Échec d'initialisation du Remote Filesystem.");
      }

      if (initData.syncError) throw new Error(`Synchronisation GitHub échouée : ${initData.syncError}`);
      setStatusMessage(`3/3 ${initData.filesCount ?? 0} fichier(s) synchronisé(s). Ouverture de l'IDE...`);

      if (onWorkspaceOpened) {
        onWorkspaceOpened(session.id, "sandbox", "github-codespaces");
      } else {
        router.push(`/chat/${session.id}`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Échec de la création du GitHub Codespace.";
      setErrorMessage(msg);
      setLoading(false);
    }
  };

  // Handle Remote Cloud Sandbox (E2B / Vercel / Cloud Run)
  const handleOpenRemoteSandbox = async (providerId: ProviderId) => {
    setLoading(true);
    setErrorMessage(null);
    const meta = PROVIDER_METADATA[providerId];
    setStatusMessage(`Initialisation du Workspace ${meta.name}...`);

    try {
      const session = await createSession(
        `Remote Workspace (${meta.name})`,
        `Execution environment: ${meta.name}`,
        "opencode/zen-coder-free",
        providerId,
        "sandbox",
        cloudApiKey ? { apiKey: cloudApiKey.trim() } : {}
      );

      const response = await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        signal: AbortSignal.timeout(30000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environment: "sandbox",
          providerId,
          ...(cloudApiKey ? { apiKey: cloudApiKey.trim() } : {}),
        }),
      });
      if (!response.ok) throw new Error(`Impossible de configurer l’environnement ${meta.name}. Réessayez.`);

      if (onWorkspaceOpened) {
        onWorkspaceOpened(session.id, "sandbox", providerId);
      } else {
        router.push(`/chat/${session.id}`);
      }
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : `Échec de lancement de l'environnement ${providerId}.`);
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-3xl my-auto p-4 sm:p-6 space-y-6">
      {/* Loading Overlay State */}
      {loading ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--foreground)] p-8 shadow-xl text-center space-y-4 animate-in fade-in">
          <Loader2 className="h-10 w-10 text-[var(--primary)] animate-spin mx-auto" />
          <div className="space-y-1">
            <h3 className="text-base font-bold text-[var(--foreground)]">Initialisation du Workspace...</h3>
            <p className="text-xs font-mono text-[var(--muted-foreground)]">{statusMessage}</p>
          </div>
        </div>
      ) : (
        /* Workspace Environment Selection Panel */
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--foreground)] shadow-xl overflow-hidden">
          {/* STEP 1: INITIAL ENVIRONMENT SELECTOR (Both buttons 100% interactive, never disabled) */}
          <div className="p-4 sm:p-5 border-b border-[var(--border)] bg-[var(--surface)]">
            <div className="text-center mb-3">
              <span className="text-[11px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider">
                1. Sélectionner l&apos;Environnement
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* BUTTON 1: LOCAL ENVIRONMENT */}
              <button
                type="button"
                onClick={() => {
                  setEnvironmentMode("local");
                  setRemoteProvider(null);
                  setErrorMessage(null);
                }}
                className={`py-3.5 px-4 rounded-xl transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer touch-manipulation border-2 text-center active:scale-[0.99] ${
                  environmentMode === "local"
                    ? "bg-[var(--surface-hover)] border-[var(--primary)] text-[var(--foreground)] shadow-md ring-2 ring-[var(--primary)]/20"
                    : "bg-[var(--surface-elevated)] border-[var(--border)] text-[var(--foreground)] hover:border-[var(--primary)]/60 hover:bg-[var(--surface-hover)] shadow-xs"
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-sm sm:text-base">
                  <Laptop className={`h-5 w-5 ${environmentMode === "local" ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}`} />
                  <span>Environnement Local</span>
                </div>
                <span className={`text-[11px] leading-tight ${environmentMode === "local" ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"}`}>
                  Exécution directe sur le disque local via LocalProvider
                </span>
              </button>

              {/* BUTTON 2: REMOTE ENVIRONMENT (Always active, NEVER disabled) */}
              <button
                type="button"
                onClick={() => {
                  setEnvironmentMode("remote");
                  if (!remoteProvider) {
                    setRemoteProvider("github-codespaces");
                  }
                  setErrorMessage(null);
                }}
                className={`py-3.5 px-4 rounded-xl transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer touch-manipulation border-2 text-center active:scale-[0.99] ${
                  environmentMode === "remote"
                    ? "bg-[var(--surface-hover)] border-emerald-600 text-[var(--foreground)] shadow-md ring-2 ring-emerald-600/20"
                    : "bg-[var(--surface-elevated)] border-[var(--border)] text-[var(--foreground)] hover:border-emerald-600 hover:bg-[var(--surface-hover)] shadow-xs"
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-sm sm:text-base">
                  <Cloud className={`h-5 w-5 ${environmentMode === "remote" ? "text-emerald-500" : "text-[var(--muted-foreground)]"}`} />
                  <span>Environnement Distant</span>
                </div>
                <span className={`text-[11px] leading-tight ${environmentMode === "remote" ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"}`}>
                  GitHub Codespaces, E2B, Vercel ou Cloud Run
                </span>
              </button>
            </div>
          </div>

          {/* STEP 2: CONTENT DEPENDING ON ENVIRONMENT MODE */}

          {/* 2.0: NO ENVIRONMENT SELECTED YET */}
          {environmentMode === null && (
            <div className="p-8 text-center space-y-2 animate-in fade-in duration-150">
              <p className="text-sm font-medium text-[var(--muted-foreground)]">
                Veuillez cliquer sur <strong className="text-[var(--foreground)]">💻 Environment Local</strong> pour travailler directement sur votre machine, ou sur <strong className="text-emerald-500">☁️ Environment Distant</strong> pour utiliser un environnement cloud ou Codespaces.
              </p>
            </div>
          )}

          {/* 2.1: LOCAL ENVIRONMENT PANEL */}
          {environmentMode === "local" && (
            <div className="p-6 space-y-5 animate-in fade-in duration-150">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-2 text-xs text-[var(--muted-foreground)]">
                <div className="flex items-center gap-2 font-bold text-[var(--foreground)] text-sm">
                  <Laptop className="h-4 w-4 text-[var(--primary)]" />
                  <span>Mode Local Autonome (`LocalProvider`)</span>
                </div>
                <p className="leading-relaxed text-[var(--muted-foreground)]">
                  SoryOS-Code travaille directement sur votre système de fichiers local. Aucun sandbox cloud n&apos;est créé et aucun fichier n&apos;est copié en ligne sans votre accord. Aucune authentification GitHub ni clé API n&apos;est nécessaire.
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider">
                  Chemin du Dossier Local (Workspace)
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <FolderOpen className="absolute left-3 top-3 h-4 w-4 text-[var(--muted-foreground)]" />
                    <input
                      type="text"
                      value={localFolderPath}
                      onChange={(e) => setLocalFolderPath(e.target.value)}
                      placeholder="/home/sory/projects/my-project"
                      className="w-full pl-9 pr-3 py-2.5 text-xs font-mono border border-[var(--border)] rounded-xl outline-none focus:border-[var(--primary)] bg-[var(--input)] text-[var(--foreground)]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenLocalFolder}
                    className="py-2.5 px-5 text-xs font-bold text-[var(--primary-foreground)] bg-[var(--primary)] hover:opacity-90 rounded-xl shadow-2xs transition flex items-center justify-center gap-2 cursor-pointer shrink-0 active:scale-[0.98]"
                  >
                    <span>Open Local Folder</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2.2: REMOTE ENVIRONMENT PANEL */}
          {environmentMode === "remote" && (
            <div className="p-6 space-y-6 animate-in fade-in duration-150">
              <div className="space-y-1">
                <span className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider">
                  2. Environment Distant — Choisissez votre provider :
                </span>
                <p className="text-xs text-[var(--muted-foreground)]">
                  GitHub Codespaces utilise votre vrai compte GitHub. Les autres providers fonctionnent comme sandboxes cloud.
                </p>
              </div>

              {/* 4 REMOTE PROVIDER CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. GITHUB CODESPACES */}
                <button
                  type="button"
                  onClick={() => setRemoteProvider("github-codespaces")}
                  className={`p-4 rounded-xl border-2 text-left transition flex flex-col justify-between cursor-pointer active:scale-[0.99] ${
                    remoteProvider === "github-codespaces"
                      ? "bg-[var(--surface-hover)] border-emerald-600 shadow-xs"
                      : "bg-[var(--surface-elevated)] border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--surface-hover)]"
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-[var(--foreground)] flex items-center gap-1.5">
                        <Github className="h-4 w-4 text-[var(--primary)]" />
                        GitHub Codespaces
                      </span>
                      {account.connected && (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                          @{account.username}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)] leading-snug">
                      Machine distante GitHub Codespaces (vrai compte GitHub).
                    </p>
                  </div>
                </button>

                {/* 2. E2B */}
                <button
                  type="button"
                  onClick={() => setRemoteProvider("e2b")}
                  className={`p-4 rounded-xl border-2 text-left transition flex flex-col justify-between cursor-pointer active:scale-[0.99] ${
                    remoteProvider === "e2b"
                      ? "bg-[var(--surface-hover)] border-emerald-600 shadow-xs"
                      : "bg-[var(--surface-elevated)] border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--surface-hover)]"
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-[var(--foreground)] flex items-center gap-1.5">
                        <Boxes className="h-4 w-4 text-[var(--primary)]" />
                        E2B
                      </span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                        Cloud Sandbox
                      </span>
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)] leading-snug">
                      Sandbox cloud complet pour terminal, fichiers et processus.
                    </p>
                  </div>
                </button>

                {/* 3. VERCEL SANDBOX */}
                <button
                  type="button"
                  onClick={() => setRemoteProvider("vercel")}
                  className={`p-4 rounded-xl border-2 text-left transition flex flex-col justify-between cursor-pointer active:scale-[0.99] ${
                    remoteProvider === "vercel"
                      ? "bg-[var(--surface-hover)] border-emerald-600 shadow-xs"
                      : "bg-[var(--surface-elevated)] border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--surface-hover)]"
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-[var(--foreground)] flex items-center gap-1.5">
                        <Layers className="h-4 w-4 text-[var(--primary)]" />
                        Vercel Sandbox
                      </span>
                      <span className="text-[10px] text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded">
                        Serverless
                      </span>
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)] leading-snug">
                      Environnement d&apos;exécution serverless et builds rapides.
                    </p>
                  </div>
                </button>

                {/* 4. GOOGLE CLOUD RUN */}
                <button
                  type="button"
                  onClick={() => setRemoteProvider("google-cloud-run")}
                  className={`p-4 rounded-xl border-2 text-left transition flex flex-col justify-between cursor-pointer active:scale-[0.99] ${
                    remoteProvider === "google-cloud-run"
                      ? "bg-[var(--surface-hover)] border-emerald-600 shadow-xs"
                      : "bg-[var(--surface-elevated)] border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--surface-hover)]"
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-[var(--foreground)] flex items-center gap-1.5">
                        <Terminal className="h-4 w-4 text-[var(--primary)]" />
                        Google Cloud Run
                      </span>
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                        Heavy Jobs
                      </span>
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)] leading-snug">
                      Build / Job / Exécution de compilations lourdes.
                    </p>
                  </div>
                </button>
              </div>

              {/* SPECIFIC PROVIDER CONFIGURATION PANEL */}

              {/* A. GITHUB CODESPACES: REAL GITHUB AUTHENTICATION */}
              {remoteProvider === "github-codespaces" && (
                <div className="border-t border-[var(--border)] pt-5 space-y-4">
                  {!account.connected ? (
                    /* Step 2A: Unauthenticated - User connects their real GitHub account */
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-4">
                      <div className="text-center space-y-1">
                        <Github className="h-9 w-9 text-[var(--foreground)] mx-auto" />
                        <h4 className="text-sm font-bold text-[var(--foreground)]">
                          Connexion à votre vrai compte GitHub
                        </h4>
                        <p className="text-xs text-[var(--muted-foreground)] max-w-md mx-auto">
                          Connectez votre compte GitHub réel pour afficher vos véritables repositories et créer vos Codespaces. Aucun compte fictif n&apos;est utilisé.
                        </p>
                      </div>

                      {/* Device Flow in progress */}
                      {deviceFlow && (
                        <div className="p-4 bg-[var(--surface-elevated)] border border-emerald-500/30 rounded-xl space-y-3 text-center animate-in fade-in">
                          <span className="text-xs text-[var(--muted-foreground)]">Code d&apos;autorisation GitHub :</span>
                          <div className="text-2xl font-mono font-black text-[var(--foreground)] tracking-wider">
                            {deviceFlow.userCode}
                          </div>
                          <p className="text-xs text-[var(--muted-foreground)]">
                            Ouvrez la page de validation GitHub et saisissez ce code pour valider votre connexion :
                          </p>
                          <div className="flex justify-center gap-2">
                            <a
                              href={deviceFlow.verificationUri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="py-2 px-4 text-xs font-bold text-[var(--primary-foreground)] bg-[var(--primary)] hover:opacity-90 rounded-lg inline-flex items-center gap-1.5"
                            >
                              <span>Ouvrir {deviceFlow.verificationUri}</span>
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                            <button
                              type="button"
                              onClick={cancelDeviceFlow}
                              className="py-2 px-3 text-xs text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] rounded-lg"
                            >
                              Annuler
                            </button>
                          </div>
                          <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-500">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>En attente de votre autorisation sur GitHub...</span>
                          </div>
                        </div>
                      )}

                      {/* Token connection form */}
                      {!deviceFlow && (
                        <form onSubmit={handleConnectRealGithub} className="p-4 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-xl space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-[var(--foreground)] flex items-center gap-1.5">
                              <Key className="h-3.5 w-3.5 text-[var(--primary)]" />
                              <span>Personal Access Token GitHub (Classic ou Fine-grained)</span>
                            </label>
                            <a
                              href="https://github.com/settings/tokens/new?scopes=repo,codespace,read:user&description=SoryOS-Code-IDE"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] font-semibold text-[var(--primary)] hover:underline flex items-center gap-1"
                            >
                              <span>Générer un token sur GitHub</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>

                          <input
                            type="password"
                            placeholder="ghp_... ou github_pat_..."
                            value={githubTokenInput}
                            onChange={(e) => setGithubTokenInput(e.target.value)}
                            required
                            className="w-full px-3 py-2 text-xs font-mono border border-[var(--border)] rounded-lg outline-none focus:border-[var(--primary)] bg-[var(--input)] text-[var(--foreground)]"
                          />

                          <p className="text-[11px] text-[var(--muted-foreground)]">
                            Permissions requises pour Codespaces : <code className="bg-[var(--surface-hover)] px-1 py-0.5 rounded text-[var(--foreground)]">repo</code>, <code className="bg-[var(--surface-hover)] px-1 py-0.5 rounded text-[var(--foreground)]">codespace</code>, <code className="bg-[var(--surface-hover)] px-1 py-0.5 rounded text-[var(--foreground)]">read:user</code>.
                          </p>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                            <button
                              type="submit"
                              disabled={githubLoading || !githubTokenInput.trim()}
                              className="py-2 px-5 text-xs font-bold text-[var(--primary-foreground)] bg-[var(--primary)] hover:opacity-90 rounded-lg shadow-2xs transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                            >
                              {githubLoading ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Github className="h-3.5 w-3.5" />
                              )}
                              <span>Se connecter avec ce compte GitHub</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => void startDeviceFlow()}
                              disabled={githubLoading}
                              className="py-2 px-3 text-xs font-semibold text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] rounded-lg transition"
                              title="Connexion interactive Device Flow"
                            >
                              Utiliser Device Flow
                            </button>
                          </div>
                        </form>
                      )}

                      {githubAuthError && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs rounded-lg flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                          <span>{githubAuthError}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-center gap-1 text-[11px] text-[var(--muted-foreground)] pt-1">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                        <span>Votre clé est validée directement sur l&apos;API officielle de GitHub et conservée côté serveur.</span>
                      </div>
                    </div>
                  ) : (
                    /* Step 2B: Authenticated with Real User Account */
                    <div className="space-y-5">
                      {/* GitHub Account Header */}
                      <div className="flex items-center justify-between bg-[var(--surface)] border border-[var(--border)] p-3 rounded-xl text-xs text-[var(--foreground)]">
                        <div className="flex items-center gap-2.5">
                          {account.avatarUrl ? (
                            <img
                              src={account.avatarUrl}
                              alt={account.username}
                              className="h-7 w-7 rounded-full border border-emerald-500/30"
                            />
                          ) : (
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                          )}
                          <div>
                            <div className="font-bold text-[var(--foreground)]">
                              Connecté en tant que @{account.username} {account.name && `(${account.name})`}
                            </div>
                            <div className="text-[10px] text-emerald-500">Compte réel vérifié sur api.github.com</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void disconnectGithub()}
                          className="text-xs font-semibold text-red-500 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          <span>Déconnecter</span>
                        </button>
                      </div>

                      {/* Existing Codespaces Section */}
                      {codespaces.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider">
                              Codespaces Existants
                            </label>
                            <span className="text-[11px] text-[var(--muted-foreground)] font-mono">
                              {codespaces.length} disponible(s)
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {codespaces.map((cs) => (
                              <div
                                key={cs.id}
                                className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-3 space-y-2 hover:border-[var(--primary)] transition shadow-2xs"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-[var(--foreground)] truncate">
                                    {cs.name}
                                  </span>
                                  <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2 rounded">
                                    ● {cs.state}
                                  </span>
                                </div>
                                <p className="text-[11px] font-mono text-[var(--muted-foreground)] truncate">
                                  {cs.repositoryName} · {cs.branch}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => handleOpenExistingCodespace((cs as { name?: string }).name || cs.id, cs.repositoryName, cs.branch)}
                                  className="w-full py-1.5 px-3 text-xs font-bold text-[var(--primary-foreground)] bg-[var(--primary)] hover:opacity-90 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                  <FolderGit2 className="h-3.5 w-3.5" />
                                  <span>Open Codespace</span>
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Repositories & New Codespace Form */}
                      <div className="border-t border-[var(--border)] pt-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider">
                            Vos Repositories GitHub & Création de Codespace
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowNewCodespaceForm(!showNewCodespaceForm)}
                            className="text-xs font-semibold text-[var(--primary)] hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>{showNewCodespaceForm ? "Masquer" : "Nouveau Codespace"}</span>
                          </button>
                        </div>

                        {/* Search Repositories Bar */}
                        <div className="relative">
                          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                          <input
                            type="text"
                            placeholder="Rechercher parmi vos dépôts GitHub..."
                            value={repoSearch}
                            onChange={(e) => setRepoSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 text-xs border border-[var(--border)] rounded-lg outline-none focus:border-[var(--primary)] bg-[var(--input)] text-[var(--foreground)]"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase">Repository</label>
                            <select
                              value={selectedRepo}
                              onChange={(e) => setSelectedRepo(e.target.value)}
                              className="w-full px-3 py-2 text-xs border border-[var(--border)] rounded-xl bg-[var(--input)] font-mono text-[var(--foreground)] outline-none"
                            >
                              {filteredRepos.length === 0 ? (
                                <option value="">Aucun dépôt trouvé</option>
                              ) : (
                                filteredRepos.map((r) => (
                                  <option key={r.fullName} value={r.fullName}>
                                    {r.fullName} {r.private ? "(Privé)" : "(Public)"}
                                  </option>
                                ))
                              )}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase">Branche</label>
                            <select
                              value={selectedBranch}
                              onChange={(e) => setSelectedBranch(e.target.value)}
                              className="w-full px-3 py-2 text-xs border border-[var(--border)] rounded-xl bg-[var(--input)] font-mono text-[var(--foreground)] outline-none"
                            >
                              {branches.length === 0 ? (
                                <option value="main">main</option>
                              ) : (
                                branches.map((b) => (
                                  <option key={b.name} value={b.name}>
                                    {b.name} {b.isDefault ? "(défaut)" : ""}
                                  </option>
                                ))
                              )}
                            </select>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase">Configuration Machine</label>
                          <select
                            value={selectedMachine}
                            onChange={(e) => setSelectedMachine(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs border border-[var(--border)] rounded-xl bg-[var(--input)] font-mono text-[var(--foreground)] outline-none"
                          >
                            <option value="standardLinux32gb">Standard Linux (2 cores, 8GB RAM, 32GB Storage)</option>
                            <option value="premiumLinux64gb">Performance Linux (4 cores, 16GB RAM, 64GB Storage)</option>
                          </select>
                        </div>

                        <button
                          type="button"
                          onClick={handleCreateNewCodespace}
                          disabled={!selectedRepo || githubLoading}
                          className="w-full py-2.5 px-4 text-xs font-bold text-[var(--primary-foreground)] bg-[var(--primary)] hover:opacity-90 rounded-xl shadow-2xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-[0.98]"
                        >
                          {githubLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                          <span>Créer & Connecter le Codespace</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* B. CLOUD PROVIDERS (E2B / VERCEL / CLOUD RUN): DIRECT LAUNCH WITH OPTIONAL API KEY */}
              {remoteProvider && remoteProvider !== "github-codespaces" && (
                <div className="border-t border-[var(--border)] pt-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4 text-[var(--primary)]" />
                      <h4 className="text-sm font-bold text-[var(--foreground)]">
                        {PROVIDER_METADATA[remoteProvider].name}
                      </h4>
                    </div>

                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      Disponible
                    </span>
                  </div>

                  <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                    {PROVIDER_METADATA[remoteProvider].description}
                  </p>

                  <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-[var(--foreground)]">
                        Clé API / Token (Optionnel si configuré sur le serveur) :
                      </label>
                      <input
                        type="password"
                        placeholder="Collez votre clé API ici si nécessaire..."
                        value={cloudApiKey}
                        onChange={(e) => setCloudApiKey(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-mono border border-[var(--border)] rounded-lg outline-none focus:border-[var(--primary)] bg-[var(--input)] text-[var(--foreground)]"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenRemoteSandbox(remoteProvider)}
                      className="w-full py-2.5 px-4 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-2xs transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                    >
                      <span>Créer Sandbox dans {PROVIDER_METADATA[remoteProvider].name}</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs rounded-xl text-center">
          {errorMessage}
        </div>
      )}
    </div>
  );
}
