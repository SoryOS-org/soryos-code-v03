# Execution Provider Workflow Documentation

## Supported Environments

1. **Local Execution (`LocalExecutionProvider`)**:
   - Operates directly on the host machine filesystem (`process.cwd()`).
   - Uses `fs/promises` and `child_process.exec` via dynamic evaluation (`eval("require")`).

2. **Sandbox Environments**:
   - `github-codespaces`: Connects to GitHub Codespace instance.
   - `e2b`: Cloud micro-VM sandbox execution.
   - `vercel`: Vercel serverless deployment runtime.
   - `google-cloud-run`: Cloud Run containerized execution environment.
