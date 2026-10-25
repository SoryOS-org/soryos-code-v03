import { NextRequest, NextResponse } from "next/server";
import { sessionStore, memorySessionSource, resolveSessionTarget } from "@soryos/session";
import { runPipeline } from "@soryos/agent";
import type { SoryOSEvent } from "@soryos/schema";

/**
 * Démarre l'exécution de l'agent pour une session.
 * La résolution de la cible (reprise / fork) passe par la logique PARTAGÉE
 * `@soryos/session` — identique au CLI (`--continue`, `--fork`).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const target = body.target as "session" | "continue" | "fork" | undefined;

  let sessionId = id;
  if (target === "continue" || target === "fork") {
    try {
      const resolved = await resolveSessionTarget(
        {
          continueLast: target === "continue",
          fork: target === "fork",
          sessionId: target === "fork" ? id : undefined,
        },
        memorySessionSource,
      );
      sessionId = resolved.session.id;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  const session = sessionStore.get(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.agent_running) {
    return new NextResponse("Session already running", { status: 409 });
  }

  const agentId = body.agent || "build";
  const modelId = body.model;
  const apiKey =
    body.apiKey ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.MISTRAL_API_KEY ||
    null;

  if (!apiKey) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      sessionStore.update(sessionId, { agent_running: true });

      function send(event: SoryOSEvent) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Stream closed by client
        }
      }

      try {
        const result = await runPipeline(
          { sessionId, agentId, modelId, apiKey },
          (event) => send(event),
        );

        if (result.status === "completed") {
          send({ type: "done" });
        } else {
          send({ type: "error", message: result.error });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        send({ type: "error", message: msg });
      } finally {
        sessionStore.update(sessionId, { agent_running: false });
        try {
          controller.close();
        } catch {
          // ignore
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
