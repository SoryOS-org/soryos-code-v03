/**
 * Spec — arbre de commandes déclaratif + registre de handlers lazy.
 * Mécanisme adapté du pattern opencode (Spec.make + handlers () => import()),
 * réimplémenté en Promise pur, sans Effect, zéro dépendance.
 */

import { SessionTargetFlags, ModelFlags, FormatFlags, PermissionFlags } from "./flags";

export interface FlagSpec {
  type: "string" | "boolean";
  name: string;
  alias?: string;
  description?: string;
  /** Valeur par défaut (boolean: false si absent) */
  default?: string | boolean;
  /** Valeurs autorisées (ferme le type) */
  choices?: readonly string[];
  /** Variadic: capture toutes les occurrences (--file a --file b) */
  repeatable?: boolean;
  /** Hidden: non affiché dans l'aide */
  hidden?: boolean;
}

export interface ArgSpec {
  name: string;
  description?: string;
  required?: boolean;
  variadic?: boolean;
}

export interface CommandSpec {
  name: string;
  description: string;
  aliases?: string[];
  args?: ArgSpec[];
  flags?: FlagSpec[];
  subcommands?: CommandSpec[];
}

export interface ParsedInvocation {
  /** Chemin des noms de commandes, ex: ["session", "list"] */
  path: string[];
  /** Nœud de commande résolu */
  spec: CommandSpec;
  /** Arguments positionnels (hors nom de commande) */
  positionals: string[];
  /** Flags parsés: nom canonique -> valeur */
  flags: Record<string, string | boolean | string[]>;
}

export interface CommandContext {
  invocation: ParsedInvocation;
  /** write sur stderr (chrome terminal) */
  stderr: (line?: string) => void;
  /** write sur stdout (données) */
  stdout: (chunk: string) => void;
}

export type CommandHandler = (ctx: CommandContext) => Promise<number | void> | number | void;

type HandlerNode = CommandHandler | { [key: string]: HandlerNode };

const GLOBAL_FLAGS: FlagSpec[] = [
  { type: "boolean", name: "help", alias: "h", description: "Show help" },
];

function findFlag(flags: FlagSpec[] | undefined, name: string): FlagSpec | undefined {
  if (!flags) return undefined;
  return flags.find((f) => f.name === name || f.alias === name);
}

function collectSubcommand(spec: CommandSpec, name: string): CommandSpec | undefined {
  return spec.subcommands?.find((c) => c.name === name || (c.aliases ?? []).includes(name));
}

/** Résout le plus long préfixe de sous-commandes correspondant à argv. */
function resolvePath(root: CommandSpec, argv: string[]): { spec: CommandSpec; rest: string[] } {
  let spec = root;
  let i = 0;
  while (i < argv.length) {
    const token = argv[i];
    if (token.startsWith("-")) break;
    const sub = collectSubcommand(spec, token);
    if (!sub) break;
    spec = sub;
    i++;
  }
  return { spec, rest: argv.slice(i) };
}

/** Parse les flags/args restants pour un nœud de commande. */
function parseFlags(
  spec: CommandSpec,
  rest: string[],
): { flags: Record<string, string | boolean | string[]>; positionals: string[]; error?: string } {
  const allFlags = [...(spec.flags ?? []), ...GLOBAL_FLAGS];
  const flags: Record<string, string | boolean | string[]> = {};
  const positionals: string[] = [];
  let passthrough: string[] | null = null;

  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];

    if (passthrough) {
      passthrough.push(token);
      continue;
    }
    if (token === "--") {
      passthrough = [];
      continue;
    }

    if (token.startsWith("--")) {
      const eq = token.indexOf("=");
      const rawName = eq === -1 ? token.slice(2) : token.slice(2, eq);
      const inlineValue = eq === -1 ? undefined : token.slice(eq + 1);
      const flag = findFlag(allFlags, rawName);
      if (!flag) return { flags, positionals, error: `Unknown flag: --${rawName}` };

      if (flag.type === "boolean") {
        flags[flag.name] = inlineValue === undefined ? true : inlineValue !== "false";
        continue;
      }
      const value = inlineValue ?? rest[++i];
      if (value === undefined) return { flags, positionals, error: `Flag --${flag.name} requires a value` };
      if (flag.choices && !flag.choices.includes(value)) {
        return { flags, positionals, error: `Flag --${flag.name} must be one of: ${flag.choices.join(", ")}` };
      }
      if (flag.repeatable) {
        const arr = (flags[flag.name] as string[] | undefined) ?? [];
        arr.push(value);
        flags[flag.name] = arr;
      } else {
        flags[flag.name] = value;
      }
      continue;
    }

    if (token.startsWith("-") && token.length > 1) {
      const rawName = token.slice(1);
      const flag = findFlag(allFlags, rawName);
      if (!flag) return { flags, positionals, error: `Unknown flag: -${rawName}` };
      if (flag.type === "boolean") {
        flags[flag.name] = true;
        continue;
      }
      const value = rest[++i];
      if (value === undefined) return { flags, positionals, error: `Flag -${rawName} requires a value` };
      flags[flag.name] = value;
      continue;
    }

    positionals.push(token);
  }

  if (passthrough) flags["__"] = passthrough;

  // defaults + required
  for (const flag of allFlags) {
    if (flags[flag.name] === undefined && flag.default !== undefined) {
      flags[flag.name] = flag.default;
    }
  }
  const argSpecs = spec.args ?? [];
  const requiredCount = argSpecs.filter((a) => a.required).length;
  if (positionals.length < requiredCount) {
    const missing = argSpecs.filter((a) => a.required).map((a) => `<${a.name}>`);
    return { flags, positionals, error: `Missing required argument(s): ${missing.join(" ")}` };
  }
  if (!argSpecs.some((a) => a.variadic) && positionals.length > argSpecs.length) {
    return { flags, positionals, error: `Unexpected argument: ${positionals[argSpecs.length]}` };
  }

  return { flags, positionals };
}

/** Parse argv complet contre l'arbre de commandes. */
export function parseInvocation(root: CommandSpec, argv: string[]): ParsedInvocation | { error: string; spec: CommandSpec } {
  const { spec, rest } = resolvePath(root, argv);
  const { flags, positionals, error } = parseFlags(spec, rest);
  if (error) return { error, spec };
  const path: string[] = [];
  let node: CommandSpec | undefined = root;
  // retrace le chemin depuis argv
  let idx = 0;
  while (node && idx < argv.length && !argv[idx].startsWith("-")) {
    const sub = collectSubcommand(node, argv[idx]);
    if (!sub) break;
    path.push(sub.name);
    node = sub;
    idx++;
  }
  return { path, spec, positionals, flags };
}

/** Résout le handler lazy correspondant à un chemin de commandes. */
export function resolveHandler(handlers: HandlerNode, path: string[]): CommandHandler | undefined {
  let node: HandlerNode = handlers;
  for (const segment of path) {
    if (typeof node === "function") return undefined;
    const next: HandlerNode | undefined = node[segment];
    if (next === undefined) return undefined;
    node = next;
  }
  return typeof node === "function" ? node : undefined;
}

/** Rend l'aide d'un nœud de commande (ou de la racine). */
export function renderHelp(root: CommandSpec, spec: CommandSpec, path: string[]): string {
  const lines: string[] = [];
  const full = [root.name, ...path].join(" ");
  lines.push(`${spec.description}`);
  lines.push("");
  lines.push("USAGE:");
  const usageParts = [full];
  if (spec.subcommands?.length) usageParts.push("<command>");
  if (spec.args?.length) {
    for (const arg of spec.args) {
      usageParts.push(arg.variadic ? `[${arg.name}...]` : arg.required ? `<${arg.name}>` : `[${arg.name}]`);
    }
  }
  if (spec.flags?.length) usageParts.push("[options]");
  lines.push(`  ${usageParts.join(" ")}`);

  if (spec.subcommands?.length) {
    lines.push("");
    lines.push("COMMANDS:");
    const width = Math.max(...spec.subcommands.map((c) => c.name.length));
    for (const sub of spec.subcommands) {
      lines.push(`  ${sub.name.padEnd(width + 2)}${sub.description}`);
    }
  }

  const visibleFlags = [...(spec.flags ?? []), ...(path.length === 0 ? GLOBAL_FLAGS : [])].filter((f) => !f.hidden);
  if (visibleFlags.length) {
    lines.push("");
    lines.push("OPTIONS:");
    const rendered = visibleFlags.map((f) => {
      const short = f.alias ? `-${f.alias}, ` : "    ";
      const value = f.type === "string" ? ` <${f.choices ? f.choices.join("|") : "value"}>` : "";
      return { label: `  ${short}--${f.name}${value}`, description: f.description ?? "" };
    });
    const width = Math.max(...rendered.map((r) => r.label.length));
    for (const r of rendered) {
      lines.push(`${r.label.padEnd(width + 2)}${r.description}`);
    }
  }

  return lines.join("\n");
}

/**
 * Déclaration de l'arbre de commandes du CLI.
 * Les feuilles sont des handlers lazy (() => import(...)).
 * Alias au-delà du premier deviennent des commandes sœurs partageant params/sous-commandes.
 */
export const ROOT_SPEC: CommandSpec = {
  name: "soryos-code",
  description: "SoryOS-Code Autonomous CLI Engine",
  args: [],
  flags: [],
  subcommands: [
    {
      name: "run",
      description: "Exécution non-interactive d'un prompt unique",
      args: [
        { name: "message", description: "Prompt text (can be piped via stdin)", variadic: true },
      ],
      flags: [
        ...SessionTargetFlags,
        ...ModelFlags,
        ...FormatFlags,
        ...PermissionFlags,
        { type: "string", name: "title", description: "Titre de la session" },
      ],
    },
    {
      name: "interactive",
      description: "Session interactive dans le terminal (REPL)",
      aliases: ["i", "chat"],
      flags: [
        ...SessionTargetFlags,
        ...ModelFlags,
        ...FormatFlags,
        ...PermissionFlags,
        { type: "string", name: "title", description: "Titre de la session" },
      ],
    },
    {
      name: "session",
      description: "Gestion des sessions disque (CLI uniquement)",
      subcommands: [
        { name: "list", description: "Liste toutes les sessions" },
        { name: "delete", description: "Supprime une session", args: [{ name: "id", description: "Session ID" }] },
        { name: "export", description: "Exporte une session en JSON", args: [{ name: "id", description: "Session ID" }] },
        { name: "import", description: "Importe une session depuis un fichier JSON", args: [{ name: "file", description: "Chemin du fichier JSON" }] },
      ],
    },
    {
      name: "models",
      description: "Liste les modèles disponibles dans le registre",
    },
    {
      name: "auth",
      description: "Gère les identifiants des providers (list/login/logout/switch)",
      subcommands: [
        { name: "list", description: "Affiche l'état de chaque provider" },
        { name: "login", description: "Connecte un provider (saisie masquée)", args: [{ name: "provider", description: "Provider id (ex: google)" }] },
        { name: "logout", description: "Déconnecte un provider", args: [{ name: "provider", description: "Provider id" }] },
        { name: "switch", description: "Définit le provider actif", args: [{ name: "provider", description: "Provider id" }] },
      ],
    },
    {
      name: "debug",
      description: "Outils de diagnostic",
      subcommands: [
        { name: "paths", description: "Affiche les chemins utiles (cwd, sessions dir)" },
        { name: "config", description: "Affiche un résumé de la configuration" },
      ],
    },
    {
      name: "plugin",
      description: "Liste des skills disponibles (markdown sous packages/tool/skills)",
    },
    {
      name: "help",
      description: "Affiche cette aide",
      aliases: ["h"],
    },
  ],
};

/** Helper: rend l'aide complète (racine). */
export function printRootHelp(): void {
  console.log(renderHelp(ROOT_SPEC, ROOT_SPEC, []));
}

/** Helper: rend l'aide d'une sous-commande spécifique. */
export function printCommandHelp(path: string[]): void {
  let node: CommandSpec | undefined = ROOT_SPEC;
  for (const segment of path) {
    const current: CommandSpec | undefined = node;
    if (!current) break;
    const sub: CommandSpec | undefined = current.subcommands?.find(
      (c) => c.name === segment || (c.aliases ?? []).includes(segment),
    );
    if (!sub) break;
    node = sub;
  }
  if (!node) {
    console.log(`Unknown command: ${path.join(" ")}`);
    return;
  }
  console.log(renderHelp(ROOT_SPEC, node, path));
}
