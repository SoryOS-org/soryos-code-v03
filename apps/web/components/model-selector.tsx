"use client";

import { useEffect, useState, useTransition } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getAllProviders,
  getModelById,
  ProviderInfo,
  ModelInfo,
} from "@/lib/providers";
import { ChevronDown, Check, Sparkles, Cpu, RefreshCw } from "lucide-react";

interface ModelSelectorProps {
  currentModelId: string;
  onModelChange: (modelId: string) => void;
  className?: string;
}

export function ModelSelector({
  currentModelId,
  onModelChange,
  className = "",
}: ModelSelectorProps) {
  const [providers, setProviders] = useState<ProviderInfo[]>(() => getAllProviders());
  const [isSyncing, startSync] = useTransition();
  const [lastSyncNotice, setLastSyncNotice] = useState<string | null>(null);

  // Dynamically fetch providers on mount and sync with OpenCode Zen
  useEffect(() => {
    let mounted = true;
    async function fetchLiveProviders() {
      try {
        const res = await fetch("/api/providers");
        if (!res.ok) return;
        const data = (await res.json()) as { providers?: ProviderInfo[] };
        if (mounted && data.providers && Array.isArray(data.providers)) {
          setProviders(data.providers);
        }
      } catch (err) {
        console.warn("Could not fetch dynamic providers:", err);
      }
    }
    void fetchLiveProviders();
    return () => {
      mounted = false;
    };
  }, []);

  const handleManualSync = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startSync(async () => {
      try {
        const res = await fetch("/api/providers", { method: "POST" });
        if (!res.ok) return;
        const data = (await res.json()) as { providers?: ProviderInfo[] };
        if (data.providers) {
          setProviders(data.providers);
          const zen = data.providers.find((p) => p.id === "opencode-zen");
          const count = zen?.models.length || 0;
          setLastSyncNotice(`Synced ${count} Zen models`);
          setTimeout(() => setLastSyncNotice(null), 3000);
        }
      } catch (err) {
        console.error("Manual sync error:", err);
      }
    });
  };

  const activeModel = getModelById(currentModelId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={`flex items-center gap-2 rounded-lg px-2.5 py-1 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-hover)] border border-[var(--border)] bg-[var(--surface-elevated)] shadow-2xs cursor-pointer ${className}`}
        >
          <Sparkles className="h-3.5 w-3.5 text-[var(--primary)]" />
          <span className="font-semibold text-[var(--foreground)]">{activeModel.providerName}</span>
          <span className="text-[var(--muted-foreground)]">·</span>
          <span className="truncate max-w-[130px] text-[var(--muted-foreground)]">{activeModel.name}</span>
          {activeModel.isFree && (
            <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Free
            </span>
          )}
          <ChevronDown className="h-3 w-3 text-[var(--muted-foreground)]" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="w-92 sm:w-96 max-h-[500px] overflow-y-auto p-1.5 bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--foreground)] shadow-xl rounded-xl text-xs z-50"
      >
        {/* Dynamic Sync Header */}
        <div className="flex items-center justify-between px-2 py-1.5 border-b border-[var(--border)] mb-1">
          <div>
            <div className="flex items-center gap-1.5">
              <p className="font-semibold text-xs text-[var(--foreground)]">AI Provider & Models</p>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <p className="text-[10px] text-[var(--muted-foreground)]">
              {lastSyncNotice || "Auto-syncs live with OpenCode Zen free models"}
            </p>
          </div>
          <button
            type="button"
            onClick={handleManualSync}
            disabled={isSyncing}
            title="Check OpenCode Zen for newly added models"
            className="flex items-center gap-1 px-1.5 py-1 text-[10px] font-medium text-[var(--primary)] hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded cursor-pointer transition-colors"
          >
            <RefreshCw className={`h-3 w-3 ${isSyncing ? "animate-spin" : ""}`} />
            <span>{isSyncing ? "Syncing..." : "Sync Zen"}</span>
          </button>
        </div>

        {/* Dynamically rendered providers list */}
        {providers.map((provider, pIndex) => (
          <div key={provider.id}>
            {pIndex > 0 && <DropdownMenuSeparator className="bg-[var(--border)] my-1" />}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex items-center justify-between text-[11px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider px-2 py-1.5">
                <div className="flex items-center gap-1.5 truncate">
                  <Cpu className="h-3 w-3 text-[var(--primary)] shrink-0" />
                  <span className="truncate text-[var(--foreground)]">{provider.name}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {provider.id === "opencode-zen" && (
                    <span className="text-[9px] font-semibold text-[var(--primary)] bg-[var(--primary)]/10 px-1 py-0.2 rounded border border-[var(--primary)]/20">
                      Bearer public
                    </span>
                  )}
                  {provider.hasFreeTier && (
                    <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                      Free Tier
                    </span>
                  )}
                </div>
              </DropdownMenuLabel>

              {provider.models.map((model: ModelInfo) => {
                const isSelected = model.id === currentModelId;
                return (
                  <DropdownMenuItem
                    key={model.id}
                    onClick={() => onModelChange(model.id)}
                    className={`flex items-start justify-between gap-2 px-2.5 py-2 cursor-pointer rounded-lg text-xs transition-colors ${
                      isSelected
                        ? "bg-[var(--primary)]/15 text-[var(--foreground)] font-semibold border-l-2 border-[var(--primary)]"
                        : "hover:bg-[var(--surface-hover)] text-[var(--foreground)]"
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-[12px] truncate">{model.name}</span>
                        {model.isFree && (
                          <span className="rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-1 py-0.2 text-[9px] font-bold">
                            FREE
                          </span>
                        )}
                        {model.badge && !model.isFree && (
                          <span className="rounded bg-[var(--surface)] text-[var(--muted-foreground)] px-1 py-0.2 text-[9px] border border-[var(--border)]">
                            {model.badge}
                          </span>
                        )}
                        {model.contextLength && (
                          <span className="rounded bg-[var(--primary)]/10 text-[var(--primary)] px-1 py-0.2 text-[9px] font-medium border border-[var(--primary)]/15">
                            {model.contextLength}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--muted-foreground)] line-clamp-1">
                        {model.description}
                      </p>
                    </div>
                    {isSelected && (
                      <Check className="h-3.5 w-3.5 text-[var(--primary)] shrink-0 mt-0.5" />
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
