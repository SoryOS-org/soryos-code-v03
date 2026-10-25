import { NextRequest, NextResponse } from "next/server";
import { credentialManager, PROVIDER_REGISTRY } from "@/lib/credentials/manager";
import { aiProviderRegistry } from "@/lib/ai/registry";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const providerId = searchParams.get("providerId");
  const sessionId = searchParams.get("sessionId") || undefined;

  if (providerId) {
    const status = credentialManager.getProviderStatus(providerId, sessionId);
    if (!status) {
      return NextResponse.json({ error: "Provider inconnu" }, { status: 404 });
    }
    return NextResponse.json({ status, definition: PROVIDER_REGISTRY[providerId] });
  }

  const statuses = credentialManager.getAllStatuses(sessionId);
  return NextResponse.json({ providers: statuses, definitions: PROVIDER_REGISTRY });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, providerId, fields, sessionId, modelId, prompt } = body;

    if (!providerId) {
      return NextResponse.json({ error: "providerId manquant" }, { status: 400 });
    }

    // 1 & 2. Real connection test: sends a tiny prompt to the provider
    if (action === "test" || action === "test_ai") {
      const status = credentialManager.getProviderStatus(providerId, sessionId);
      const ping = await aiProviderRegistry.testAI(providerId, { sessionId, modelId, prompt: prompt || undefined });
      const authFailed = ping.httpStatus === 401 || ping.httpStatus === 403;
      const diagnostics = {
        providerId,
        providerName: PROVIDER_REGISTRY[providerId]?.name || providerId,
        credentialStatus: status?.configured ? "found" : "missing",
        credentialSource: status?.source || "none",
        credentialSourceLabel: status?.sourceLabel || "Non configuré",
        runtimeStatus: "initialized",
        endpoint: ping.diagnostics?.endpoint,
        model: ping.model,
        networkStatus: ping.httpStatus ? "passed" : "failed",
        authStatus: ping.success || !authFailed ? "passed" : "failed",
        apiStatus: ping.success ? "passed" : "failed",
        httpStatus: ping.httpStatus,
        latencyMs: ping.latencyMs,
        finalResult: ping.success ? "connected" : status?.configured ? "error" : "not_configured",
      };
      return NextResponse.json({
        success: ping.success,
        httpStatus: ping.httpStatus,
        message: ping.success ? `Connexion réelle réussie (${ping.model})` : ping.error,
        error: ping.error,
        prompt: prompt || "Réponds uniquement : OK",
        response: ping.response,
        model: ping.model,
        latencyMs: ping.latencyMs,
        diagnostics,
        status,
      });
    }

    // 3. Full Matrix Diagnostics across all providers
    if (action === "diagnostics") {
      const matrix = await aiProviderRegistry.runFullMatrixDiagnostics(sessionId);
      const statuses = credentialManager.getAllStatuses(sessionId);
      return NextResponse.json({
        matrix,
        providers: statuses,
        timestamp: new Date().toISOString(),
      });
    }

    // 4. Delete Credentials
    if (action === "delete") {
      const deleteResult = credentialManager.deleteCredentials(providerId, sessionId);
      return NextResponse.json(deleteResult);
    }

    // 5. Default action: Save Credentials
    if (!fields || typeof fields !== "object") {
      return NextResponse.json({ error: "Identifiants manquants" }, { status: 400 });
    }

    const saveResult = credentialManager.saveCredentials(providerId, fields, sessionId);
    return NextResponse.json(saveResult);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
