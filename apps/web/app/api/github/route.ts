import { NextRequest, NextResponse } from "next/server";
import { getGitHubService } from "@/lib/github/service";

export async function GET(req: NextRequest) {
  const gitHubService = getGitHubService();
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") || "account";
  const sessionId = searchParams.get("sessionId") || "session";
  const repo = searchParams.get("repo") || "";

  if (action === "account") {
    const account = gitHubService.getAccountState(sessionId);
    return NextResponse.json(account);
  }

  if (action === "repos") {
    const repos = await gitHubService.listRepositories(sessionId);
    return NextResponse.json({ repos });
  }

  if (action === "branches") {
    if (!repo) {
      return NextResponse.json({ error: "repo parameter required" }, { status: 400 });
    }
    const branches = await gitHubService.listBranches(sessionId, repo);
    return NextResponse.json({ branches });
  }

  if (action === "codespaces") {
    const codespaces = await gitHubService.listCodespaces(sessionId, repo);
    return NextResponse.json({ codespaces });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const gitHubService = getGitHubService();
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") || "";
  const body = await req.json().catch(() => ({}));
  const sessionId = body.sessionId || "session";

  // Action: Connect with real token verified against https://api.github.com/user
  if (action === "connect") {
    const token = body.token;
    if (!token || typeof token !== "string" || !token.trim()) {
      return NextResponse.json(
        { error: "Veuillez fournir un token GitHub valide (ex: ghp_... ou github_pat_...)" },
        { status: 400 }
      );
    }

    try {
      const account = await gitHubService.verifyAndStoreToken(sessionId, token.trim());
      return NextResponse.json({
        success: true,
        account,
      });
    } catch (e: unknown) {
      return NextResponse.json(
        { error: (e as Error)?.message || "Échec de l'authentification GitHub" },
        { status: 401 }
      );
    }
  }

  // Action: Device Flow Start (RFC 8628)
  if (action === "device_code") {
    const clientId = process.env.GITHUB_CLIENT_ID || body.clientId;
    if (!clientId) {
      return NextResponse.json({
        hasClientId: false,
        message: "GITHUB_CLIENT_ID non configuré. Vous pouvez vous connecter directement avec un Personal Access Token (PAT).",
      });
    }

    try {
      const res = await fetch("https://github.com/login/device/code", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          scope: "repo,codespace,read:user,user:email",
        }),
      });

      const data = await res.json();
      return NextResponse.json({
        hasClientId: true,
        ...data,
      });
    } catch (e: unknown) {
      return NextResponse.json({ error: (e as Error)?.message || "Erreur Device Flow" }, { status: 500 });
    }
  }

  // Action: Poll Device Token
  if (action === "poll_device_token") {
    const clientId = process.env.GITHUB_CLIENT_ID || body.clientId;
    const deviceCode = body.deviceCode;

    if (!clientId || !deviceCode) {
      return NextResponse.json({ error: "clientId et deviceCode requis" }, { status: 400 });
    }

    try {
      const res = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          device_code: deviceCode,
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        }),
      });

      const data = await res.json();
      if (data.access_token) {
        const account = await gitHubService.verifyAndStoreToken(sessionId, data.access_token);
        return NextResponse.json({ success: true, account });
      }

      return NextResponse.json({ status: data.error || "authorization_pending" });
    } catch (e: unknown) {
      return NextResponse.json({ error: (e as Error)?.message }, { status: 500 });
    }
  }

  // Action: Disconnect
  if (action === "disconnect") {
    gitHubService.disconnectAccount(sessionId);
    return NextResponse.json({ success: true });
  }

  // Action: Create Repository
  if (action === "create_repo") {
    const name = body.name;
    if (!name) {
      return NextResponse.json({ error: "Nom de repository requis" }, { status: 400 });
    }
    const description = body.description || "";
    const isPrivate = Boolean(body.private);
    try {
      const repo = await gitHubService.createRepository(sessionId, name, description, isPrivate);
      return NextResponse.json({ success: true, repo });
    } catch (e: unknown) {
      return NextResponse.json({ error: (e as Error)?.message }, { status: 400 });
    }
  }

  // Action: Create Codespace
  if (action === "create_codespace") {
    const repo = body.repo || "";
    const branch = body.branch || "main";
    const machine = body.machine || "standardLinux32gb";
    if (!repo) {
      return NextResponse.json({ error: "Repository requis" }, { status: 400 });
    }
    try {
      const codespace = await gitHubService.createCodespace(sessionId, repo, branch, machine);
      return NextResponse.json({ success: true, codespace });
    } catch (e: unknown) {
      return NextResponse.json({ error: (e as Error)?.message }, { status: 400 });
    }
  }

  return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
}
