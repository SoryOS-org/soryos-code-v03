/**
 * @soryos/theme — Theme token schema, resolution, and OKLCH color utilities.
 * Port of opencode's @opencode/theme (schema → expand → resolve pipeline).
 */

export {
  HUE_STEPS,
  SEMANTIC_HUES,
  ACTION_VARIANTS,
  ACTION_STATES,
  FEEDBACK_KINDS,
} from "./schema.js";

export type {
  HueStep,
  SemanticHue,
  ActionVariant,
  ActionState,
  ActionStateKey,
  SurfaceName,
  FeedbackKind,
  Mode,
  HexColor,
  ColorValue,
  HueName,
  HueValueDefinition,
  HueDefinition,
  CategoricalDefinition,
  StatefulColorDefinition,
  ActionColorDefinition,
  TextDefinition,
  BackgroundDefinition,
  BackgroundRaisedDefinition,
  FeedbackTextDefinition,
  FeedbackBackgroundDefinition,
  SyntaxToken,
  SyntaxDefinition,
  MarkdownToken,
  MarkdownDefinition,
  DiffDefinition,
  ThemeTokensDefinition,
  ThemeDefinition,
  BaseThemeDefinition,
  ModeDefinition,
  ThemeDocument,
} from "./schema.js";

export type {
  ResolvedActionState,
  ResolvedFormfieldState,
  HueScale,
  Hue,
  HueSource,
  Categorical,
  ActionStates,
  StatefulColor,
  FormfieldColor,
  ResolvedThemeTokens,
  ResolvedTheme,
} from "./types.js";

export { RGBA } from "./rgba.js";
export { rgbToOklch, oklchToHex } from "./color.js";
export { expandTheme, expandTokens, mergeTheme } from "./expand.js";
export { selectTheme, selectThemeMode, themeModes, supportsThemeMode } from "./select.js";
export { parseThemeDocument, resolveThemeDocument, resolveTheme, themeDecodeError } from "./resolve.js";
