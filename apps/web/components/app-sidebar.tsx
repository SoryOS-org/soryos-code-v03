"use client";

import { useEffect, useState, useMemo, useRef, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Sparkles,
  FolderDown,
  X,
  Layers,
  Settings,
  MessageSquare,
  Search,
  Trash2,
  Edit2,
  Check,
  Moon,
  Sun,
  Laptop,
  Code2,
  FolderGit2,
  Loader2,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { listSessions, createSession } from "@/lib/api";
import { ImportRepoModal } from "@/components/import-repo-modal";
import { SettingsPanel } from "@/components/settings-panel";
import { PWAInstallButton } from "@/components/pwa-install-button";
import { useTheme } from "@/lib/theme/theme-context";
import { Button } from "@/components/ui/button";

interface SessionItem {
  id: string;
  title: string;
  created_at: string;
}

interface AppSidebarProps {
  currentSessionId?: string;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function AppSidebar({
  currentSessionId,
  mobileOpen = false,
  onMobileClose,
}: AppSidebarProps) {
  const router = useRouter();
  const { preferences, resolvedIsDark, mounted, updatePreferences } = useTheme();

  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isOpening, startOpening] = useTransition();
  const [creationError, setCreationError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleCreateNewSession = async () => {
    if (isCreating || isOpening) return;
    setIsCreating(true);
    setCreationError(null);
    try {
      const session = await createSession(
        "Nouveau Projet IA",
        undefined,
        "opencode/zen-coder-free",
        "local",
        "local"
      );
      fetchSessions();
      startOpening(() => {
        router.push(`/chat/${session.id}`);
      });
    } catch (err) {
      console.error("Failed to create session:", err);
      setCreationError(err instanceof Error ? err.message : "Impossible d’ouvrir le projet. Réessayez.");
    } finally {
      setIsCreating(false);
    }
  };

  // Keyboard shortcut (⌘K or Ctrl+K) to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Fetch list of sessions
  const fetchSessions = () => {
    listSessions()
      .then((data) => {
        setSessions(data || []);
      })
      .catch(() => {
        setSessions([]);
      });
  };

  useEffect(() => {
    fetchSessions();
  }, [currentSessionId]);

  // Handle 1-click Theme Toggle
  const handleToggleTheme = () => {
    const nextTheme = resolvedIsDark ? "light" : "dark";
    updatePreferences({ theme: nextTheme });
  };

  // Start Editing Title
  const handleStartEdit = (session: SessionItem, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
  };

  // Save Title
  const handleSaveTitle = async (sessionId: string, e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!editingTitle.trim()) return;

    try {
      await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editingTitle.trim() }),
      });
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, title: editingTitle.trim() } : s))
      );
    } catch {
      // ignore
    } finally {
      setEditingSessionId(null);
    }
  };

  // Delete Session
  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      await fetch(`/api/sessions/${sessionId}`, {
        method: "DELETE",
      });
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        router.push("/");
      }
    } catch {
      // ignore
    } finally {
      setDeletingSessionId(null);
    }
  };

  // Filter sessions by search query
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter(
      (s) => s.title.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)
    );
  }, [sessions, searchQuery]);

  const sidebarContent = (
    <div className="flex h-full w-full flex-col bg-[var(--sidebar-background)] text-[var(--sidebar-foreground)] border-r border-[var(--border)] select-none">
      {/* 1. Header: Branding & Close for Mobile */}
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-[var(--border)] bg-[var(--surface-elevated)]/50 backdrop-blur-sm">
        <Link
          href="/"
          onClick={onMobileClose}
          className="flex items-center gap-2.5 group cursor-pointer"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] shadow-xs transition-transform group-hover:scale-105">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs tracking-tight text-[var(--foreground)]">
                SoryOS-Code
              </span>
              <span className="text-[9px] font-mono font-bold bg-[var(--primary)]/10 text-[var(--primary)] px-1.5 py-0.2 rounded">
                v3.0
              </span>
            </div>
            <p className="text-[10px] text-[var(--muted-foreground)] truncate">
              Autonomous AI IDE
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-1">
          {/* 1-Click Dark/Light Theme Quick Switcher */}
          <button
            type="button"
            onClick={handleToggleTheme}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition cursor-pointer"
            title={mounted && resolvedIsDark ? "Basculer en Mode Clair" : "Basculer en Mode Sombre"}
            aria-label="Changer de thème"
          >
            {mounted && resolvedIsDark ? <Sun className="h-3.5 w-3.5 text-amber-400" /> : <Moon className="h-3.5 w-3.5 text-indigo-500" />}
          </button>

          {/* Close for mobile drawer */}
          <button
            onClick={onMobileClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] md:hidden transition cursor-pointer"
            aria-label="Fermer le menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 2. Primary Action: Nouveau projet */}
      <div className="p-3 pb-2 space-y-2">
        <Button
          type="button"
          onClick={handleCreateNewSession}
          disabled={isCreating || isOpening}
          aria-busy={isCreating || isOpening}
          className="flex items-center justify-between w-full rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] px-3.5 py-2.5 text-xs font-bold shadow-xs hover:opacity-95 active:scale-[0.99] transition cursor-pointer disabled:opacity-60"
        >
          <div className="flex items-center gap-2">
            {isCreating || isOpening ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            <span>{isOpening ? "Ouverture..." : isCreating ? "Création..." : "Nouveau projet IA"}</span>
          </div>
          <span className="text-[10px] font-mono opacity-80 bg-black/15 px-1.5 py-0.5 rounded">
            ⌘N
          </span>
        </Button>
        {creationError && (
          <p role="alert" className="text-xs text-[var(--foreground)]">{creationError}</p>
        )}

        {/* Secondary Quick Nav Items */}
        <div className="grid grid-cols-2 gap-1.5 pt-0.5">
          <button
            type="button"
            onClick={() => {
              setIsImportOpen(true);
              onMobileClose?.();
            }}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-2.5 py-2 text-[11px] font-semibold text-[var(--foreground)] hover:bg-[var(--surface-hover)] hover:border-[var(--primary)]/50 transition cursor-pointer"
            title="Importer un dépôt GitHub ou Git"
          >
            <FolderDown className="h-3.5 w-3.5 text-emerald-500" />
            <span className="truncate">Importer</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsSettingsOpen(true);
              onMobileClose?.();
            }}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-2.5 py-2 text-[11px] font-semibold text-[var(--foreground)] hover:bg-[var(--surface-hover)] hover:border-[var(--primary)]/50 transition cursor-pointer"
            title="Paramètres & Apparence"
          >
            <Settings className="h-3.5 w-3.5 text-purple-400" />
            <span className="truncate">Settings</span>
          </button>
        </div>
      </div>

      {/* 3. Search Bar for Sessions */}
      <div className="px-3 pt-1 pb-2">
        <div className="relative flex items-center">
          <Search className="absolute left-2.5 h-3.5 w-3.5 text-[var(--muted-foreground)] pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Filtrer les sessions par titre..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setSearchQuery("");
                searchInputRef.current?.blur();
              }
            }}
            className="w-full pl-8 pr-12 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/30 transition"
            aria-label="Filtrer les sessions par titre"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                searchInputRef.current?.focus();
              }}
              className="absolute right-2 flex h-4 w-4 items-center justify-center rounded text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition cursor-pointer"
              title="Effacer le filtre (Échap)"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <kbd className="absolute right-2 hidden sm:inline-flex items-center gap-0.5 rounded border border-[var(--border)] bg-[var(--surface-elevated)] px-1.5 py-0.5 text-[9px] font-mono text-[var(--muted-foreground)] select-none pointer-events-none">
              ⌘K
            </kbd>
          )}
        </div>
      </div>

      {/* 4. Session History List */}
      <div className="flex items-center justify-between px-4 pt-2 pb-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
          {searchQuery.trim() ? (
            <>Sessions ({filteredSessions.length}/{sessions.length})</>
          ) : (
            <>Sessions & Projets ({filteredSessions.length})</>
          )}
        </span>
        {searchQuery.trim() ? (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="text-[9px] font-medium text-[var(--primary)] hover:underline cursor-pointer"
          >
            Effacer
          </button>
        ) : sessions.length > 0 ? (
          <span className="text-[9px] font-mono text-[var(--muted-foreground)]">
            Auto-save
          </span>
        ) : null}
      </div>

      <ScrollArea className="min-h-0 flex-1 px-2.5 pb-2">
        {filteredSessions.length > 0 ? (
          <div className="space-y-1 py-1">
            {filteredSessions.map((s) => {
              const isActive = s.id === currentSessionId;
              const isEditing = editingSessionId === s.id;
              const isDeleting = deletingSessionId === s.id;

              if (isEditing) {
                return (
                  <div
                    key={s.id}
                    className="flex items-center gap-1.5 rounded-xl border border-[var(--primary)] bg-[var(--surface-hover)] p-1.5 shadow-2xs"
                  >
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveTitle(s.id, e);
                        if (e.key === "Escape") setEditingSessionId(null);
                      }}
                      autoFocus
                      className="flex-1 bg-transparent px-2 py-0.5 text-xs text-[var(--foreground)] font-semibold outline-none"
                    />
                    <button
                      type="button"
                      onClick={(e) => handleSaveTitle(s.id, e)}
                      className="p-1 text-emerald-500 hover:bg-emerald-500/10 rounded cursor-pointer"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingSessionId(null)}
                      className="p-1 text-[var(--muted-foreground)] hover:bg-[var(--surface)] rounded cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              }

              return (
                <div
                  key={s.id}
                  className={`group relative flex items-center justify-between rounded-xl px-2.5 py-2 text-xs transition border ${
                    isActive
                      ? "border-[var(--primary)]/50 bg-[var(--primary)]/10 text-[var(--foreground)] font-bold shadow-2xs"
                      : "border-transparent text-[var(--sidebar-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] font-medium"
                  }`}
                >
                  <Link
                    href={`/chat/${s.id}`}
                    onClick={onMobileClose}
                    className="flex items-center gap-2.5 min-w-0 flex-1 pr-1"
                    title={s.title}
                  >
                    <div
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${
                        isActive
                          ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                          : "bg-[var(--surface)] text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]"
                      }`}
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold leading-snug">
                        {s.title || "Session sans titre"}
                      </p>
                      <p className="text-[10px] font-mono text-[var(--muted-foreground)] truncate">
                        {s.id.startsWith("demo-") ? "Exemple" : s.id.slice(0, 8)}
                      </p>
                    </div>
                  </Link>

                  {/* Hover Action Buttons */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      type="button"
                      onClick={(e) => handleStartEdit(s, e)}
                      className="p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface)] rounded transition cursor-pointer"
                      title="Renommer la session"
                    >
                      <Edit2 className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => setDeletingSessionId(s.id)}
                      className="p-1 text-[var(--muted-foreground)] hover:text-red-500 hover:bg-red-500/10 rounded transition cursor-pointer"
                      title="Supprimer la session"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Deletion Confirm Popup Overlay */}
                  {isDeleting && (
                    <div className="absolute inset-0 z-20 flex items-center justify-between bg-[var(--surface-elevated)] px-2 py-1 rounded-xl border border-red-500/40 shadow-md">
                      <span className="text-[10px] font-bold text-red-500 truncate">
                        Supprimer ?
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => handleDeleteSession(s.id, e)}
                          className="px-2 py-0.5 bg-red-600 text-white rounded text-[10px] font-bold hover:bg-red-700 cursor-pointer"
                        >
                          Oui
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDeletingSessionId(null);
                          }}
                          className="px-2 py-0.5 text-[var(--muted-foreground)] hover:bg-[var(--surface)] rounded text-[10px]"
                        >
                          Non
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center px-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--surface)] text-[var(--muted-foreground)] mb-2">
              <MessageSquare className="h-4 w-4" />
            </div>
            <p className="text-xs font-semibold text-[var(--foreground)]">
              {searchQuery ? "Aucune session trouvée" : "Aucune session"}
            </p>
            <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5 max-w-[200px]">
              {searchQuery
                ? `Aucun titre ne correspond à "${searchQuery}"`
                : "Créez un nouveau projet pour commencer"}
            </p>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="mt-3 inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-2.5 py-1 text-[11px] font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition cursor-pointer"
              >
                <X className="h-3 w-3" />
                <span>Effacer le filtre</span>
              </button>
            )}
          </div>
        )}
      </ScrollArea>

      {/* 5. Footer: System status & PWA button */}
      <div className="border-t border-[var(--border)] p-3 space-y-2 bg-[var(--surface-elevated)]/60">
        <PWAInstallButton className="w-full justify-center text-xs" />

        <div className="flex items-center justify-between text-[11px] text-[var(--muted-foreground)] pt-0.5">
          <div className="flex items-center gap-1.5">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-medium text-[var(--foreground)]">OpenCode Zen</span>
          </div>
          <span className="text-[10px] font-mono text-[var(--muted-foreground)]">
            {mounted ? (resolvedIsDark ? "Dark Theme" : "Light Theme") : "Theme"}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden md:flex h-full w-[260px] shrink-0 flex-col border-r border-[var(--border)]">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer (Overlay + Slide-over Panel) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in"
            onClick={onMobileClose}
          />
          {/* Drawer Panel */}
          <div className="relative flex w-4/5 max-w-xs flex-1 flex-col shadow-2xl animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}

      <ImportRepoModal
        isOpen={isImportOpen}
        onClose={() => {
          setIsImportOpen(false);
          fetchSessions();
        }}
      />

      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </>
  );
}
