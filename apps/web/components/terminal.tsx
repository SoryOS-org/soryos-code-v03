"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Terminal as TerminalIcon,
  Plus,
  X,
  Trash2,
  Maximize2,
  Minimize2,
  Folder,
  GitBranch,
  Play,
  Square,
  RefreshCw,
  Sparkles,
  ChevronDown,
  Cloud,
  Laptop,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
} from "lucide-react";

interface TerminalProps {
  sessionId: string | null;
  providerId?: string;
  onPortDetected?: (port: number) => void;
}

interface TabInfo {
  id: string;
  title: string;
  shell: string;
  cwd: string;
  gitBranch: string;
  gitStatus: string;
  isRunning: boolean;
  activeCommand?: string;
  detectedPort?: number;
}

interface TerminalData {
  id: string;
  title: string;
  shell: string;
  cwd: string;
  buffer: string;
  history: string[];
  gitBranch: string;
  gitStatus: string;
  isRunning: boolean;
  activeCommand?: string;
  exitCode: number | null;
  detectedPort?: number;
  remote?: string;
}

/**
 * ANSI Color & Style Parser into safe styled React elements
 */
function renderAnsi(text: string): React.ReactNode[] {
  if (!text) return [];

  const lines = text.split("\r\n").join("\n").split("\n");
  const nodes: React.ReactNode[] = [];

  const colorMap: Record<string, string> = {
    "30": "text-slate-900",
    "31": "text-red-400 font-medium",
    "32": "text-emerald-400 font-medium",
    "33": "text-amber-300 font-medium",
    "34": "text-sky-400 font-medium",
    "35": "text-purple-400 font-medium",
    "36": "text-teal-300 font-medium",
    "37": "text-slate-200",
    "90": "text-slate-500",
    "91": "text-red-300",
    "92": "text-emerald-300",
    "93": "text-amber-200",
    "94": "text-sky-300",
    "95": "text-pink-300",
    "96": "text-teal-200",
    "97": "text-white font-bold",
    "1": "font-bold",
    "2": "opacity-75",
    "3": "italic",
    "4": "underline",
  };

  lines.forEach((line, lineIdx) => {
    // Check for 24-bit RGB or standard ANSI SGR
    const parts = line.split(/\x1b\[([0-9;:]*)m/g);
    let currentClasses = "text-slate-300";
    const lineElements: React.ReactNode[] = [];

    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 1) {
        // ANSI code
        const code = parts[i];
        if (!code || code === "0") {
          currentClasses = "text-slate-300";
        } else {
          const subCodes = code.split(";");
          const classes: string[] = [];
          for (const c of subCodes) {
            if (colorMap[c]) classes.push(colorMap[c]);
          }
          if (classes.length > 0) {
            currentClasses = classes.join(" ");
          }
        }
      } else {
        // Text part
        if (parts[i]) {
          lineElements.push(
            <span key={`p-${i}`} className={currentClasses}>
              {parts[i]}
            </span>
          );
        }
      }
    }

    nodes.push(
      <div key={`line-${lineIdx}`} className="min-h-[1.25rem] whitespace-pre-wrap break-all leading-5">
        {lineElements.length > 0 ? lineElements : <span>&nbsp;</span>}
      </div>
    );
  });

  return nodes;
}

export function Terminal({ sessionId, providerId = "github-codespaces", onPortDetected }: TerminalProps) {
  const [tabs, setTabs] = useState<TabInfo[]>([
    {
      id: "terminal-1",
      title: "1: bash",
      shell: "/bin/bash",
      cwd: "/workspaces/project",
      gitBranch: "main",
      gitStatus: "clean",
      isRunning: false,
    },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>("terminal-1");
  const [activeTerminal, setActiveTerminal] = useState<TerminalData | null>(null);
  const [input, setInput] = useState("");
  const [repository, setRepository] = useState<string | null>(null);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [localHistory, setLocalHistory] = useState<string[]>([]);
  const [executing, setExecuting] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shellDropdownOpen, setShellDropdownOpen] = useState(false);

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on buffer change
  const scrollToBottom = useCallback(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  // Fetch terminal state from server
  const refreshTerminalState = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/sessions/${sessionId}/terminal?terminalId=${activeTabId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.terminals) {
        setTabs(data.terminals);
      }
      if (data.repository) setRepository(data.repository);
      if (data.activeTerminal) {
        setActiveTerminal(data.activeTerminal);
        // Keep the UI tab id in sync with the server's real terminal id.
        if (data.activeTerminal.id !== activeTabId) setActiveTabId(data.activeTerminal.id);
        if (data.activeTerminal.history) {
          setLocalHistory(data.activeTerminal.history);
        }
        if (data.activeTerminal.detectedPort && onPortDetected) {
          onPortDetected(data.activeTerminal.detectedPort);
        }
      }
    } catch {
      // ignore
    }
  }, [sessionId, activeTabId, onPortDetected]);

  useEffect(() => {
    const timer = setInterval(() => {
      void refreshTerminalState();
    }, 2500);
    return () => clearInterval(timer);
  }, [refreshTerminalState]);

  useEffect(() => {
    scrollToBottom();
  }, [activeTerminal?.buffer, scrollToBottom]);

  // Focus terminal input
  const handleFocus = () => {
    inputRef.current?.focus();
  };

  // Create a new terminal tab
  const handleCreateTerminal = async (shell: string = "/bin/bash") => {
    if (!sessionId) return;
    setShellDropdownOpen(false);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/terminal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", shell }),
      });
      const data = await res.json();
      if (data.success && data.terminal) {
        setTabs((prev) => [...prev, data.terminal]);
        setActiveTabId(data.terminal.id);
        void refreshTerminalState();
      }
    } catch (err) {
      console.warn("Failed to create terminal:", err);
    }
  };

  // Close terminal tab
  const handleCloseTerminal = async (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/sessions/${sessionId}/terminal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close", terminalId: tabId }),
      });
      const data = await res.json();
      if (data.success) {
        setTabs((prev) => prev.filter((t) => t.id !== tabId));
        if (data.activeTerminalId) {
          setActiveTabId(data.activeTerminalId);
        }
        void refreshTerminalState();
      }
    } catch (err) {
      console.warn("Failed to close terminal:", err);
    }
  };

  // Send Signal (Ctrl+C / SIGINT)
  const handleSendInterrupt = async () => {
    if (!sessionId) return;
    try {
      await fetch(`/api/sessions/${sessionId}/terminal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "signal", terminalId: activeTabId, signal: "SIGINT" }),
      });
      setExecuting(false);
      void refreshTerminalState();
    } catch (err) {
      console.warn("Interrupt failed:", err);
    }
  };

  // Clear terminal screen
  const handleClear = async () => {
    if (!sessionId) return;
    try {
      await fetch(`/api/sessions/${sessionId}/terminal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear", terminalId: activeTabId }),
      });
      setActiveTerminal((prev) => (prev ? { ...prev, buffer: "" } : null));
    } catch (err) {
      console.warn("Clear failed:", err);
    }
  };

  // Execute command
  const executeCommand = async (cmdStr: string) => {
    if (!sessionId || !cmdStr.trim()) return;

    const trimmed = cmdStr.trim();
    setInput("");
    setHistoryIndex(-1);
    setLocalHistory((prev) => [...prev, trimmed]);
    setExecuting(true);

    // Show the command immediately; the server appends the real output to the buffer.
    setActiveTerminal((prev) =>
      prev ? { ...prev, buffer: (prev.buffer || "") + `\x1b[90m… ${trimmed}\x1b[0m\r\n` } : prev
    );
    scrollToBottom();

    try {
      const res = await fetch(`/api/sessions/${sessionId}/terminal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "exec",
          terminalId: activeTabId,
          command: trimmed,
        }),
      });

      const data = await res.json();
      if (data) {
        if (data.detectedPort && onPortDetected) {
          onPortDetected(data.detectedPort);
        }
        void refreshTerminalState();
      }
    } catch (err) {
      const errMsg = `\x1b[31mError: ${err instanceof Error ? err.message : "Execution failed"}\x1b[0m\r\n`;
      setActiveTerminal((prev) =>
        prev ? { ...prev, buffer: (prev.buffer || "") + errMsg } : null
      );
    } finally {
      setExecuting(false);
      handleFocus();
    }
  };

  // Keyboard navigation (History Up/Down, Autocomplete Tab, Ctrl+C, Ctrl+L)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Ctrl+C -> Send SIGINT
    if (e.ctrlKey && e.key.toLowerCase() === "c") {
      e.preventDefault();
      void handleSendInterrupt();
      return;
    }

    // Ctrl+L -> Clear buffer
    if (e.ctrlKey && e.key.toLowerCase() === "l") {
      e.preventDefault();
      void handleClear();
      return;
    }

    // Enter -> Execute
    if (e.key === "Enter") {
      e.preventDefault();
      if (!executing) {
        void executeCommand(input);
      }
      return;
    }

    // Up Arrow -> Previous history
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (localHistory.length === 0) return;
      const newIdx = historyIndex === -1 ? localHistory.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(newIdx);
      setInput(localHistory[newIdx] || "");
      return;
    }

    // Down Arrow -> Next history
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex === -1) return;
      const newIdx = historyIndex + 1;
      if (newIdx >= localHistory.length) {
        setHistoryIndex(-1);
        setInput("");
      } else {
        setHistoryIndex(newIdx);
        setInput(localHistory[newIdx] || "");
      }
      return;
    }

    // Tab -> Autocomplete common commands/folders
    if (e.key === "Tab") {
      e.preventDefault();
      const suggestions = ["git status", "git branch", "git log", "npm run dev", "npm install", "ls -la", "pwd", "cd src", "cd ..", "cat package.json"];
      const match = suggestions.find((s) => s.startsWith(input) && s !== input);
      if (match) {
        setInput(match);
      }
    }
  };

  const handleCopyBuffer = () => {
    if (activeTerminal?.buffer) {
      void navigator.clipboard.writeText(activeTerminal.buffer.replace(/\x1b\[[0-9;]*m/g, ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const currentTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const isRemote = Boolean(activeTerminal?.remote);
  const projectName = (repository || "").split("/").pop() || "";
  const promptUser = isRemote ? `${projectName || "user"}@codespace` : "user@local";
  const currentCwd = activeTerminal?.cwd || currentTab?.cwd || "/workspaces/project";
  const currentBranch = activeTerminal?.gitBranch || currentTab?.gitBranch || "main";
  const isDirty = (activeTerminal?.gitStatus || currentTab?.gitStatus) === "modified";
  const isProcessRunning = activeTerminal?.isRunning || executing;

  return (
    <div
      ref={containerRef}
      onClick={handleFocus}
      className={`flex flex-col overflow-hidden bg-[var(--terminal-background)] text-[var(--terminal-foreground)] font-mono text-xs select-text ${
        isMaximized ? "fixed inset-0 z-50 rounded-none shadow-2xl" : "h-full min-h-0 w-full"
      }`}
    >
      {/* 1. Top VS Code Style Toolbar */}
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[var(--foreground)]">
        {/* Left: Terminal Tab List & New Terminal Button */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-[60%] sm:max-w-[70%]">
          <div className="flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider">
            <TerminalIcon className="h-3.5 w-3.5 text-[var(--primary)]" />
            <span className="hidden sm:inline">TERMINAL</span>
          </div>

          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveTabId(tab.id);
                  void refreshTerminalState();
                }}
                className={`group flex items-center gap-2 rounded-t-md px-3 py-1 text-xs font-medium transition cursor-pointer border-t-2 ${
                  isActive
                    ? "bg-[var(--terminal-background)] text-[var(--terminal-foreground)] border-[var(--primary)]"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] border-transparent"
                }`}
              >
                {tab.isRunning ? (
                  <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                )}
                <span className="truncate max-w-[100px] sm:max-w-[130px]">{tab.title}</span>
                {tabs.length > 1 && (
                  <button
                    onClick={(e) => handleCloseTerminal(tab.id, e)}
                    className="opacity-0 group-hover:opacity-100 hover:text-red-400 rounded p-0.5 transition cursor-pointer"
                    title="Fermer ce terminal"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}

          {/* New Terminal Dropdown Button */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShellDropdownOpen((v) => !v);
              }}
              className="flex items-center gap-1 rounded px-1.5 py-1 text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition cursor-pointer"
              title="Ouvrir un nouveau terminal"
            >
              <Plus className="h-3.5 w-3.5" />
              <ChevronDown className="h-3 w-3" />
            </button>

            {shellDropdownOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute left-0 top-full mt-1 z-50 w-36 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] py-1 shadow-2xl animate-in fade-in zoom-in-95 text-[var(--foreground)]"
              >
                <button
                  onClick={() => handleCreateTerminal("/bin/bash")}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition"
                >
                  <span className="text-emerald-400 font-bold">$</span> bash
                </button>
                <button
                  onClick={() => handleCreateTerminal("/bin/sh")}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition"
                >
                  <span className="text-blue-400 font-bold">#</span> sh
                </button>
                <button
                  onClick={() => handleCreateTerminal("/bin/zsh")}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition"
                >
                  <span className="text-purple-400 font-bold">%</span> zsh
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Environment Info Badges & Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Environment Badge */}
          <div className="hidden lg:flex items-center gap-1.5 bg-[var(--surface-elevated)] border border-[var(--border)] px-2 py-0.5 rounded text-[11px] text-[var(--foreground)]">
            {providerId === "github-codespaces" || providerId === "github-repository" ? (
              <Cloud className="h-3 w-3 text-sky-400" />
            ) : (
              <Laptop className="h-3 w-3 text-emerald-400" />
            )}
            <span className="truncate max-w-[120px]">
              {providerId === "github-codespaces" ? "Codespaces" : "Local"}
            </span>
          </div>

          {/* Git Branch Badge */}
          <div className="hidden md:flex items-center gap-1 bg-[var(--surface-elevated)] border border-[var(--border)] px-2 py-0.5 rounded text-[11px] text-amber-500 dark:text-amber-300">
            <GitBranch className="h-3 w-3 text-amber-500 dark:text-amber-400" />
            <span>{currentBranch}</span>
            {isDirty && <span className="text-amber-500 dark:text-amber-400 font-bold">*</span>}
          </div>

          {/* Running Process Indicator / Interrupt Button */}
          {isProcessRunning && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                void handleSendInterrupt();
              }}
              className="flex items-center gap-1 bg-red-500/20 border border-red-500/40 text-red-500 dark:text-red-300 px-2 py-0.5 rounded text-[11px] font-bold hover:bg-red-500/30 transition cursor-pointer animate-pulse"
              title="Arrêter le processus en cours (Ctrl+C / SIGINT)"
            >
              <Square className="h-3 w-3 fill-red-500 text-red-500 dark:fill-red-400 dark:text-red-400" />
              <span>Arrêter (Ctrl+C)</span>
            </button>
          )}

          {/* Copy Buffer */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCopyBuffer();
            }}
            className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition cursor-pointer"
            title="Copier la sortie du terminal"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          </button>

          {/* Clear Buffer */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              void handleClear();
            }}
            className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition cursor-pointer"
            title="Effacer l'écran (Ctrl+L)"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>

          {/* Maximize Toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsMaximized((v) => !v);
            }}
            className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition cursor-pointer"
            title={isMaximized ? "Réduire le terminal" : "Agrandir le terminal"}
          >
            {isMaximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* 2. Interactive Terminal Output Canvas */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1 scrollbar-thin scrollbar-thumb-[var(--border)]">
        {/* Render Buffer with Real ANSI formatting */}
        {activeTerminal?.buffer && renderAnsi(activeTerminal.buffer)}

        {/* 3. Interactive Input Prompt Line */}
        <div className="flex items-center gap-1.5 pt-1 text-[var(--terminal-foreground)] flex-wrap sm:flex-nowrap">
          {/* Shell Prompt: user@codespace ➜ /workspaces/project (main) $ */}
          <div className="flex items-center gap-1.5 shrink-0 font-bold select-none text-[11px] sm:text-xs">
            <span className="text-emerald-500 dark:text-emerald-400">{promptUser}</span>
            <span className="text-[var(--primary)]">➜</span>
            <span className="text-sky-500 dark:text-sky-400 flex items-center gap-1">
              <Folder className="h-3 w-3 inline text-sky-500 dark:text-sky-400" />
              {currentCwd}
            </span>
            <span className="text-amber-500 dark:text-amber-300 flex items-center gap-0.5">
              ({currentBranch}
              {isDirty && "*"})
            </span>
            <span className="text-[var(--terminal-foreground)]">$</span>
          </div>

          {/* Input field */}
          <div className="flex-1 min-w-[120px] relative flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={executing || !sessionId}
              placeholder={executing ? "Processus en cours..." : "Tapez une commande (ex: git status, ls -la, npm run dev)..."}
              className="w-full bg-transparent font-mono text-xs text-[var(--terminal-foreground)] placeholder:text-[var(--muted-foreground)] outline-none border-none p-0 focus:ring-0"
              autoFocus
              spellCheck={false}
              autoComplete="off"
            />
          </div>
        </div>

        {/* Scroll anchor */}
        <div ref={terminalEndRef} />
      </div>

      {/* 4. Mobile & Quick Actions Helper Toolbar */}
      <div className="flex shrink-0 items-center justify-between border-t border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] text-[var(--muted-foreground)] overflow-x-auto no-scrollbar gap-2">
        <div className="flex items-center gap-1">
          <span className="text-[var(--muted-foreground)] uppercase text-[9px] font-bold tracking-wider">Raccourcis:</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setInput("ls -la");
              void executeCommand("ls -la");
            }}
            className="px-1.5 py-0.5 bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] text-[var(--foreground)] border border-[var(--border)] rounded transition cursor-pointer"
          >
            ls -la
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setInput("git status");
              void executeCommand("git status");
            }}
            className="px-1.5 py-0.5 bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] text-[var(--foreground)] border border-[var(--border)] rounded transition cursor-pointer"
          >
            git status
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setInput("git branch --show-current");
              void executeCommand("git branch --show-current");
            }}
            className="px-1.5 py-0.5 bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] text-[var(--foreground)] border border-[var(--border)] rounded transition cursor-pointer"
          >
            git branch
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setInput("pwd");
              void executeCommand("pwd");
            }}
            className="px-1.5 py-0.5 bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] text-[var(--foreground)] border border-[var(--border)] rounded transition cursor-pointer"
          >
            pwd
          </button>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              void handleSendInterrupt();
            }}
            className="px-1.5 py-0.5 bg-red-500/20 hover:bg-red-500/30 text-red-500 dark:text-red-300 border border-red-500/30 rounded transition cursor-pointer"
          >
            Ctrl+C
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              void handleClear();
            }}
            className="px-1.5 py-0.5 bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] text-[var(--foreground)] border border-[var(--border)] rounded transition cursor-pointer"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
