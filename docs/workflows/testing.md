# Testing Workflow & Verification Documentation

## Essential Verification Steps

Whenever changes are made to the codebase, run:

1. **TypeScript Typecheck**:
   ```bash
   npm run typecheck
   ```
   Must compile with 0 errors.

2. **Engine Test Suite**:
   ```bash
   npm run test:engine
   ```
   Must pass 10/10 tests covering:
   - Read `package.json`
   - Real disk file write
   - Surgical patch edit
   - Shell command execution (`pwd`, `ls -la`)
   - Glob pattern search
   - Grep text search
   - Roadmap todo write/read
   - Permission enforcement (blocking Plan writes)
   - Non-simulation error handling

3. **Production Build**:
   ```bash
   npm run build
   ```
