/**
 * Interactive command — ouvre le REPL terminal du CLI.
 * Utilise la résolution de session partagée (`resolveCliSession`), identique
 * au mode `run` et à la GUI.
 */

import { SessionData } from "@soryos/schema";
import { sessionStore } from "@soryos/session";
import { cliSessionStore } from "../cli-session-store";
import { CommandHandler } from "../framework/spec";
import { startInteractive } from "../framework/interactive";
import { resolveCliSession } from "../framework/session";
import { detectProviderAndKey, resolveProviderContext } from "../framework/auth";
import { fail, EXIT_ERROR, requireInteractive } from "../framework/ui";
import { str, bool } from "../framework/flags";

interface InteractiveFlags {
  session?: string;
  continue?: boolean;
  fork?: boolean;
  model?: string;
  agent?: string;
  format?: "default" | "json";
  auto?: boolean;
  title?: string;
}

export const interactiveHandler: CommandHandler = async (ctx) => {
  const flags = ctx.invocation.flags as unknown as InteractiveFlags;

  const formatJson = str(flags, "format") === "json";
  const agentId = str(flags, "agent") ?? "build";

  // Le garde-fou TTY passe avant la recherche de clé : hors terminal,
  // le message doit dire « terminal requis », pas « clé manquante ».
  const ttyGuard = requireInteractive("Interactive mode");
  if (ttyGuard !== null) return ttyGuard;

  const creds = await detectProviderAndKey();
  if (!creds) {
    const context = await resolveProviderContext();
    if (context.activeWithoutKey) {
      return fail(
        `Provider "${context.providerName}" is active but has no API key. Run: soryos-code auth login ${context.providerId}`,
      );
    }
    return fail("API key required: set GEMINI_API_KEY, OPENAI_API_KEY, or MISTRAL_API_KEY");
  }

  let session: SessionData;
  try {
    // Résolution partagée (identique CLI ↔ GUI).
    ({ session } = await resolveCliSession(flags));
  } catch (err: any) {
    return fail(err?.message ?? String(err));
  }

  // La session doit exister dans @soryos/session avant le premier run.
  sessionStore.getOrCreate(session.id);
  sessionStore.save(session);
  await cliSessionStore.save(session);

  return startInteractive({
    session,
    agentId,
    apiKey: creds.apiKey,
    formatJson,
    auto: bool(flags, "auto"),
  });
};
