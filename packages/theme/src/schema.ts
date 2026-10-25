/**
 * Theme schema types — port of opencode's theme schema, converted from Effect Schema to plain TS.
 * Defines the ThemeDocument → ThemeDefinition → ThemeTokensDefinition hierarchy.
 */

export type HueStep = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
export const HUE_STEPS: readonly HueStep[] = [100, 200, 300, 400, 500, 600, 700, 800, 900];

export type SemanticHue = "accent" | "interactive" | "neutral";
export const SEMANTIC_HUES: readonly SemanticHue[] = ["accent", "interactive", "neutral"];

export type ActionVariant = "primary" | "secondary" | "destructive";
export const ACTION_VARIANTS: readonly ActionVariant[] = ["primary", "secondary", "destructive"];

export type ActionState = "disabled" | "pressed" | "focused" | "selected" | "hovered";
export const ACTION_STATES: readonly ActionState[] = ["disabled", "pressed", "focused", "selected", "hovered"];
export type ActionStateKey = `$${ActionState}`;

export type SurfaceName = "dialog";
export type FormfieldState = ActionState;
export type FeedbackKind = "error" | "warning" | "success" | "info";
export const FEEDBACK_KINDS: readonly FeedbackKind[] = ["error", "warning", "success", "info"];

export type Mode = "light" | "dark";

export type HexColor = string;
export type ColorValue = string;

export type HueName = string;

/** A hue value is either an alias string "$hue.other" or a full 9-step scale. */
export type HueValueDefinition = string | Partial<Record<HueStep, HexColor>>;
export type HueDefinition = Record<string, HueValueDefinition> &
  Readonly<Record<SemanticHue, HueValueDefinition>>;

export type CategoricalDefinition = HueName[];

export interface StatefulColorDefinition {
  base?: ColorValue;
  $hovered?: ColorValue;
  $focused?: ColorValue;
  $pressed?: ColorValue;
  $selected?: ColorValue;
  $disabled?: ColorValue;
}

export interface ActionColorDefinition {
  primary?: StatefulColorDefinition;
  secondary?: StatefulColorDefinition;
  destructive?: StatefulColorDefinition;
}

export interface FeedbackTextDefinition {
  base?: ColorValue;
  muted?: ColorValue;
}

export interface TextDefinition {
  base?: ColorValue;
  muted?: ColorValue;
  action?: ActionColorDefinition;
  formfield?: StatefulColorDefinition;
  feedback?: Partial<Record<FeedbackKind, FeedbackTextDefinition>>;
}

export interface BackgroundRaisedDefinition {
  base?: ColorValue;
  high?: ColorValue;
  max?: ColorValue;
}

export interface FeedbackBackgroundDefinition {
  base?: ColorValue;
}

export interface BackgroundDefinition {
  base?: ColorValue;
  raised?: BackgroundRaisedDefinition;
  action?: ActionColorDefinition;
  formfield?: StatefulColorDefinition;
  feedback?: Partial<Record<FeedbackKind, FeedbackBackgroundDefinition>>;
}

export type SyntaxToken =
  | "comment" | "keyword" | "function" | "variable" | "string"
  | "number" | "type" | "operator" | "punctuation";
export type SyntaxDefinition = Partial<Record<SyntaxToken, ColorValue>>;

export type MarkdownToken =
  | "text" | "heading" | "link" | "linkText" | "code" | "blockQuote"
  | "emphasis" | "strong" | "horizontalRule" | "listItem" | "listEnumeration"
  | "image" | "imageText" | "codeBlock";
export type MarkdownDefinition = Partial<Record<MarkdownToken, ColorValue>>;

export interface DiffDefinition {
  text?: { added?: ColorValue; removed?: ColorValue; context?: ColorValue; hunkHeader?: ColorValue };
  background?: { added?: ColorValue; removed?: ColorValue; context?: ColorValue };
  highlight?: { added?: ColorValue; removed?: ColorValue };
  lineNumber?: { text?: ColorValue; background?: { added?: ColorValue; removed?: ColorValue } };
}

export interface ThemeTokensDefinition {
  text?: TextDefinition;
  background?: BackgroundDefinition;
  border?: { base?: ColorValue };
  scrollbar?: { base?: ColorValue };
  diff?: DiffDefinition;
  syntax?: SyntaxDefinition;
  markdown?: MarkdownDefinition;
}

export interface ThemeDefinition extends ThemeTokensDefinition {
  hue: HueDefinition;
  categorical: CategoricalDefinition;
  "@dialog"?: ThemeTokensDefinition;
}

export interface BaseThemeDefinition extends ThemeTokensDefinition {
  categorical: CategoricalDefinition;
  "@dialog"?: ThemeTokensDefinition;
}

export interface ModeDefinition extends ThemeTokensDefinition {
  hue: HueDefinition;
  categorical?: CategoricalDefinition;
  "@dialog"?: ThemeTokensDefinition;
}

export interface ThemeDocument {
  $schema?: string;
  base: BaseThemeDefinition;
  light?: ModeDefinition;
  dark?: ModeDefinition;
}

export type { Mode as ThemeMode };
