"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import type { ChatMessage, ToolStep } from "@soryos/schema";
import {
  Terminal,
  FileCode,
  FileDiff,
  FileText,
  Search,
  Globe,
  GitBranch,
  Wrench,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Square,
  ChevronDown,
  ChevronUp,
  Clock,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ToolProgressBarProps {
  loading: boolean;
  status?: string | null;
  messages: ChatMessage[];
  onAbort?: () => void;
}

// Map tool names to human-readable labels, icons, and theme accents
function getToolMeta(name: string = "") {
  const normalized = name.toLowerCase();

  if (normalized.includes("shell") || normalized.includes("command") || normalized.includes("bash") || normalized.includes("exec")) {
    return {
      label: "Commande Shell",
      icon: Terminal,
      color: "text-amber-500 dark:text-amber-400",
      bgBadge: "bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-300",
      barGradient: "from-amber-500 via-orange-500 to-amber-400",
    };
  }
  if (normalized.includes("write") || normalized.includes("create")) {
    return {
      label: "Création de fichier",
      icon: FileCode,
      color: "text-emerald-500 dark:text-emerald-400",
      bgBadge: "bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-300",
      barGradient: "from-emerald-500 via-teal-500 to-emerald-400",
    };
  }
  if (normalized.includes("edit") || normalized.includes("patch") || normalized.includes("modify")) {
    return {
      label: "Édition de code",
      icon: FileDiff,
      color: "text-blue-500 dark:text-blue-400",
      bgBadge: "bg-blue-500/15 border-blue-500/30 text-blue-600 dark:text-blue-300",
      barGradient: "from-blue-500 via-indigo-500 to-cyan-400",
    };
  }
  if (normalized.includes("read") || normalized.includes("view") || normalized.includes("cat")) {
    return {
      label: "Lecture de fichier",
      icon: FileText,
      color: "text-sky-500 dark:text-sky-400",
      bgBadge: "bg-sky-500/15 border-sky-500/30 text-sky-600 dark:text-sky-300",
      barGradient: "from-sky-500 via-blue-500 to-sky-400",
    };
  }
  if (normalized.includes("grep") || normalized.includes("search") || normalized.includes("find")) {
    return {
      label: "Recherche de code",
      icon: Search,
      color: "text-purple-500 dark:text-purple-400",
      bgBadge: "bg-purple-500/15 border-purple-500/30 text-purple-600 dark:text-purple-300",
      barGradient: "from-purple-500 via-fuchsia-500 to-purple-400",
    };
  }
  if (normalized.includes("web") || normalized.includes("browser") || normalized.includes("http")) {
    return {
      label: "Recherche Web",
      icon: Globe,
      color: "text-emerald-500 dark:text-emerald-400",
      bgBadge: "bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-300",
      barGradient: "from-emerald-500 via-cyan-500 to-emerald-400",
    };
  }
  if (normalized.includes("git")) {
    return {
      label: "Opération Git",
      icon: GitBranch,
      color: "text-rose-500 dark:text-rose-400",
      bgBadge: "bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-300",
      barGradient: "from-rose-500 via-orange-500 to-rose-400",
    };
  }

  return {
    label: name || "Outil",
    icon: Wrench,
    color: "text-[var(--primary)]",
    bgBadge: "bg-[var(--primary)]/15 border-[var(--primary)]/30 text-[var(--primary)]",
    barGradient: "from-blue-600 via-indigo-500 to-violet-500",
  };
}

function extractToolSummary(tool?: ToolStep | null): string {
  if (!tool) return "";
  const input = tool.input;
  if (!input) return "";

  if (typeof input === "string") {
    return input;
  }

  // Common tool input fields
  const cmd = input.command || input.CommandLine || input.cmd;
  if (typeof cmd === "string") return cmd;

  const path = input.path || input.filePath || input.TargetFile || input.AbsolutePath || input.file;
  if (typeof path === "string") return path;

  const query = input.query || input.pattern || input.search;
  if (typeof query === "string") return `Recherche: "${query}"`;

  const instruction = input.Instruction || input.instruction;
  if (typeof instruction === "string") return instruction;

  // Try first string property
  for (const key of Object.keys(input)) {
    const val = input[key];
    if (typeof val === "string" && val.length > 0 && val.length < 120) {
      return val;
    }
  }

  return tool.name;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) {
    return `${secs}s`;
  }
  return `${mins}m ${secs < 10 ? "0" : ""}${secs}s`;
}

export function ToolProgressBar({
  loading,
  status,
  messages,
  onAbort,
}: ToolProgressBarProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [lastFinishedTool, setLastFinishedTool] = useState<{
    name: string;
    duration: number;
    isError?: boolean;
  } | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Extract tool steps from the latest assistant message
  const currentTurnTools = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === "assistant" && msg.blocks) {
        const tools = msg.blocks
          .filter((b): b is { type: "tool"; step: ToolStep } => b.type === "tool" && Boolean(b.step))
          .map((b) => b.step);
        if (tools.length > 0) return tools;
      }
    }
    return [];
  }, [messages]);

  // Find currently running tool step
  const runningTool = useMemo(() => {
    return currentTurnTools.find((t) => t.status === "running") || null;
  }, [currentTurnTools]);

  const completedToolsCount = useMemo(() => {
    return currentTurnTools.filter((t) => t.status === "done" || t.status === "success").length;
  }, [currentTurnTools]);

  const totalToolsCount = currentTurnTools.length;

  const activeTool = runningTool || (loading && currentTurnTools[currentTurnTools.length - 1]?.status === "running" ? currentTurnTools[currentTurnTools.length - 1] : null);

  const isExecuting = loading || Boolean(runningTool);

  // Handle timer & duration tracking
  useEffect(() => {
    if (isExecuting) {
      if (!startTimeRef.current) {
        startTimeRef.current = Date.now();
      }

      if (!timerRef.current) {
        timerRef.current = setInterval(() => {
          if (startTimeRef.current) {
            const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
            setElapsedSeconds(elapsed);
          }
        }, 500);
      }
    } else {
      if (startTimeRef.current) {
        const totalDuration = Math.max(1, Math.floor((Date.now() - startTimeRef.current) / 1000));
        if (currentTurnTools.length > 0) {
          const lastTool = currentTurnTools[currentTurnTools.length - 1];
          setLastFinishedTool({
            name: lastTool.name,
            duration: totalDuration,
            isError: lastTool.isError || lastTool.status === "error",
          });

          // Clear completed state badge after 3 seconds
          const dismissTimer = setTimeout(() => {
            setLastFinishedTool(null);
          }, 3500);

          return () => clearTimeout(dismissTimer);
        }
      }

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      startTimeRef.current = null;
      setElapsedSeconds(0);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isExecuting, currentTurnTools]);

  // Calculate dynamic progress percentage
  const progressPercent = useMemo(() => {
    if (!isExecuting) {
      return lastFinishedTool ? 100 : 0;
    }

    if (totalToolsCount > 1) {
      // Multi-step execution progress
      const basePct = (completedToolsCount / totalToolsCount) * 100;
      // Fractional progress for current active step based on time
      const stepWeight = 100 / totalToolsCount;
      const stepProgress = 1 - Math.exp(-elapsedSeconds / 10);
      return Math.min(95, Math.round(basePct + stepProgress * stepWeight * 0.9));
    }

    // Single tool progress asymptotic formula
    // Reaches ~50% in 7s, ~75% in 15s, ~90% in 25s, never 100% until finished
    const asymptotic = 100 * (1 - Math.exp(-elapsedSeconds / 12));
    return Math.min(93, Math.max(8, Math.round(asymptotic)));
  }, [isExecuting, totalToolsCount, completedToolsCount, elapsedSeconds, lastFinishedTool]);

  // Don't render anything if completely idle and no recent finished tool
  if (!isExecuting && !lastFinishedTool) {
    return null;
  }

  const meta = getToolMeta(activeTool?.name || lastFinishedTool?.name || "");
  const Icon = meta.icon;
  const toolSummary = extractToolSummary(activeTool);
  const isLongRunning = elapsedSeconds >= 10;
  const isVeryLongRunning = elapsedSeconds >= 30;

  return (
    <div className="relative z-20 shrink-0 border-b border-[var(--border)] bg-[var(--surface-elevated)]/95 backdrop-blur-md transition-all duration-300 shadow-2xs">
      {/* 1. Ultra-sleek animated progress bar line at the very top edge */}
      <div className="relative h-1 w-full overflow-hidden bg-[var(--surface-hover)]">
        <div
          className={`h-full bg-gradient-to-r ${meta.barGradient} transition-all duration-500 ease-out`}
          style={{ width: `${progressPercent}%` }}
        />
        {/* Shimmer light sweep animation across active bar */}
        {isExecuting && (
          <div
            className="absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-white/40 dark:via-white/20 to-transparent animate-pulse"
            style={{
              left: `${Math.max(0, progressPercent - 15)}%`,
              transition: "left 0.5s ease-out",
            }}
          />
        )}
      </div>

      {/* 2. Main execution control & status banner */}
      <div className="flex flex-col px-3 sm:px-5 py-2">
        <div className="flex items-center justify-between gap-3 min-w-0">
          {/* Left: Spinner, Icon, Tool Name and Command Summary */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {/* Visual Animated Spinner */}
            <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-2xs">
              {isExecuting ? (
                <>
                  {/* Outer spinning pulse ring */}
                  <Loader2 className={`h-4 w-4 animate-spin ${meta.color}`} />
                  {/* Glowing center indicator */}
                  <span
                    className={`absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full ${
                      isVeryLongRunning
                        ? "bg-amber-500 animate-ping"
                        : "bg-blue-500 animate-pulse"
                    }`}
                  />
                </>
              ) : lastFinishedTool?.isError ? (
                <AlertCircle className="h-4 w-4 text-rose-500" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              )}
            </div>

            {/* Tool Identity & Active Task Description */}
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold border ${meta.bgBadge}`}
                >
                  <Icon className="h-3 w-3" />
                  <span>{meta.label}</span>
                </span>

                {totalToolsCount > 1 && isExecuting && (
                  <span className="text-[11px] font-mono font-medium text-[var(--muted-foreground)]">
                    Étape {Math.min(totalToolsCount, completedToolsCount + 1)} / {totalToolsCount}
                  </span>
                )}

                {/* Long-running execution warning badge */}
                {isExecuting && isLongRunning && (
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium animate-pulse ${
                      isVeryLongRunning
                        ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                        : "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/20"
                    }`}
                  >
                    <Clock className="h-2.5 w-2.5" />
                    {isVeryLongRunning ? "Exécution longue (compilation / install)" : "Traitement en cours"}
                  </span>
                )}

                {/* Finished state badge */}
                {!isExecuting && lastFinishedTool && (
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      lastFinishedTool.isError
                        ? "bg-rose-500/20 text-rose-700 dark:text-rose-300"
                        : "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                    }`}
                  >
                    {lastFinishedTool.isError ? "Erreur" : "Terminé avec succès"}
                  </span>
                )}
              </div>

              {/* Target command or status line */}
              <div className="flex items-center gap-2 mt-0.5 min-w-0">
                <span className="truncate text-xs font-mono text-[var(--foreground)] font-medium">
                  {toolSummary || status || (isExecuting ? "Exécution de l'outil en cours..." : "Action terminée")}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Elapsed Timer, Details Toggle, Abort Button */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Live Timer Display */}
            {isExecuting && (
              <div className="flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs font-mono font-medium text-[var(--muted-foreground)]">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>{formatDuration(elapsedSeconds)}</span>
              </div>
            )}

            {!isExecuting && lastFinishedTool && (
              <div className="flex items-center gap-1 text-xs font-mono text-[var(--muted-foreground)]">
                <span>{lastFinishedTool.duration}s</span>
              </div>
            )}

            {/* Toggle Input Details if command or input exists */}
            {toolSummary && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded((prev) => !prev)}
                className="h-7 w-7 p-0 rounded-md text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                title={isExpanded ? "Masquer les détails" : "Afficher les détails de la commande"}
              >
                {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </Button>
            )}

            {/* Abort Button during long running execution */}
            {isExecuting && onAbort && (
              <Button
                variant="outline"
                size="sm"
                onClick={onAbort}
                className="h-7 gap-1 px-2 rounded-md border-red-500/30 bg-red-500/10 text-xs font-semibold text-red-600 hover:bg-red-500/20 cursor-pointer"
                title="Interrompre l'exécution"
              >
                <Square className="h-2.5 w-2.5 fill-current" />
                <span className="hidden sm:inline">Arrêter</span>
              </Button>
            )}
          </div>
        </div>

        {/* 3. Expandable detail drawer for long commands or arguments */}
        {isExpanded && activeTool && (
          <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2.5 text-xs font-mono overflow-hidden">
            <div className="flex items-center justify-between text-[11px] text-[var(--muted-foreground)] pb-1 mb-1 border-b border-[var(--border)]">
              <span>Paramètres de l&apos;outil</span>
              <span>id: {activeTool.id}</span>
            </div>
            <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap break-all text-[11px] text-[var(--foreground)]">
              {typeof activeTool.input === "string"
                ? activeTool.input
                : JSON.stringify(activeTool.input, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
