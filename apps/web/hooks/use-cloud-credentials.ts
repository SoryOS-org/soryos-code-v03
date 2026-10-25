"use client";

import { useState, useEffect, useCallback } from "react";
import type { ProviderStatus, ProviderDefinition } from "@soryos/credentials";
import type {
  ProviderConnectionTestResult,
  ProviderAITestResult,
  ProviderDiagnosticsResult,
} from "@/lib/ai/types";

export function useCloudCredentials(sessionId?: string) {
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [definitions, setDefinitions] = useState<Record<string, ProviderDefinition>>({});
  const [diagnosticsMap, setDiagnosticsMap] = useState<Record<string, ProviderDiagnosticsResult>>({});
  const [aiTestResults, setAiTestResults] = useState<Record<string, ProviderAITestResult>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    try {
      const url = sessionId
        ? `/api/credentials?sessionId=${encodeURIComponent(sessionId)}`
        : "/api/credentials";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Impossible de charger les identifiants cloud");
      const data = await res.json();
      if (data.providers) setProviders(data.providers);
      if (data.definitions) setDefinitions(data.definitions);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur chargement credentials";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      try {
        const url = sessionId
          ? `/api/credentials?sessionId=${encodeURIComponent(sessionId)}`
          : "/api/credentials";
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        if (!isMounted) return;
        if (data.providers) setProviders(data.providers);
        if (data.definitions) setDefinitions(data.definitions);
      } catch {
        // ignore initial fetch error
      }
    };
    void init();
    return () => {
      isMounted = false;
    };
  }, [sessionId]);

  const saveCredentials = async (
    providerId: string,
    fields: Record<string, string>,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", providerId, fields, sessionId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Erreur d'enregistrement");
      }
      if (data.status) {
        setProviders((prev) =>
          prev.map((p) => (p.id === providerId ? data.status : p)),
        );
      }
      return data.status as ProviderStatus;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur d'enregistrement";
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async (providerId: string, modelId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", providerId, sessionId, modelId }),
      });
      const data = (await res.json()) as ProviderConnectionTestResult & {
        status?: ProviderStatus;
      };

      if (data.status) {
        setProviders((prev) =>
          prev.map((p) => (p.id === providerId ? data.status! : p)),
        );
      }
      if (data.diagnostics) {
        setDiagnosticsMap((prev) => ({
          ...prev,
          [providerId]: data.diagnostics,
        }));
      }

      return data;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur lors du test de connexion";
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const testAI = async (
    providerId: string,
    options?: { modelId?: string; prompt?: string },
  ) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test_ai",
          providerId,
          sessionId,
          modelId: options?.modelId,
          prompt: options?.prompt || "Réponds uniquement : OK",
        }),
      });
      const data = (await res.json()) as ProviderAITestResult & {
        status?: ProviderStatus;
      };

      if (data.status) {
        setProviders((prev) =>
          prev.map((p) => (p.id === providerId ? data.status! : p)),
        );
      }
      if (data.diagnostics) {
        setDiagnosticsMap((prev) => ({
          ...prev,
          [providerId]: data.diagnostics,
        }));
      }

      setAiTestResults((prev) => ({
        ...prev,
        [providerId]: data,
      }));

      return data;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur lors du test IA";
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const runAllDiagnostics = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "diagnostics", sessionId }),
      });
      const data = await res.json();
      if (data.matrix) {
        const diagMap: Record<string, ProviderDiagnosticsResult> = {};
        for (const [pId, item] of Object.entries(
          data.matrix as Record<string, ProviderConnectionTestResult>,
        )) {
          if (item.diagnostics) {
            diagMap[pId] = item.diagnostics;
          }
        }
        setDiagnosticsMap(diagMap);
      }
      if (data.providers) {
        setProviders(data.providers);
      }
    } catch (e: unknown) {
      console.warn("Diagnostics error:", e);
    } finally {
      setLoading(false);
    }
  };

  const removeCredentials = async (providerId: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", providerId, sessionId }),
      });
      const data = await res.json();
      if (data.status) {
        setProviders((prev) =>
          prev.map((p) => (p.id === providerId ? data.status : p)),
        );
      }
      setDiagnosticsMap((prev) => {
        const next = { ...prev };
        delete next[providerId];
        return next;
      });
      setAiTestResults((prev) => {
        const next = { ...prev };
        delete next[providerId];
        return next;
      });
      return data.status as ProviderStatus;
    } finally {
      setLoading(false);
    }
  };

  return {
    providers,
    definitions,
    diagnosticsMap,
    aiTestResults,
    loading,
    error,
    refresh: fetchProviders,
    saveCredentials,
    testConnection,
    testAI,
    runAllDiagnostics,
    removeCredentials,
  };
}
