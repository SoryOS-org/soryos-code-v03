/**
 * Theme resolution — port of opencode's resolve.ts.
 * Converts a stringly-typed ThemeDefinition into RGBA-based ResolvedTheme.
 * Handles $ reference resolution with cycle detection, hue scales, stateful colors.
 */

import { RGBA } from "./rgba.js";
import { expandTheme, mergeTheme } from "./expand.js";
import {
  ACTION_STATES,
  ACTION_VARIANTS,
  HUE_STEPS,
  type ActionStateKey,
  type HueDefinition,
  type HueStep,
  type Mode,
  type SurfaceName,
  type ThemeDefinition,
  type ThemeDocument,
  type ThemeTokensDefinition,
} from "./schema.js";
import type {
  ActionStates,
  HueScale,
  ResolvedActionState,
  ResolvedTheme,
  ResolvedThemeTokens,
  StatefulColor,
} from "./types.js";
import { selectThemeMode, themeModes } from "./select.js";

type ResolvedHue = Readonly<Record<string, HueScale>>;

export function themeDecodeError(error: unknown, name: string): Error {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`Invalid theme: ${name} ${message}`, { cause: error });
}

/** Parse and eagerly validate a ThemeDocument (resolves every present mode). */
export function parseThemeDocument(input: unknown, name = "theme"): ThemeDocument {
  try {
    const document = input as ThemeDocument;
    if (!document || typeof document !== "object") throw new Error("not an object");
    if (!document.base) throw new Error("missing base");
    themeModes(document).forEach((mode) => resolveThemeDocument(document, mode));
    return document;
  } catch (error) {
    throw themeDecodeError(error, name);
  }
}

export function resolveThemeDocument(document: ThemeDocument, mode?: Mode): ResolvedTheme {
  const selected = selectThemeMode(document, mode);
  const definition = expandTheme(selected.theme);
  return resolveExpandedTheme(definition);
}

export function resolveTheme(definition: ThemeDefinition): ResolvedTheme {
  return resolveExpandedTheme(expandTheme(definition));
}

function resolveExpandedTheme(definition: ThemeDefinition): ResolvedTheme {
  const hue = resolveHue(definition.hue) as ResolvedThemeTokens["hue"];
  const categorical = (definition.categorical ?? []).map((name) => {
    const scale = hue[name];
    if (!scale) throw new Error(`Categorical hue "${name}" was not found`);
    return scale;
  });
  const hueSteps = compileHueSteps(hue);
  const base = tokens(definition);
  const views = {} as Record<SurfaceName, ResolvedTheme>;
  const view = (toks: ThemeTokensDefinition): ResolvedTheme => ({
    ...resolveView(toks, hue, categorical, hueSteps),
    surface: (name) => views[name],
  });
  views.dialog = definition["@dialog"] ? view(contextualize(base, definition["@dialog"])) : view(base);
  return view(base);
}

function tokens(definition: ThemeDefinition): ThemeTokensDefinition {
  return {
    text: definition.text,
    background: definition.background,
    border: definition.border,
    scrollbar: definition.scrollbar,
    diff: definition.diff,
    syntax: definition.syntax,
    markdown: definition.markdown,
  };
}

function contextualize(base: ThemeTokensDefinition, override: ThemeTokensDefinition): ThemeTokensDefinition {
  const result = mergeTheme(base, override);
  const text = result["text"] as NonNullable<ThemeTokensDefinition["text"]>;
  const background = result["background"] as NonNullable<ThemeTokensDefinition["background"]>;
  return {
    ...result,
    text: { ...text, action: contextualActions(base.text?.action, override.text?.action) },
    background: { ...background, action: contextualActions(base.background?.action, override.background?.action) },
  } as ThemeTokensDefinition;
}

function contextualActions(
  base: Record<string, any> | undefined,
  surface: Record<string, any> | undefined,
): Record<string, any> {
  return Object.fromEntries(
    ACTION_VARIANTS.map((variant) => {
      const baseVariant = base?.[variant];
      const surfaceVariant = surface?.[variant];
      return [
        variant,
        Object.fromEntries(
          (["base", ...ACTION_STATES] as readonly ResolvedActionState[]).map((state) => {
            const key = state === "base" ? undefined : (`$${state}` as ActionStateKey);
            return [
              key ?? "base",
              (key ? surfaceVariant?.[key] : undefined) ??
                surfaceVariant?.base ??
                (key ? baseVariant?.[key] : undefined) ??
                baseVariant?.base,
            ];
          }),
        ),
      ];
    }),
  );
}

function resolveView(
  definition: ThemeTokensDefinition,
  hue: ResolvedThemeTokens["hue"],
  categorical: ResolvedThemeTokens["categorical"],
  hueSteps: Pick<ResolvedThemeTokens, "source" | "increase" | "decrease">,
): ResolvedThemeTokens {
  const source: Record<string, unknown> = { hue, ...definition };
  const resolved = createResolver(source)(source, "theme") as unknown as ResolvedThemeTokens;
  return {
    ...resolved,
    hue,
    categorical,
    text: {
      ...resolved.text,
      action: statefulActions(resolved.text?.action as any),
      formfield: statefulColor(resolved.text?.formfield as any),
      feedback: resolved.text?.feedback,
    },
    background: {
      ...resolved.background,
      action: statefulActions(resolved.background?.action as any),
      formfield: statefulColor(resolved.background?.formfield as any),
      feedback: resolved.background?.feedback,
    },
    ...hueSteps,
  };
}

function statefulActions(actions: Record<string, StatefulColor> | undefined): Readonly<Record<string, StatefulColor>> {
  if (!actions) return {} as Record<string, StatefulColor>;
  return Object.fromEntries(
    ACTION_VARIANTS.map((variant) => [variant, statefulColor(actions[variant])]),
  );
}

function statefulColor(color: StatefulColor): StatefulColor {
  if (!color) return color;
  return {
    ...color,
    state: (states: ActionStates) =>
      color[ACTION_STATES.find((state) => states[state]) ?? "base"] ?? color.base,
  };
}

function compileHueSteps(
  hue: ResolvedHue,
): Pick<ResolvedThemeTokens, "source" | "increase" | "decrease"> {
  const index = new WeakMap<RGBA, { hue: string; step: HueStep; position: number }>();
  for (const [name, scale] of Object.entries(hue)) {
    HUE_STEPS.forEach((step, position) => {
      const color = (scale as Record<number, RGBA>)[step];
      if (color instanceof RGBA) index.set(color, { hue: name, step, position });
    });
  }
  const shift = (color: RGBA, amount: number) => {
    const match = index.get(color);
    if (!match) return color;
    const offset = Number.isFinite(amount) ? Math.trunc(amount) : 0;
    const position = Math.max(0, Math.min(HUE_STEPS.length - 1, match.position + offset));
    return (hue[match.hue] as Record<number, RGBA>)[HUE_STEPS[position]];
  };
  return {
    source: (color) => {
      const match = index.get(color);
      return match ? { hue: match.hue, step: match.step } : undefined;
    },
    increase: (color, amount = 1) => shift(color, amount),
    decrease: (color, amount = 1) => shift(color, -amount),
  };
}

function resolveHue(definition: HueDefinition): ResolvedHue {
  const source = definition as Record<string, unknown>;
  const cache = new Map<string, HueScale>();

  function resolve(name: string, stack: string[]): HueScale {
    const hit = cache.get(name);
    if (hit) return hit;
    if (stack.includes(name)) throw new Error(`Circular hue reference: ${[...stack, name].join(" -> ")}`);
    const value = source[name];
    if (typeof value === "string") {
      const match = /^\$hue\.(.+)$/.exec(value);
      if (!match?.[1]) throw new Error(`Hue alias "${value}" must reference a hue scale`);
      if (source[match[1]] === undefined) throw new Error(`Hue alias "${value}" references a missing hue`);
      const target = resolve(match[1], [...stack, name]);
      const result = Object.fromEntries(
        HUE_STEPS.map((step) => [step, RGBA.clone((target as Record<number, RGBA>)[step])]),
      ) as HueScale;
      cache.set(name, result);
      return result;
    }
    if (typeof value !== "object" || value === null) throw new Error(`Hue "${name}" was not found`);
    const record = value as Record<number, unknown>;
    const result = Object.fromEntries(
      HUE_STEPS.map((step) => {
        const color = record[step];
        if (typeof color !== "string" || !isHex(color)) throw new Error(`Invalid hue color at "hue.${name}.${step}"`);
        return [step, RGBA.fromHex(color)];
      }),
    ) as HueScale;
    for (const step of Object.keys(record)) {
      if (!HUE_STEPS.includes(Number(step) as HueStep))
        throw new Error(`Unknown hue step at "hue.${name}.${step}"`);
    }
    cache.set(name, result);
    return result;
  }

  return Object.fromEntries(Object.keys(source).map((name) => [name, resolve(name, [])])) as ResolvedHue;
}

function createResolver(source: Record<string, unknown>) {
  const cache = new Map<string, RGBA>();

  function resolve(value: unknown, path: string, stack: string[] = []): unknown {
    if (value instanceof RGBA) return value;
    if (value === undefined || value === null) return value;
    if (typeof value === "string") return resolveColor(value, path, stack);
    if (typeof value === "number") return value;
    if (!isRecord(value)) throw new Error(`Invalid theme value at "${path}"`);
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [resolvedKey(key), resolve(item, `${path}.${key}`, stack)]),
    );
  }

  function resolveColor(value: string, path: string, stack: string[]): RGBA {
    if (value === "transparent") return RGBA.fromInts(0, 0, 0, 0);
    if (isHex(value)) return RGBA.fromHex(value);
    if (!value.startsWith("$")) throw new Error(`Invalid color "${value}" at "${path}"`);
    const target = value.slice(1);
    const hit = cache.get(target);
    if (hit) return hit;
    if (stack.includes(target)) throw new Error(`Circular theme reference: ${[...stack, target].join(" -> ")}`);
    const result = resolve(readColor(source, target), target, [...stack, target]);
    if (!(result instanceof RGBA)) throw new Error(`Theme reference "${value}" at "${path}" is not a color`);
    cache.set(target, result);
    return result;
  }

  return (value: unknown, path: string) => resolve(value, path);
}

function readColor(source: Record<string, unknown>, path: string): unknown {
  const match = /^hue\.(.+)\.(100|200|300|400|500|600|700|800|900)$/.exec(path);
  if (!match?.[1] || !match[2]) return read(source, path);
  const scales = source.hue;
  const scale = isRecord(scales) ? scales[match[1]] : undefined;
  const color = isRecord(scale) ? scale[match[2]] : undefined;
  if (color === undefined) throw new Error(`Theme reference "$${path}" was not found`);
  return color;
}

function resolvedKey(key: string): string {
  if (!key.startsWith("$")) return key;
  const state = key.slice(1);
  return (ACTION_STATES as readonly string[]).includes(state) ? state : key;
}

function read(source: Record<string, unknown>, path: string): unknown {
  const result = path.split(".").reduce<unknown>(
    (value, key) => (isRecord(value) ? value[key] : undefined),
    source,
  );
  if (result === undefined) throw new Error(`Theme reference "$${path}" was not found`);
  return result;
}

function isHex(value: string): boolean {
  return /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof RGBA);
}
