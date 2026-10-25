# Testing Strategy

## Description
Comprehensive testing strategy: what to test at each layer, how to keep suites fast and honest, and anti-patterns to refuse.

## Instructions

### The testing trophy (adapted)
- **Static** (types, lint): cheapest first line — `tsc --noEmit` must be clean before any test runs.
- **Unit** (pure logic): test domain functions, parsers, reducers — fast, no I/O mocks, table-driven where cases multiply.
- **Integration** (module wiring): real filesystem/network against temp dirs or local fixtures; this is where tool executors, stores, and providers are proven.
- **E2E** (thin): a few happy paths through the real UI/API; never one E2E per feature.

### What to assert
- Assert observable behavior (outputs, side effects on disk, emitted events), never internal call counts of your own mocks.
- Failure paths are first-class: every honest-error branch deserves a test (missing file, denied permission, timeout, invalid input).
- Test the invariant, not the implementation: "file was written with exact content" beats "writeFile called once".

### Speed & isolation
- No network in unit tests: no live APIs, no DNS. If a test needs the internet, it's an integration test behind a flag.
- Each test creates its own temp directory (`mkdtemp`) and removes it in `finally` — parallel-safe, order-independent.
- Reset module-level singletons between tests or design them injectable; leaked global state is the #1 flaky-suite cause.
- Timeouts in tests must be explicit and short; a hanging network call should fail fast with an honest message.

### Honesty rules (this codebase)
- NO FAKE tests: never stub the system under test with the same logic it implements (tautological tests).
- Never `expect(true).toBe(true)`, never snapshot-un reviewed blobs, never `.skip` to go green.
- If a test can't run in CI (needs API keys, GPU), it asserts the honest *error path* instead of skipping silently.
- Mock only true externals (HTTP at the transport boundary), and assert the request the code intended to send.

### Coverage discipline
- Coverage is a smoke detector, not a goal: 100% line coverage of getters means little; an untested error branch is what bites.
- New bug = regression test first, then the fix (red → green proves the fix targets the real defect).

### Running (this repo)
- `npm run typecheck` — static layer (0 errors required).
- `npm run test:engine` — engine suite across packages via turbo (builds workspace deps first).
- Package-scoped: `npx vitest run` inside `packages/<name>`.
