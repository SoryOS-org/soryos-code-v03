"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface GitHubAccountState {
  connected: boolean;
  username?: string;
  name?: string;
  avatarUrl?: string;
  scopes?: string[];
}

export interface GitHubRepoState {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  description: string | null;
  defaultBranch: string;
  htmlUrl: string;
}

export interface GitHubBranchState {
  name: string;
  commitHash: string;
  isDefault: boolean;
}

export interface GitHubCodespaceState {
  id: string;
  name: string;
  displayName?: string;
  state: "Running" | "Stopped" | "Building" | "Failed";
  repositoryName: string;
  branch: string;
  webUrl?: string;
}

export function useGitHubAuth(sessionId: string = "session") {
  const [account, setAccount] = useState<GitHubAccountState>({ connected: false });
  const [repos, setRepos] = useState<GitHubRepoState[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const [branches, setBranches] = useState<GitHubBranchState[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("main");
  const [codespaces, setCodespaces] = useState<GitHubCodespaceState[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Device Code Flow State
  const [deviceFlow, setDeviceFlow] = useState<{
    userCode: string;
    verificationUri: string;
    deviceCode: string;
    expiresIn: number;
    interval: number;
  } | null>(null);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch account status
  const refreshAccount = useCallback(async () => {
    try {
      const res = await fetch(`/api/github?action=account&sessionId=${sessionId}`);
      const data = await res.json();
      setAccount(data);
      return data;
    } catch {
      setError("Impossible de vérifier l'état du compte GitHub");
      return { connected: false };
    }
  }, [sessionId]);

  // Fetch real repos for connected account
  const fetchRepos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/github?action=repos&sessionId=${sessionId}`);
      const data = await res.json();
      if (data.repos) {
        setRepos(data.repos);
        if (data.repos.length > 0 && !selectedRepo) {
          setSelectedRepo(data.repos[0].fullName);
        }
      }
    } catch {
      setError("Impossible de charger les dépôts GitHub");
    } finally {
      setLoading(false);
    }
  }, [sessionId, selectedRepo]);

  // Fetch real branches for repo
  const fetchBranches = useCallback(async (repoFullName: string) => {
    if (!repoFullName) return;
    try {
      const res = await fetch(`/api/github?action=branches&sessionId=${sessionId}&repo=${encodeURIComponent(repoFullName)}`);
      const data = await res.json();
      if (data.branches) {
        setBranches(data.branches);
        if (data.branches.length > 0) {
          setSelectedBranch(data.branches[0].name);
        }
      }
    } catch {
      setError("Impossible de charger les branches");
    }
  }, [sessionId]);

  // Fetch real codespaces
  const fetchCodespaces = useCallback(async (repoFullName?: string) => {
    try {
      const url = repoFullName
        ? `/api/github?action=codespaces&sessionId=${sessionId}&repo=${encodeURIComponent(repoFullName)}`
        : `/api/github?action=codespaces&sessionId=${sessionId}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.codespaces) {
        setCodespaces(data.codespaces);
      }
    } catch {
      setError("Impossible de charger les codespaces");
    }
  }, [sessionId]);

  // Initial load
  useEffect(() => {
    const timer = setTimeout(() => {
      void refreshAccount().then((acc) => {
        if (acc.connected) {
          void fetchRepos();
          void fetchCodespaces();
        }
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [refreshAccount, fetchRepos, fetchCodespaces]);

  // When selected repo changes, update branches & codespaces
  useEffect(() => {
    if (selectedRepo) {
      const timer = setTimeout(() => {
        void fetchBranches(selectedRepo);
        void fetchCodespaces(selectedRepo);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [selectedRepo, fetchBranches, fetchCodespaces]);

  // Connect using user's real GitHub Token (PAT or OAuth token)
  const connectWithToken = async (token: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/github?action=connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, token: token.trim() }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        const errorMsg = data.error || "Token GitHub invalide";
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      if (data.account) {
        setAccount(data.account);
        await fetchRepos();
        await fetchCodespaces();
        return { success: true, account: data.account };
      }

      return { success: false, error: "Réponse inattendue" };
    } catch {
      const errorMsg = "Erreur de connexion au serveur d'authentification";
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  // Start GitHub Device Authorization Flow (like VS Code)
  const startDeviceFlow = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/github?action=device_code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();

      if (!data.hasClientId) {
        return {
          supported: false,
          message: data.message,
        };
      }

      setDeviceFlow({
        userCode: data.user_code,
        verificationUri: data.verification_uri,
        deviceCode: data.device_code,
        expiresIn: data.expires_in,
        interval: data.interval || 5,
      });

      // Start polling
      if (pollingRef.current) clearInterval(pollingRef.current);
      const intervalMs = (data.interval || 5) * 1000;
      pollingRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch(`/api/github?action=poll_device_token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId,
              deviceCode: data.device_code,
            }),
          });
          const pollData = await pollRes.json();
          if (pollData.success && pollData.account) {
            if (pollingRef.current) clearInterval(pollingRef.current);
            setDeviceFlow(null);
            setAccount(pollData.account);
            await fetchRepos();
            await fetchCodespaces();
          }
        } catch {
          // keep polling
        }
      }, intervalMs);

      return { supported: true, ...data };
    } catch {
      setError("Impossible d'initier le Device Flow GitHub");
      return { supported: false };
    } finally {
      setLoading(false);
    }
  };

  const cancelDeviceFlow = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setDeviceFlow(null);
  };

  // Disconnect GitHub account
  const disconnect = async () => {
    setLoading(true);
    try {
      await fetch(`/api/github?action=disconnect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      setAccount({ connected: false });
      setRepos([]);
      setSelectedRepo("");
      setBranches([]);
      setCodespaces([]);
    } catch {
      setError("Échec de la déconnexion GitHub");
    } finally {
      setLoading(false);
    }
  };

  // Create new repository
  const createRepo = async (name: string, description: string, isPrivate: boolean) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/github?action=create_repo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, name, description, private: isPrivate }),
      });
      const data = await res.json();
      if (data.repo) {
        setRepos((prev) => [data.repo, ...prev]);
        setSelectedRepo(data.repo.fullName);
        return data.repo;
      }
    } catch {
      setError("Échec de création du dépôt sur GitHub");
    } finally {
      setLoading(false);
    }
  };

  // Create Codespace
  const createCodespaceFn = async (repoFullName: string, branch: string, machine?: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/github?action=create_codespace`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, repo: repoFullName, branch, machine }),
      });
      const data = await res.json();
      if (data.codespace) {
        setCodespaces((prev) => [data.codespace, ...prev]);
        return data.codespace;
      }
      throw new Error(data.error || "Échec de création du Codespace");
    } catch (e: unknown) {
      setError((e as Error)?.message || "Échec de création du Codespace");
      throw e;
    } finally {
      setLoading(false);
    }
  };

  return {
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
    deviceFlow,
    connect: startDeviceFlow,
    connectWithToken,
    startDeviceFlow,
    cancelDeviceFlow,
    disconnect,
    createRepo,
    createCodespace: createCodespaceFn,
    refreshAccount,
    fetchRepos,
    fetchCodespaces,
  };
}
