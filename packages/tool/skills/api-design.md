# API Design

## Description
Guidelines for designing REST (and GraphQL) APIs: resource modeling, versioning, pagination, errors, and evolution safety.

## Instructions

### Resource modeling
- Nouns for paths, verbs for operations: `GET /sessions/{id}/messages`, not `GET /getSessionMessages`.
- Model collections and members consistently: `/things` (collection) + `/things/{id}` (member).
- Sub-resources nest one level max; deeper hierarchies become query params (`/sessions/{id}/messages?thread=…`).

### HTTP semantics
- Use status codes honestly: `200/201/204` success, `400` invalid input, `401` unauthenticated, `403` unauthorized, `404` missing, `409` conflict, `422` semantic validation, `429` rate-limited, `5xx` server fault.
- `POST` creates (return `201` + `Location`), `PUT` full replace, `PATCH` partial update, `DELETE` idempotent removal (`204` or `404` if already gone — pick one and document it).
- Make operations idempotent where possible: safe retries on `GET/PUT/DELETE`, idempotency keys on risky `POST`s.

### Input validation
- Validate at the boundary: every request body/params schema-checked before touching domain logic.
- Reject unknown fields in strict mode; never silently ignore a typo'd field.
- Error responses carry machine-readable codes + human messages:
  `{ "error": { "code": "SESSION_NOT_FOUND", "message": "…", "details": {…} } }`

### Pagination
- Cursor-based pagination for mutable data (stable under inserts); offset only for static admin lists.
- Cap page size server-side (`limit` ≤ 100) and return `{ items, nextCursor, hasMore }`.

### Versioning & evolution
- Additive changes are non-breaking: new optional fields, new endpoints, new enum values (clients must tolerate unknown values).
- Breaking changes require a new version path (`/v2/…`) or negotiated headers — never silently change semantics.
- Deprecate with `Deprecation` + `Sunset` headers before removal.

### Auth & security
- Authenticate once at the edge; authorize per-resource in the domain layer (ownership checks on every ID-addressed access).
- Never leak existence: return `404` (not `403`) for resources the caller may not know exist, when that hides secrets.
- Rate-limit mutating routes; validate/limit body sizes; never trust client-supplied IDs for authorization decisions.

### Real-time
- SSE for one-way server→client streams (tool output, progress): each event has a `type` + JSON payload, heartbeats to keep proxies alive.
- WebSockets only when the client must send high-frequency messages; otherwise SSE is simpler and retryable.
