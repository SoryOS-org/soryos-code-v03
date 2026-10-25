#!/usr/bin/env -S npx tsx
/**
 * @soryos/cli — CLI standalone du moteur autonome SoryOS-Code.
 * Structure inspirée d'opencode : arbre de commandes déclaratif + handlers
 * lazy-loading + conventions stdout/stderr + --format json + exit codes.
 *
 * Lancement :
 *   npm run cli -- <commande>      (depuis la racine du dépôt)
 *   npx tsx packages/cli/src/index.ts <commande>
 *   node_modules/.bin/soryos-code <commande>  (après npm link)
 */

import { parseInvocation, printRootHelp, printCommandHelp, ROOT_SPEC } from "./framework/spec";
import { fail, EXIT_OK, EXIT_ERROR, println, writeOut } from "./framework/ui";
import { hydrateCredentials } from "./framework/auth";
import type { CommandContext, CommandHandler } from "./framework/spec";

interface ResolvedHandler {
  handler: CommandHandler;
}

/** Résout le handler correspondant à un chemin de commande (lazy import). */
async function resolveHandler(path: string[]): Promise<ResolvedHandler | null> {
  const [cmd, sub] = path;

  switch (cmd) {
    case "run":
      return { handler: (await import("./commands")).runHandler };

    case "interactive":
    case "i":
    case "chat":
      return { handler: (await import("./commands/interactive")).interactiveHandler };

    case "session":
      if (!sub) return { handler: async () => { printCommandHelp(["session"]); return EXIT_ERROR; } };
      switch (sub) {
        case "list":
          return { handler: async () => (await import("./commands/session/list")).sessionListHandler() };
        case "delete":
          return { handler: async (ctx) => (await import("./commands/session/delete")).sessionDeleteHandler(ctx.invocation.positionals[0]) };
        case "export":
          return { handler: async (ctx) => (await import("./commands/session/export")).sessionExportHandler(ctx.invocation.positionals[0]) };
        case "import":
          return { handler: async (ctx) => (await import("./commands/session/import")).sessionImportHandler(ctx.invocation.positionals[0]) };
      }
      break;

    case "models":
      return { handler: async () => (await import("./commands")).modelsHandler() };

    case "auth":
      return { handler: (await import("./commands")).authHandler };

    case "debug":
      if (!sub) return { handler: async () => { printCommandHelp(["debug"]); return EXIT_ERROR; } };
      switch (sub) {
        case "paths":
          return { handler: async () => (await import("./commands/debug/paths")).debugPathsHandler() };
        case "config":
          return { handler: async () => (await import("./commands/debug/config")).debugConfigHandler() };
      }
      break;

    case "plugin":
      return { handler: async () => (await import("./commands")).pluginHandler() };
  }

  return null;
}

/**
 * Point d'entrée public du CLI.
 * @returns le code de sortie (0 ok, 1 erreur, 130 interrupt)
 */
export async function runCLI(argv: string[] = process.argv.slice(2)): Promise<number> {
  // Les identifiants sauvegardés sur disque doivent être visibles AVANT toute
  // résolution de provider (sinon `auth login` ne sert à rien).
  await hydrateCredentials();

  if (argv.length === 0) {
    // Sans argument : on ouvre la session interactive (comme opencode).
    if (process.stdin.isTTY && process.stderr.isTTY) {
      const resolved = await resolveHandler(["interactive"]);
      if (resolved) {
        const ctx: CommandContext = {
          invocation: { path: ["interactive"], spec: ROOT_SPEC, positionals: [], flags: {} },
          stderr: (line?: string) => println(line ?? ""),
          stdout: writeOut,
        };
        try {
          const exitCode = await resolved.handler(ctx);
          return typeof exitCode === "number" ? exitCode : EXIT_OK;
        } catch (err) {
          fail(err instanceof Error ? err.message : String(err));
          return EXIT_ERROR;
        }
      }
    }
    printRootHelp();
    return EXIT_OK;
  }

  if (argv.includes("--help") || argv.includes("-h")) {
    const parsed = parseInvocation(ROOT_SPEC, argv);
    if (!("error" in parsed) && parsed.path.length) {
      printCommandHelp(parsed.path);
    } else {
      printRootHelp();
    }
    return EXIT_OK;
  }

  const result = parseInvocation(ROOT_SPEC, argv);
  if ("error" in result) {
    fail(result.error);
    return EXIT_ERROR;
  }

  const { path, spec, positionals, flags } = result;

  if (!path.length) {
    printRootHelp();
    return EXIT_OK;
  }

  if (path.length === 1 && argv[0] === "help") {
    printCommandHelp(path);
    return EXIT_OK;
  }

  const resolved = await resolveHandler(path);
  if (!resolved) {
    fail(`Unknown command: ${path.join(" ")}`);
    printRootHelp();
    return EXIT_ERROR;
  }

  const ctx: CommandContext = {
    invocation: { path, spec, positionals, flags },
    stderr: (line?: string) => println(line ?? ""),
    stdout: writeOut,
  };

  try {
    const exitCode = await resolved.handler(ctx);
    return typeof exitCode === "number" ? exitCode : EXIT_OK;
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
    return EXIT_ERROR;
  }
}

/** Bootstrap exécuté quand le fichier est lancé directement. */
if (require.main === module) {
  runCLI()
    .then((code) => process.exit(code))
    .catch((err) => {
      fail(err instanceof Error ? err.message : String(err));
      process.exit(EXIT_ERROR);
    });
}
