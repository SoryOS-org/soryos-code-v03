# Tool Execution Workflow Documentation

## Invariant
**"NO REAL ACTION = NO SUCCESS"**

Every tool execution must execute physically against disk or shell and verify its outcome.

## Steps
1. **Tool Invocations**: LLM requests a tool (e.g. `write_file`, `shell_command`).
2. **Schema Validation**: Parameters are validated against Zod schema.
3. **Permission Check**: `PermissionsManager` validates agent role rights.
4. **Physical Action**: `ExecutionProvider` writes file or executes bash process.
5. **Disk Verification**: Output is checked directly on disk or process exit code.
6. **Result Formatting**: Output returned to LLM context with status `success` or `error`.
