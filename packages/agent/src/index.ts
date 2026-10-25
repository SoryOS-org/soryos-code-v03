
export * from './types';
export * from './config';
export * from './runtime';
export * from './context-builder';
export * from './subagents';
export * from './planner';
export * from './session-compactor';
export * from './error-handler';
export * from './llm-client';
export * from './provider';
export * from './run-pipeline';

import { llmClient } from './llm-client';
import { registerTaskTool } from './subagents';

export const streamChat = llmClient.streamChat.bind(llmClient);

// Inject the `task` subagent tool into the global registry + executor
// (override map) so every consumer (web routes, CLI) gets it automatically.
registerTaskTool();
