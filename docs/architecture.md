# SoryOS-Code Complete Architecture Documentation

## System Topology

```
SoryOS-Code Monorepo
│
├── apps/
│   ├── web/                # Next.js 16 + React 19 Web IDE
│   │                       # SSE adapter over the same engine
│   └── cli/                # Autonomous CLI engine (`soryos-code`)
│                           # Terminal adapter — shares the engine with `apps/web`
│
└── packages/
    ├── schema/             # Central domain types & contracts (incl. canonical event contract)
    ├── core/               # Base errors & exceptions
    ├── bus/                # GlobalEventBus real-time event stream
    ├── agent/               # Multi-turn AgentRuntime (the shared heart)
    ├── tool/                # ToolRegistry + ToolExecutor (35 tools + MCP)
    ├── execution/          # Physical Command/File Execution provider layer
    ├── permissions/         # Role-based security + ask-gate
    ├── session/             # Session Store + session target resolution
    ├── filesystem/         # Filesystem operations adapter
    ├── git/                 # Git tracking, branch management
    ├── sandbox/             # E2B, Vercel, Codespaces, Cloud Run providers
    ├── terminal/            # PTY process stream manager
    ├── dev-runner/          # Dev server orchestrator
    ├── plugin/              # Promise-based plugin authoring API
    ├── theme/              # OKLCH theme system
    ├── images/             # Real image format/metadata parsing
    ├── vision/              # Vision model providers
    ├── voice/              # Speech-to-text providers
    ├── auth/               # Credentials management
    ├── credentials/        # Secure credential store
    ├── config/             # Configuration service
    └── cli/                 # CLI command tree + handlers (opencode-Spec pattern)
```

## Data Flow Pipeline

1. **User Request** arrives via Web UI or CLI.
2. **`SessionStore`** retrieves or initializes `SessionData`.
3. **`AgentRuntime`** prepares context and selects the AI Model from `AIProviderRegistry`.
4. **LLM Inferences** emit text or tool calls.
5. **`ToolExecutor`** validates permissions via `PermissionsManager`.
6. **`ExecutionProvider`** executes physical disk writes, shell commands, or searches.
7. **`GlobalEventBus`** streams events (`tool.started`, `tool.completed`, `file.changed`) to UI & CLI in real time.
8. **Verification** is performed before completing the task.
