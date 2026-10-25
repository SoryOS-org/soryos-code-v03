"use client";

import { useState } from "react";
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  Loader2,
  XCircle,
  FileCode,
  FileText,
  Terminal,
  Server,
  Wrench,
  Search,
  Globe,
  Ban,
  FileDiff,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolStep } from "@soryos/schema";

// Category configuration for compact tool card headers
const TOOL_CONFIG: Record<
  string,
  {
    compactTitle: string;
    getSummary: (input: any) => string;
    icon: typeof FileText;
    colorClass: string;
    badgeBg: string;
  }
> = {
  shell_command: {
    compactTitle: "Shell command",
    getSummary: (i) => {
      const cmd = typeof i === "string" ? i : i?.command ?? i?.CommandLine ?? "Executing command";
      // Trim long commands for compact single line display
      return cmd.length > 60 ? `${cmd.slice(0, 57)}...` : cmd;
    },
    icon: Terminal,
    colorClass: "text-amber-500 dark:text-amber-400",
    badgeBg: "bg-amber-500/10 border-amber-500/20",
  },
  run_command: {
    compactTitle: "Shell command",
    getSummary: (i) => {
      const cmd = typeof i === "string" ? i : i?.command ?? i?.CommandLine ?? "Executing command";
      return cmd.length > 60 ? `${cmd.slice(0, 57)}...` : cmd;
    },
    icon: Terminal,
    colorClass: "text-amber-500 dark:text-amber-400",
    badgeBg: "bg-amber-500/10 border-amber-500/20",
  },
  write_file: {
    compactTitle: "File created",
    getSummary: (i) => i?.path ?? i?.filePath ?? "Target file",
    icon: FileCode,
    colorClass: "text-emerald-500 dark:text-emerald-400",
    badgeBg: "bg-emerald-500/10 border-emerald-500/20",
  },
  edit_file: {
    compactTitle: "File edited",
    getSummary: (i) => i?.path ?? i?.filePath ?? "Target file",
    icon: FileDiff,
    colorClass: "text-blue-500 dark:text-blue-400",
    badgeBg: "bg-blue-500/10 border-blue-500/20",
  },
  read_file: {
    compactTitle: "File read",
    getSummary: (i) => i?.path ?? i?.filePath ?? "Target file",
    icon: FileText,
    colorClass: "text-indigo-500 dark:text-indigo-400",
    badgeBg: "bg-indigo-500/10 border-indigo-500/20",
  },
  list_files: {
    compactTitle: "Inspect files",
    getSummary: (i) => i?.dir ?? i?.path ?? "Scanning directory",
    icon: Search,
    colorClass: "text-purple-500 dark:text-purple-400",
    badgeBg: "bg-purple-500/10 border-purple-500/20",
  },
  glob_files: {
    compactTitle: "Glob search",
    getSummary: (i) => i?.pattern ?? "Matching pattern",
    icon: Search,
    colorClass: "text-purple-500 dark:text-purple-400",
    badgeBg: "bg-purple-500/10 border-purple-500/20",
  },
  grep_search: {
    compactTitle: "Grep search",
    getSummary: (i) => i?.query ?? i?.pattern ?? "Searching text",
    icon: Search,
    colorClass: "text-purple-500 dark:text-purple-400",
    badgeBg: "bg-purple-500/10 border-purple-500/20",
  },
  web_search: {
    compactTitle: "Web search",
    getSummary: (i) => i?.query ?? "Web query",
    icon: Globe,
    colorClass: "text-sky-500 dark:text-sky-400",
    badgeBg: "bg-sky-500/10 border-sky-500/20",
  },
  start_dev_server: {
    compactTitle: "Dev Server",
    getSummary: () => "Starting dev server process",
    icon: Server,
    colorClass: "text-emerald-500 dark:text-emerald-400",
    badgeBg: "bg-emerald-500/10 border-emerald-500/20",
  },
};

function getToolConfig(name: string) {
  return (
    TOOL_CONFIG[name] ?? {
      compactTitle: name.replace(/_/g, " "),
      getSummary: (i: any) =>
        typeof i === "string"
          ? i
          : i?.path ?? i?.command ?? i?.query ?? name,
      icon: Wrench,
      colorClass: "text-slate-500 dark:text-slate-400",
      badgeBg: "bg-slate-500/10 border-slate-500/20",
    }
  );
}

// Helper to identify minor internal inspection commands that should render ultra-compact
function isInternalInspectionCommand(name: string, input: any): boolean {
  if (name === "list_files" || name === "glob_files" || name === "grep_search") return true;
  if (name === "shell_command" || name === "run_command") {
    const cmd = String(typeof input === "string" ? input : input?.command ?? input?.CommandLine ?? "").trim();
    return (
      cmd === "pwd" ||
      cmd === "ls" ||
      cmd.startsWith("ls ") ||
      cmd === "git status" ||
      cmd.startsWith("git branch") ||
      cmd.startsWith("test -f") ||
      cmd.startsWith("which ")
    );
  }
  return false;
}

export function ToolStepCard({ step }: { step: ToolStep }) {
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const isRunning = step.status === "running";
  const isPending = step.status === "pending";
  const isCancelled = step.status === "cancelled";
  const hasError = Boolean(step.isError || step.status === "error" || step.error);

  const config = getToolConfig(step.name);
  const Icon = config.icon;
  const summaryText = config.getSummary(step.input);
  const isInspection = isInternalInspectionCommand(step.name, step.input);

  const copyOutput = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const outputText = step.error || step.output || "";

  return (
    <div
      className={cn(
        "my-1.5 min-w-0 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] transition-all text-xs font-sans shadow-2xs",
        isInspection && "opacity-90 hover:opacity-100"
      )}
    >
      {/* Sleek Compact Header Bar */}
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-[var(--surface)]">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {/* Tool Icon */}
          <div
            className={cn(
              "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
              config.badgeBg
            )}
          >
            <Icon className={cn("h-3 w-3", config.colorClass)} />
          </div>

          {/* Compact Label & Summary */}
          <div className="flex items-center gap-1.5 min-w-0 font-mono text-[11px] truncate">
            <span className="font-semibold text-[var(--foreground)] shrink-0">
              {config.compactTitle}
            </span>
            <span className="text-[var(--muted-foreground)] shrink-0">·</span>
            <span className="truncate font-normal text-[var(--muted-foreground)]">
              {summaryText}
            </span>
          </div>
        </div>

        {/* Status Badge & Details Toggle */}
        <div className="flex shrink-0 items-center gap-2">
          {/* Status Indicator */}
          {isPending ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-500">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span>Pending</span>
            </span>
          ) : isRunning ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-blue-500 font-semibold">
              <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
              <span>Running</span>
            </span>
          ) : isCancelled ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[var(--muted-foreground)]">
              <Ban className="h-3 w-3" />
              <span>Cancelled</span>
            </span>
          ) : hasError ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-red-500 font-semibold">
              <XCircle className="h-3 w-3 text-red-500" />
              <span>Failed</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-500 font-semibold">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              <span>Done</span>
            </span>
          )}

          {/* Details Toggle Button */}
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-mono font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition cursor-pointer"
          >
            <ChevronRight
              className={cn(
                "h-3 w-3 transition-transform duration-150",
                showDetails && "rotate-90"
              )}
            />
            <span>Details</span>
          </button>
        </div>
      </div>

      {/* Collapsible Technical Details (Hidden by default) */}
      {showDetails && (
        <div className="border-t border-[var(--border)] bg-[var(--surface-elevated)] p-3 space-y-2.5 text-[11px] font-mono">
          {/* Metadata Row */}
          <div className="flex flex-wrap items-center gap-3 text-[10px] text-[var(--muted-foreground)] border-b border-[var(--border)] pb-2">
            <div>
              <span className="font-semibold text-[var(--foreground)]">Tool:</span> {step.name}
            </div>
            {step.startedAt && (
              <div>
                <span className="font-semibold text-[var(--foreground)]">Started:</span>{" "}
                {new Date(step.startedAt).toLocaleTimeString()}
              </div>
            )}
            {step.completedAt && (
              <div>
                <span className="font-semibold text-[var(--foreground)]">Completed:</span>{" "}
                {new Date(step.completedAt).toLocaleTimeString()}
              </div>
            )}
            {typeof step.metadata?.providerId === "string" && (
              <div>
                <span className="font-semibold text-[var(--foreground)]">Environment:</span>{" "}
                {step.metadata.providerId}
              </div>
            )}
          </div>

          {/* Raw Arguments Section */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
              <span>Command / Input</span>
            </div>
            <pre className="rounded bg-[var(--surface)] p-2 font-mono text-[11px] text-[var(--foreground)] border border-[var(--border)] overflow-x-auto whitespace-pre-wrap break-all">
              {typeof step.input === "object" ? JSON.stringify(step.input, null, 2) : String(step.input)}
            </pre>
          </div>

          {/* Output / Result Section */}
          {outputText && (
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                <span>{hasError ? "Error Output" : "Execution Output"}</span>
                <button
                  type="button"
                  onClick={() => void copyOutput(outputText)}
                  className="flex items-center gap-1 text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition cursor-pointer"
                >
                  {copied ? (
                    <Check className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
              </div>
              <pre
                className={cn(
                  "max-h-52 overflow-auto rounded p-2.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-all border",
                  hasError
                    ? "bg-red-500/10 text-red-500 dark:text-red-400 border-red-500/30"
                    : "bg-[var(--terminal-background)] text-[var(--terminal-foreground)] border-[var(--border)]"
                )}
              >
                {outputText}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
