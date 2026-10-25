/**
 * Interactive — REPL terminal du CLI SoryOS-Code.
 *
 * Inspiré du REPL d'opencode (zone de saisie encadrée, historique, slash
 * commands, pickers de modèle/provider) mais reste un adaptateur texte :
 * le moteur est @soryos/agent (runPipeline), le rendu est
 * framework/render.ts. Zéro dépendance, zéro TUI framework.
 *
 * UN SEUL gestionnaire de clavier (`framework/input.ts`) est partagé entre la
 * ligne de saisie et les pickers : pas de conflit sur stdin.
 */

import { SessionData } from "@soryos/schema";
import { sessionStore } from "@soryos/session";
import { aiProviderRegistry } from "@soryos/provider";
import { PROVIDER_REGISTRY } from "@soryos/credentials";
import { bold, cyan, dim, green, red, yellow, warn, danger, println, requireInteractive, EXIT_OK, EXIT_ERROR, EXIT_INTERRUPT } from "./ui";
import { executeRun } from "./engine";
import { pick, ok, info } from "./terminal";
import { TerminalInput, parseMouseEvent, type TerminalKey } from "./input";
import { aiProviderIds, defaultModelFor, detectProviderAndKey, modelNeedsKey, providerOwnsModel, refreshLiveModels, resolveProviderContext } from "./auth";
import { isPublicGatewayKey } from "@soryos/credentials";
import { getActiveProvider, setActiveProvider } from "./provider-state";
import { cliSessionStore } from "../cli-session-store";

export interface InteractiveOptions {
  session: SessionData;
  agentId: string;
  apiKey: string;
  formatJson: boolean;
  /** Auto-approuve les demandes de permission (--auto). */
  auto?: boolean;
}

interface SlashOutcome {
  action: "continue" | "exit";
  exitCode?: number;
  /** Nouvelle session courante (commande /new). */
  session?: SessionData;
  /** Nouvel agent (commande /agent). */
  agentId?: string;
  /** Nouveau modèle (commande /model). */
  model?: string;
  /** Nouveau provider actif (commande /provider). */
  providerId?: string;
}

const SLASH_HELP = [
  "/help, /h        Show this help",
  "/exit, /quit     Exit the session",
  "/new [title]     Start a new session",
  "/model [id]      Change the model (picker when no id)",
  "/provider [id]   Change the AI provider (picker when no id)",
  "/agent <role>    Change agent (build|plan|explore|code-reviewer)",
  "/auth            Show the connected provider",
  "/sessions        List recent sessions",
  "/clear           Clear the screen",
  "Ctrl+C / Ctrl+D  Exit",
];

/** Modèles disponibles (registre réel des providers). */
function availableModels(): Array<{
  id: string;
  name: string;
  providerId: string;
  providerName: string;
  description: string;
  badge?: string;
  isFree?: boolean;
  isDefault?: boolean;
  pricing?: string;
}> {
  const out: Array<{
    id: string;
    name: string;
    providerId: string;
    providerName: string;
    description: string;
    badge?: string;
    isFree?: boolean;
    isDefault?: boolean;
    pricing?: string;
  }> = [];

  for (const provider of aiProviderRegistry.getAllProviders()) {
    let models: Array<{
      id: string;
      name: string;
      description?: string;
      badge?: string;
      isFree?: boolean;
      pricing?: string;
    }> = [];
    try {
      models = provider.listModels() as typeof models;
    } catch {
      models = [];
    }
    // Un provider sans modèle n'apparaît pas (rien à sélectionner).
    if (!models.length) continue;

    let defaultModel = "";
    try {
      defaultModel = provider.getDefaultModel();
    } catch {
      defaultModel = "";
    }

    for (const model of models) {
      out.push({
        id: model.id,
        name: model.name,
        providerId: String(provider.id),
        providerName: provider.name,
        description: model.description ?? "",
        badge: model.badge,
        isFree: model.isFree,
        isDefault: model.id === defaultModel,
        pricing: model.pricing,
      });
    }
  }
  return out;
}

/** Exécute une slash command. */
async function handleSlash(
  cmd: string,
  args: string[],
  session: SessionData,
  agentId: string,
  input: TerminalInput,
): Promise<SlashOutcome> {
  switch (cmd) {
    case "help":
    case "h":
      println(bold(cyan("\nSlash commands:")));
      for (const line of SLASH_HELP) println(dim(`  ${line}`));
      println("");
      return { action: "continue" };

    case "exit":
    case "quit":
    case "q":
      return { action: "exit", exitCode: EXIT_OK };

    case "new": {
      const id = `cli-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const title = args.length ? args.join(" ") : "CLI Session";
      const fresh: SessionData = {
        ...session,
        id,
        title,
        sandbox_id: `sandbox-${id}`,
        created_at: new Date().toISOString(),
        messages: [],
        todos: undefined,
        errors: undefined,
      };
      sessionStore.getOrCreate(fresh.id);
      sessionStore.save(fresh);
      ok(`New session: ${fresh.id}`);
      return { action: "continue", session: fresh };
    }

    case "model": {
      if (args.length) {
        return { action: "continue", model: args[0] };
      }

      // Catalogue Zen rafraîchi depuis la passerelle (liste en direct) :
      // le catalogue statique devient périmé (modèles retirés).
      await refreshLiveModels();

      // Clé courante : le free tier du gateway public n'expose que les
      // modèles gratuits (mécanisme opencode).
      const context = await resolveProviderContext();
      const apiKey = context.apiKey;
      const publicOnly = isPublicGatewayKey(apiKey) && context.providerId === "opencode-zen";

      const models = availableModels();
      if (!models.length) {
        info("No model in the registry.");
        return { action: "continue" };
      }

      const current = session.model;
      const chosen = await pick<string>(
        {
          title: publicOnly ? "Select a model (free tier)" : "Select a model",
          options: models.map((m) => ({
            value: m.id,
            title: m.name,
            // L'id d'abord (c'est l'info actionnable), puis le provider.
            description: [
              m.id,
              m.isDefault ? yellow("★") : undefined,
              m.badge ? yellow(`[${m.badge}]`) : undefined,
              m.isFree ? green("free") : undefined,
              m.pricing && !m.isFree ? dim(m.pricing) : undefined,
              modelNeedsKey(m.providerId, m.id, apiKey) ? red("key required") : undefined,
              m.id === current ? cyan("(current)") : undefined,
            ]
              .filter(Boolean)
              .join(" "),
            category: m.providerName,
          })),
          hint: "↑/↓ navigate · type to filter · enter select · esc cancel",
        },
        input,
      );

      if (!chosen) {
        info("Cancelled.");
        return { action: "continue" };
      }
      return { action: "continue", model: chosen };
    }

    case "provider": {
      if (args.length) {
        return { action: "continue", providerId: args[0] };
      }

      const active = await getActiveProvider();
      const providers = aiProviderIds();
      const chosen = await pick<string>(
        {
          title: "Select the AI provider",
          options: providers.map((id) => ({
            value: id,
            title: PROVIDER_REGISTRY[id]?.name ?? id,
            description: PROVIDER_REGISTRY[id]?.description,
            category: id === active ? "Active" : "Available",
          })),
          hint: "↑/↓ navigate · enter select · esc cancel",
        },
        input,
      );

      if (!chosen) {
        info("Cancelled.");
        return { action: "continue" };
      }
      return { action: "continue", providerId: chosen };
    }

    case "auth": {
      const creds = await detectProviderAndKey();
      if (creds) {
        ok(`Provider ${creds.provider} (${creds.source})`);
      } else {
        info("No provider connected. Run: soryos-code auth login");
      }
      const active = await getActiveProvider();
      if (active) println(dim(`  active: ${active}`));
      return { action: "continue" };
    }

    case "agent": {
      const valid = ["build", "plan", "explore", "code-reviewer"];
      if (!args.length) {
        println(dim(`Current agent: ${agentId}`));
        return { action: "continue" };
      }
      const next = args[0].toLowerCase();
      if (!valid.includes(next)) {
        println(danger(`Invalid agent "${next}". Must be one of: ${valid.join(", ")}`));
        return { action: "continue" };
      }
      return { action: "continue", agentId: next };
    }

    case "sessions": {
      const sessions = sessionStore
        .list()
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 10);
      if (!sessions.length) {
        println(dim("No sessions found."));
        return { action: "continue" };
      }
      println(bold(cyan("\nRecent sessions:")));
      for (const s of sessions) {
        const marker = s.id === session.id ? green(" (current)") : "";
        println(dim(`  ${s.id}${marker} — ${s.title}`));
      }
      println("");
      return { action: "continue" };
    }

    case "clear":
      process.stderr.write("\x1b[2J\x1b[0f");
      return { action: "continue" };

    default:
      println(danger(`Unknown command "/${cmd}". Type /help for the list.`));
      return { action: "continue" };
  }
}

/**
 * Boucle REPL : ligne de saisie encadrée (bordure gauche `┃`), historique
 * (flèches), slash commands, pickers.
 */
export async function startInteractive(opts: InteractiveOptions): Promise<number> {
  const guard = requireInteractive("Interactive mode");
  if (guard !== null) return guard;

  if (!opts.apiKey) {
    return EXIT_ERROR;
  }

  let session = opts.session;
  let agentId = opts.agentId;
  let model = session.model;
  let exitCode = EXIT_OK;
  let running = false;

  const input = new TerminalInput();
  input.start();
  // Traçabilité souris : tap pour positionner le curseur (tablette / tactile)
  input.enableMouse();

  // Historique (100 entrées max, comme opencode).
  const history: string[] = [];
  let historyIndex = -1;

  let buffer = "";
  /** Position du curseur dans le buffer (édition tactile). */
  let cursor = 0;
  const output = process.stderr;

  /** Cadre de la zone de saisie (bordure gauche, comme opencode). */
  const PROMPT_TEXT = "┃ soryos › ";
  const PROMPT_WIDTH = PROMPT_TEXT.length;
  const promptLine = () => `${bold(cyan("┃ "))}${bold(cyan("soryos › "))}`;

  const draw = () => {
    output.write("\r\x1b[K");
    output.write(`${promptLine()}${buffer}`);
    // Replace la ligne par le buffer + curseur visible.
    output.write(`\x1b[${buffer.length - cursor}D`);
    output.write("\x1b[?25h");
  };

  const clearLine = () => {
    output.write("\r\x1b[K");
  };

  const submit = (text: string) => {
    const value = text.trim();
    buffer = "";
    cursor = 0;
    historyIndex = -1;
    clearLine();
    if (!value) {
      draw();
      return;
    }
    if (history[history.length - 1] !== value) {
      history.push(value);
      if (history.length > 100) history.shift();
    }
    void runLine(value);
  };

  const runLine = async (text: string) => {
    const slash = text.startsWith("/")
      ? (() => {
          const parts = text.slice(1).trim().split(/\s+/);
          return [parts[0]?.toLowerCase() ?? "", parts.slice(1)] as [string, string[]];
        })()
      : null;

    if (slash) {
      const [cmd, args] = slash;
      let outcome: SlashOutcome;
      try {
        outcome = await handleSlash(cmd, args, session, agentId, input);
      } catch (err: any) {
        println(danger(`✖ ${err?.message ?? err}`));
        draw();
        return;
      }

      if (outcome.session) session = outcome.session;
      if (outcome.agentId) agentId = outcome.agentId;
      if (outcome.model) {
        model = outcome.model;
        // MISE À JOUR CIBLÉE : ne jamais réécrire l'objet local, il ne
        // contient pas l'historique (l'agent travaille sur l'objet du store).
        sessionStore.update(session.id, { model });
        ok(`Model set to ${model}`);
      }
      if (outcome.providerId) {
        await setActiveProvider(outcome.providerId);
        const providerName = PROVIDER_REGISTRY[outcome.providerId]?.name ?? outcome.providerId;
        ok(`Provider set to ${providerName}`);

        // Le modèle doit suivre le provider : un modèle Gemini avec un
        // provider OpenAI échoue (le modèle détermine le provider appelé).
        const newDefault = defaultModelFor(outcome.providerId);
        if (!providerOwnsModel(outcome.providerId, model)) {
          model = newDefault;
          sessionStore.update(session.id, { model });
          ok(`Model set to ${model} (default of ${providerName})`);
        }
      }
      if (outcome.action === "exit") {
        exitCode = outcome.exitCode ?? EXIT_OK;
        input.stop();
        return;
      }
      draw();
      return;
    }

    running = true;
    // Le renderer affiche déjà l'événement canonique `error`.
    let failureReported = false;
    try {
      const outcome = await executeRun({
        session,
        prompt: text,
        agentId,
        modelId: model,
        apiKey: opts.apiKey,
        formatJson: opts.formatJson,
        auto: opts.auto,
        onFailure: () => {
          failureReported = true;
        },
      });

      if (outcome.status === "failed") {
        exitCode = EXIT_ERROR;
        if (!failureReported && !opts.formatJson) {
          println(danger(`✖ ${outcome.error ?? "Unknown error"}`));
        }
      }

      const latest = sessionStore.get(session.id);
      if (latest) await cliSessionStore.save(latest);
    } catch (err: any) {
      exitCode = EXIT_ERROR;
      if (!opts.formatJson) println(danger(`✖ ${err?.message ?? err}`));
    } finally {
      running = false;
      if (!opts.formatJson) println("");
      draw();
    }
  };

  const onKey = (key: TerminalKey) => {
    // Souris / tactile : un tap positionne le curseur dans la ligne de saisie.
    const mouse = parseMouseEvent(key.sequence ?? "");
    if (mouse) {
      if (mouse.type !== "press" || mouse.button !== 0) return;
      // La ligne de saisie est la dernière ligne écrite : on place le curseur
      // à la colonne cliquée (borné à la longueur du buffer).
      const col = Math.max(0, mouse.col - PROMPT_WIDTH - 1);
      if (col <= buffer.length) {
        cursor = col;
        draw();
      }
      return;
    }

    if (key.ctrl && key.name === "c") {
      if (buffer.length === 0) {
        println(warn("\nInterrupted."));
        exitCode = EXIT_INTERRUPT;
        input.stop();
        return;
      }
      buffer = "";
      clearLine();
      draw();
      return;
    }
    if (key.ctrl && key.name === "d") {
      if (buffer.length === 0) {
        exitCode = EXIT_OK;
        input.stop();
        return;
      }
      return;
    }
    if (key.name === "return" || key.name === "enter") {
      submit(buffer);
      return;
    }
    if (key.name === "backspace") {
      if (cursor > 0) {
        buffer = buffer.slice(0, cursor - 1) + buffer.slice(cursor);
        cursor--;
        draw();
      }
      return;
    }
    if (key.name === "delete") {
      if (cursor < buffer.length) {
        buffer = buffer.slice(0, cursor) + buffer.slice(cursor + 1);
        draw();
      }
      return;
    }
    if (key.name === "left") {
      if (cursor > 0) {
        cursor--;
        draw();
      }
      return;
    }
    if (key.name === "right") {
      if (cursor < buffer.length) {
        cursor++;
        draw();
      }
      return;
    }
    if (key.name === "home") {
      cursor = 0;
      draw();
      return;
    }
    if (key.name === "end") {
      cursor = buffer.length;
      draw();
      return;
    }
    if (key.name === "up") {
      if (!history.length) return;
      historyIndex = historyIndex < 0 ? history.length - 1 : Math.max(0, historyIndex - 1);
      buffer = history[historyIndex] ?? "";
      cursor = buffer.length;
      draw();
      return;
    }
    if (key.name === "down") {
      if (historyIndex < 0) return;
      historyIndex = historyIndex + 1;
      if (historyIndex >= history.length) {
        historyIndex = -1;
        buffer = "";
      } else {
        buffer = history[historyIndex];
      }
      cursor = buffer.length;
      draw();
      return;
    }
    if (key.name === "escape") {
      buffer = "";
      cursor = 0;
      clearLine();
      draw();
      return;
    }
    if (key.sequence && key.sequence >= " " && !key.ctrl && !key.meta) {
      buffer = buffer.slice(0, cursor) + key.sequence + buffer.slice(cursor);
      cursor += key.sequence.length;
      draw();
    }
  };

  const pop = input.push(onKey);

  println(bold(cyan("SoryOS-Code interactive")));
  println(dim(`Session: ${session.id}  Agent: ${agentId}  Model: ${model}`));
  println(dim("Type /help for slash commands, /exit to quit."));
  println("");
  draw();

  // Attend la fin de la boucle (input.stop() ou sortie du process).
  await new Promise<void>((resolve) => {
    const check = setInterval(() => {
      if (input.depth === 0) {
        clearInterval(check);
        resolve();
      }
    }, 50);
  });

  pop();
  input.stop();

  return exitCode;
}
