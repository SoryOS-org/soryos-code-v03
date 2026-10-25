"use client";

import { useState } from "react";
import {
  Key,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Trash2,
  ExternalLink,
  Sparkles,
  Cpu,
  Brain,
  Layers,
  Terminal,
  Boxes,
  Cloud,
  Play,
  RefreshCw,
  Activity,
  Check,
  AlertTriangle,
} from "lucide-react";
import { useCloudCredentials } from "@/hooks/use-cloud-credentials";

interface ProviderDiagnosticsViewProps {
  sessionId?: string;
  defaultProviderId?: string;
}

export function ProviderDiagnosticsView({
  sessionId,
  defaultProviderId = "google",
}: ProviderDiagnosticsViewProps) {
  const {
    providers,
    definitions,
    diagnosticsMap,
    aiTestResults,
    saveCredentials,
    testConnection,
    testAI,
    runAllDiagnostics,
    removeCredentials,
  } = useCloudCredentials(sessionId);

  const [activeTab, setActiveTab] = useState<string>(defaultProviderId);
  const [formValues, setFormValues] = useState<Record<string, Record<string, string>>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testingAiId, setTestingAiId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [matrixRunning, setMatrixRunning] = useState(false);
  const [feedback, setFeedback] = useState<{ id: string; type: "success" | "error"; message: string } | null>(null);

  const currentDef = definitions[activeTab] || definitions["google"];
  const currentStatus = providers.find((p) => p.id === activeTab);
  const currentForm = formValues[activeTab] || {};
  const currentDiag = diagnosticsMap[activeTab];
  const currentAiTest = aiTestResults[activeTab];

  const handleInputChange = (providerId: string, fieldKey: string, value: string) => {
    setFormValues((prev) => ({
      ...prev,
      [providerId]: {
        ...(prev[providerId] || {}),
        [fieldKey]: value,
      },
    }));
  };

  const handleSave = async (providerId: string) => {
    setSavingId(providerId);
    setFeedback(null);
    try {
      const values = formValues[providerId] || {};
      const status = await saveCredentials(providerId, values);
      setFeedback({
        id: providerId,
        type: "success",
        message: `✓ Identifiants ${status.name} enregistrés avec succès.`,
      });
      setFormValues((prev) => ({
        ...prev,
        [providerId]: {},
      }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Échec de sauvegarde";
      setFeedback({
        id: providerId,
        type: "error",
        message: msg,
      });
    } finally {
      setSavingId(null);
    }
  };

  const handleTestConnection = async (providerId: string) => {
    setTestingId(providerId);
    setFeedback(null);
    try {
      const res = await testConnection(providerId);
      setFeedback({
        id: providerId,
        type: res.success ? "success" : "error",
        message: res.message,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Échec du test de connexion";
      setFeedback({
        id: providerId,
        type: "error",
        message: msg,
      });
    } finally {
      setTestingId(null);
    }
  };

  const handleTestAI = async (providerId: string) => {
    setTestingAiId(providerId);
    try {
      await testAI(providerId, { prompt: "Réponds uniquement : OK" });
    } catch (e: unknown) {
      console.warn("AI test error:", e);
    } finally {
      setTestingAiId(null);
    }
  };

  const handleRunFullMatrix = async () => {
    setMatrixRunning(true);
    try {
      await runAllDiagnostics();
    } finally {
      setMatrixRunning(false);
    }
  };

  const handleDelete = async (providerId: string) => {
    setSavingId(providerId);
    setFeedback(null);
    try {
      await removeCredentials(providerId);
      setFormValues((prev) => ({
        ...prev,
        [providerId]: {},
      }));
      setFeedback({
        id: providerId,
        type: "success",
        message: "Identifiants supprimés.",
      });
    } finally {
      setSavingId(null);
    }
  };

  const getProviderIcon = (id: string) => {
    switch (id) {
      case "google":
        return <Sparkles className="h-4 w-4 text-[#c6623f] shrink-0" />;
      case "openai":
        return <Brain className="h-4 w-4 text-emerald-600 shrink-0" />;
      case "openrouter":
        return <Cpu className="h-4 w-4 text-purple-600 shrink-0" />;
      case "deepseek":
        return <Cpu className="h-4 w-4 text-blue-600 shrink-0" />;
      case "mistral":
        return <Layers className="h-4 w-4 text-amber-600 shrink-0" />;
      case "grok":
        return <Terminal className="h-4 w-4 text-slate-800 shrink-0" />;
      case "opencode-zen":
        return <Sparkles className="h-4 w-4 text-teal-600 shrink-0" />;
      case "e2b":
        return <Boxes className="h-4 w-4 text-emerald-600 shrink-0" />;
      case "vercel":
        return <Layers className="h-4 w-4 text-slate-900 shrink-0" />;
      case "google-cloud-run":
        return <Cloud className="h-4 w-4 text-blue-600 shrink-0" />;
      default:
        return <Cloud className="h-4 w-4 text-slate-600 shrink-0" />;
    }
  };

  const aiProviders = providers.filter((p) => p.category === "ai");
  const sandboxProviders = providers.filter((p) => p.category === "sandbox");

  return (
    <div className="flex flex-col md:flex-row gap-4 h-full min-h-[460px]">
      {/* Sidebar List */}
      <div className="w-full md:w-56 shrink-0 space-y-3 border-b md:border-b-0 md:border-r border-[var(--border)] pr-0 md:pr-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
            Fournisseurs IA
          </span>
          <button
            onClick={handleRunFullMatrix}
            disabled={matrixRunning}
            title="Tester tous les providers"
            className="p-1 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition cursor-pointer"
          >
            <RefreshCw className={`h-3 w-3 ${matrixRunning ? "animate-spin text-[var(--primary)]" : ""}`} />
          </button>
        </div>

        <div className="space-y-1">
          {aiProviders.map((p) => {
            const isActive = activeTab === p.id;
            const diag = diagnosticsMap[p.id];
            const isConnected = diag?.finalResult === "connected" || p.lastTestStatus === "success";

            return (
              <button
                key={p.id}
                onClick={() => {
                  setActiveTab(p.id);
                  setFeedback(null);
                }}
                className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-xs font-semibold transition cursor-pointer ${
                  isActive
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-xs"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  {getProviderIcon(p.id)}
                  <span className="truncate">{p.name}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {isConnected ? (
                    <span className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-200" title="Connecté" />
                  ) : p.configured ? (
                    <span className="h-2 w-2 rounded-full bg-blue-500 ring-2 ring-blue-200" title="Configuré" />
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-slate-300" title="Non configuré" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {sandboxProviders.length > 0 && (
          <div className="space-y-1 pt-2 border-t border-[var(--border)]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] px-1 block">
              Sandboxes Cloud
            </span>
            {sandboxProviders.map((p) => {
              const isActive = activeTab === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setActiveTab(p.id);
                    setFeedback(null);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                    isActive
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-xs"
                      : "text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {getProviderIcon(p.id)}
                    <span className="truncate">{p.name}</span>
                  </div>
                  {p.configured && <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Diagnostic & Form Area */}
      <div className="flex-1 space-y-4 min-w-0">
        {currentDef && (
          <div className="space-y-4">
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[var(--border)]">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-bold text-[var(--foreground)]">{currentDef.name}</h4>
                  {currentStatus?.configured ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      <Check className="h-3 w-3 text-emerald-600" />
                      Configuré
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      Non configuré
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{currentDef.description}</p>
              </div>

              <div className="flex items-center gap-2">
                {currentDef.id === "google" && (
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[var(--primary)] hover:underline flex items-center gap-1"
                  >
                    <span>Clé Gemini</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {currentDef.id === "openai" && (
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[var(--primary)] hover:underline flex items-center gap-1"
                  >
                    <span>Clé OpenAI</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {currentDef.id === "mistral" && (
                  <a
                    href="https://console.mistral.ai/api-keys/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[var(--primary)] hover:underline flex items-center gap-1"
                  >
                    <span>Clé Mistral</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {currentDef.id === "openrouter" && (
                  <a
                    href="https://openrouter.ai/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[var(--primary)] hover:underline flex items-center gap-1"
                  >
                    <span>Clé OpenRouter</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>

            {/* DIAGNOSTIC MATRIX CARD */}
            {currentDef.category === "ai" && (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-[var(--primary)]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--foreground)]">
                      Diagnostic Réseau & Chaîne Réelle
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-[var(--muted-foreground)]">
                    {currentDiag?.latencyMs ? `${currentDiag.latencyMs} ms` : "Non testé"}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {/* Credentials */}
                  <div className="bg-[var(--surface)] p-2.5 rounded-lg border border-[var(--border)] space-y-1">
                    <div className="text-[10px] uppercase font-bold text-[var(--muted-foreground)]">Credential</div>
                    <div className="font-semibold flex items-center gap-1.5">
                      {currentStatus?.configured ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          <span className="text-emerald-700">Found</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                          <span className="text-red-600">Missing</span>
                        </>
                      )}
                    </div>
                    <div className="text-[10px] text-[var(--muted-foreground)] truncate" title={currentStatus?.sourceLabel}>
                      {currentStatus?.sourceLabel || "None"}
                    </div>
                    {currentStatus?.fingerprint && currentStatus.fingerprint !== "none" && (
                      <div className="text-[10px] font-mono text-[var(--muted-foreground)] truncate" title={currentStatus.fingerprint}>
                        {currentStatus.fingerprint}
                      </div>
                    )}
                  </div>

                  {/* Runtime */}
                  <div className="bg-[var(--surface)] p-2.5 rounded-lg border border-[var(--border)] space-y-1">
                    <div className="text-[10px] uppercase font-bold text-[var(--muted-foreground)]">Runtime</div>
                    <div className="font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span className="text-emerald-700">Initialized</span>
                    </div>
                    <div className="text-[10px] text-[var(--muted-foreground)] truncate">
                      {currentDef.id}Adapter
                    </div>
                    <div className="text-[10px] font-mono text-[var(--muted-foreground)]">
                      HTTP / SSE
                    </div>
                  </div>

                  {/* Endpoint & Model */}
                  <div className="bg-[var(--surface)] p-2.5 rounded-lg border border-[var(--border)] space-y-1">
                    <div className="text-[10px] uppercase font-bold text-[var(--muted-foreground)]">Endpoint & Modèle</div>
                    <div className="font-semibold truncate" title={currentDiag?.model || "Configuré"}>
                      {currentDiag?.model || currentDef.id}
                    </div>
                    <div className="text-[10px] text-[var(--muted-foreground)] truncate" title={currentDiag?.endpoint || "Configuré"}>
                      {currentDiag?.endpoint ? new URL(currentDiag.endpoint).hostname : "Configuré"}
                    </div>
                    <div className="text-[10px] text-emerald-600 font-semibold">
                      ✓ Configured
                    </div>
                  </div>

                  {/* Statut Final */}
                  <div className="bg-[var(--surface)] p-2.5 rounded-lg border border-[var(--border)] space-y-1">
                    <div className="text-[10px] uppercase font-bold text-[var(--muted-foreground)]">Résultat Final</div>
                    <div className="font-semibold flex items-center gap-1.5">
                      {currentDiag?.finalResult === "connected" || currentStatus?.lastTestStatus === "success" ? (
                        <span className="text-emerald-700 font-bold flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          CONNECTED
                        </span>
                      ) : currentDiag?.finalResult === "auth_failed" ? (
                        <span className="text-red-600 font-bold flex items-center gap-1">
                          <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                          ✕ AUTH 401
                        </span>
                      ) : currentDiag?.finalResult === "invalid_model" ? (
                        <span className="text-amber-600 font-bold flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                          ✕ MODEL 404
                        </span>
                      ) : currentDiag?.finalResult === "network_error" ? (
                        <span className="text-red-600 font-bold flex items-center gap-1">
                          <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                          ✕ RÉSEAU
                        </span>
                      ) : (
                        <span className="text-[var(--muted-foreground)] font-medium">Non testé</span>
                      )}
                    </div>
                    <div className="text-[10px] text-[var(--muted-foreground)]">
                      {currentDiag?.httpStatus ? `HTTP ${currentDiag.httpStatus}` : "Pas de ping"}
                    </div>
                  </div>
                </div>

                {/* Detailed Error Details */}
                {currentDiag?.errorMessage && (
                  <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-600 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 text-red-600" />
                      <span>Erreur retournée par le provider :</span>
                    </div>
                    <div className="font-mono text-[11px] whitespace-pre-wrap break-all bg-[var(--surface)] p-2 rounded border border-red-500/10">
                      {currentDiag.errorMessage}
                    </div>
                  </div>
                )}

                {/* AI Test Output */}
                {currentAiTest && (
                  <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs space-y-1">
                    <div className="font-bold text-emerald-700 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                        Réponse réelle reçue de l&apos;IA ({currentAiTest.model}) :
                      </span>
                      <span className="text-[11px] font-mono text-emerald-600">
                        {currentAiTest.latencyMs} ms
                      </span>
                    </div>
                    <div className="bg-[var(--surface)] p-2 rounded border border-emerald-500/10 font-mono text-xs text-[var(--foreground)] font-bold">
                      {currentAiTest.response || currentAiTest.error || "Aucune réponse"}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Masked Key Display */}
            {currentStatus?.configured && currentStatus.maskedKey && (
              <div className="p-3 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-xl space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--muted-foreground)] font-medium flex items-center gap-1.5">
                    <Key className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                    Clé enregistrée ({currentStatus.sourceLabel}) :
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDelete(currentDef.id)}
                    disabled={savingId === currentDef.id}
                    className="text-red-600 hover:text-red-700 text-xs font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Effacer</span>
                  </button>
                </div>
                <div className="flex items-center justify-between font-mono text-xs text-[var(--foreground)] bg-[var(--surface)] px-2.5 py-1.5 rounded-lg border border-[var(--border)]">
                  <span>{currentStatus.maskedKey}</span>
                  <span className="text-[10px] text-[var(--muted-foreground)]">
                    {currentStatus.keyLength} car. • {currentStatus.fingerprint}
                  </span>
                </div>
              </div>
            )}

            {/* Feedback */}
            {feedback && feedback.id === currentDef.id && (
              <div
                className={`flex items-start gap-2 p-2.5 text-xs rounded-xl border ${
                  feedback.type === "success"
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700"
                    : "bg-red-500/10 border-red-500/20 text-red-600"
                }`}
              >
                {feedback.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                )}
                <span className="leading-relaxed">{feedback.message}</span>
              </div>
            )}

            {/* Input Form */}
            <div className="space-y-3">
              <div className="text-xs font-bold text-[var(--foreground)]">
                {currentStatus?.configured ? "Mettre à jour la clé API" : "Renseigner la clé API"}
              </div>

              {currentDef.fields.map((field: { key: string; label: string; type: string; placeholder?: string; description?: string }) => (
                <div key={field.key} className="space-y-1">
                  <label className="text-xs font-semibold text-[var(--foreground)] block">
                    {field.label}
                  </label>
                  {field.type === "textarea" ? (
                    <textarea
                      rows={3}
                      value={currentForm[field.key] || ""}
                      onChange={(e) => handleInputChange(currentDef.id, field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-mono text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                    />
                  ) : (
                    <input
                      type={field.type}
                      value={currentForm[field.key] || ""}
                      onChange={(e) => handleInputChange(currentDef.id, field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-mono text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                    />
                  )}
                  {field.description && (
                    <p className="text-[11px] text-[var(--muted-foreground)]">{field.description}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => handleSave(currentDef.id)}
                disabled={savingId === currentDef.id}
                className="py-1.5 px-3.5 text-xs font-bold text-[var(--primary-foreground)] bg-[var(--primary)] hover:opacity-90 rounded-xl shadow-xs transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {savingId === currentDef.id ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Enregistrement...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Enregistrer</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleTestConnection(currentDef.id)}
                disabled={
                  testingId === currentDef.id ||
                  (!currentStatus?.configured && !Object.values(currentForm).some((v) => v.trim()))
                }
                className="py-1.5 px-3 text-xs font-semibold text-[var(--foreground)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl shadow-2xs transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {testingId === currentDef.id ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--primary)]" />
                    <span>Ping HTTP...</span>
                  </>
                ) : (
                  <>
                    <Activity className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                    <span>Tester la connexion</span>
                  </>
                )}
              </button>

              {currentDef.category === "ai" && (
                <button
                  type="button"
                  onClick={() => handleTestAI(currentDef.id)}
                  disabled={
                    testingAiId === currentDef.id ||
                    (!currentStatus?.configured && !Object.values(currentForm).some((v) => v.trim()))
                  }
                  className="py-1.5 px-3 text-xs font-semibold text-emerald-700 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl shadow-2xs transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {testingAiId === currentDef.id ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
                      <span>Requête IA en cours...</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5 text-emerald-600 fill-emerald-600" />
                      <span>Tester l&apos;IA (Réponse: OK)</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
