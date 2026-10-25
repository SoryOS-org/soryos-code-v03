export type ThemeMode = "light" | "dark" | "system";

export type ColorTheme =
  | "soryos"
  | "midnight"
  | "ocean"
  | "forest"
  | "violet"
  | "rose"
  | "amber"
  | "custom";

export type AccentColor =
  | "blue"
  | "purple"
  | "cyan"
  | "green"
  | "orange"
  | "red"
  | "pink";

export type UiDensity = "compact" | "normal" | "comfortable";

export interface CustomThemeColors {
  background: string;
  surface: string;
  foreground: string;
  primary: string;
  accent: string;
  border: string;
}

export interface AppearancePreferences {
  theme: ThemeMode;
  colorTheme: ColorTheme;
  accentColor: AccentColor;
  uiDensity: UiDensity;
  fontSize: number; // in pixels (e.g. 13, 14, 15)
  customColors?: CustomThemeColors;
}

export interface ThemeTokens {
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceHover: string;
  surfaceActive?: string;
  inputBg?: string;
  border: string;
  borderSubtle: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryFg: string;
  accent: string;
  accentFg: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  terminalBg: string;
  terminalFg: string;
  editorBg: string;
  editorFg: string;
  sidebarBg: string;
  sidebarFg: string;
  selection: string;
  ring: string;
}
