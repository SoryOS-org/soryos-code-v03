import { sessionStore } from '@soryos/session';
import { globalEventBus } from '@soryos/bus';
import { llmClient, LlmClient } from './llm-client';

export const KEEP_RECENT_MESSAGES = 15;
export const COMPACTION_THRESHOLD = 30;
const MAX_SUMMARY_CHARS = 12000;

export const COMPACTION_SYSTEM_PROMPT = `You are a memory-compaction assistant for a coding agent session.
You receive the older portion of a conversation (the most recent messages are kept verbatim elsewhere).

Produce a structured summary of the archived messages covering, when present:
- User goals and intents (what the user is trying to achieve)
- Files touched and what changed in them
- Key decisions and their rationale
- Errors encountered and how they were resolved
- Current state and any unfinished work

Be factual and concise. Do NOT invent anything that is not in the messages.
Output plain text only (no JSON, no markdown fences).`;

export interface CompactionResult {
  compacted: boolean;
  archivedCount?: number;
  remainingCount?: number;
  error?: string;
}

/**
 * Port of OpenCode's session compaction strategy:
 * - NEVER delete without a summary (if the LLM fails, messages stay untouched).
 * - Keep the most recent messages verbatim (KEEP_RECENT_MESSAGES).
 * - Archive older messages into a structured, merged memorySummary.
 */
export class SessionCompactor {
  private llm: LlmClient;

  constructor(llm?: LlmClient) {
    this.llm = llm ?? llmClient;
  }

  async maybeCompact(sessionId: string): Promise<CompactionResult> {
    const session = sessionStore.get(sessionId);
    if (!session) {
      return { compacted: false, error: `Session not found: ${sessionId}` };
    }

    const total = session.messages.length;
    if (total <= COMPACTION_THRESHOLD) {
      return { compacted: false };
    }

    const archived = session.messages.slice(0, total - KEEP_RECENT_MESSAGES);
    const keep = session.messages.slice(total - KEEP_RECENT_MESSAGES);

    const transcript = archived
      .map((m) => `${m.role}: ${m.content.slice(0, 3000)}`)
      .join('\n\n');

    const res = await this.llm.generate({
      prompt: `Conversation messages to archive:\n\n${transcript}`,
      systemPrompt: COMPACTION_SYSTEM_PROMPT,
      model: session.model,
      sessionId,
    });

    if (res.error) {
      return { compacted: false, error: `Compaction failed (messages untouched): ${res.error}` };
    }
    if (!res.text?.trim()) {
      return { compacted: false, error: 'Compaction failed (messages untouched): empty summary from the model.' };
    }

    const summary = res.text.trim();
    let merged = session.memorySummary
      ? `${session.memorySummary}\n\n---\n\n${summary}`
      : summary;
    if (merged.length > MAX_SUMMARY_CHARS) {
      merged = merged.slice(merged.length - MAX_SUMMARY_CHARS);
    }

    sessionStore.update(sessionId, {
      messages: keep,
      memorySummary: merged,
    });

    globalEventBus.emit('session.compacted', {
      sessionId,
      archivedCount: archived.length,
      remainingCount: keep.length,
    });

    return { compacted: true, archivedCount: archived.length, remainingCount: keep.length };
  }
}

export const sessionCompactor = new SessionCompactor();
