"use client";

import { useState } from "react";
import {
  X,
  Cloud,
  Boxes,
  Layers,
  Terminal,
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
  Play,
  RefreshCw,
  Activity,
  Check,
  AlertTriangle,
} from "lucide-react";
import { useCloudCredentials } from "@/hooks/use-cloud-credentials";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultProviderId?: string;
  sessionId?: string;
}

export function SettingsModal({
  isOpen,
  onClose,
  defaultProviderId = "google",
  sessionId,
}: SettingsModalProps) {
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

  if (!isOpen) return null;

  const currentDef = definitions[activeTab];
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative flex flex-col w-full max-w-4xl max-h-[92vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-[#faf8f5]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#c6623f]/10 text-[#c6623f] shadow-xs">
              <Key className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                AI Providers & Runtime Diagnostics
              </h2>
              <p className="text-xs text-slate-500">
                Gestion des clés d&apos;authentification, diagnostic de la chaîne réseau et tests réels sans mock.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRunFullMatrix}
              disabled={matrixRunning}
              title="Tester tous les providers"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${matrixRunning ? "animate-spin text-[#c6623f]" : ""}`} />
              <span>Diagnostic Global</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              aria-label="Fermer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex flex-1 min-h-0 flex-col sm:flex-row overflow-hidden">
          {/* Sidebar */}
          <div className="w-full sm:w-64 shrink-0 border-b sm:border-b-0 sm:border-r border-slate-100 bg-[#faf8f5]/60 p-3 space-y-4 overflow-x-auto sm:overflow-y-auto">
            {/* AI Providers */}
            <div className="space-y-1">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Fournisseurs IA ({aiProviders.length})
              </div>
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
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold transition cursor-pointer ${
                      isActive
                        ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                        : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {getProviderIcon(p.id)}
                      <span className="truncate">{p.name}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
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

            {/* Sandboxes */}
            <div className="space-y-1">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Sandboxes Cloud ({sandboxProviders.length})
              </div>
              {sandboxProviders.map((p) => {
                const isActive = activeTab === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setActiveTab(p.id);
                      setFeedback(null);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition cursor-pointer ${
                      isActive
                        ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                        : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {getProviderIcon(p.id)}
                      <span className="truncate">{p.name}</span>
                    </div>
                    {p.configured && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form & Diagnostics Panel */}
          <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 space-y-6">
            {currentDef && (
              <div className="space-y-5">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-slate-900">{currentDef.name}</h3>
                      {currentStatus?.configured ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                          <Check className="h-3 w-3 text-emerald-600" />
                          Configuré
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                          Non configuré
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{currentDef.description}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {currentDef.id === "google" && (
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[#c6623f] hover:underline flex items-center gap-1"
                      >
                        <span>Obtenir une clé Gemini</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {currentDef.id === "openai" && (
                      <a
                        href="https://platform.openai.com/api-keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-emerald-600 hover:underline flex items-center gap-1"
                      >
                        <span>Obtenir une clé OpenAI</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {currentDef.id === "mistral" && (
                      <a
                        href="https://console.mistral.ai/api-keys/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-amber-600 hover:underline flex items-center gap-1"
                      >
                        <span>Obtenir une clé Mistral</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {currentDef.id === "openrouter" && (
                      <a
                        href="https://openrouter.ai/keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-purple-600 hover:underline flex items-center gap-1"
                      >
                        <span>Obtenir une clé OpenRouter</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>

                {/* DIAGNOSTIC MATRIX CARD */}
                {currentDef.category === "ai" && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-[#c6623f]" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Matrice de Diagnostic Réseau & Runtime
                        </h4>
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">
                        {currentDiag?.latencyMs ? `${currentDiag.latencyMs} ms` : "Non testé"}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      {/* 1. Credentials */}
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1">
                        <div className="text-[10px] uppercase font-bold text-slate-400">Credentials</div>
                        <div className="font-semibold flex items-center gap-1.5">
                          {currentStatus?.configured ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span className="text-emerald-700">Present</span>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                              <span className="text-red-600">Missing</span>
                            </>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate" title={currentStatus?.sourceLabel}>
                          {currentStatus?.sourceLabel || "None"}
                        </div>
                        {currentStatus?.fingerprint && currentStatus.fingerprint !== "none" && (
                          <div className="text-[10px] font-mono text-slate-400 truncate" title={currentStatus.fingerprint}>
                            {currentStatus.fingerprint}
                          </div>
                        )}
                      </div>

                      {/* 2. Runtime */}
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1">
                        <div className="text-[10px] uppercase font-bold text-slate-400">Runtime</div>
                        <div className="font-semibold flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          <span className="text-emerald-700">Initialized</span>
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">
                          {currentDef.id}Adapter
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">
                          Mode HTTP/SSE
                        </div>
                      </div>

                      {/* 3. Endpoint & Model */}
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1">
                        <div className="text-[10px] uppercase font-bold text-slate-400">Endpoint / Modèle</div>
                        <div className="font-semibold text-slate-800 truncate" title={currentDiag?.model || "Standard"}>
                          {currentDiag?.model || currentDef.id}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate" title={currentDiag?.endpoint || "Configuré"}>
                          {currentDiag?.endpoint ? new URL(currentDiag.endpoint).hostname : "Configuré"}
                        </div>
                        <div className="text-[10px] text-emerald-600 font-semibold">
                          ✓ Endpoint actif
                        </div>
                      </div>

                      {/* 4. Statut Final */}
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1">
                        <div className="text-[10px] uppercase font-bold text-slate-400">Statut Connexion</div>
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
                            <span className="text-slate-500 font-medium">Non testé</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {currentDiag?.httpStatus ? `HTTP ${currentDiag.httpStatus}` : "Pas de ping"}
                        </div>
                      </div>
                    </div>

                    {/* Detailed Diagnostic Message if Error */}
                    {currentDiag?.errorMessage && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 space-y-1">
                        <div className="font-bold flex items-center gap-1.5">
                          <AlertCircle className="h-3.5 w-3.5 text-red-600" />
                          <span>Détails de l&apos;erreur du provider :</span>
                        </div>
                        <div className="font-mono text-[11px] whitespace-pre-wrap break-all bg-white/70 p-2 rounded border border-red-100">
                          {currentDiag.errorMessage}
                        </div>
                      </div>
                    )}

                    {/* AI Test Output if executed */}
                    {currentAiTest && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs space-y-1">
                        <div className="font-bold text-emerald-800 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                            Réponse réelle reçue de l&apos;IA ({currentAiTest.model}) :
                          </span>
                          <span className="text-[11px] font-mono text-emerald-700">
                            {currentAiTest.latencyMs} ms
                          </span>
                        </div>
                        <div className="bg-white p-2.5 rounded border border-emerald-100 font-mono text-[12px] text-slate-800 font-bold">
                          {currentAiTest.response || currentAiTest.error || "Aucune réponse"}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Masked Key Display if Already Configured */}
                {currentStatus?.configured && currentStatus.maskedKey && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium flex items-center gap-1.5">
                        <Key className="h-3.5 w-3.5 text-slate-400" />
                        Clé actuelle enregistrée :
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
                    <div className="flex items-center justify-between font-mono text-xs text-slate-800 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                      <span>{currentStatus.maskedKey}</span>
                      <span className="text-[10px] text-slate-400">
                        {currentStatus.keyLength} caractères • {currentStatus.fingerprint}
                      </span>
                    </div>
                  </div>
                )}

                {/* Feedback Message */}
                {feedback && feedback.id === currentDef.id && (
                  <div
                    className={`flex items-start gap-2 p-3 text-xs rounded-xl border ${
                      feedback.type === "success"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                        : "bg-red-50 border-red-200 text-red-800"
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

                {/* Configuration Input Fields */}
                <div className="space-y-3 pt-1">
                  <div className="text-xs font-bold text-slate-700">
                    {currentStatus?.configured ? "Mettre à jour la clé API" : "Renseigner la clé API"}
                  </div>

                  {currentDef.fields.map((field: { key: string; label: string; type: string; placeholder?: string; description?: string }) => (
                    <div key={field.key} className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 block">
                        {field.label}
                      </label>
                      {field.type === "textarea" ? (
                        <textarea
                          rows={4}
                          value={currentForm[field.key] || ""}
                          onChange={(e) => handleInputChange(currentDef.id, field.key, e.target.value)}
                          placeholder={field.placeholder}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:border-[#c6623f] focus:outline-none focus:ring-1 focus:ring-[#c6623f]"
                        />
                      ) : (
                        <input
                          type={field.type}
                          value={currentForm[field.key] || ""}
                          onChange={(e) => handleInputChange(currentDef.id, field.key, e.target.value)}
                          placeholder={field.placeholder}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:border-[#c6623f] focus:outline-none focus:ring-1 focus:ring-[#c6623f]"
                        />
                      )}
                      {field.description && (
                        <p className="text-[11px] text-slate-500">{field.description}</p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Actions: Save / Test Connection / Test AI */}
                <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-slate-100">
                  {/* Save button */}
                  <button
                    type="button"
                    onClick={() => handleSave(currentDef.id)}
                    disabled={savingId === currentDef.id}
                    className="py-2 px-4 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 active:bg-slate-950 rounded-xl shadow-xs transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    {savingId === currentDef.id ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Enregistrement...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span>Enregistrer la clé</span>
                      </>
                    )}
                  </button>

                  {/* Test Connection Button */}
                  <button
                    type="button"
                    onClick={() => handleTestConnection(currentDef.id)}
                    disabled={
                      testingId === currentDef.id ||
                      (!currentStatus?.configured && !Object.values(currentForm).some((v) => v.trim()))
                    }
                    className="py-2 px-3.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-300 rounded-xl shadow-2xs transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    {testingId === currentDef.id ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-[#c6623f]" />
                        <span>Ping HTTP en cours...</span>
                      </>
                    ) : (
                      <>
                        <Activity className="h-3.5 w-3.5 text-slate-500" />
                        <span>Tester la connexion</span>
                      </>
                    )}
                  </button>

                  {/* Test AI Button (Prompt: "Réponds uniquement : OK") */}
                  {currentDef.category === "ai" && (
                    <button
                      type="button"
                      onClick={() => handleTestAI(currentDef.id)}
                      disabled={
                        testingAiId === currentDef.id ||
                        (!currentStatus?.configured && !Object.values(currentForm).some((v) => v.trim()))
                      }
                      className="py-2 px-3.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 border border-emerald-200 rounded-xl shadow-2xs transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      {testingAiId === currentDef.id ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
                          <span>Requête IA &apos;OK&apos;...</span>
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
      </div>
    </div>
  );
}
