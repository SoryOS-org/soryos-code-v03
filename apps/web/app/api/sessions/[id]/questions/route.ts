import { NextRequest, NextResponse } from "next/server";
import {
  resolveQuestionRequest,
  cancelQuestionRequest,
  hasPendingQuestionRequest,
} from "@soryos/tool";

/**
 * Répond à une question interactive de l'agent (bus `question.asked`).
 * Pass-through vers @soryos/tool — aucune logique métier ici.
 * Body: { requestId: string, answers?: string[][], cancelled?: boolean }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: { requestId?: string; answers?: unknown; cancelled?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { requestId, answers, cancelled } = body;
  if (!requestId || typeof requestId !== "string") {
    return NextResponse.json({ error: "Missing requestId" }, { status: 400 });
  }
  if (!hasPendingQuestionRequest(requestId)) {
    return NextResponse.json(
      { error: "No pending question for this requestId (expired or already resolved)." },
      { status: 404 },
    );
  }

  if (cancelled === true) {
    cancelQuestionRequest(requestId);
    return NextResponse.json({ ok: true, sessionId: id, requestId, cancelled: true });
  }

  if (!Array.isArray(answers)) {
    return NextResponse.json(
      { error: 'Body must include "answers" (array of string arrays, one per question) or cancelled:true' },
      { status: 400 },
    );
  }
  const normalized = answers.map((a) => (Array.isArray(a) ? a.map(String) : [String(a)]));
  const resolved = resolveQuestionRequest(requestId, normalized);
  if (!resolved) {
    return NextResponse.json({ error: "Question already resolved." }, { status: 409 });
  }
  return NextResponse.json({ ok: true, sessionId: id, requestId, answers: normalized });
}
