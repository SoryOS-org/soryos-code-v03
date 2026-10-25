# TypeScript Expert

## Description
Expert guidance for TypeScript development: type modeling, generics, strict-mode discipline, and safe refactoring.

## Instructions

### Type modeling
- Model domain data with `interface` for object shapes you expect to extend; use `type` unions for closed variant sets (discriminated unions preferred over boolean flags).
- Prefer `readonly` properties and `readonly T[]` for data that must not be mutated in place.
- Never use `any`. Use `unknown` at trust boundaries and narrow with type guards (`typeof`, `in`, discriminated keys, or explicit predicates).
- Encode invariants in types where cheap: branded types for IDs, template literal types for patterns, `const` assertions for literal maps.

### Generics
- Constrain with the minimal bound that unlocks the needed members (`T extends object`, `TKey extends keyof T`).
- Default type parameters only when the default is the overwhelmingly common case.
- Prefer generic functions over generic classes unless the class genuinely carries the type parameter as state.

### Strict-mode discipline
- Treat `strict: true` as non-negotiable. No `!` non-null assertions in business logic — restructure so the compiler proves the value exists.
- Handle `undefined`/`null` explicitly at the point of extraction (`?.`, guards, early return), not with assertions.
- Avoid type assertions (`as`) that downcast; if an assertion is unavoidable, follow it with a runtime check that would fail loudly.

### Functions & async
- Annotate public function signatures explicitly; let inference handle locals.
- Always type async failures: catch clauses receive `unknown` — narrow with `instanceof Error` before using `.message`.
- Use `Promise.all`/`Promise.allSettled` deliberately; never leave floating promises (enable `@typescript-eslint/no-floating-promises` when linting).

### Refactoring safety
- Delete dead code and unreachable branches; dead `if` paths rot into bugs.
- When renaming across the codebase, rely on the compiler: fix every reported error, never blanket-`as` to silence one.
- Keep barrel files (`index.ts`) thin — re-exports only, no logic, to avoid cycles.

### Monorepo habits
- Share contracts via a `@soryos/schema`-style package: one source of truth for domain types.
- Internal packages expose source (`main: src/index.ts`) so the typechecker sees real types; no hand-written `.d.ts` drift.
