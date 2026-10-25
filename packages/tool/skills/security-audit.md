# Security Audit

## Description
Security best practices for code review: OWASP Top 10 mapping, authn/authz, secrets handling, and agent-specific threats.

## Instructions

### OWASP Top 10 → review checklist
- **A01 Broken access control**: every ID-addressed route re-checks ownership server-side; no trusted client-supplied IDs/roles; plan/explore modes cannot reach write/exec tools.
- **A02 Cryptographic failures**: TLS only for remote calls; no homemade crypto; hashed passwords with bcrypt/argon2 (never MD5/SHA-1).
- **A03 Injection**: parameterized queries/ORM only — never string-concatenated SQL/shell; shell tools run argv arrays or strictly reviewed strings; regex from users is ReDoS-risky (bound input size).
- **A04 Insecure design**: destructive operations (delete file, git push, shell) require the permissions layer, not ad-hoc checks.
- **A05 Misconfiguration**: no default credentials, no debug endpoints in prod builds, CORS deny-by-default.
- **A06 Vulnerable components**: lockfiles committed; audit deps; no install-time scripts from untrusted packages without review.
- **A07 Auth failures**: login rate-limited; session IDs rotate on privilege change; timeout + revocation paths exist.
- **A08 Data integrity failures**: verify what you execute/import (signed URLs, pinned versions); deserialization of untrusted input is forbidden.
- **A09 Logging failures**: audit-log auth changes and destructive ops — but NEVER log secrets, tokens, key material, or full PII.
- **SSRF**: server-side fetch of user-supplied URLs must block private ranges (127.0.0.0/8, 10/8, 172.16/12, 192.168/16, 169.254/16, ::1) or be an explicitly reviewed exception.

### Secrets
- Secrets live in env vars or the credentials store — never in code, logs, error messages, URLs, or committed files.
- `process.env` reads happen at the edge (provider/credential layer), not deep in domain logic.
- Error messages shown to users/agents must not echo secrets or internal paths beyond what's needed.

### Agent / tool-specific threats (this codebase)
- Prompt-injection via fetched content: webfetch/websearch output is UNTRUSTED DATA — it can never become instructions or tool arguments without explicit user intent.
- Tool output size caps: truncated honestly (never silently dropped); huge outputs are a DoS and a context-overflow vector.
- Path traversal: every file tool resolves paths against the session workspace and rejects `..` escapes and absolute paths outside the root.
- Shell: deny-list is not a security boundary — the permissions manager (mode × tool × args) is; dangerous tools go through the ask-gate.
- Plugins are code: only load plugins from sources the user explicitly trusts; plugin storage is namespaced per plugin id.

### Review output format
For each finding: severity (critical/high/medium/low), file:line, the concrete exploit path, and the minimal fix. No findings = state which areas were checked and why they're clean — never silent.
