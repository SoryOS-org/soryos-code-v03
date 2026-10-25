"use client";

import { useState, useMemo } from "react";
import { Search, FileCode, FolderTree, X, Check, Plus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ContextFilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  filePaths: string[];
  onSelectFile: (path: string) => void;
}

export function ContextFilesModal({
  isOpen,
  onClose,
  filePaths,
  onSelectFile,
}: ContextFilesModalProps) {
  const [search, setSearch] = useState("");
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());

  const filteredPaths = useMemo(() => {
    if (!search.trim()) return filePaths;
    const q = search.toLowerCase().trim();
    return filePaths.filter((p) => p.toLowerCase().includes(q));
  }, [filePaths, search]);

  if (!isOpen) return null;

  const handleToggle = (path: string) => {
    onSelectFile(path);
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="relative flex flex-col w-full max-w-lg max-h-[85vh] bg-[var(--surface-elevated)] rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden text-[var(--foreground)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
              <FolderTree className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[var(--foreground)]">
                Ajouter des fichiers au contexte
              </h2>
              <p className="text-[11px] text-[var(--muted-foreground)]">
                {filePaths.length} fichier(s) disponibles dans le projet
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition cursor-pointer"
            aria-label="Fermer"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="border-b border-[var(--border)] p-3 bg-[var(--surface-elevated)]">
          <div className="relative flex items-center">
            <Search className="absolute left-3 h-4 w-4 text-[var(--muted-foreground)] pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un fichier (ex: page.tsx, route.ts, css)..."
              autoFocus
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] pl-9 pr-8 py-2 text-xs font-medium text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus:bg-[var(--surface-elevated)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 transition"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] p-0.5 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Files List */}
        <ScrollArea className="flex-1 min-h-[240px] max-h-[50vh] p-2 bg-[var(--surface-elevated)]">
          {filteredPaths.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-[var(--muted-foreground)]">
              <FileCode className="h-8 w-8 mb-2 opacity-40 text-[var(--muted-foreground)]" />
              <p className="text-xs font-semibold text-[var(--foreground)]">Aucun fichier trouvé</p>
              <p className="text-[11px] text-[var(--muted-foreground)]">Essayez un autre mot-clé de recherche</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredPaths.map((path) => {
                const isSelected = selectedPaths.has(path);
                const parts = path.split("/");
                const filename = parts.pop() || path;
                const directory = parts.join("/");

                return (
                  <button
                    key={path}
                    type="button"
                    onClick={() => handleToggle(path)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition cursor-pointer border ${
                      isSelected
                        ? "border-[var(--primary)]/40 bg-[var(--primary)]/10 text-[var(--foreground)]"
                        : "border-transparent bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] hover:border-[var(--border)] text-[var(--foreground)]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <FileCode
                        className={`h-4 w-4 shrink-0 ${
                          isSelected ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold text-[var(--foreground)] font-mono">
                          {filename}
                        </div>
                        {directory && (
                          <div className="truncate text-[10px] text-[var(--muted-foreground)] font-mono">
                            {directory}/
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isSelected ? (
                        <span className="flex items-center gap-1 rounded-md bg-[var(--primary)] px-2 py-0.5 text-[10px] font-bold text-[var(--primary-foreground)] shadow-2xs">
                          <Check className="h-3 w-3 stroke-[2.5]" />
                          Ajouté
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition">
                          <Plus className="h-3 w-3" />
                          Insérer
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-xs">
          <span className="text-[11px] text-[var(--muted-foreground)]">
            {selectedPaths.size > 0
              ? `${selectedPaths.size} référence(s) insérée(s)`
              : "Cliquez pour insérer @fichier dans le message"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[var(--primary)] px-4 py-1.5 text-xs font-semibold text-[var(--primary-foreground)] hover:opacity-90 active:scale-95 transition cursor-pointer"
          >
            Terminer
          </button>
        </div>
      </div>
    </div>
  );
}
