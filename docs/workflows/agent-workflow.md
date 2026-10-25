# SoryOS-Code Agent Workflow Documentation

## Execution Lifecycle

```
[User Input]
     │
     ▼
1. Receive Request -> Load Session & ActiveWorkspace
     │
     ▼
2. System Prompt Assembly -> Include AGENTS.md instructions & active agent role
     │
     ▼
3. LLM Inferences -> Generate text stream and/or tool call
     │
     ▼
4. Tool Call Interception -> Check Permissions (@soryos/permissions)
     │
     ▼
5. Tool Execution -> Execute on Physical ExecutionProvider (@soryos/execution)
     │
     ▼
6. Event Streaming -> Emit events over GlobalEventBus (@soryos/bus)
     │
     ▼
7. Verification -> Verify file changes on disk & run typecheck/tests
     │
     ▼
8. Output Generation -> Return final structured response
```
