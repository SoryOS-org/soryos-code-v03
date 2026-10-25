import { globalEventBus } from "@soryos/bus";

/**
 * Interactive question flow (port of OpenCode's question tool).
 * The tool emits a `question.asked` bus event carrying a requestId; a UI/route
 * answers via resolveQuestionRequest(). Timeout → cancelled (honest, never hang).
 */

export const QUESTION_TIMEOUT_MS = 120_000;

export interface QuestionOption {
  label: string;
  description?: string;
}

export interface QuestionPrompt {
  question: string;
  header?: string;
  options?: QuestionOption[];
  multiple?: boolean;
}

export type QuestionAnswers = string[][];

interface PendingQuestion {
  resolve: (answers: QuestionAnswers | null) => void;
  timer: ReturnType<typeof setTimeout>;
}

const pendingQuestions = new Map<string, PendingQuestion>();

export function createQuestionRequest(
  sessionId: string,
  questions: QuestionPrompt[],
  timeoutMs: number = QUESTION_TIMEOUT_MS
): { requestId: string; answers: Promise<QuestionAnswers | null> } {
  const requestId = `question-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const answers = new Promise<QuestionAnswers | null>((resolve) => {
    const timer = setTimeout(() => {
      pendingQuestions.delete(requestId);
      resolve(null); // timeout = cancelled
    }, timeoutMs);
    pendingQuestions.set(requestId, { resolve, timer });
  });
  return { requestId, answers };
}

/** Resolves a pending question with the user's answers (array per question). */
export function resolveQuestionRequest(requestId: string, answers: QuestionAnswers): boolean {
  const pending = pendingQuestions.get(requestId);
  if (!pending) return false;
  clearTimeout(pending.timer);
  pendingQuestions.delete(requestId);
  pending.resolve(answers);
  return true;
}

/** Dismisses a pending question (user cancelled). */
export function cancelQuestionRequest(requestId: string): boolean {
  const pending = pendingQuestions.get(requestId);
  if (!pending) return false;
  clearTimeout(pending.timer);
  pendingQuestions.delete(requestId);
  pending.resolve(null);
  return true;
}

export function hasPendingQuestionRequest(requestId: string): boolean {
  return pendingQuestions.has(requestId);
}

/** Port of OpenCode's toModelContent — the model-facing answer summary. */
export function formatAnswers(questions: QuestionPrompt[], answers: QuestionAnswers): string {
  const formatted = questions
    .map((question, index) => {
      const value = answers[index];
      const joined = value?.length ? value.join(", ") : "Unanswered";
      return `"${question.question}"="${joined}"`;
    })
    .join(", ");
  return `User has answered your questions: ${formatted}. You can now continue with the user's answers in mind.`;
}

/** Validates the tool input; returns an honest error message or null. */
export function validateQuestions(questions: unknown): { ok: true; questions: QuestionPrompt[] } | { ok: false; error: string } {
  if (!Array.isArray(questions) || questions.length === 0) {
    return { ok: false, error: 'Parameter "questions" must be a non-empty array of question objects.' };
  }
  const cleaned: QuestionPrompt[] = [];
  for (let i = 0; i < questions.length; i++) {
    const raw = questions[i] as Record<string, unknown>;
    if (!raw || typeof raw !== "object" || typeof raw.question !== "string" || !raw.question.trim()) {
      return { ok: false, error: `Question ${i + 1} must have a non-empty "question" string.` };
    }
    const options: QuestionOption[] = Array.isArray(raw.options)
      ? raw.options
          .filter((o): o is Record<string, unknown> => !!o && typeof o === "object" && typeof (o as any).label === "string")
          .map((o) => ({
            label: (o as any).label as string,
            description: typeof o.description === "string" ? (o.description as string) : undefined,
          }))
      : [];
    cleaned.push({
      question: raw.question as string,
      header: typeof raw.header === "string" ? (raw.header as string) : undefined,
      options,
      multiple: raw.multiple === true,
    });
  }
  return { ok: true, questions: cleaned };
}
