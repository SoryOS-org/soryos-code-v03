/**
 * Run command — moteur non-interactif (style opencode run/runNonInteractive).
 * Sortie : stderr=chrome humain, stdout=NDJSON --format json.
 * Session cible : --session/-s id, --continue/-c newest, --fork (copie), défaut=new.
 * --auto : active confirmDangerous + auto-approuve les demandes de permission.
 * Exit codes : 0 ok, 1 erreur, 130 SIGINT.
 */

import { SessionData } from "@soryos/schema";
import { sessionStore } from "@soryos/session";
import { workspaceManager } from "@soryos/workspace";
import { executeRun, type RunOutput } from "../framework/engine";
import { cliSessionStore } from "../cli-session-store";
import { resolveCliSession } from "../framework/session";
import { detectProviderAndKey, resolveProviderContext } from "../framework/auth";
import { CommandContext, CommandHandler } from "../framework/spec";
import { bold, cyan, dim, green, yellow, red, blue, warn, danger, println, fail, emitNdjson, EXIT_OK, EXIT_ERROR, EXIT_INTERRUPT, readStdinIfPiped } from "../framework/ui";
import { SessionTargetFlags, ModelFlags, FormatFlags, PermissionFlags, str, bool } from "../framework/flags";

interface RunFlags {
  session?: string;
  continue?: boolean;
  fork?: boolean;
  model?: string;
  agent?: string;
  format?: "default" | "json";
  auto?: boolean;
  title?: string;
  __?: string[];
}

export { detectProviderAndKey };

export const runHandler: CommandHandler = async (ctx) => {
  const inv = ctx.invocation;
  const flags = inv.flags as unknown as RunFlags;
  const positionals = inv.positionals;

  let prompt = positionals.join(" ");
  const stdin = await readStdinIfPiped();
  if (stdin) prompt = prompt ? `${prompt}\n${stdin}` : stdin;

  if (!prompt) return fail("Prompt is required (positional args or piped stdin).");

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
  session.confirmDangerous = bool(flags, "auto");

  // Persist session BEFORE run (so session exists for listeners)
  sessionStore.getOrCreate(session.id);
  sessionStore.save(session);
  await cliSessionStore.save(session);

  const formatJson = str(flags, "format") === "json";
  const agentId = str(flags, "agent") ?? "build";

  if (!formatJson) {
    println(bold(cyan(`=== SoryOS-Code Run ===`)));
    println(dim(`Session: ${session.id}  Agent: ${agentId}  Model: ${session.model}`));
    println("");
  } else {
    emitNdjson({ type: "session_started", sessionId: session.id, agent: agentId, model: session.model });
  }

  let sigintCount = 0;
  const sigintHandler = () => {
    sigintCount++;
    if (sigintCount === 1) {
      println(warn("\n⚠ Interrupt received — finishing current step… (Ctrl+C again to force exit)"));
      process.exitCode = EXIT_INTERRUPT;
    } else {
      process.exit(EXIT_INTERRUPT);
    }
  };
  process.on("SIGINT", sigintHandler);

  let resultCode = EXIT_OK;
  // Le renderer affiche déjà l'événement canonique `error` : on ne le
  // réimprime pas (pas de doublon dans la sortie ni dans le NDJSON).
  let failureReported = false;

  try {
    const outcome: RunOutput = await executeRun({
      session,
      prompt,
      agentId,
      apiKey: creds.apiKey,
      formatJson,
      auto: bool(flags, "auto"),
      onFailure: () => {
        failureReported = true;
      },
    });

    // La session est TOUJOURS persistée (succès OU échec) : le message
    // utilisateur et l'historique ne doivent jamais être perdus.
    if (outcome.session) {
      await cliSessionStore.save(outcome.session);
    }

    if (outcome.status === "completed") {
      if (!formatJson) {
        println(bold(green(`✔ Task completed`)));
      }
      resultCode = EXIT_OK;
    } else {
      const failMessage = outcome.error ?? "Unknown error";
      if (!failureReported) {
        if (!formatJson) {
          println(danger(`Error: ${failMessage}`));
        } else {
          emitNdjson({ type: "error", sessionId: session.id, message: failMessage });
        }
      }
      resultCode = EXIT_ERROR;
    }
  } catch (err: any) {
    // Even on an unexpected error, keep the session (message + history).
    const latest = sessionStore.get(session.id);
    if (latest) {
      try {
        await cliSessionStore.save(latest);
      } catch {
        /* la persistance ne doit jamais masquer l'erreur d'origine */
      }
    }
    if (!formatJson) println(danger(`Error: ${err?.message ?? err}`));
    else emitNdjson({ type: "error", sessionId: session.id, message: err?.message ?? String(err) });
    resultCode = EXIT_ERROR;
  } finally {
    process.off("SIGINT", sigintHandler);
  }

  return resultCode;
};