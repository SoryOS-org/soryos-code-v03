"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@soryos/schema";
import { assistantBlocks } from "@/lib/chat-blocks";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  ArrowUp,
  Square,
  Sparkles,
  User,
  Wrench,
  Search,
  Code2,
  Bug,
  Plus,
  FolderDown,
  Paperclip,
  FolderTree,
  Globe,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { ToolStepCard } from "@/components/tool-step-card";
import { ModelSelector } from "@/components/model-selector";
import { AgentSelector } from "@/components/agent-selector";
import { LiveButton } from "@/components/live-button";
import { ContextFilesModal } from "@/components/context-files-modal";
import { DEFAULT_MODEL_ID } from "@/lib/providers";
import { SandboxSelector, EnvironmentType, ProviderId } from "@/components/sandbox-selector";
import { ToolProgressBar } from "@/components/tool-progress-bar";

interface ChatPanelProps {
  sessionId?: string;
  filePaths?: string[];
  messages: ChatMessage[];
  loading: boolean;
  status?: string | null;
  sessionTitle?: string;
  currentModelId?: string;
  currentAgentId?: string;
  currentEnvironment?: EnvironmentType;
  currentProviderId?: ProviderId;
  onModelChange?: (modelId: string) => void;
  onAgentChange?: (agentId: string) => void;
  onProviderChange?: (providerId: ProviderId) => void;
  onEnvironmentAndProviderChange?: (env: EnvironmentType, providerId: ProviderId) => void;
  onWorkspaceReady?: (info: { repository: string; branch: string; codespaceId?: string }) => void;
  onSendMessage: (content: string) => void;
  onAbort?: () => void;
  onOpenLive?: () => void;
  onOpenImport?: () => void;
}

function AssistantTurn({ message }: { message: ChatMessage }) {
  const blocks = assistantBlocks(message);
  if (!blocks.length) return null;

  return (
    <div className="w-full min-w-0 space-y-2">
      {blocks.map((block, i) =>
        block.type === "text" ? (
          <div
            key={`text-${i}`}
            className="chat-prose prose prose-sm max-w-none text-[15px] leading-relaxed text-[var(--foreground)] dark:prose-invert"
          >
            <MarkdownRenderer content={block.content || ""} />
          </div>
        ) : block.step ? (
          <ToolStepCard key={block.step.id || `step-${i}`} step={block.step} />
        ) : null,
      )}
    </div>
  );
}

const QUICK_PROMPTS = [
  { label: "Ajouter une fonctionnalité", icon: Code2, prompt: "Ajoute un composant interactif avec Tailwind CSS et TypeScript" },
  { label: "Déboguer l'application", icon: Bug, prompt: "Inspecte les fichiers du projet et corrige les erreurs TypeScript" },
  { label: "Recherche Web & Doc", icon: Search, prompt: "Recherche la documentation la plus récente sur React 19 et Vite" },
  { label: "Diagramme d'architecture", icon: Sparkles, prompt: "Génère un diagramme Mermaid montrant l'architecture du projet" },
];

export function ChatPanel({
  sessionId = "session",
  filePaths = [],
  messages,
  loading,
  status,
  sessionTitle = "Session",
  currentModelId = DEFAULT_MODEL_ID,
  currentAgentId = "build",
  currentEnvironment = "local",
  currentProviderId = "local",
  onModelChange,
  onAgentChange,
  onProviderChange,
  onEnvironmentAndProviderChange,
  onWorkspaceReady,
  onSendMessage,
  onAbort,
  onOpenLive,
  onOpenImport,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [isContextModalOpen, setIsContextModalOpen] = useState(false);
  const [attachedFile, setAttachedFile] = useState<{
    name: string;
    size: number;
    previewUrl?: string;
  } | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading, status]);

  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const nextHeight = Math.min(Math.max(el.scrollHeight, 24), 160);
    el.style.height = `${nextHeight}px`;
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [input, adjustTextareaHeight]);

  const handleSubmit = () => {
    if ((!input.trim() && !attachedFile) || loading) return;
    let fullContent = input.trim();
    if (attachedFile) {
      fullContent = `[Fichier joint: ${attachedFile.name}]\n\n${fullContent}`;
      setAttachedFile(null);
    }
    onSendMessage(fullContent);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
    setAttachedFile({
      name: file.name,
      size: file.size,
      previewUrl,
    });
    e.target.value = "";
    textareaRef.current?.focus();
  };

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <div className="app-watermark pointer-events-none absolute inset-0" />

      {/* 1. Chat Header Bar */}
      <header className="relative z-10 hidden lg:flex h-12 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface-elevated)] px-5 shadow-2xs">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" className="shrink-0 transition hover:opacity-80 flex items-center gap-2">
            <span className="font-black text-sm tracking-tight text-[var(--foreground)]">SoryOS-Code</span>
          </Link>
          <div className="h-4 w-px bg-[var(--border)]" />
          <h1 className="truncate text-sm font-semibold text-[var(--foreground)]">
            {sessionTitle ?? "Session"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Sandbox Provider Selector */}
          <SandboxSelector
            sessionId={sessionId}
            currentEnvironment={currentEnvironment}
            currentProviderId={currentProviderId}
            onSelectEnvironmentAndProvider={
              onEnvironmentAndProviderChange ??
              ((env, prov) => onProviderChange?.(prov))
            }
            onWorkspaceReady={onWorkspaceReady}
          />
          {loading && onAbort && (
            <Button
              variant="outline"
              size="sm"
              onClick={onAbort}
              className="h-8 gap-1.5 rounded-lg border-red-500/30 bg-red-500/10 text-xs font-semibold text-red-600 hover:bg-red-500/20 transition cursor-pointer"
            >
              <Square className="h-3 w-3 fill-current" />
              Arrêter
            </Button>
          )}
        </div>
      </header>

      {/* 2. Provider + Model Selector (Prominently in the Top of Chat) */}
      <div className="relative z-10 flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)]/90 px-3 sm:px-6 py-2 backdrop-blur-xs">
        <div className="flex items-center gap-2 min-w-0">
          <ModelSelector
            currentModelId={currentModelId}
            onModelChange={onModelChange ?? (() => {})}
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <AgentSelector
            currentAgentId={currentAgentId}
            onAgentChange={onAgentChange ?? (() => {})}
          />
        </div>
      </div>

      {/* 3. Visual Progress Bar & Spinner for Tool Executions */}
      <ToolProgressBar
        loading={loading}
        status={status}
        messages={messages}
        onAbort={onAbort}
      />

      {/* 4. Messages Scroll Area */}
      <ScrollArea className="relative z-10 min-h-0 flex-1">
        <div className="mx-auto max-w-3xl space-y-6 px-4 sm:px-6 py-6 pb-6">
          {/* Empty state when no messages */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 sm:py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)] mb-3 shadow-2xs">
                <Sparkles className="h-6 w-6" />
              </div>
              <h2 className="text-base font-bold text-[var(--foreground)]">Comment puis-je vous aider aujourd&apos;hui ?</h2>
              <p className="mt-1 max-w-sm text-xs text-[var(--muted-foreground)]">
                Posez une question, créez du code, joignez un fichier ou lancez une session vocale Live.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2 max-w-md">
                {QUICK_PROMPTS.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setInput(item.prompt)}
                      className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] hover:shadow-2xs transition cursor-pointer"
                    >
                      <Icon className="h-3.5 w-3.5 text-[var(--primary)]" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Messages list */}
          {messages.map((message) =>
            message.role === "user" ? (
              <div
                key={message.id}
                className="group flex flex-col items-end gap-1"
              >
                <div className="flex items-center gap-2 text-[11px] font-mono font-medium text-[var(--muted-foreground)] px-1">
                  <span>Vous</span>
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--surface-hover)] text-[var(--foreground)]">
                    <User className="h-3 w-3" />
                  </div>
                </div>
                <div className="rounded-2xl rounded-tr-xs border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-2xs max-w-[90%]">
                  <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words text-[var(--foreground)]">
                    {message.content}
                  </p>
                </div>
              </div>
            ) : (
              <div key={message.id} className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 text-[11px] font-mono font-medium text-[var(--primary)] px-1">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--primary)]/15 text-[var(--primary)]">
                    <Sparkles className="h-3 w-3" />
                  </div>
                  <span>Agent OpenCode</span>
                </div>
                <AssistantTurn message={message} />
              </div>
            ),
          )}

          {/* Loading status pill */}
          {loading && (
            <div className="flex items-center gap-2.5 rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-4 py-2.5 text-xs text-[var(--primary)] font-mono shadow-2xs animate-pulse">
              <Wrench className="h-3.5 w-3.5 animate-spin shrink-0" />
              <span className="font-medium">{status ?? "L'agent réfléchit et exécute les outils..."}</span>
            </div>
          )}
          <div ref={bottomRef} className="h-px shrink-0" aria-hidden />
        </div>
      </ScrollArea>

      {/* 4. Nouveau Composer (ChatGPT-style minimalist card) */}
      <div className="relative z-20 shrink-0 border-t border-[var(--border)] bg-[var(--surface)]/90 px-3 sm:px-4 md:px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md">
        <div className="mx-auto w-full max-w-3xl">
          <div className="relative flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-xs transition-all duration-200 focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[var(--primary)]/15">
            {/* Attachment preview if any */}
            {attachedFile && (
              <div className="flex items-center gap-2 px-3.5 pt-2.5">
                <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs text-[var(--foreground)]">
                  {attachedFile.previewUrl ? (
                    <img
                      src={attachedFile.previewUrl}
                      alt={attachedFile.name}
                      className="h-5 w-5 rounded object-cover"
                    />
                  ) : (
                    <Paperclip className="h-3.5 w-3.5 text-[var(--primary)]" />
                  )}
                  <span className="max-w-[200px] truncate text-[11px] font-medium font-mono">
                    {attachedFile.name}
                  </span>
                  <span className="text-[10px] text-[var(--muted-foreground)]">
                    ({(attachedFile.size / 1024).toFixed(0)} KB)
                  </span>
                  <button
                    type="button"
                    onClick={() => setAttachedFile(null)}
                    className="ml-1 rounded-full p-0.5 text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition cursor-pointer"
                    title="Retirer le fichier"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}

            {/* Auto-growing Textarea */}
            <div className="px-3.5 pt-3 pb-1">
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  adjustTextareaHeight();
                }}
                onKeyDown={handleKeyDown}
                placeholder="Écrivez un message…"
                disabled={loading}
                className="w-full resize-none border-0 bg-transparent p-0 text-[15px] leading-relaxed text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-0 max-h-[160px] overflow-y-auto"
              />
            </div>

            {/* Hidden native file input for [+] menu */}
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
              accept="image/*,.txt,.md,.json,.ts,.tsx,.js,.jsx,.css,.html,.py,.sh"
            />

            {/* Action Bar inside Composer: [ + ] on left, [ LIVE ] [ ↑ ] on right */}
            <div className="flex items-center justify-between px-2.5 pb-2 pt-1">
              {/* Left: [+] Button with Compact Menu */}
              <div className="flex items-center gap-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition-colors cursor-pointer active:scale-95 border border-transparent hover:border-[var(--border)]"
                      aria-label="Ajouter et options"
                      title="Ajouter (Import, image, contexte...)"
                    >
                      <Plus className="h-4.5 w-4.5 stroke-[2]" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    side="top"
                    sideOffset={8}
                    className="w-72 p-1.5 bg-[var(--surface-elevated)] border border-[var(--border)] shadow-xl rounded-xl text-xs z-50 mb-1 text-[var(--foreground)]"
                  >
                    <DropdownMenuLabel className="px-2.5 py-1 text-[11px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider">
                      Ajouter
                    </DropdownMenuLabel>

                    {/* 📎 Importer un projet ou fichier */}
                    {onOpenImport && (
                      <DropdownMenuItem
                        onClick={onOpenImport}
                        className="flex items-center gap-2.5 px-2.5 py-2 cursor-pointer rounded-lg hover:bg-[var(--surface-hover)] text-[var(--foreground)] font-medium"
                      >
                        <FolderDown className="h-4 w-4 text-[var(--primary)] shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-xs">Importer un dépôt / fichier</span>
                          <span className="text-[10px] text-[var(--muted-foreground)] truncate">GitHub Codespace, dépôt Git ou projet</span>
                        </div>
                      </DropdownMenuItem>
                    )}

                    {/* 🖼 Ajouter une image ou fichier */}
                    <DropdownMenuItem
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2.5 px-2.5 py-2 cursor-pointer rounded-lg hover:bg-[var(--surface-hover)] text-[var(--foreground)]"
                    >
                      <Paperclip className="h-4 w-4 text-blue-500 shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-xs">Ajouter une image ou fichier</span>
                        <span className="text-[10px] text-[var(--muted-foreground)] truncate">Joindre une capture, doc ou code</span>
                      </div>
                    </DropdownMenuItem>

                    {/* 📁 Ajouter du contexte */}
                    {filePaths.length > 0 && (
                      <DropdownMenuItem
                        onClick={() => setIsContextModalOpen(true)}
                        className="flex items-center gap-2.5 px-2.5 py-2 cursor-pointer rounded-lg hover:bg-[var(--surface-hover)] text-[var(--foreground)]"
                      >
                        <FolderTree className="h-4 w-4 text-amber-500 shrink-0" />
                        <div className="flex flex-col min-w-0 text-left">
                          <span className="font-semibold text-xs">Ajouter du contexte</span>
                          <span className="text-[10px] text-[var(--muted-foreground)]">{filePaths.length} fichier(s) du projet</span>
                        </div>
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuSeparator className="bg-[var(--border)] my-1" />

                    {/* 🔧 Outils */}
                    <DropdownMenuItem
                      onClick={() => {
                        setInput((prev) => (prev ? `${prev}\n\nInspecte les fichiers du projet et exécute les tests.` : "Inspecte le projet, exécute les tests et corrige les erreurs TypeScript."));
                        textareaRef.current?.focus();
                      }}
                      className="flex items-center gap-2.5 px-2.5 py-2 cursor-pointer rounded-lg hover:bg-[var(--surface-hover)] text-[var(--foreground)]"
                    >
                      <Wrench className="h-4 w-4 text-indigo-500 shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-xs">Outils & Diagnostic</span>
                        <span className="text-[10px] text-[var(--muted-foreground)] truncate">Exécuter des commandes, inspecter</span>
                      </div>
                    </DropdownMenuItem>

                    {/* 🌐 Web */}
                    <DropdownMenuItem
                      onClick={() => {
                        setInput((prev) => (prev ? `${prev} [Recherche Web]` : "Recherche sur le web : "));
                        textareaRef.current?.focus();
                      }}
                      className="flex items-center gap-2.5 px-2.5 py-2 cursor-pointer rounded-lg hover:bg-[var(--surface-hover)] text-[var(--foreground)]"
                    >
                      <Globe className="h-4 w-4 text-emerald-500 shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-xs">Recherche Web</span>
                        <span className="text-[10px] text-[var(--muted-foreground)] truncate">Recherche Google et docs à jour</span>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Right: Live Button + Send Button */}
              <div className="flex items-center gap-2">
                {/* Single Live Button in Composer */}
                {onOpenLive && (
                  <LiveButton onClick={onOpenLive} />
                )}

                {/* Send / Stop Button */}
                {loading && onAbort ? (
                  <button
                    type="button"
                    onClick={onAbort}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--foreground)] text-[var(--background)] hover:opacity-90 transition shadow-xs cursor-pointer active:scale-95"
                    title="Arrêter la réponse"
                  >
                    <Square className="h-3.5 w-3.5 fill-current" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={(!input.trim() && !attachedFile) || loading}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-xs cursor-pointer active:scale-95"
                    title="Envoyer (Entrée)"
                  >
                    <ArrowUp className="h-4 w-4 stroke-[2.5]" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Context Files Selector Modal */}
      <ContextFilesModal
        isOpen={isContextModalOpen}
        onClose={() => setIsContextModalOpen(false)}
        filePaths={filePaths}
        onSelectFile={(path) => {
          setInput((prev) => (prev ? `${prev} @${path}` : `@${path} `));
          textareaRef.current?.focus();
        }}
      />
    </div>
  );
}
