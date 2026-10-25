"use client";

import { useState } from "react";
import { useGitHubAuth } from "@/hooks/use-github-auth";
import {
  Github,
  CheckCircle2,
  Plus,
  Loader2,
  LogOut,
  FolderGit2,
  GitBranch,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";

interface GitHubAuthManagerProps {
  sessionId?: string;
  onCodespaceConnected?: (repo: string, branch: string) => void;
}

export function GitHubAuthManager({
  sessionId = "session",
  onCodespaceConnected,
}: GitHubAuthManagerProps) {
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
    connect,
    disconnect,
    createRepo,
    createCodespace,
  } = useGitHubAuth(sessionId);

  const [showNewRepo, setShowNewRepo] = useState(false);
  const [newRepoName, setNewRepoName] = useState("");
  const [newRepoDesc, setNewRepoDesc] = useState("");
  const [newRepoPrivate, setNewRepoPrivate] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const handleCreateRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRepoName.trim()) return;
    setActionLoading(true);
    try {
      const created = await createRepo(newRepoName.trim(), newRepoDesc.trim(), newRepoPrivate);
      if (created) {
        setShowNewRepo(false);
        setNewRepoName("");
        setNewRepoDesc("");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartCodespace = async () => {
    if (!selectedRepo) return;
    setActionLoading(true);
    try {
      const cs = await createCodespace(selectedRepo, selectedBranch);
      if (cs) {
        onCodespaceConnected?.(selectedRepo, selectedBranch);
      }
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-2xs space-y-4 text-slate-800">
      {/* Header & Connection Status */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2 font-bold text-sm">
          <Github className="h-5 w-5 text-slate-900" />
          <span>GitHub Codespaces Auth</span>
        </div>

        {account.connected ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-full">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Connected as @{account.username}
            </span>
            <button
              type="button"
              onClick={() => void disconnect()}
              disabled={loading}
              className="p-1 text-slate-400 hover:text-red-600 transition rounded"
              title="Disconnect GitHub"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <span className="text-xs font-medium text-slate-500 bg-slate-200 px-2.5 py-0.5 rounded-full">
            Not connected
          </span>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-1.5 p-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* When NOT Authenticated */}
      {!account.connected ? (
        <div className="space-y-3 py-1">
          <p className="text-xs text-slate-600 leading-relaxed">
            Connect your GitHub account securely to associate repositories, select session branches, and launch remote Codespaces.
          </p>

          <button
            type="button"
            onClick={() => void connect()}
            disabled={loading}
            className="w-full py-2.5 px-4 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 active:bg-slate-950 rounded-xl shadow-xs transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Github className="h-4 w-4" />
            )}
            <span>Connect GitHub</span>
          </button>

          <div className="flex items-center gap-1 text-[11px] text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <span>Tokens are stored securely server-side and never exposed to the client.</span>
          </div>
        </div>
      ) : (
        /* When Authenticated */
        <div className="space-y-3">
          {/* Repository Selection & Creation */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider">
                Repository
              </label>
              <button
                type="button"
                onClick={() => setShowNewRepo(!showNewRepo)}
                className="text-[11px] text-[var(--primary)] font-semibold flex items-center gap-1 hover:underline cursor-pointer"
              >
                <Plus className="h-3 w-3" />
                <span>{showNewRepo ? "Select existing" : "Create new repo"}</span>
              </button>
            </div>

            {showNewRepo ? (
              <form onSubmit={handleCreateRepo} className="p-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl space-y-2.5">
                <input
                  type="text"
                  placeholder="Repository name (e.g. my-soryos-project)"
                  value={newRepoName}
                  onChange={(e) => setNewRepoName(e.target.value)}
                  required
                  className="w-full px-2.5 py-1.5 text-xs border border-[var(--border)] rounded-lg font-mono text-[var(--foreground)] bg-[var(--input)] outline-none focus:border-[var(--primary)]"
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={newRepoDesc}
                  onChange={(e) => setNewRepoDesc(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-[var(--border)] rounded-lg text-[var(--foreground)] bg-[var(--input)] outline-none focus:border-[var(--primary)]"
                />
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-1.5 text-xs text-[var(--foreground)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newRepoPrivate}
                      onChange={(e) => setNewRepoPrivate(e.target.checked)}
                      className="rounded text-[var(--primary)]"
                    />
                    <span>Private repository</span>
                  </label>
                  <button
                    type="submit"
                    disabled={actionLoading || !newRepoName.trim()}
                    className="px-3 py-1.5 text-xs font-bold text-[var(--primary-foreground)] bg-[var(--primary)] hover:opacity-90 rounded-lg transition flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                  >
                    {actionLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                    <span>Create Repository</span>
                  </button>
                </div>
              </form>
            ) : (
              <select
                value={selectedRepo}
                onChange={(e) => setSelectedRepo(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[var(--border)] rounded-xl bg-[var(--input)] font-mono text-[var(--foreground)] outline-none focus:border-[var(--primary)] shadow-2xs"
              >
                {repos.map((r) => (
                  <option key={r.fullName} value={r.fullName}>
                    {r.fullName} {r.private ? "(Private)" : "(Public)"}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Branch Selection */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider flex items-center gap-1">
              <GitBranch className="h-3.5 w-3.5 text-[var(--primary)]" />
              Session Branch
            </label>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-[var(--border)] rounded-xl bg-[var(--input)] font-mono text-[var(--foreground)] outline-none focus:border-[var(--primary)] shadow-2xs"
            >
              {branches.map((b) => (
                <option key={b.name} value={b.name}>
                  {b.name} {b.isDefault ? "(default)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Codespace Launch Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleStartCodespace}
              disabled={actionLoading || !selectedRepo}
              className="w-full py-2.5 px-4 text-xs font-bold text-[var(--primary-foreground)] bg-[var(--primary)] hover:opacity-90 rounded-xl shadow-xs transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FolderGit2 className="h-4 w-4" />
              )}
              <span>
                {codespaces.length ? "Connect Existing Codespace" : "Create & Launch Codespace"}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
