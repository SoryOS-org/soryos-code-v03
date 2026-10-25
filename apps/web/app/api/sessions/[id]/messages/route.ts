import { NextRequest, NextResponse } from "next/server";
import { sessionStore } from "@soryos/session";
import { runPipeline } from "@soryos/agent";
import { validateChatImages, type ChatImageAttachment, type SoryOSEvent } from "@soryos/schema";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = sessionStore.get(id);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.agent_running) {
    return new NextResponse("Session already running", { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const content = (body.content || "").trim();

  if (!content) {
    return NextResponse.json({ error: "Message content required" }, { status: 400 });
  }

  let images: ChatImageAttachment[] | undefined;
  if (body.images !== undefined) {
    const imageError = validateChatImages(body.images);
    if (imageError) {
      return NextResponse.json({ error: `Invalid images: ${imageError}` }, { status: 400 });
    }
    images = body.images as ChatImageAttachment[];
  }

  // Push user message into session
  const now = () => new Date().toISOString();
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let assistantText = "";
      // Index AVANT l'ajout du message utilisateur (fait par runPipeline).
      const startIndex = session.messages.length;
      let errorText = "";
      sessionStore.update(id, { agent_running: true });

      function send(event: SoryOSEvent) {
        if (event.type === "text" && event.delta) assistantText += event.delta;
        if (event.type === "error") errorText += `\n\n⚠️ ${event.message || "Erreur inconnue"}`;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Stream closed by client
        }
      }

      try {
        const pipelineResult = await runPipeline(
          {
            sessionId: id,
            prompt: content,
            images,
            agentId: body.agent,
            modelId: body.model,
            apiKey: body.apiKey,
          },
          (event) => send(event),
        );

        if (pipelineResult.status === "completed") {
          const updated = sessionStore.get(id);
          const stored = updated ?? session;
          const assistantMessages = stored.messages.slice(startIndex).filter((m) => m.role === "assistant");
          const last = assistantMessages.at(-1);
          if (last) {
            if (assistantText.trim().length > last.content.length) last.content = assistantText.trim();
            if (errorText) last.content = `${last.content}${errorText}`.trim();
            sessionStore.update(id, { messages: stored.messages });
          } else {
            stored.messages.push({
              id: `assistant-${Date.now()}`,
              role: "assistant",
              content: `${assistantText}${errorText}`.trim() || "⚠️ Aucune réponse reçue du fournisseur IA.",
              created_at: now(),
            });
            sessionStore.update(id, { messages: stored.messages });
          }
          send({ type: "done" });
        } else {
          send({ type: "error", message: pipelineResult.error });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        send({ type: "error", message: msg });
      } finally {
        sessionStore.update(id, { agent_running: false });
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
