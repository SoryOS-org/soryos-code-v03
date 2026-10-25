/**
 * @soryos/agent
 * Agent configuration and definitions.
 */

import { AgentDefinition } from './types';

/**
 * Agent Matrix - all available agent definitions
 */
export const AGENT_MATRIX: AgentDefinition[] = [
  // Google Gemini (Générations 2.x & 3.x)
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: 'Fast and efficient model for quick coding tasks and tool calling',
    model: 'gemini-2.5-flash',
    provider: 'google',
    capabilities: ['code', 'text', 'tools', 'streaming'],
    systemPrompt: 'You are an AI coding assistant. Help the user with their programming tasks.'
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    description: 'Deep reasoning model for complex architectural refactoring',
    model: 'gemini-2.5-pro',
    provider: 'google',
    capabilities: ['code', 'text', 'tools', 'streaming'],
    systemPrompt: 'You are an AI coding assistant. Help the user with their programming tasks.'
  },
  {
    id: 'gemini-3.0-flash',
    name: 'Gemini 3.0 Flash',
    description: 'Next-generation ultra-fast multimodal model',
    model: 'gemini-3.0-flash',
    provider: 'google',
    capabilities: ['code', 'text', 'tools', 'streaming', 'vision'],
    systemPrompt: 'You are an AI coding assistant. Help the user with their programming tasks.'
  },
  {
    id: 'gemini-3.0-pro',
    name: 'Gemini 3.0 Pro',
    description: 'Frontier Generation 3 intelligence for software engineering',
    model: 'gemini-3.0-pro',
    provider: 'google',
    capabilities: ['code', 'text', 'tools', 'streaming'],
    systemPrompt: 'You are an AI coding assistant. Help the user with their programming tasks.'
  },
  {
    id: 'gemini-3.1-pro',
    name: 'Gemini 3.1 Pro',
    description: 'Advanced engineering model with high abstraction capability',
    model: 'gemini-3.1-pro',
    provider: 'google',
    capabilities: ['code', 'text', 'tools', 'streaming'],
    systemPrompt: 'You are an AI coding assistant. Help the user with their programming tasks.'
  },
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    description: 'Phenomenal speed and hybrid reasoning generation 3.5 model',
    model: 'gemini-3.5-flash',
    provider: 'google',
    capabilities: ['code', 'text', 'tools', 'streaming', 'vision'],
    systemPrompt: 'You are an AI coding assistant. Help the user with their programming tasks.'
  },
  {
    id: 'gemini-3.5-pro',
    name: 'Gemini 3.5 Pro',
    description: 'Supreme frontier model with multi-pass reasoning',
    model: 'gemini-3.5-pro',
    provider: 'google',
    capabilities: ['code', 'text', 'tools', 'streaming'],
    systemPrompt: 'You are an AI coding assistant. Help the user with their programming tasks.'
  },
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    description: 'Next-gen responsive model with advanced tooling and fast execution',
    model: 'gemini-3.8-flash',
    provider: 'google',
    capabilities: ['code', 'text', 'tools', 'streaming', 'vision'],
    systemPrompt: 'You are an AI coding assistant. Help the user with their programming tasks.'
  },
  {
    id: 'gemini-3.8-pro',
    name: 'Gemini 3.8 Pro',
    description: 'High-capability reasoning model for heavy refactoring and code generation',
    model: 'gemini-3.8-pro',
    provider: 'google',
    capabilities: ['code', 'text', 'tools', 'streaming', 'vision'],
    systemPrompt: 'You are an AI coding assistant. Help the user with their programming tasks.'
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    description: 'High performance ultra-fast model for interactive tasks',
    model: 'gemini-2.0-flash',
    provider: 'google',
    capabilities: ['code', 'text', 'tools', 'streaming'],
    systemPrompt: 'You are an AI coding assistant. Help the user with their programming tasks.'
  },
  {
    id: 'gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash-Lite',
    description: 'Lightweight and low-latency model for quick micro-tasks',
    model: 'gemini-2.0-flash-lite',
    provider: 'google',
    capabilities: ['code', 'text', 'tools', 'streaming'],
    systemPrompt: 'You are an AI coding assistant. Help the user with their programming tasks.'
  },
  {
    id: 'gemini-2.0-flash-thinking-exp',
    name: 'Gemini 2.0 Flash Thinking',
    description: 'Visible thinking process for complex algorithmic problem solving',
    model: 'gemini-2.0-flash-thinking-exp',
    provider: 'google',
    capabilities: ['code', 'text', 'tools', 'streaming'],
    systemPrompt: 'You are an AI coding assistant. Help the user with their programming tasks.'
  },
  {
    id: 'gemini-2.0-flash-thinking-exp-01-21',
    name: 'Gemini 2.0 Thinking (01-21)',
    description: 'Specialized snapshot with dynamic thinking process for coding',
    model: 'gemini-2.0-flash-thinking-exp-01-21',
    provider: 'google',
    capabilities: ['code', 'text', 'tools', 'streaming'],
    systemPrompt: 'You are an AI coding assistant. Help the user with their programming tasks.'
  },
  {
    id: 'gemini-2.0-pro-exp-02-05',
    name: 'Gemini 2.0 Pro Experimental',
    description: 'Heavy reasoning model for AST analysis and strict patching',
    model: 'gemini-2.0-pro-exp-02-05',
    provider: 'google',
    capabilities: ['code', 'text', 'tools', 'streaming'],
    systemPrompt: 'You are an AI coding assistant. Help the user with their programming tasks.'
  },
  {
    id: 'gemini-exp-1206',
    name: 'Gemini Exp 1206',
    description: 'Experimental flagship version with high writing fidelity',
    model: 'gemini-exp-1206',
    provider: 'google',
    capabilities: ['code', 'text', 'tools', 'streaming'],
    systemPrompt: 'You are an AI coding assistant. Help the user with their programming tasks.'
  },

  // Anthropic Claude (Génération 3.x)
  {
    id: 'claude-3-7-sonnet',
    name: 'Claude 3.7 Sonnet',
    description: 'Hybrid reasoning/coding model with dynamic thinking',
    model: 'claude-3-7-sonnet',
    provider: 'anthropic',
    capabilities: ['code', 'text', 'tools', 'streaming', 'vision'],
    systemPrompt: 'You are an AI coding assistant. Help the user with their programming tasks.'
  },
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    description: 'Gold standard industry model for agentic development',
    model: 'claude-3-5-sonnet',
    provider: 'anthropic',
    capabilities: ['code', 'text', 'tools', 'streaming', 'vision'],
    systemPrompt: 'You are an AI coding assistant. Help the user with their programming tasks.'
  },
  {
    id: 'claude-3-5-haiku',
    name: 'Claude 3.5 Haiku',
    description: 'Lightning-fast precision coding model',
    model: 'claude-3-5-haiku',
    provider: 'anthropic',
    capabilities: ['code', 'text', 'tools', 'streaming'],
    systemPrompt: 'You are an AI coding assistant. Help the user with their programming tasks.'
  },
  {
    id: 'claude-3-opus',
    name: 'Claude 3 Opus',
    description: 'Deep architectural reasoning and synthesis model',
    model: 'claude-3-opus',
    provider: 'anthropic',
    capabilities: ['code', 'text', 'tools', 'streaming'],
    systemPrompt: 'You are an AI coding assistant. Help the user with their programming tasks.'
  },

  // OpenAI (o1, o3, GPT-4o, GPT-4.5)
  {
    id: 'o3-mini',
    name: 'OpenAI o3-mini',
    description: 'Next-gen STEM reasoning and high-speed coding',
    model: 'o3-mini',
    provider: 'openai',
    capabilities: ['code', 'text', 'tools', 'streaming'],
    systemPrompt: 'You are an AI coding assistant. Help the user with their programming tasks.'
  },
  {
    id: 'o1',
    name: 'OpenAI o1',
    description: 'Deep chain-of-thought reasoning for difficult engineering problems',
    model: 'o1',
    provider: 'openai',
    capabilities: ['code', 'text', 'tools', 'streaming'],
    systemPrompt: 'You are an AI coding assistant. Help the user with their programming tasks.'
  },
  {
    id: 'gpt-4.5-preview',
    name: 'GPT-4.5 Orion',
    description: 'Largest foundation frontier model from OpenAI',
    model: 'gpt-4.5-preview',
    provider: 'openai',
    capabilities: ['code', 'text', 'tools', 'streaming', 'vision'],
    systemPrompt: 'You are an AI coding assistant. Help the user with their programming tasks.'
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    description: 'Omni model from OpenAI with vision and audio',
    model: 'gpt-4o',
    provider: 'openai',
    capabilities: ['code', 'text', 'vision', 'audio', 'tools', 'streaming'],
    systemPrompt: 'You are an AI coding assistant. Help the user with their programming tasks.'
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    description: 'Fast and efficient omni model from OpenAI',
    model: 'gpt-4o-mini',
    provider: 'openai',
    capabilities: ['code', 'text', 'vision', 'audio', 'tools', 'streaming'],
    systemPrompt: 'You are an AI coding assistant. Help the user with their programming tasks.'
  },

  // DeepSeek & OpenCode Zen (Séries 2.5 & 3)
  {
    id: 'deepseek-r1',
    name: 'DeepSeek R1',
    description: 'Reinforcement learning reasoning model',
    model: 'deepseek-r1',
    provider: 'deepseek',
    capabilities: ['code', 'text', 'tools', 'streaming'],
    systemPrompt: 'You are an AI coding assistant. Help the user with their programming tasks.'
  },
  {
    id: 'deepseek-v3',
    name: 'DeepSeek V3 (671B)',
    description: 'Mixture-of-Experts architecture for high performance coding',
    model: 'deepseek-v3',
    provider: 'deepseek',
    capabilities: ['code', 'text', 'tools', 'streaming'],
    systemPrompt: 'You are an AI coding assistant. Help the user with their programming tasks.'
  },
  {
    id: 'opencode-zen-qwen-coder',
    name: 'Qwen 2.5 Coder 32B (Zen)',
    description: 'State of the art open coding model',
    model: 'opencode-zen-qwen-coder',
    provider: 'opencode-zen',
    capabilities: ['code', 'text', 'tools', 'streaming'],
    systemPrompt: 'You are an AI coding assistant. Help the user with their programming tasks.'
  },
  {
    id: 'opencode-zen-llama3-instruct',
    name: 'Llama 3.3 70B (Zen)',
    description: 'High capacity open weights model for planning and development',
    model: 'opencode-zen-llama3-instruct',
    provider: 'opencode-zen',
    capabilities: ['code', 'text', 'tools', 'streaming'],
    systemPrompt: 'You are an AI coding assistant. Help the user with their programming tasks.'
  },

  // Mistral AI
  {
    id: 'codestral-2501',
    name: 'Codestral 25.01',
    description: 'Specialized model for code generation and fill-in-the-middle',
    model: 'codestral-2501',
    provider: 'mistral',
    capabilities: ['code', 'text', 'tools', 'streaming'],
    systemPrompt: 'You are an AI coding assistant. Help the user with their programming tasks.'
  },
  {
    id: 'mistral-large-2411',
    name: 'Mistral Large 2',
    description: 'Flagship 123B model with multi-lingual reasoning',
    model: 'mistral-large-2411',
    provider: 'mistral',
    capabilities: ['code', 'text', 'tools', 'streaming'],
    systemPrompt: 'You are an AI coding assistant. Help the user with their programming tasks.'
  },

  // OpenRouter Free Models
  {
    id: 'openrouter/deepseek/deepseek-r1:free',
    name: 'DeepSeek R1 (OpenRouter Free)',
    description: 'Reinforcement learning reasoning model free via OpenRouter',
    model: 'openrouter/deepseek/deepseek-r1:free',
    provider: 'openrouter',
    capabilities: ['code', 'text', 'tools', 'streaming'],
    systemPrompt: 'You are an AI coding assistant. Help the user with their programming tasks.'
  },
  {
    id: 'openrouter/deepseek/deepseek-chat:free',
    name: 'DeepSeek V3 (OpenRouter Free)',
    description: 'High performance 671B MoE coding model free via OpenRouter',
    model: 'openrouter/deepseek/deepseek-chat:free',
    provider: 'openrouter',
    capabilities: ['code', 'text', 'tools', 'streaming'],
    systemPrompt: 'You are an AI coding assistant. Help the user with their programming tasks.'
  },
  {
    id: 'openrouter/meta-llama/llama-3.3-70b-instruct:free',
    name: 'Llama 3.3 70B (OpenRouter Free)',
    description: 'Llama 3.3 70B open model free via OpenRouter',
    model: 'openrouter/meta-llama/llama-3.3-70b-instruct:free',
    provider: 'openrouter',
    capabilities: ['code', 'text', 'tools', 'streaming'],
    systemPrompt: 'You are an AI coding assistant. Help the user with their programming tasks.'
  },
  {
    id: 'openrouter/qwen/qwen-2.5-coder-32b-instruct:free',
    name: 'Qwen 2.5 Coder 32B (OpenRouter Free)',
    description: 'Code specialist open weights model free via OpenRouter',
    model: 'openrouter/qwen/qwen-2.5-coder-32b-instruct:free',
    provider: 'openrouter',
    capabilities: ['code', 'text', 'tools', 'streaming'],
    systemPrompt: 'You are an AI coding assistant. Help the user with their programming tasks.'
  },
  {
    id: 'openrouter/google/gemini-2.0-flash-exp:free',
    name: 'Gemini 2.0 Flash Exp (OpenRouter Free)',
    description: 'Gemini 2.0 Flash experimental model free via OpenRouter',
    model: 'openrouter/google/gemini-2.0-flash-exp:free',
    provider: 'openrouter',
    capabilities: ['code', 'text', 'tools', 'streaming'],
    systemPrompt: 'You are an AI coding assistant. Help the user with their programming tasks.'
  },
  {
    id: 'openrouter/google/gemini-2.0-flash-thinking-exp:free',
    name: 'Gemini 2.0 Flash Thinking (OpenRouter Free)',
    description: 'Gemini 2.0 Flash Thinking experimental free via OpenRouter',
    model: 'openrouter/google/gemini-2.0-flash-thinking-exp:free',
    provider: 'openrouter',
    capabilities: ['code', 'text', 'tools', 'streaming'],
    systemPrompt: 'You are an AI coding assistant. Help the user with their programming tasks.'
  },

  // Live Voice Agent
  {
    id: 'live-voice',
    name: 'Live Voice Agent',
    description: 'AI agent for real-time voice interactions and commands',
    model: 'gemini-3.8-flash',
    provider: 'google',
    capabilities: ['code', 'text', 'vision', 'audio', 'voice', 'realtime'],
    systemPrompt: 'You are a Live Voice Agent in SoryOS Code. You can receive voice input from users and respond with actions. Process voice commands, execute tools, and provide real-time feedback. Always acknowledge voice input and provide clear, concise responses.'
  }
];

/**
 * Get an agent definition by ID
 */
export function getAgentDefinition(id: string): AgentDefinition | undefined {
  return AGENT_MATRIX.find(agent => agent.id === id || agent.model === id);
}

/**
 * Get all agent definitions
 */
export function getAllAgentDefinitions(): AgentDefinition[] {
  return [...AGENT_MATRIX];
}

/**
 * Get agent definitions by provider
 */
export function getAgentsByProvider(provider: string): AgentDefinition[] {
  return AGENT_MATRIX.filter(agent => agent.provider === provider);
}

/**
 * Get agent definitions by capability
 */
export function getAgentsByCapability(capability: string): AgentDefinition[] {
  return AGENT_MATRIX.filter(agent => agent.capabilities.includes(capability));
}

/**
 * Get default agent definition
 */
export function getDefaultAgent(): AgentDefinition {
  return AGENT_MATRIX.find(agent => agent.id === 'gemini-3.8-flash') || AGENT_MATRIX[0];
}

/**
 * Get agent definition by model ID
 */
export function getAgentByModel(model: string): AgentDefinition | undefined {
  return AGENT_MATRIX.find(agent => 
    agent.model === model || 
    agent.id === model ||
    agent.name.toLowerCase().includes(model.toLowerCase())
  );
}

/**
 * Agent configuration
 */
/**
 * Resolved default settings for the agent runtime.
 *
 * Named `AgentDefaultsConfig` to avoid colliding with the per-run `AgentConfig`
 * in ./types, which carries `model`/`provider` instead of the defaults.
 */
export interface AgentDefaultsConfig {
  defaultModel: string;
  defaultProvider: string;
  maxTokens: number;
  temperature: number;
  topP: number;
  streaming: boolean;
}

/**
 * Default agent configuration
 */
export const DEFAULT_AGENT_CONFIG: AgentDefaultsConfig = {
  defaultModel: 'gemini-2.5-flash',
  defaultProvider: 'google',
  maxTokens: 4096,
  temperature: 0.7,
  topP: 0.9,
  streaming: true
};
