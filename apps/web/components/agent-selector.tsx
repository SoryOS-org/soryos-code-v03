"use client";

import { useState } from "react";
import {
  Check,
  ChevronDown,
  Info,
  Layers,
  Wrench,
  Sparkles,
  X,
} from "lucide-react";
import {
  OPENCODE_AGENTS,
  OpenCodeAgent,
  getAgentById,
} from "@/lib/opencode-agents";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface AgentSelectorProps {
  currentAgentId: string;
  onAgentChange: (agentId: string) => void;
  className?: string;
}

export function AgentSelector({
  currentAgentId,
  onAgentChange,
  className = "",
}: AgentSelectorProps) {
  const [inspectorAgent, setInspectorAgent] = useState<OpenCodeAgent | null>(
    null,
  );
  const activeAgent = getAgentById(currentAgentId);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={`flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] px-2.5 py-1 text-xs font-semibold text-[var(--foreground)] shadow-xs transition-colors hover:border-[var(--primary)] hover:bg-[var(--surface-hover)] focus:outline-none cursor-pointer ${className}`}
            title={`Agent actif : ${activeAgent.name}`}
          >
            <span className="text-sm">{activeAgent.icon}</span>
            <span className="max-w-[110px] truncate">{activeAgent.name.replace(/ \(.*\)/, "")}</span>
            <span className="rounded bg-[var(--primary)]/15 px-1 py-0.2 text-[9px] font-bold text-[var(--primary)]">
              Agent
            </span>
            <ChevronDown className="h-3 w-3 text-[var(--muted-foreground)]" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          className="w-80 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-1.5 shadow-xl text-[var(--foreground)] z-50"
        >
          <div className="flex items-center justify-between px-2.5 py-2">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--foreground)]">
              <Layers className="h-3.5 w-3.5 text-[var(--primary)]" />
              <span>Agents OpenCode</span>
            </div>
            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
              6 Spécialistes
            </span>
          </div>
          <DropdownMenuSeparator className="bg-[var(--border)]" />

          <div className="space-y-1 py-1 max-h-[320px] overflow-y-auto">
            {OPENCODE_AGENTS.map((agent) => {
              const isSelected = agent.id === activeAgent.id;
              return (
                <div
                  key={agent.id}
                  className={`group relative flex items-start gap-2.5 rounded-lg p-2 transition cursor-pointer ${
                    isSelected
                      ? "bg-[var(--surface-hover)] border border-[var(--primary)]/40"
                      : "hover:bg-[var(--surface-hover)]"
                  }`}
                  onClick={() => onAgentChange(agent.id)}
                >
                  <span className="text-lg shrink-0 mt-0.5">{agent.icon}</span>
                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-[var(--foreground)] truncate">
                        {agent.name}
                      </span>
                      <span
                        className="text-[9px] px-1 py-0.2 rounded font-semibold"
                        style={{
                          backgroundColor: `${agent.color}15`,
                          color: agent.color,
                        }}
                      >
                        {agent.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--muted-foreground)] line-clamp-1 mt-0.5">
                      {agent.role}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {agent.tools.slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className="rounded bg-[var(--surface)] border border-[var(--border)] px-1 py-0.2 font-mono text-[9px] text-[var(--muted-foreground)]"
                        >
                          {t}
                        </span>
                      ))}
                      {agent.tools.length > 3 && (
                        <span className="font-mono text-[9px] text-[var(--muted-foreground)]">
                          +{agent.tools.length - 3}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setInspectorAgent(agent);
                    }}
                    className="absolute right-2 top-2 rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition cursor-pointer"
                    title="Voir les détails de l'agent"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>

                  {isSelected && (
                    <div className="absolute right-2 bottom-2 text-[var(--primary)]">
                      <Check className="h-4 w-4" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Agent Inspector Modal */}
      {inspectorAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-2xl max-h-[90vh] overflow-y-auto text-[var(--foreground)]">
            <button
              onClick={() => setInspectorAgent(null)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3 pb-4 border-b border-[var(--border)]">
              <span className="text-3xl">{inspectorAgent.icon}</span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-[var(--foreground)]">
                    {inspectorAgent.name}
                  </h3>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                    style={{
                      backgroundColor: `${inspectorAgent.color}20`,
                      color: inspectorAgent.color,
                    }}
                  >
                    {inspectorAgent.badge}
                  </span>
                </div>
                <p className="text-xs text-[var(--muted-foreground)]">{inspectorAgent.role}</p>
              </div>
            </div>

            <div className="mt-4 space-y-4 text-xs text-[var(--secondary-foreground)]">
              <div>
                <p className="font-semibold text-[var(--foreground)] mb-1">Description :</p>
                <p className="leading-relaxed bg-[var(--surface)] p-3 rounded-lg border border-[var(--border)] text-[var(--foreground)]">
                  {inspectorAgent.description}
                </p>
              </div>

              <div>
                <div className="flex items-center gap-1.5 font-semibold text-[var(--foreground)] mb-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-[var(--primary)]" />
                  <span>Capacités & Fonctionnalités :</span>
                </div>
                <ul className="space-y-1 pl-4 list-disc marker:text-[var(--primary)] text-[var(--foreground)]">
                  {inspectorAgent.capabilities.map((cap, i) => (
                    <li key={i}>{cap}</li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="flex items-center gap-1.5 font-semibold text-[var(--foreground)] mb-1.5">
                  <Wrench className="h-3.5 w-3.5 text-[var(--primary)]" />
                  <span>Outils OpenCode assignés :</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {inspectorAgent.tools.map((tool) => (
                    <span
                      key={tool}
                      className="rounded-md bg-[var(--surface)] border border-[var(--border)] px-2 py-1 font-mono text-[11px] font-medium text-[var(--foreground)]"
                    >
                      {tool}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <p className="font-semibold text-[var(--foreground)] mb-1">Quand l&apos;utiliser :</p>
                <p className="text-[var(--foreground)] italic bg-[var(--surface)] p-2.5 rounded-lg border border-[var(--border)]">
                  {inspectorAgent.whenToUse}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInspectorAgent(null)}
                className="border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
              >
                Fermer
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  onAgentChange(inspectorAgent.id);
                  setInspectorAgent(null);
                }}
                className="bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90"
              >
                Sélectionner cet agent
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
