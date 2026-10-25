# `@soryos/plugin` Agent Operating Guidelines

## Overview
Promise-based plugin authoring API + loader. Port of opencode's `@opencode/plugin` Promise API, adapted to SoryOS's existing registries (ToolRegistry, EventBus, permissions).

## Responsibilities
- Define plugin interfaces and types for extensibility
- Provide a `define()` function for type-safe plugin authoring
- Provide loader functions for resolving and loading plugins from local paths or package names
- Wire the plugin system to SoryOS's existing registries:
  - **ToolRegistry**: Register new tools or override existing ones
  - **EventBus**: Subscribe to system events
  - **permissionsManager**: Hook into permission evaluation
  - **Storage**: Async key-value storage for plugins

## Core Types
- `Plugin`: `{ id: string, setup: (context: PluginContext) => Promise<Cleanup | void> | Cleanup | void }`
- `PluginContext`: Provides `tool`, `permission`, `event`, and `storage` domains
- `PluginToolDomain`: `add()`, `remove()`, `list()` methods for tools
- `PluginPermissionDomain`: `hook()` for intercepting permission decisions
- `PluginEventDomain`: `subscribe()` for bus events
- `PluginStorageDomain`: `get()`, `set()`, `remove()`, `scan()` for async storage

## Key Functions
- `define(plugin)`: Types a plugin with type inference
- `isPlugin(value)`: Validates a module export as a Plugin
- `createPluginContext(session?)`: Creates a context bound to SoryOS registries
- `resolvePluginEntry(source, directory)`: Resolves plugin module path to URL
- `loadPlugin(source, context, options)`: Loads and initializes a plugin
- `unloadPlugin(result)`: Calls cleanup function for a loaded plugin

## Integration with Existing Registries

### Tool Registration
Plugins can register new tools via `context.tool.add()`:
```typescript
ctx.tool.add({
  id: "my_tool",
  name: "my_tool",
  description: "A custom tool",
  category: "agent",
  parameters: { type: "object", properties: {...}, required: [...] },
}, async (args, ctx) => {
  // Handler implementation
});
```

### Permission Hooks
Plugins can intercept permission decisions via `context.permission.hook()`:
```typescript
await ctx.permission.hook((evaluation) => {
  if (evaluation.toolName === "dangerous_tool") {
    evaluation.effect = "deny";
  }
});
```

### Event Subscription
Plugins can subscribe to system events via `context.event.subscribe()`:
```typescript
await ctx.event.subscribe((event) => {
  if (event.type === "tool.completed") {
    // Handle tool completion
  }
});
```

## Loader System
- Supports loading plugins from relative paths (`./my-plugin`)
- Supports loading plugins from absolute paths (`/path/to/plugin`)
- Supports loading plugins from npm packages
- Searches for entry files: `index.ts`, `index.js`, `plugin.ts`, `plugin.js`, `mod.ts`, `mod.js`

## Storage System
Real filesystem-backed key-value storage (`src/storage.ts`), one JSON file per plugin namespace:
- Path: `.soryos/plugin-storage/<plugin-id>.json`
- `get/set/remove/scan` physically read/write disk (NO fake storage)
- `createPluginStorage(namespace, baseDir?)` — per-plugin isolated storage
- `createMemoryStorage()` — in-memory storage used when no namespace is provided (never touches disk)
- `loadPlugin()` automatically binds `context.storage` to the plugin's id as namespace
- Empty namespace files are deleted on `remove` to avoid orphan files

## Plugin Lifecycle
1. Plugin is loaded via `loadPlugin()`
2. Plugin's `setup()` is called with a `PluginContext`
3. Plugin can register capabilities (tools, hooks, subscriptions)
4. When unloading, `unloadPlugin()` is called
5. Cleanup functions are invoked in reverse order of registration

## Example Plugin
```typescript
// my-plugin.ts
import { define } from "@soryos/plugin";
import type { PluginContext } from "@soryos/plugin";

export default define({
  id: "my-custom-plugin",
  setup: async (context: PluginContext) => {
    // Register a custom tool
    context.tool.add({
      id: "custom_greeter",
      name: "custom_greeter",
      description: "Greets the user with a custom message",
      category: "agent",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Name to greet" },
        },
        required: ["name"],
      },
    }, async (args, ctx) => {
      return {
        toolName: "custom_greeter",
        output: `Hello, ${args.name}!`,
        isError: false,
      };
    });

    // Return cleanup function
    return () => {
      // Cleanup logic
    };
  },
});
```