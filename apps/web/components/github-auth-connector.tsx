"use client";

import { useGitHubAuth } from "@/hooks/use-github-auth";
import {
  Github,
  CheckCircle2,
  LogOut,
  Loader2,
  Plus,
  GitBranch,
  FolderGit2,
  ShieldCheck,
  AlertCircle,
  Key,
  ExternalLink,
} from "lucide-react";
import { useState } from "react";

interface GitHubAuthConnectorProps {
  sessionId?: string;
  onCodespaceSelected?: (repo: string, branch: string, codespaceId?: string) => void;
}

export function GitHubAuthConnector({
  sessionId = "session",
  onCodespaceSelected,
}: GitHubAuthConnectorProps) {
  const {
    account,
    repos,
    selectedRepo,
    setSelectedRepo,
    branches,
    selectedBranch,
    setSelectedBranch,
    codespaces,
    loading,
    error,
    connectWithToken,
    disconnect,
    createRepo,
    createCodespace,
  } = useGitHubAuth(sessionId);

  const [tokenInput, setTokenInput] = useState("");
  const [showTokenForm, setShowTokenForm] = useState(false);
  const [showNewRepo, setShowNewRepo] = useState(false);
  const [newRepoName, setNewRepoName] = useState("");
  const [newRepoDesc, setNewRepoDesc] = useState("");
  const [newRepoPrivate, setNewRepoPrivate] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const handleConnectToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;
    setActionLoading(true);
    try {
      const res = await connectWithToken(tokenInput.trim());
      if (res.success) {
        setTokenInput("");
        setShowTokenForm(false);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRepoName.trim()) return;
    setActionLoading(true);
    try {
      const created = await createRepo(
        newRepoName.trim(),
        newRepoDesc.trim(),
        newRepoPrivate
      );
      if (created) {
        setShowNewRepo(false);
        setNewRepoName("");
        setNewRepoDesc("");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleLaunchCodespace = async () => {
    if (!selectedRepo) return;
    setActionLoading(true);
    try {
      // Reuse an already-running/existing codespace instead of creating a new one
      const cs = codespaces.length
        ? codespaces[0]
        : await createCodespace(selectedRepo, selectedBranch);
      if (cs) {
        onCodespaceSelected?.(selectedRepo, selectedBranch || "main", cs.id);
      }
    } catch {
      // Error already surfaced via the hook's `error` state
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 space-y-3 text-slate-800">
      {/* Header & Status */}
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
        <div className="flex items-center gap-1.5 font-bold text-xs">
          <Github className="h-4 w-4 text-slate-900" />
          <span>Compte GitHub</span>
        </div>

        {account.connected ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 rounded-full">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              @{account.username}
            </span>
            <button
              type="button"
              onClick={() => void disconnect()}
              disabled={loading}
              className="p-1 text-slate-400 hover:text-red-600 transition rounded cursor-pointer"
              title="Déconnecter"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <span className="text-[10px] font-medium text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
            Non connecté
          </span>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-1.5 p-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Unauthenticated View */}
      {!account.connected ? (
        <div className="space-y-3 pt-1">
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Connectez votre compte GitHub réel pour synchroniser vos dépôts et lancer vos Codespaces.
          </p>

          {!showTokenForm ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowTokenForm(true)}
                className="w-full py-2 px-3 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-2xs transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Key className="h-3.5 w-3.5" />
                <span>Connecter avec votre Token GitHub (PAT)</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleConnectToken} className="space-y-2.5 p-3 bg-white border border-slate-200 rounded-xl">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700">
                  Personal Access Token (PAT)
                </label>
                <a
                  href="https://github.com/settings/tokens/new?scopes=repo,codespace,read:user&description=SoryOS-Code"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-emerald-700 hover:underline flex items-center gap-0.5"
                >
                  <span>Générer sur GitHub</span>
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </div>

              <input
                type="password"
                placeholder="ghp_... ou github_pat_..."
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                required
                className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-200 rounded-lg outline-none focus:border-slate-800"
              />

              <p className="text-[10px] text-slate-500">
                Permissions requises : <code className="bg-slate-100 px-1 rounded">repo</code>, <code className="bg-slate-100 px-1 rounded">codespace</code>, <code className="bg-slate-100 px-1 rounded">read:user</code>.
              </p>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={actionLoading || !tokenInput.trim()}
                  className="py-1.5 px-3 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {actionLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                  <span>Vérifier & Connecter</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowTokenForm(false)}
                  className="py-1.5 px-2.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Annuler
                </button>
              </div>
            </form>
          )}

          <div className="flex items-center gap-1 text-[10px] text-slate-500">
            <ShieldCheck className="h-3 w-3 text-emerald-600 shrink-0" />
            <span>Votre clé est validée directement sur l&apos;API GitHub et stockée uniquement côté serveur.</span>
          </div>
        </div>
      ) : (
        /* Authenticated View */
        <div className="space-y-2.5">
          {/* Repository Selector */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-slate-600 uppercase">
                Repository
              </label>
              <button
                type="button"
                onClick={() => setShowNewRepo(!showNewRepo)}
                className="text-[10px] text-[#c6623f] font-semibold flex items-center gap-0.5 hover:underline"
              >
                <Plus className="h-3 w-3" />
                <span>{showNewRepo ? "Sélectionner existant" : "Nouveau repo"}</span>
              </button>
            </div>

            {showNewRepo ? (
              <form onSubmit={handleCreateRepo} className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-2">
                <input
                  type="text"
                  placeholder="Nom du repository (ex: mon-projet)"
                  value={newRepoName}
                  onChange={(e) => setNewRepoName(e.target.value)}
                  required
                  className="w-full px-2 py-1 text-xs border border-slate-200 rounded font-mono text-slate-800 outline-none"
                />
                <input
                  type="text"
                  placeholder="Description (optionnel)"
                  value={newRepoDesc}
                  onChange={(e) => setNewRepoDesc(e.target.value)}
                  className="w-full px-2 py-1 text-xs border border-slate-200 rounded text-slate-800 outline-none"
                />
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newRepoPrivate}
                      onChange={(e) => setNewRepoPrivate(e.target.checked)}
                      className="rounded"
                    />
                    <span>Privé</span>
                  </label>
                  <button
                    type="submit"
                    disabled={actionLoading || !newRepoName.trim()}
                    className="px-2.5 py-1 text-[11px] font-bold text-white bg-[#c6623f] hover:bg-[#b05332] rounded transition flex items-center gap-1 disabled:opacity-50"
                  >
                    {actionLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                    <span>Créer sur GitHub</span>
                  </button>
                </div>
              </form>
            ) : (
              <select
                value={selectedRepo}
                onChange={(e) => setSelectedRepo(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white font-mono text-slate-800 outline-none"
              >
                {repos.length === 0 ? (
                  <option value="">Aucun dépôt trouvé</option>
                ) : (
                  repos.map((r) => (
                    <option key={r.fullName} value={r.fullName}>
                      {r.fullName} {r.private ? "(Privé)" : "(Public)"}
                    </option>
                  ))
                )}
              </select>
            )}
          </div>

          {/* Branch Selector */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-600 uppercase flex items-center gap-1">
              <GitBranch className="h-3 w-3 text-[#c6623f]" />
              Branche
            </label>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white font-mono text-slate-800 outline-none"
            >
              {branches.map((b) => (
                <option key={b.name} value={b.name}>
                  {b.name} {b.isDefault ? "(défaut)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Launch Codespace Button */}
          <div className="pt-1">
            <button
              type="button"
              onClick={handleLaunchCodespace}
              disabled={actionLoading || !selectedRepo}
              className="w-full py-2 px-3 text-xs font-bold text-white bg-[#c6623f] hover:bg-[#b05332] rounded-lg transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
            >
              {actionLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FolderGit2 className="h-3.5 w-3.5" />
              )}
              <span>
                {codespaces.length ? "Ouvrir Codespace" : "Créer Codespace"}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
