"use client";

import { useState } from "react";
import {
  X,
  Palette,
  Code2,
  Terminal as TerminalIcon,
  Cloud,
  GitBranch,
  Cpu,
  Boxes,
  Info,
  Check,
  RotateCcw,
  Sun,
  Moon,
  Laptop,
  Sliders,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Activity,
} from "lucide-react";
import { useTheme } from "@/lib/theme/theme-context";
import { COLOR_THEMES, ACCENT_PALETTES } from "@/lib/theme/palettes";
import { ColorTheme, AccentColor, ThemeMode, UiDensity } from "@/lib/theme/types";
import { ProviderDiagnosticsView } from "./provider-diagnostics-view";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCategory?: string;
}

type SettingsCategory =
  | "appearance"
  | "editor"
  | "terminal"
  | "environment"
  | "git"
  | "ai"
  | "providers"
  | "about";

export function SettingsPanel({ isOpen, onClose, defaultCategory = "appearance" }: SettingsPanelProps) {
  const { preferences, updatePreferences, resetPreferences, resolvedIsDark } = useTheme();
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>(
    (defaultCategory as SettingsCategory) || "appearance"
  );
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);

  if (!isOpen) return null;

  const categories: Array<{ id: SettingsCategory; label: string; description: string; icon: React.ReactNode }> = [
    {
      id: "appearance",
      label: "Appearance",
      description: "Thèmes, couleurs, accents, mode sombre et typographie",
      icon: <Palette className="h-4 w-4" />,
    },
    {
      id: "editor",
      label: "Editor",
      description: "Monaco Editor, indentation, mini-map et options",
      icon: <Code2 className="h-4 w-4" />,
    },
    {
      id: "terminal",
      label: "Terminal",
      description: "PTY, polices monospace et configurations du shell",
      icon: <TerminalIcon className="h-4 w-4" />,
    },
    {
      id: "environment",
      label: "Environment",
      description: "Codespaces, Docker, sandboxes et runtime",
      icon: <Cloud className="h-4 w-4" />,
    },
    {
      id: "git",
      label: "Git & Version Control",
      description: "Branches, authentification GitHub et synchronisation",
      icon: <GitBranch className="h-4 w-4" />,
    },
    {
      id: "ai",
      label: "AI & Agents",
      description: "Modèles d'inférence, OpenCode agents et streaming",
      icon: <Cpu className="h-4 w-4" />,
    },
    {
      id: "providers",
      label: "Cloud & Sandboxes",
      description: "Gestionnaires de clés API et diagnostics cloud",
      icon: <Boxes className="h-4 w-4" />,
    },
    {
      id: "about",
      label: "About SoryOS-Code",
      description: "Informations sur le système et versions",
      icon: <Info className="h-4 w-4" />,
    },
  ];

  const handleResetConfirm = () => {
    resetPreferences();
    setResetModalOpen(false);
  };

  const colorThemesList: ColorTheme[] = [
    "soryos",
    "midnight",
    "ocean",
    "forest",
    "violet",
    "rose",
    "amber",
    "custom",
  ];

  const accentColorsList: AccentColor[] = [
    "blue",
    "purple",
    "cyan",
    "green",
    "orange",
    "red",
    "pink",
  ];

  const customColorsMap = (preferences.customColors as unknown as Record<string, string>) || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative flex flex-col w-full max-w-4xl max-h-[90vh] bg-[var(--surface)] text-[var(--foreground)] rounded-2xl shadow-2xl border border-[var(--border)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--surface-elevated)]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] shadow-md">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">Settings & Configuration</h2>
              <p className="text-xs text-[var(--muted-foreground)]">
                Centre de contrôle global de SoryOS-Code Workbench
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] rounded-lg transition cursor-pointer"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body Split */}
        <div className="flex flex-1 min-h-0 flex-col sm:flex-row overflow-hidden">
          {/* Mobile Category Card List (shown on mobile when not viewing a detail) */}
          <div className={`flex-1 overflow-y-auto p-4 space-y-2.5 sm:hidden ${mobileDetailOpen ? "hidden" : "block"}`}>
            <div className="px-1 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
              Rubriques de Configuration
            </div>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveCategory(cat.id);
                  setMobileDetailOpen(true);
                }}
                className="flex w-full items-center justify-between p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] transition cursor-pointer active:scale-[0.99] text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
                    {cat.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-[var(--foreground)] truncate">{cat.label}</div>
                    <div className="text-xs text-[var(--muted-foreground)] line-clamp-1">{cat.description}</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-[var(--muted-foreground)] shrink-0 ml-2" />
              </button>
            ))}
          </div>

          {/* Desktop Sidebar Navigation */}
          <div className="hidden sm:block w-64 shrink-0 border-r border-[var(--border)] bg-[var(--surface-elevated)] p-3 space-y-1 overflow-y-auto">
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
              Rubriques
            </div>
            {categories.map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setActiveCategory(cat.id);
                    setMobileDetailOpen(true);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold transition cursor-pointer ${
                    isActive
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm"
                      : "text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {cat.icon}
                    <span className="truncate">{cat.label}</span>
                  </div>
                  <ChevronRight className={`h-3 w-3 shrink-0 transition-transform ${isActive ? "opacity-100" : "opacity-0"}`} />
                </button>
              );
            })}
          </div>

          {/* Main Content Pane */}
          <div className={`flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-6 ${!mobileDetailOpen ? "hidden sm:block" : "block"}`}>
            {/* Mobile Back to Categories Header */}
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-[var(--border)] sm:hidden">
              <button
                onClick={() => setMobileDetailOpen(false)}
                className="flex items-center gap-1.5 text-xs font-bold text-[var(--primary)] hover:underline cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Retour aux rubriques</span>
              </button>
              <span className="text-xs font-bold text-[var(--foreground)]">
                {categories.find((c) => c.id === activeCategory)?.label}
              </span>
            </div>
            {/* 1. APPEARANCE */}
            {activeCategory === "appearance" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
                  <div>
                    <h3 className="text-base font-bold">Appearance & Themes</h3>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      Personnalisez l&apos;interface visuelle, les palettes de couleurs et l&apos;accentuation.
                    </p>
                  </div>
                  <button
                    onClick={() => setResetModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] text-xs font-semibold transition cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                    <span>Reset Appearance</span>
                  </button>
                </div>

                {/* Theme Mode */}
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                    Mode d&apos;affichage (Theme Mode)
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: "light" as ThemeMode, label: "Light", icon: <Sun className="h-4 w-4" /> },
                      { id: "dark" as ThemeMode, label: "Dark", icon: <Moon className="h-4 w-4" /> },
                      { id: "system" as ThemeMode, label: "System", icon: <Laptop className="h-4 w-4" /> },
                    ].map((m) => (
                      <button
                        key={m.id}
                        onClick={() => updatePreferences({ theme: m.id })}
                        className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                          preferences.theme === m.id
                            ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)] shadow-sm"
                            : "border-[var(--border)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)]"
                        }`}
                      >
                        {m.icon}
                        <span>{m.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color Themes Cards */}
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                    Palette de couleurs (Color Theme)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {colorThemesList.map((ct) => {
                      const family = COLOR_THEMES[ct];
                      const isSelected = preferences.colorTheme === ct;
                      const previewTokens = resolvedIsDark ? family.dark : family.light;

                      return (
                        <div
                          key={ct}
                          onClick={() => updatePreferences({ colorTheme: ct })}
                          className={`group relative flex flex-col rounded-xl border p-3.5 transition cursor-pointer ${
                            isSelected
                              ? "border-[var(--primary)] ring-2 ring-[var(--primary)]/30 bg-[var(--surface-elevated)]"
                              : "border-[var(--border)] bg-[var(--surface-elevated)] hover:border-[var(--muted-foreground)] hover:bg-[var(--surface-hover)]"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold capitalize">{family.name}</span>
                            {isSelected && (
                              <div className="h-5 w-5 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] flex items-center justify-center shadow-xs">
                                <Check className="h-3 w-3" />
                              </div>
                            )}
                          </div>

                          {/* Mini Swatches Preview */}
                          <div className="flex items-center gap-1.5 mt-1">
                            <div
                              className="h-4 w-4 rounded-full border border-black/10 shadow-xs"
                              style={{ backgroundColor: previewTokens.background }}
                              title="Background"
                            />
                            <div
                              className="h-4 w-4 rounded-full border border-black/10 shadow-xs"
                              style={{ backgroundColor: previewTokens.surface }}
                              title="Surface"
                            />
                            <div
                              className="h-4 w-4 rounded-full border border-black/10 shadow-xs"
                              style={{ backgroundColor: previewTokens.primary }}
                              title="Primary"
                            />
                            <div
                              className="h-4 w-4 rounded-full border border-black/10 shadow-xs"
                              style={{ backgroundColor: previewTokens.accent }}
                              title="Accent"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Accent Color */}
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                    Couleur d&apos;accentuation (Accent Color)
                  </label>
                  <div className="flex flex-wrap items-center gap-3">
                    {accentColorsList.map((ac) => {
                      const palette = ACCENT_PALETTES[ac];
                      const isSelected = preferences.accentColor === ac;
                      return (
                        <button
                          key={ac}
                          onClick={() => updatePreferences({ accentColor: ac })}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold capitalize transition cursor-pointer ${
                            isSelected
                              ? "border-[var(--foreground)] bg-[var(--surface-elevated)] shadow-sm"
                              : "border-[var(--border)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)]"
                          }`}
                        >
                          <span
                            className="h-4 w-4 rounded-full shadow-xs"
                            style={{ backgroundColor: palette.primary }}
                          />
                          <span>{ac}</span>
                          {isSelected && <Check className="h-3 w-3 ml-1" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Colors Section (if Custom active) */}
                {preferences.colorTheme === "custom" && (
                  <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
                      Configuration du Thème Customisé
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                      {[
                        { key: "background", label: "Background" },
                        { key: "surface", label: "Surface" },
                        { key: "foreground", label: "Foreground" },
                        { key: "primary", label: "Primary" },
                        { key: "accent", label: "Accent" },
                        { key: "border", label: "Border" },
                      ].map((c) => (
                        <div key={c.key} className="space-y-1">
                          <label className="font-semibold block text-[var(--muted-foreground)]">
                            {c.label}
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={
                                customColorsMap[c.key] || (resolvedIsDark ? "#0d1117" : "#ffffff")
                              }
                              onChange={(e) =>
                                updatePreferences({
                                  customColors: {
                                    background: "#0d1117",
                                    surface: "#161b22",
                                    foreground: "#f0f6fc",
                                    primary: "#c6623f",
                                    accent: "#df7450",
                                    border: "#30363d",
                                    ...(preferences.customColors || {}),
                                    [c.key]: e.target.value,
                                  },
                                })
                              }
                              className="h-7 w-10 rounded border border-[var(--border)] cursor-pointer bg-transparent p-0"
                            />
                            <span className="font-mono text-[11px]">
                              {customColorsMap[c.key] || "—"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* UI Density & Font Size */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                      Densité de l&apos;interface (UI Density)
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["compact", "normal", "comfortable"] as UiDensity[]).map((d) => (
                        <button
                          key={d}
                          onClick={() => updatePreferences({ uiDensity: d })}
                          className={`py-2 rounded-xl border text-xs font-semibold capitalize transition cursor-pointer ${
                            preferences.uiDensity === d
                              ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                              : "border-[var(--border)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)]"
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                      Taille de police (Font Size: {preferences.fontSize}px)
                    </label>
                    <div className="flex items-center gap-3 pt-2">
                      <span className="text-xs text-[var(--muted-foreground)]">12px</span>
                      <input
                        type="range"
                        min="11"
                        max="18"
                        step="1"
                        value={preferences.fontSize}
                        onChange={(e) => updatePreferences({ fontSize: parseInt(e.target.value, 10) })}
                        className="flex-1 accent-[var(--primary)] cursor-pointer"
                      />
                      <span className="text-xs text-[var(--muted-foreground)]">18px</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. EDITOR */}
            {activeCategory === "editor" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="border-b border-[var(--border)] pb-4">
                  <h3 className="text-base font-bold">Monaco Editor Configuration</h3>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Paramètres de l&apos;éditeur de code intégré, formatage et coloration syntaxique.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]">
                    <div>
                      <div className="font-bold text-xs text-[var(--foreground)]">Mini-map de l&apos;éditeur</div>
                      <div className="text-[var(--muted-foreground)] text-[11px]">Afficher la vue d&apos;ensemble à droite</div>
                    </div>
                    <input type="checkbox" defaultChecked className="h-4 w-4 accent-[var(--primary)] cursor-pointer" />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]">
                    <div>
                      <div className="font-bold text-xs text-[var(--foreground)]">Formatage à la sauvegarde</div>
                      <div className="text-[var(--muted-foreground)] text-[11px]">Auto-formatter avec Prettier</div>
                    </div>
                    <input type="checkbox" defaultChecked className="h-4 w-4 accent-[var(--primary)] cursor-pointer" />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]">
                    <div>
                      <div className="font-bold text-xs text-[var(--foreground)]">Retour à la ligne (Word Wrap)</div>
                      <div className="text-[var(--muted-foreground)] text-[11px]">Adapter le texte à la largeur</div>
                    </div>
                    <input type="checkbox" defaultChecked className="h-4 w-4 accent-[var(--primary)] cursor-pointer" />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]">
                    <div>
                      <div className="font-bold text-xs text-[var(--foreground)]">Indentation par tabulation</div>
                      <div className="text-[var(--muted-foreground)] text-[11px]">Espaces par niveau de tabulation</div>
                    </div>
                    <select className="bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] rounded-lg px-2.5 py-1 text-xs">
                      <option>2 espaces</option>
                      <option>4 espaces</option>
                    </select>
                  </div>
                </div>

                {/* Visual Editor Preview Card */}
                <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Aperçu du Thème Monaco</div>
                  <div className="p-3 rounded-lg font-mono text-xs bg-[var(--terminal-background)] text-[var(--terminal-foreground)] border border-[var(--border)] space-y-1">
                    <p><span className="text-purple-400">import</span> React <span className="text-purple-400">from</span> <span className="text-emerald-400">&quot;react&quot;</span>;</p>
                    <p><span className="text-blue-400">export function</span> <span className="text-amber-400">App</span>() &#123;</p>
                    <p className="pl-4"><span className="text-purple-400">return</span> &lt;<span className="text-red-400">div</span> <span className="text-sky-400">className</span>=<span className="text-emerald-400">&quot;workbench&quot;</span>&gt;SoryOS-Code&lt;/<span className="text-red-400">div</span>&gt;;</p>
                    <p>&#125;</p>
                  </div>
                </div>
              </div>
            )}

            {/* 3. TERMINAL */}
            {activeCategory === "terminal" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="border-b border-[var(--border)] pb-4">
                  <h3 className="text-base font-bold">Integrated Terminal Settings</h3>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Configuration des PTY, polices de terminal et comportement du shell interactif.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] space-y-2">
                    <div className="font-bold text-xs text-[var(--foreground)]">Police Monospace du Terminal</div>
                    <div className="text-[var(--muted-foreground)] text-[11px]">Sélectionnez la typographie du PTY</div>
                    <select className="w-full bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs">
                      <option>Geist Mono (Défaut)</option>
                      <option>JetBrains Mono</option>
                      <option>Fira Code</option>
                    </select>
                  </div>

                  <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] space-y-2">
                    <div className="font-bold text-xs text-[var(--foreground)]">Shell par défaut</div>
                    <div className="text-[var(--muted-foreground)] text-[11px]">Interpréteur de commandes initial</div>
                    <select className="w-full bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs">
                      <option>/bin/bash</option>
                      <option>/bin/sh</option>
                      <option>/bin/zsh</option>
                    </select>
                  </div>
                </div>

                {/* Terminal Visual Preview */}
                <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Aperçu Visuel de l&apos;Invite</div>
                  <div className="p-3.5 rounded-lg font-mono text-xs bg-[var(--terminal-background)] text-[var(--terminal-foreground)] border border-[var(--border)]">
                    <span className="text-emerald-500 font-bold">user@codespace</span>
                    <span className="text-[var(--primary)] font-bold"> ➜ </span>
                    <span className="text-sky-500 font-bold">/workspaces/project</span>
                    <span className="text-amber-500 font-bold"> (main*)</span>
                    <span className="text-[var(--terminal-foreground)] font-bold"> $ </span>
                    <span className="text-slate-400">git status</span>
                  </div>
                </div>
              </div>
            )}

            {/* 4. ENVIRONMENT */}
            {activeCategory === "environment" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="border-b border-[var(--border)] pb-4">
                  <h3 className="text-base font-bold">Runtime Environment & Sandboxes</h3>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    État des conteneurs d&apos;exécution, micro-VMs et backends actifs.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] space-y-2">
                    <span className="text-xs font-bold text-[var(--muted-foreground)] uppercase">Environnement Actif</span>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="font-bold text-sm text-[var(--foreground)]">GitHub Codespaces</span>
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)]">Synchronisation bidirectionnelle du filesystem active</p>
                  </div>

                  <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] space-y-2">
                    <span className="text-xs font-bold text-[var(--muted-foreground)] uppercase">Moteur de Preview</span>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                      <span className="font-bold text-sm text-[var(--foreground)]">Port 3000 Web Preview</span>
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)]">Serveur de développement Next.js & Vite intégré</p>
                  </div>
                </div>
              </div>
            )}

            {/* 5. GIT */}
            {activeCategory === "git" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="border-b border-[var(--border)] pb-4">
                  <h3 className="text-base font-bold">Git & Version Control</h3>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Gestion des branches, identité de commit et synchronisation GitHub.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] space-y-3 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                    <span className="text-[var(--muted-foreground)]">Identité Git</span>
                    <span className="font-mono font-semibold text-[var(--foreground)]">SoryOS Developer &lt;developer@soryos.internal&gt;</span>
                  </div>
                  <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                    <span className="text-[var(--muted-foreground)]">Branche par défaut</span>
                    <span className="font-mono font-semibold text-amber-500">main</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--muted-foreground)]">Suivi de version</span>
                    <span className="font-semibold text-emerald-600">Git natif (Codespaces Remote)</span>
                  </div>
                </div>
              </div>
            )}

            {/* 6. AI / AGENT */}
            {activeCategory === "ai" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="border-b border-[var(--border)] pb-4">
                  <h3 className="text-base font-bold">AI & OpenCode Agents</h3>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Configuration des agents autonomes et des modèles de raisonnement.
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] space-y-3 text-xs mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--muted-foreground)]">Modèle par défaut</span>
                    <span className="font-mono font-semibold text-[var(--primary)]">Gemini 2.5 Flash / Pro (Google AI Studio)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--muted-foreground)]">Chaîne d&apos;inférence</span>
                    <span className="text-emerald-600 font-semibold">Streaming SSE natif sans mock</span>
                  </div>
                </div>
                <ProviderDiagnosticsView defaultProviderId="google" />
              </div>
            )}

            {/* 7. PROVIDERS */}
            {activeCategory === "providers" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="border-b border-[var(--border)] pb-4">
                  <h3 className="text-base font-bold">Cloud Providers & Diagnostics</h3>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Gestion des clés d&apos;API pour Google Gemini, OpenAI, Mistral, OpenRouter, OpenCode Zen, DeepSeek, E2B et Vercel.
                  </p>
                </div>
                <ProviderDiagnosticsView defaultProviderId="google" />
              </div>
            )}

            {/* 8. ABOUT */}
            {activeCategory === "about" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="border-b border-[var(--border)] pb-4">
                  <h3 className="text-base font-bold">About SoryOS-Code</h3>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Informations sur la version et l&apos;architecture de l&apos;application.
                  </p>
                </div>
                <div className="p-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] space-y-4 text-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                    <div>
                      <h4 className="font-bold text-sm text-[var(--foreground)]">SoryOS-Code Workbench</h4>
                      <p className="text-[var(--muted-foreground)] text-[11px]">Plateforme IA pour génération et exécution de code</p>
                    </div>
                    <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-xs font-bold text-emerald-600">
                      v3.0 Production
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                      <div className="text-[10px] font-bold uppercase text-[var(--muted-foreground)]">Architecture</div>
                      <div className="font-semibold text-xs text-[var(--foreground)] mt-0.5">Next.js 15 + React 19</div>
                    </div>
                    <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                      <div className="text-[10px] font-bold uppercase text-[var(--muted-foreground)]">Sandboxes</div>
                      <div className="font-semibold text-xs text-[var(--foreground)] mt-0.5">Codespaces + E2B + PTY</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {resetModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border)] p-6 space-y-4 shadow-2xl">
            <h4 className="text-base font-bold">Confirmer la réinitialisation ?</h4>
            <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
              Ceci va restaurer les paramètres d&apos;apparence par défaut (Thème Système, SoryOS, Accent Bleu).
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setResetModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[var(--border)] text-xs font-semibold hover:bg-[var(--surface-hover)] transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={handleResetConfirm}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition cursor-pointer shadow-md"
              >
                Réinitialiser
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
