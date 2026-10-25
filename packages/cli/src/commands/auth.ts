/**
 * Auth command — gestion des identifiants des providers.
 *
 * Adapted from opencode's `auth` command family (list / login / logout /
 * switch), but backed by our own `@soryos/credentials` store (real disk I/O).
 *
 *   soryos-code auth list                 → état de chaque provider
 *   soryos-code auth login [provider]     → saisie masquée + sauvegarde disque
 *   soryos-code auth logout [provider]    → suppression
 *   soryos-code auth switch <provider>    → provider actif (utilisé par défaut)
 */

import { credentialManager, PROVIDER_REGISTRY } from "@soryos/credentials";
import { aiProviderRegistry } from "@soryos/provider";
import { CommandHandler } from "../framework/spec";
import { fail, println, EXIT_OK, EXIT_ERROR, dim, bold, cyan, green, red } from "../framework/ui";
import { pick, readSecret, ok, ko, info } from "../framework/terminal";
import { TerminalInput } from "../framework/input";
import { str } from "../framework/flags";
import { getActiveProvider, setActiveProvider } from "../framework/provider-state";

/** Providers IA (ceux qui servent à l'agent). */
function aiProviders(): string[] {
  return Object.keys(PROVIDER_REGISTRY).filter((id) => PROVIDER_REGISTRY[id].category === "ai");
}

function displayName(providerId: string): string {
  return PROVIDER_REGISTRY[providerId]?.name ?? providerId;
}

function envVarFor(providerId: string): string | undefined {
  const map: Record<string, string[]> = {
    google: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
    openai: ["OPENAI_API_KEY"],
    mistral: ["MISTRAL_API_KEY"],
    openrouter: ["OPENROUTER_API_KEY"],
    deepseek: ["DEEPSEEK_API_KEY"],
    grok: ["GROK_API_KEY", "XAI_API_KEY"],
    "opencode-zen": ["OPENCODE_API_KEY"],
  };
  return map[providerId]?.find((v) => Boolean(process.env[v]));
}

async function listHandler(): Promise<number> {
  const active = await getActiveProvider();
  const rows: Array<{ id: string; name: string; status: string; source: string }> = [];

  for (const id of aiProviders()) {
    const status = credentialManager.getProviderStatus(id);
    if (!status) continue;
    const fromEnv = envVarFor(id);
    const source = status.configured
      ? status.source === "environment_variable"
        ? `env:${fromEnv}`
        : status.sourceLabel
      : "not configured";
    rows.push({
      id,
      name: status.name,
      status: status.configured ? "connected" : "—",
      source,
    });
  }

  if (!rows.length) {
    println("No AI provider registered.");
    return EXIT_OK;
  }

  println(bold(cyan("AI providers:")));
  const width = Math.max(...rows.map((r) => r.name.length));
  for (const row of rows) {
    const marker = row.id === active ? green(" (active)") : "";
    const state = row.status === "connected" ? green("connected") : dim(row.status);
    println(`  ${row.name.padEnd(width)}  ${state.padEnd(12)} ${dim(row.source)}${marker}`);
  }
  println("");
  println(dim("Connect a provider: soryos-code auth login <provider>"));
  return EXIT_OK;
}

async function loginHandler(providerArg?: string, input?: TerminalInput): Promise<number> {
  // Saisie interactive (picker ou secret) : hors TTY on refuse honnêtement.
  if (!process.stdin.isTTY) {
    return fail("auth login requires an interactive terminal (TTY).");
  }

  const terminal = input ?? new TerminalInput();
  const owned = !input;
  if (owned) terminal.start();
  const providers = aiProviders();

  let providerId = providerArg;
  if (!providerId) {
    const chosen = await pick<string>({
      title: "Connect a provider",
      options: providers.map((id) => ({
        value: id,
        title: displayName(id),
        description: PROVIDER_REGISTRY[id].description,
        footer: envVarFor(id) ? `env:${envVarFor(id)}` : undefined,
      })),
      hint: "↑/↓ navigate · enter select · esc cancel",
    }, terminal);
    if (!chosen) {
      info("Cancelled.");
      if (owned) terminal.stop();
      return EXIT_OK;
    }
    providerId = chosen;
  }

  if (!PROVIDER_REGISTRY[providerId]) {
    if (owned) terminal.stop();
    return fail(`Unknown provider: ${providerId}`);
  }

  const def = PROVIDER_REGISTRY[providerId];
  const fields: Record<string, string> = {};

  for (const field of def.fields) {
    const label = field.type === "password" ? "hidden" : "text";
    const value = await readSecret(`${bold(cyan(`${def.name} — ${field.label}`))} (${label}): `, terminal);
    if (!value) {
      ko("Cancelled.");
      if (owned) terminal.stop();
      return EXIT_ERROR;
    }
    fields[field.key] = value;
  }

  try {
    // Portée GLOBALE : la clé doit fonctionner depuis n'importe quel dossier
    // (le CLI est installé globalement). Un projet peut surcharger.
    const result = await credentialManager.persist(providerId, fields, "global");
    ok(`${def.name} connected → ${result.file}`);
    if (owned) terminal.stop();
    return EXIT_OK;
  } catch (err: any) {
    if (owned) terminal.stop();
    return fail(`Could not save credentials: ${err?.message ?? err}`);
  }
}

async function logoutHandler(providerArg?: string, input?: TerminalInput): Promise<number> {
  if (!providerArg && !process.stdin.isTTY) {
    return fail("auth logout requires an interactive terminal (TTY) when no provider is given.");
  }
  const terminal = input ?? new TerminalInput();
  const owned = !input;
  if (owned) terminal.start();
  const providers = aiProviders();

  let providerId = providerArg;
  if (!providerId) {
    const connected = providers.filter((id) => credentialManager.getProviderStatus(id)?.configured);
    if (!connected.length) {
      info("No connected provider.");
      return EXIT_OK;
    }
    const chosen = await pick<string>({
      title: "Disconnect a provider",
      options: connected.map((id) => ({ value: id, title: displayName(id) })),
    }, terminal);
    if (!chosen) {
      info("Cancelled.");
      if (owned) terminal.stop();
      return EXIT_OK;
    }
    providerId = chosen;
  }

  if (!PROVIDER_REGISTRY[providerId]) {
    if (owned) terminal.stop();
    return fail(`Unknown provider: ${providerId}`);
  }

  try {
    // On retire la clé des deux portées (globale + projet).
    const global = await credentialManager.remove(providerId, "global");
    const project = await credentialManager.remove(providerId, "project");
    if (global.removed || project.removed) {
      ok(`${displayName(providerId)} disconnected.`);
    } else {
      info(`${displayName(providerId)} had no stored credential (env vars are untouched).`);
    }
    if (owned) terminal.stop();
    return EXIT_OK;
  } catch (err: any) {
    if (owned) terminal.stop();
    return fail(`Could not remove credentials: ${err?.message ?? err}`);
  }
}

async function switchHandler(providerArg?: string, input?: TerminalInput): Promise<number> {
  if (!providerArg && !process.stdin.isTTY) {
    return fail("auth switch requires an interactive terminal (TTY) when no provider is given.");
  }
  const terminal = input ?? new TerminalInput();
  const owned = !input;
  if (owned) terminal.start();
  const providers = aiProviders();

  let providerId = providerArg;
  if (!providerId) {
    const chosen = await pick<string>({
      title: "Active provider",
      options: providers.map((id) => ({
        value: id,
        title: displayName(id),
        description: PROVIDER_REGISTRY[id].description,
      })),
    }, terminal);
    if (!chosen) {
      info("Cancelled.");
      if (owned) terminal.stop();
      return EXIT_OK;
    }
    providerId = chosen;
  }

  if (!PROVIDER_REGISTRY[providerId]) {
    if (owned) terminal.stop();
    return fail(`Unknown provider: ${providerId}`);
  }

  await setActiveProvider(providerId);
  ok(`Active provider → ${displayName(providerId)}`);
  if (owned) terminal.stop();
  return EXIT_OK;
}

/** Point d'entrée de la commande `auth`. */
export const authHandler: CommandHandler = async (ctx) => {
  const sub = ctx.invocation.path[1];
  const arg = ctx.invocation.positionals[0];

  switch (sub) {
    case undefined:
    case "list":
      return listHandler();
    case "login":
      return loginHandler(arg);
    case "logout":
      return logoutHandler(arg);
    case "switch":
      return switchHandler(arg);
    default:
      return fail(`Unknown auth subcommand: ${sub}`);
  }
};

export { aiProviderRegistry };
