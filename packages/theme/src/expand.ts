/**
 * Theme expansion — port of opencode's expand.ts.
 * Fills implicit defaults as $ references BEFORE resolution so sparse input becomes complete.
 */

import {
  ACTION_STATES,
  type ModeDefinition,
  type StatefulColorDefinition,
  type TextDefinition,
  type BackgroundDefinition,
  type ThemeTokensDefinition,
} from "./schema.js";

export function expandTheme<Definition extends ModeDefinition>(definition: Definition): Definition {
  return {
    ...definition,
    ...expandTokens(definition),
    ...(definition["@dialog"] ? { "@dialog": expandTokens(definition["@dialog"]) } : {}),
  };
}

export function expandTokens(definition: ThemeTokensDefinition): ThemeTokensDefinition {
  return {
    ...definition,
    text: expandText(definition.text),
    background: expandBackground(definition.background),
  };
}

export function mergeTheme(...values: unknown[]): Record<string, unknown> {
  return values.reduce<Record<string, unknown>>((result, value) => {
    if (!isRecord(value)) return result;
    return Object.entries(value).reduce<Record<string, unknown>>((next, [key, item]) => {
      if (item === undefined) return next;
      return {
        ...next,
        [key]: isRecord(item) ? mergeTheme(next[key], item) : item,
      };
    }, result);
  }, {});
}

function expandText(definition: TextDefinition | undefined): TextDefinition | undefined {
  if (!definition) return;
  return {
    ...definition,
    muted: definition.muted ?? (definition.base ? "$text.base" : undefined),
    action: expandActions(definition.action as Partial<Record<string, StatefulColorDefinition>> | undefined, "text.action"),
    formfield: expandFormfield(definition.formfield, "text.formfield"),
    feedback: definition.feedback
      ? Object.fromEntries(
          Object.entries(definition.feedback).map(([kind, feedback]) => [
            kind,
            {
              ...feedback,
              muted: feedback.muted ?? (feedback.base ? `$text.feedback.${kind}.base` : undefined),
            },
          ]),
        )
      : undefined,
  };
}

function expandBackground(definition: BackgroundDefinition | undefined): BackgroundDefinition | undefined {
  if (!definition) return;
  return {
    ...definition,
    action: expandActions(definition.action as Partial<Record<string, StatefulColorDefinition>> | undefined, "background.action"),
    formfield: expandFormfield(definition.formfield, "background.formfield"),
  };
}

function expandFormfield(definition: StatefulColorDefinition | undefined, path: string) {
  if (!definition?.base) return definition;
  return {
    ...definition,
    ...Object.fromEntries(
      ACTION_STATES.map((state) => [`$${state}`, definition[`$${state}` as keyof StatefulColorDefinition] ?? `$${path}.base`]),
    ),
  };
}

function expandActions<Definition extends Partial<Record<string, StatefulColorDefinition>>>(
  definition: Definition | undefined,
  path: string,
) {
  if (!definition) return;
  return Object.fromEntries(
    Object.entries(definition as Record<string, StatefulColorDefinition | undefined>).map(([variant, value]) => {
      if (!value?.base) return [variant, value];
      return [
        variant,
        {
          ...value,
          ...Object.fromEntries(
            ACTION_STATES.map((state) => [`$${state}`, value[`$${state}` as keyof StatefulColorDefinition] ?? `$${path}.${variant}.base`]),
          ),
        },
      ];
    }),
  ) as Definition;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
