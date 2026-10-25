"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { use } from "react";
import {
  abortSession,
  getSession,
  listSessionFiles,
  sendMessage,
  streamRun,
} from "@/lib/api";
import {
  appendAssistantText,
  appendAssistantTool,
  updateAssistantTool,
} from "@/lib/chat-blocks";
import type { ChatMessage, SoryOSEvent } from "@soryos/schema";
import type { GetSessionResponse } from "@/lib/types";
import { ChatPanel } from "@/components/chat-panel";
import { PreviewPanel } from "@/components/preview-panel";
import { LiveVoiceModal } from "@/components/live-voice-modal";
import { ImportRepoModal } from "@/components/import-repo-modal";
import { AppSidebar } from "@/components/app-sidebar";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { DEFAULT_MODEL_ID } from "@/lib/providers";
import { MessageSquare, Code2, Menu, Loader2, Check, AlertCircle, Cloud } from "lucide-react";

function formatMessages(
  messages: GetSessionResponse["messages"],
): ChatMessage[] {
  return messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    blocks: m.blocks,
  }));
}

function normalizeFilePath(path: string): string {
  return path
    .replace(/^\/home\/user\//, "")
    .replace(/^home\/user\//, "")
    .replace(/^\.\//, "");
}

function isProjectFile(path: string): boolean {
  const parts = normalizeFilePath(path).split("/").filter(Boolean);
  return parts.length > 0 && !parts.some((p) => p.startsWith("."));
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

import { EnvironmentType, ProviderId } from "@/components/sandbox-selector";

export default function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: sessionId } = use(params);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [filePaths, setFilePaths] = useState<string[]>([]);
  const [sessionTitle, setSessionTitle] = useState<string>("Session");
  const [currentModel, setCurrentModel] = useState<string>(DEFAULT_MODEL_ID);
  const [currentAgent, setCurrentAgent] = useState<string>("build");
  const [currentEnvironment, setCurrentEnvironment] = useState<EnvironmentType>("local");
  const [currentProvider, setCurrentProvider] = useState<ProviderId>("local");
  const [workspaceState, setWorkspaceState] = useState<
    "NO_WORKSPACE" | "WORKSPACE_LOADING" | "WORKSPACE_READY" | "WORKSPACE_ERROR"
  >("WORKSPACE_READY");
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [workspaceDetails, setWorkspaceDetails] = useState<{
    repository?: string;
    branch?: string;
    codespaceId?: string;
  }>({});
  const [isLiveOpen, setIsLiveOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<"chat" | "preview">("chat");

  const genRef = useRef(0);
  const textBufferRef = useRef("");
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshFiles = useCallback(async () => {
    const paths = (await listSessionFiles(sessionId)).filter(isProjectFile);
    if (paths.length) {
      setFilePaths(paths.map(normalizeFilePath));
    }
  }, [sessionId]);

  const initWorkspace = useCallback(async (overrides?: {
    codespaceId?: string;
    repository?: string;
    branch?: string;
    providerId?: ProviderId;
  }) => {
    setWorkspaceState("WORKSPACE_LOADING");
    setWorkspaceError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/init-workspace`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(overrides || {}),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Impossible d'initialiser le Workspace");
      }
      setWorkspaceState("WORKSPACE_READY");
      if (Array.isArray(data.paths)) {
        setFilePaths(data.paths.filter(isProjectFile).map(normalizeFilePath));
      }
    } catch (err: unknown) {
      setWorkspaceState("WORKSPACE_ERROR");
      setWorkspaceError((err as Error)?.message || "Erreur de connexion au Workspace");
    }
  }, [sessionId]);

  const flushText = useCallback((gen: number) => {
    const delta = textBufferRef.current;
    if (!delta) return;
    textBufferRef.current = "";

    setMessages((prev) => {
      if (gen !== genRef.current) return prev;
      return appendAssistantText(prev, delta);
    });
  }, []);

  const scheduleFlush = useCallback(
    (gen: number) => {
      if (flushTimerRef.current) return;
      flushTimerRef.current = setTimeout(() => {
        flushTimerRef.current = null;
        flushText(gen);
      }, 30);
    },
    [flushText],
  );

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const data = await getSession(sessionId);
        if (!mounted) return;
        setMessages(formatMessages(data.messages));
        setPreviewUrl(data.preview_url);
        setSessionTitle(data.title || "Session");
        if (data.environment) {
          setCurrentEnvironment(data.environment as EnvironmentType);
        }
        if (data.providerId) {
          setCurrentProvider(data.providerId as ProviderId);
        }
        const details = {
          repository: data.repository,
          branch: data.branch,
          codespaceId: data.codespaceId,
        };
        setWorkspaceDetails(details);

        const paths = (await listSessionFiles(sessionId)).filter(isProjectFile);

        // Auto-initialize remote workspace if files are empty
        const isRemote =
          (data.providerId === "github-codespaces" || data.providerId === "github-repository") &&
          Boolean(data.repository || data.codespaceId);

        if (isRemote && paths.length === 0) {
          void initWorkspace({
            ...details,
            providerId: data.providerId as ProviderId,
          });
        } else {
          setWorkspaceState((data.workspaceState as "NO_WORKSPACE" | "WORKSPACE_LOADING" | "WORKSPACE_READY" | "WORKSPACE_ERROR") || "WORKSPACE_READY");
          if (paths.length) {
            setFilePaths(paths.map(normalizeFilePath));
          }
        }
      } catch (e) {
        console.error("Failed to load session:", e);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [sessionId, initWorkspace]);

  const handleEnvironmentAndProviderChange = async (
    newEnv: EnvironmentType,
    newProviderId: ProviderId
  ) => {
    setCurrentEnvironment(newEnv);
    setCurrentProvider(newProviderId);
    try {
      await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ environment: newEnv, providerId: newProviderId }),
      });
    } catch (e) {
      console.error("Failed to switch environment/provider:", e);
    }
  };

  // Called when a GitHub Codespace is created/selected: persist repo binding
  // on the session AND initialize the remote workspace for real.
  const handleWorkspaceReady = async (info: {
    repository: string;
    branch: string;
    codespaceId?: string;
  }) => {
    setCurrentEnvironment("sandbox");
    setCurrentProvider("github-codespaces");
    setWorkspaceDetails(info);
    try {
      await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environment: "sandbox",
          providerId: "github-codespaces",
          repository: info.repository,
          branch: info.branch,
          codespaceId: info.codespaceId,
        }),
      });
    } catch (e) {
      console.error("Failed to persist codespace binding:", e);
    }
    await initWorkspace({ ...info, providerId: "github-codespaces" });
  };

  const runStream = useCallback(
    async (messageContent?: string) => {
      const gen = ++genRef.current;
      setLoading(true);
      setStatus("Starting agent...");

      // Le flux est CANONIQUE (SoryOSEvent) — le même vocabulaire que le CLI.
      const handleEvent = (ev: SoryOSEvent) => {
        if (gen !== genRef.current) return;

        if (ev.type === "status") {
          const cleanStatus = (ev.message || "").replace(/\s+/g, " ").trim();
          if (cleanStatus) {
            setStatus(cleanStatus);
          }
        } else if (ev.type === "text" && ev.delta) {
          textBufferRef.current += ev.delta;
          scheduleFlush(gen);
        } else if (ev.type === "tool_use") {
          flushText(gen);
          setMessages((prev) =>
            appendAssistantTool(prev, {
              id: ev.id,
              name: ev.name,
              input: ev.input,
              status: "running",
              startedAt: new Date().toISOString(),
            }),
          );
        } else if (ev.type === "tool_end") {
          flushText(gen);
          setMessages((prev) =>
            updateAssistantTool(prev, ev.id, {
              output: ev.output,
              isError: Boolean(ev.isError),
              status: ev.isError ? "error" : "done",
              completedAt: new Date().toISOString(),
            }),
          );
          void refreshFiles();
        } else if (ev.type === "error") {
          const message = ev.message || "Erreur inconnue";
          textBufferRef.current += `\n\n⚠️ ${message}`;
          scheduleFlush(gen);
          setStatus(message);
        } else if (ev.type === "preview" && ev.url) {
          setPreviewUrl(ev.url);
        } else if (ev.type === "file_changed") {
          void refreshFiles();
        }
      };

      try {
        if (messageContent) {
          const userMsg: ChatMessage = {
            id: `user-${Date.now()}`,
            role: "user",
            content: messageContent,
          };
          setMessages((prev) => [...prev, userMsg]);
          await sendMessage(sessionId, messageContent, handleEvent, currentModel, currentAgent);
        } else {
          await streamRun(sessionId, handleEvent);
        }
      } catch (e) {
        console.error("Stream failed:", e);
        if (gen === genRef.current) {
          setStatus("Connection lost. Polling for updates...");
          for (let i = 0; i < 30; i++) {
            await sleep(2000);
            if (gen !== genRef.current) break;
            try {
              const s = await getSession(sessionId);
              setMessages(formatMessages(s.messages));
              setPreviewUrl(s.preview_url);
              setSessionTitle(s.title || "Session");
              await refreshFiles();
            } catch {
              // ignore retry error
            }
          }
        }
      } finally {
        if (gen === genRef.current) {
          flushText(gen);
          setLoading(false);
          setStatus(null);
          await refreshFiles();
          try {
            const finalSession = await getSession(sessionId);
            setMessages(formatMessages(finalSession.messages));
            setPreviewUrl(finalSession.preview_url);
            setSessionTitle(finalSession.title || "Session");
          } catch {
            // ignore
          }
        }
      }
    },
    [sessionId, currentModel, currentAgent, refreshFiles, scheduleFlush, flushText],
  );

  const handleSendMessage = (content: string) => {
    void runStream(content);
  };

  const handleAbort = () => {
    void abortSession(sessionId);
    genRef.current++;
    setLoading(false);
    setStatus(null);
  };

  return (
    <div className="flex h-screen h-[100dvh] w-full overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      {/* App Sidebar with Mobile Drawer support */}
      <AppSidebar
        currentSessionId={sessionId}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Workspace Loading Overlay */}
        {workspaceState === "WORKSPACE_LOADING" && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[var(--background)]/95 backdrop-blur-sm p-6 text-center space-y-4 animate-in fade-in">
            <Loader2 className="h-10 w-10 text-[var(--primary)] animate-spin" />
            <div className="space-y-1.5 max-w-md">
              <h2 className="text-base font-bold text-[var(--foreground)]">
                Connexion au GitHub Codespace & Initialisation...
              </h2>
              {workspaceDetails.repository && (
                <p className="text-xs font-mono text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 inline-block">
                  {workspaceDetails.repository} {workspaceDetails.branch ? `(${workspaceDetails.branch})` : ""}
                </p>
              )}
              {workspaceDetails.codespaceId && (
                <p className="text-[11px] text-[var(--muted-foreground)] font-mono">
                  Machine: {workspaceDetails.codespaceId}
                </p>
              )}
              <div className="space-y-2 text-xs text-[var(--muted-foreground)] pt-3 text-left bg-[var(--surface-elevated)] p-3.5 rounded-xl border border-[var(--border)] shadow-sm">
                <div className="flex items-center gap-2 text-emerald-600 font-medium">
                  <Check className="h-3.5 w-3.5" />
                  <span>Authentification GitHub vérifiée</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-600 font-medium">
                  <Check className="h-3.5 w-3.5" />
                  <span>Codespace distant identifié</span>
                </div>
                <div className="flex items-center gap-2 text-[var(--foreground)] font-semibold">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--primary)]" />
                  <span>Chargement du Remote Filesystem & de l&apos;arborescence...</span>
                </div>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setWorkspaceState("WORKSPACE_READY")}
                  className="py-1.5 px-3 text-xs font-semibold text-[var(--primary)] hover:bg-[var(--surface-hover)] rounded-lg transition cursor-pointer"
                >
                  Accéder au Chat & Code immédiatement →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Workspace Error Overlay */}
        {workspaceState === "WORKSPACE_ERROR" && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[var(--background)] p-6 text-center space-y-4 animate-in fade-in">
            <div className="rounded-full bg-red-500/10 p-3 text-red-500">
              <AlertCircle className="h-8 w-8" />
            </div>
            <div className="space-y-1 max-w-md">
              <h2 className="text-base font-bold text-[var(--foreground)]">
                Impossible de connecter le Codespace
              </h2>
              <p className="text-xs text-red-600 dark:text-red-400 bg-red-500/10 p-2.5 rounded-lg border border-red-500/20 leading-relaxed">
                {workspaceError || "Échec d'initialisation du Workspace distant."}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void initWorkspace(workspaceDetails)}
                className="py-2 px-4 text-xs font-bold text-[var(--primary-foreground)] bg-[var(--primary)] hover:opacity-90 rounded-lg shadow-sm cursor-pointer"
              >
                Réessayer la connexion
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceState("WORKSPACE_READY")}
                className="py-2 px-3 text-xs text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] rounded-lg cursor-pointer"
              >
                Ignorer et continuer
              </button>
            </div>
          </div>
        )}
        {/* Mobile / Tablet View Switcher Header (< lg) */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-3 lg:hidden">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--foreground)] active:bg-[var(--surface-hover)]"
              aria-label="Ouvrir le menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <span className="max-w-[120px] truncate text-xs font-semibold text-[var(--foreground)]">
              {sessionTitle}
            </span>
          </div>

          {/* Segmented Control: Chat vs Code */}
          <div className="flex items-center rounded-lg bg-[var(--surface-hover)] p-0.5 text-xs font-medium">
            <button
              onClick={() => setMobileTab("chat")}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 transition ${
                mobileTab === "chat"
                  ? "bg-[var(--surface-elevated)] text-[var(--foreground)] shadow-xs font-semibold"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Chat</span>
            </button>
            <button
              onClick={() => setMobileTab("preview")}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 transition ${
                mobileTab === "preview"
                  ? "bg-[var(--surface-elevated)] text-[var(--foreground)] shadow-xs font-semibold"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              <Code2 className="h-3.5 w-3.5" />
              <span>Code</span>
              {filePaths.length > 0 && (
                <span className="rounded-full bg-[var(--primary)] px-1 py-0.2 text-[9px] font-bold text-white">
                  {filePaths.length}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-1.5" />
        </div>

        {/* Desktop Layout (>= lg): Split Resizable Panels */}
        <div className="hidden lg:flex min-h-0 flex-1 overflow-hidden">
          <ResizablePanelGroup direction="horizontal" className="h-full min-h-0">
            <ResizablePanel defaultSize={45} minSize={25} className="min-w-0">
              <ChatPanel
                sessionId={sessionId}
                filePaths={filePaths}
                messages={messages}
                loading={loading}
                status={status}
                sessionTitle={sessionTitle}
                currentModelId={currentModel}
                currentAgentId={currentAgent}
                currentEnvironment={currentEnvironment}
                currentProviderId={currentProvider}
                onModelChange={setCurrentModel}
                onAgentChange={setCurrentAgent}
                onEnvironmentAndProviderChange={handleEnvironmentAndProviderChange}
                onWorkspaceReady={handleWorkspaceReady}
                onSendMessage={handleSendMessage}
                onAbort={handleAbort}
                onOpenLive={() => setIsLiveOpen(true)}
                onOpenImport={() => setIsImportOpen(true)}
              />
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel defaultSize={55} minSize={25} className="min-w-0">
              <PreviewPanel
                sessionId={sessionId}
                previewUrl={previewUrl}
                filePaths={filePaths}
                providerId={currentProvider}
                onPreviewUrl={setPreviewUrl}
                onRefreshFiles={refreshFiles}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

        {/* Mobile / Tablet Layout (< lg): Active Tab Fullscreen */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:hidden">
          {mobileTab === "chat" ? (
            <ChatPanel
              sessionId={sessionId}
              filePaths={filePaths}
              messages={messages}
              loading={loading}
              status={status}
              sessionTitle={sessionTitle}
              currentModelId={currentModel}
              currentAgentId={currentAgent}
              currentEnvironment={currentEnvironment}
              currentProviderId={currentProvider}
              onModelChange={setCurrentModel}
              onAgentChange={setCurrentAgent}
              onEnvironmentAndProviderChange={handleEnvironmentAndProviderChange}
              onWorkspaceReady={handleWorkspaceReady}
              onSendMessage={handleSendMessage}
              onAbort={handleAbort}
              onOpenLive={() => setIsLiveOpen(true)}
              onOpenImport={() => setIsImportOpen(true)}
            />
          ) : (
            <PreviewPanel
              sessionId={sessionId}
              previewUrl={previewUrl}
              filePaths={filePaths}
              providerId={currentProvider}
              onPreviewUrl={setPreviewUrl}
              onRefreshFiles={refreshFiles}
            />
          )}
        </div>
      </div>

      <LiveVoiceModal
        isOpen={isLiveOpen}
        onClose={() => setIsLiveOpen(false)}
        sessionId={sessionId}
        messages={messages}
        loading={loading}
        status={status}
        onSendMessage={handleSendMessage}
        onCodeGenerated={async () => {
          await refreshFiles();
        }}
      />

      <ImportRepoModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        sessionId={sessionId}
        onImportSuccess={() => {
          void refreshFiles();
        }}
      />
    </div>
  );
}
