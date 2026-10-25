"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useSyncExternalStore } from "react";
import { AppearancePreferences } from "./types";
import { COLOR_THEMES, ACCENT_PALETTES } from "./palettes";

const STORAGE_KEY = "soryos_appearance_preferences";

const DEFAULT_PREFERENCES: AppearancePreferences = {
  theme: "system",
  colorTheme: "soryos",
  accentColor: "blue",
  uiDensity: "normal",
  fontSize: 14,
};

interface ThemeContextType {
  preferences: AppearancePreferences;
  resolvedIsDark: boolean;
  mounted: boolean;
  updatePreferences: (partial: Partial<AppearancePreferences>) => void;
  resetPreferences: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  preferences: DEFAULT_PREFERENCES,
  resolvedIsDark: false,
  mounted: false,
  updatePreferences: () => {},
  resetPreferences: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const mounted = useSyncExternalStore(
    useCallback(() => () => {}, []),
    () => true,
    () => false,
  );
  const [preferences, setPreferences] = useState<AppearancePreferences>(() => {
    if (typeof window === "undefined") return DEFAULT_PREFERENCES;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_PREFERENCES, ...JSON.parse(saved) };
      }
    } catch {
      // ignore
    }
    return DEFAULT_PREFERENCES;
  });

  const systemIsDark = useSyncExternalStore(
    useCallback((callback) => {
      if (typeof window === "undefined") return () => {};
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", callback);
      return () => mq.removeEventListener("change", callback);
    }, []),
    () => typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches,
    () => false,
  );

  const resolvedIsDark =
    preferences.theme === "dark" || (preferences.theme === "system" && systemIsDark);

  // Apply CSS variables to document root
  useEffect(() => {
    const root = document.documentElement;
    const themeFamily = COLOR_THEMES[preferences.colorTheme] || COLOR_THEMES.soryos;
    const tokens = resolvedIsDark ? themeFamily.dark : themeFamily.light;
    const accent = ACCENT_PALETTES[preferences.accentColor] || ACCENT_PALETTES.blue;

    // Custom overrides if custom theme is selected
    const custom = preferences.colorTheme === "custom" && preferences.customColors ? preferences.customColors : null;

    root.style.setProperty("--background", custom?.background || tokens.background);
    root.style.setProperty("--background-secondary", tokens.surface);
    root.style.setProperty("--surface", custom?.surface || tokens.surface);
    root.style.setProperty("--surface-secondary", tokens.surfaceElevated);
    root.style.setProperty("--surface-elevated", tokens.surfaceElevated);
    root.style.setProperty("--surface-hover", tokens.surfaceHover);
    root.style.setProperty("--surface-active", tokens.surfaceActive || tokens.surfaceHover);
    root.style.setProperty("--foreground", custom?.foreground || tokens.textPrimary);
    root.style.setProperty("--foreground-secondary", tokens.textSecondary);
    root.style.setProperty("--card", tokens.surfaceElevated);
    root.style.setProperty("--card-foreground", custom?.foreground || tokens.textPrimary);
    root.style.setProperty("--popover", tokens.surfaceElevated);
    root.style.setProperty("--popover-foreground", custom?.foreground || tokens.textPrimary);
    root.style.setProperty("--primary", custom?.primary || accent.primary);
    root.style.setProperty("--primary-foreground", tokens.primaryFg);
    root.style.setProperty("--secondary", tokens.surface);
    root.style.setProperty("--secondary-foreground", tokens.textSecondary);
    root.style.setProperty("--muted", tokens.surfaceElevated);
    root.style.setProperty("--muted-foreground", tokens.textMuted);
    root.style.setProperty("--accent", custom?.accent || accent.accent);
    root.style.setProperty("--accent-foreground", tokens.accentFg);
    root.style.setProperty("--destructive", tokens.error);
    root.style.setProperty("--border", custom?.border || tokens.border);
    root.style.setProperty("--border-subtle", tokens.borderSubtle || tokens.border);
    root.style.setProperty("--input", tokens.inputBg || tokens.surfaceElevated);
    root.style.setProperty("--composer-background", tokens.inputBg || tokens.surfaceElevated);
    root.style.setProperty("--ring", accent.ring);
    root.style.setProperty("--terminal-background", tokens.terminalBg);
    root.style.setProperty("--terminal-foreground", tokens.terminalFg);
    root.style.setProperty("--editor-background", tokens.editorBg);
    root.style.setProperty("--editor-foreground", tokens.editorFg);
    root.style.setProperty("--sidebar-background", tokens.sidebarBg);
    root.style.setProperty("--sidebar-foreground", tokens.sidebarFg);
    root.style.setProperty("--selection", tokens.selection);

    // Font size & UI density
    root.style.setProperty("--app-font-size", `${preferences.fontSize}px`);

    if (resolvedIsDark) {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.remove("dark");
      root.classList.add("light");
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // ignore
    }
  }, [preferences, resolvedIsDark]);

  const updatePreferences = useCallback((partial: Partial<AppearancePreferences>) => {
    setPreferences((prev) => ({ ...prev, ...partial }));
  }, []);

  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
  }, []);

  return (
    <ThemeContext.Provider value={{ preferences, resolvedIsDark, mounted, updatePreferences, resetPreferences }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
