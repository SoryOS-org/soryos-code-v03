# React Specialist

## Description
Specialized knowledge for React development: component architecture, hooks discipline, performance, and server/client boundaries.

## Instructions

### Component architecture
- Keep components small and single-purpose; extract child components instead of growing JSX trees past ~100 lines.
- Separate presentational components (props in, markup out) from container components (data fetching, state).
- Prefer composition over prop-drilling: children slots, context only for genuinely global values (theme, session).
- Colocate component-local files (`Component.tsx`, `useThing.ts`, `Component.test.tsx`) in one folder.

### Hooks discipline
- Follow the rules of hooks religiously: top level only, no conditional calls, stable dependency arrays.
- When a dependency array is "wrong", fix the cause (memoize the callback/value, split state) — never add `// eslint-disable`.
- Custom hooks own reusable stateful logic; a hook that returns more than ~3 values probably needs a reducer or object state.
- Use `useReducer` once state transitions get multi-step or interdependent.

### Server vs client
- Mark browser-only code with `"use client"` at the top of the file; default to server components in App Router.
- Never fetch in the client when the server can: move data loading to server components or route handlers.
- Keep `"use client"` boundaries small — everything below them ships to the browser bundle.
- API keys and secrets NEVER appear in client components; read them only in server code.

### Performance
- Memoize only with evidence (React DevTools profiler). Wrapping every prop in `memo`/`useMemo` is cargo cult.
- Lists: stable `key`s (domain IDs, not array indexes); virtualize long lists.
- Avoid creating objects/functions inline as props to memoized children when the list is large — hoist or `useCallback` with real deps.
- Code-split heavy routes/panels with `dynamic(() => import(...))`.

### State management
- Local state first (`useState`/`useReducer` in the component), then lifted state, then context, then a store — in that order.
- Server cache state (SWR/React Query patterns) is not client state: don't mirror fetched data into `useState`.

### Error handling
- Wrap risky subtrees in error boundaries; boundaries must render a real fallback with a retry path.
- Loading, empty, and error states are part of the UI contract — every async surface designs all three.
