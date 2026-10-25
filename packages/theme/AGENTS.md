# `@soryos/theme` Agent Operating Guidelines

## Overview
Theme token schema, expansion, resolution pipeline, and OKLCH color utilities. Port of `@opencode/theme` adapted to plain TypeScript (no Effect, no @opentui).

## Architecture
```
ThemeDocument (base + light/dark)
  → selectThemeMode (pick mode, merge base+mode)
  → expandTheme (fill implicit defaults as $ refs)
  → resolveHue (resolve hue scales + aliases with cycle detection)
  → resolveView (walk token tree, resolve $ refs → RGBA)
  → ResolvedTheme (RGBA-based, with stateful colors + hue step shifting)
```

## Key Exports
- `RGBA` — local color class (fromHex/fromInts/clone/toHex)
- `rgbToOklch`, `oklchToHex` — color space conversion (pure math)
- `expandTheme`, `expandTokens`, `mergeTheme` — fill defaults before resolution
- `selectTheme`, `selectThemeMode`, `themeModes` — mode selection
- `parseThemeDocument` — eager validation (resolves every present mode)
- `resolveThemeDocument(doc, mode)` → `ResolvedTheme`
- `resolveTheme(definition)` → `ResolvedTheme`

## Rules
- Choose theme tokens by semantic role, never by raw color.
- Use `text.feedback.*` / `background.feedback.*` for outcome/status feedback.
- Use `formfield` states for form controls, `action` states for actions.
- If a token is missing for a semantic role, extend the schema before using it.
- `$` references support cycle detection — circular refs throw with the full chain.
- Hue aliases (`"$hue.other"`) clone the target scale (distinct RGBA instances).
- `source/increase/decrease` shift colors on the 100–900 hue scale.

## Testing
- `npm run typecheck` from package root
- `npm run test:engine` (vitest)
