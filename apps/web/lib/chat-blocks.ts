/**
 * @soryos/web
 * Chat Blocks Utilities - UI ONLY
 * 
 * Ce fichier contient UNIQUEMENT des utilitaires pour l'UI.
 * Aucune logique métier.
 */

import type { ChatMessage, MessageBlock, ToolStep } from "@soryos/schema";

/**
 * Récupère les blocs d'un message assistant.
 */
export function assistantBlocks(msg: ChatMessage): MessageBlock[] {
  if (msg.blocks?.length) return msg.blocks;
  if (msg.role === "assistant" && msg.content.trim()) {
    return [{ type: "text", content: msg.content }];
  }
  return [];
}

/**
 * Ajoute du texte à un message assistant.
 */
export function appendAssistantText(messages: ChatMessage[], delta: string): ChatMessage[] {
  const last = messages[messages.length - 1];
  if (last?.role !== "assistant") {
    return [
      ...messages,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        blocks: [{ type: "text", content: delta }],
        created_at: new Date().toISOString(),
      },
    ];
  }

  const blocks = [...assistantBlocks(last)];
  const tail = blocks[blocks.length - 1];
  if (tail?.type === "text") {
    blocks[blocks.length - 1] = { type: "text", content: (tail.content || "") + delta };
  } else {
    blocks.push({ type: "text", content: delta });
  }

  return [...messages.slice(0, -1), { ...last, content: "", blocks }];
}

/**
 * Ajoute un outil à un message assistant.
 */
export function appendAssistantTool(messages: ChatMessage[], step: ToolStep): ChatMessage[] {
  const last = messages[messages.length - 1];
  if (last?.role !== "assistant") {
    return [
      ...messages,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        blocks: [{ type: "tool", step }],
        created_at: new Date().toISOString(),
      },
    ];
  }

  return [
    ...messages.slice(0, -1),
    {
      ...last,
      content: "",
      blocks: [...assistantBlocks(last), { type: "tool", step }],
    },
  ];
}

/**
 * Met à jour un outil dans un message assistant.
 */
export function updateAssistantTool(
  messages: ChatMessage[],
  id: string,
  patch: Partial<ToolStep>,
): ChatMessage[] {
  const last = messages[messages.length - 1];
  if (last?.role !== "assistant") return messages;

  const blocks: MessageBlock[] = assistantBlocks(last).map((block) => {
    if (block.type !== "tool" || !block.step || block.step.id !== id) return block;
    return { type: "tool", step: { ...block.step, ...patch } };
  });

  return [...messages.slice(0, -1), { ...last, blocks }];
}
