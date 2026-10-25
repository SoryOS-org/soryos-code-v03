import { NextRequest, NextResponse } from "next/server";
import {
  resolvePermissionRequest,
  hasPendingPermissionRequest,
  type PermissionDecision,
} from "@soryos/permissions";

const DECISIONS: PermissionDecision[] = ["allow-once", "allow-always", "deny-once", "deny-always"];

/**
 * Répond à une demande de permission interactive (bus `permission.requested`).
 * Pass-through vers @soryos/permissions — aucune logique métier ici.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: { requestId?: string; decision?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { requestId, decision } = body;
  if (!requestId || typeof requestId !== "string") {
    return NextResponse.json({ error: "Missing requestId" }, { status: 400 });
  }
  if (!decision || !DECISIONS.includes(decision as PermissionDecision)) {
    return NextResponse.json(
      { error: `decision must be one of: ${DECISIONS.join(", ")}` },
      { status: 400 },
    );
  }

  if (!hasPendingPermissionRequest(requestId)) {
    return NextResponse.json(
      { error: "No pending permission request for this requestId (expired or already resolved)." },
      { status: 404 },
    );
  }

  const resolved = resolvePermissionRequest(requestId, decision as PermissionDecision);
  if (!resolved) {
    return NextResponse.json({ error: "Request already resolved." }, { status: 409 });
  }

  return NextResponse.json({ ok: true, sessionId: id, requestId, decision });
}
