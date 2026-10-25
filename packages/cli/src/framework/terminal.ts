/**
 * Terminal UI primitives — bordered boxes, secret input, interactive picker.
 *
 * Mechanisms adapted from opencode's TUI (bordered prompt area, dialog
 * select with filter + cursor) but implemented in plain ANSI: no TUI
 * framework, no Solid, no opentui.
 */

import * as readline from "node:readline";
import { bold, cyan, dim, green, red, yellow } from "./ui";
import { TerminalInput, parseMouseEvent, type TerminalKey } from "./input";

/* -------------------------------------------------------------------------- */
/* Boîtes bordées                                                             */
/* -------------------------------------------------------------------------- */

export interface BoxOptions {
  title?: string;
  /** Lignes du contenu (sans bordure). */
  lines?: string[];
  /** Largeur totale (bordures incluses). Par défaut : adaptative. */
  width?: number;
}

/** Caractères de bordure (coins arrondis, comme opencode). */
const BOX = {
  topLeft: "╭",
  topRight: "╮",
  bottomLeft: "╰",
  bottomRight: "╯",
  horizontal: "─",
  vertical: "│",
};

/** Largeur du terminal (80 par défaut). */
export function terminalWidth(): number {
  const cols = process.stderr.columns;
  if (typeof cols === "number" && cols > 0) return cols;
  const env = Number(process.env.COLUMNS);
  if (Number.isFinite(env) && env > 0) return env;
  return 80;
}

/**
 * Largeur de boîte adaptive : elle suit le terminal, avec une marge et des
 * bornes (une boîte plus large que l'écran déborde et casse l'alignement).
 */
export function boxWidth(max = 100): number {
  const cols = terminalWidth();
  return Math.max(20, Math.min(cols - 2, max));
}

/** Longueur VISIBLE d'un texte (les codes ANSI ne comptent pas). */
export function visibleLength(text: string): number {
  return text.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "").length;
}

/**
 * Tronque un texte à une largeur VISIBLE, en préservant les codes ANSI
 * (et en refermant les couleurs ouvertes). L'ellipse compte dans la largeur.
 */
export function truncateVisible(text: string, max: number): string {
  if (max <= 0) return "";
  if (visibleLength(text) <= max) return text;

  const limit = Math.max(1, max - 1); // place pour l'ellipse
  let visible = 0;
  let out = "";
  let i = 0;
  while (i < text.length && visible < limit) {
    if (text[i] === "\x1b") {
      const match = /^\x1b\[[0-9;?]*[a-zA-Z]/.exec(text.slice(i));
      if (match) {
        out += match[0];
        i += match[0].length;
        continue;
      }
    }
    out += text[i];
    visible++;
    i++;
  }
  return `${out}…\x1b[0m`;
}

/** Complète un texte à la largeur visible exacte. */
function pad(text: string, width: number): string {
  const len = visibleLength(text);
  return len >= width ? text : text + " ".repeat(width - len);
}

/**
 * Dessine une boîte bordée (retourne les lignes, sans saut de ligne).
 * Le contenu est TRONQUÉ à la largeur intérieure : la bordure droite reste
 * alignée quelle que soit la longueur du texte.
 */
export function drawBox(opts: BoxOptions): string[] {
  const width = opts.width ?? boxWidth();
  const inner = Math.max(4, width - 4); // "│ " + " │"

  // Le titre est tronqué pour que la bordure haute garde la largeur exacte.
  const rawTitle = opts.title ? ` ${opts.title} ` : "";
  const title = rawTitle ? truncateVisible(rawTitle, Math.max(0, width - 4)) : "";
  const topFill = Math.max(0, width - 2 - visibleLength(title));
  const top = `${BOX.topLeft}${title}${BOX.horizontal.repeat(topFill)}${BOX.topRight}`;

  const body = (opts.lines ?? []).map((line) => {
    const clipped = truncateVisible(line, inner);
    return `${BOX.vertical} ${pad(clipped, inner)} ${BOX.vertical}`;
  });

  return [top, ...body, `${BOX.bottomLeft}${BOX.horizontal.repeat(width - 2)}${BOX.bottomRight}`];
}

/** Affiche une boîte sur stderr. */
export function printBox(opts: BoxOptions): void {
  for (const line of drawBox(opts)) {
    process.stderr.write(`${line}\n`);
  }
}

/* -------------------------------------------------------------------------- */
/* Saisie de secret (masquée)                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Lit une ligne en masquant la saisie (comme le champ password d'opencode).
 * @param prompt texte affiché avant la saisie
 * @param input gestionnaire partagé (créé à la demande si absent)
 * @returns la valeur saisie (vide si l'utilisateur annule)
 */
export async function readSecret(prompt: string, input?: TerminalInput): Promise<string> {
  const output = process.stderr;
  const terminal = input ?? new TerminalInput();
  const owned = !input;

  if (owned) terminal.start();
  output.write(prompt);

  return new Promise<string>((resolve) => {
    let value = "";

    const onKey = (key: TerminalKey) => {
      if (key.ctrl && (key.name === "c" || key.name === "d")) {
        output.write("\n");
        pop();
        if (owned) terminal.stop();
        resolve("");
        return;
      }
      if (key.name === "return" || key.name === "enter") {
        output.write("\n");
        pop();
        if (owned) terminal.stop();
        resolve(value);
        return;
      }
      if (key.name === "backspace") {
        if (value.length) {
          value = value.slice(0, -1);
          output.write("\b \b");
        }
        return;
      }
      if (key.sequence && key.sequence >= " " && !key.ctrl && !key.meta) {
        value += key.sequence;
        output.write("*");
      }
    };

    const pop = terminal.push(onKey);
  });
}

/* -------------------------------------------------------------------------- */
/* Picker interactif                                                          */
/* -------------------------------------------------------------------------- */

export interface PickerOption<T> {
  value: T;
  title: string;
  description?: string;
  footer?: string;
  /** Groupe (affiché en tête de section). */
  category?: string;
}

export interface PickerOptions<T> {
  title: string;
  options: PickerOption<T>[];
  /** Ligne d'aide sous la liste. */
  hint?: string;
  /** Nombre d'options visibles. */
  visible?: number;
  /** Filtre activé (l'utilisateur tape pour filtrer). */
  filter?: boolean;
}

/**
 * Picker interactif : champ de recherche, ↑/↓ pour naviguer, Entrée pour
 * choisir, Échap pour annuler, **clic/tap** pour sélectionner directement.
 * @param input gestionnaire de clavier partagé (REPL + picker)
 * @returns la valeur choisie, ou null si annulé
 */
export async function pick<T>(
  opts: PickerOptions<T>,
  input: TerminalInput,
): Promise<T | null> {
  const output = process.stderr;

  let query = "";
  let index = 0;
  let offset = 0;
  let lastHeight = 0;
  /** Ligne de la boîte (dans la boîte) → index d'option (undefined = non sélectionnable). */
  let lineToItem = new Map<number, number>();
  /** Ligne écran du haut de la boîte (1-based). */
  let baseRow = 0;
  /** Option pressée à la souris (pour confirmer au relâchement). */
  let pressedItem: number | null = null;

  const filtered = (): PickerOption<T>[] => {
    if (!query) return opts.options;
    const q = query.toLowerCase();
    return opts.options.filter((o) => {
      const hay = `${o.title} ${o.description ?? ""} ${o.category ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  };

  const render = () => {
    // --- largeur adaptative ---------------------------------------------
    const width = boxWidth();
    const inner = Math.max(4, width - 4);
    const narrow = inner < 46; //终端 étroit (mobile) : on allège
    const visible = Math.max(3, Math.min(opts.visible ?? 10, narrow ? 6 : 12, Math.max(3, Math.floor((process.stderr.rows ?? 24) / 2))));

    const list = filtered();

    if (index >= list.length) index = Math.max(0, list.length - 1);
    if (index < offset) offset = index;
    if (index >= offset + visible) offset = index - visible + 1;

    const lines: string[] = [];
    const map = new Map<number, number>();

    // Champ de recherche (toujours actif).
    map.set(lines.length, -1);
    lines.push(`${dim("Search:")} ${query}${cyan("▌")}`);

    if (!list.length) {
      map.set(lines.length, -1);
      lines.push(dim("  (no match)"));
    }

    let lastCategory: string | undefined;
    for (let i = offset; i < Math.min(list.length, offset + visible); i++) {
      const option = list[i];
      if (option.category && option.category !== lastCategory) {
        lastCategory = option.category;
        map.set(lines.length, -1); // en-tête de groupe : non sélectionnable
        lines.push(dim(`  ${option.category}`));
      }
      const active = i === index;
      const marker = active ? cyan("❯") : " ";
      const title = active ? bold(cyan(option.title)) : option.title;

      // La description est tronquée à la place DISPONIBLE (jamais de
      // débordement : la bordure droite doit rester alignée).
      const prefix = `${marker} ${title}`;
      const used = visibleLength(prefix);
      const room = inner - used - 3;
      const desc = !narrow && option.description && room > 6 ? dim(` — ${option.description}`) : "";
      const clippedDesc = desc ? truncateVisible(desc, room) : "";

      map.set(lines.length, i);
      lines.push(`${prefix}${clippedDesc}`);
    }

    if (list.length > visible) {
      map.set(lines.length, -1);
      lines.push(dim(`  … ${list.length - visible} more`));
    }

    map.set(lines.length, -1);
    lines.push(
      dim(
        narrow
          ? "↑/↓ · enter · esc"
          : (opts.hint ?? "↑/↓ navigate · enter select · esc cancel"),
      ),
    );

    lineToItem = map;

    // Efface l'affichage précédent et redessine.
    if (lastHeight > 0) {
      output.write(`\x1b[${lastHeight}A`);
    } else {
      // Premier rendu : on revient en début de ligne, sinon la boîte
      // commence à la suite du prompt et dépasse la largeur du terminal.
      output.write("\r\x1b[K");
    }
    const box = drawBox({ title: opts.title, lines, width });
    for (const line of box) output.write(`${line}\n`);
    lastHeight = box.length;
  };

  let cleanupResize: (() => void) | null = null;

  const promise = new Promise<T | null>((resolve) => {
    let done = false;

    const finish = (value: T | null) => {
      if (done) return;
      done = true;
      pop();
      input.disableMouse();
      cleanupResize?.();
      if (lastHeight > 0) {
        output.write(`\x1b[${lastHeight}A`);
        output.write("\x1b[0J");
      }
      resolve(value);
    };

    const onKey = (key: TerminalKey) => {
      // Souris / tactile : un tap (press + release) sélectionne l'élément.
      const mouse = parseMouseEvent(key.sequence ?? "");
      if (mouse) {
        if (mouse.type === "wheel") {
          index = Math.max(0, Math.min(filtered().length - 1, index + (mouse.button === 0 ? -1 : 1)));
          render();
          return;
        }
        if (mouse.button !== 0) return; // uniquement le bouton principal

        // La boîte commence à la ligne `baseRow` : ligne 1 = bordure haute.
        const boxLine = mouse.row - baseRow;
        const item = lineToItem.get(boxLine - 1);

        if (mouse.type === "press") {
          pressedItem = item ?? null;
          if (item !== undefined && item >= 0) {
            index = item;
            render();
          }
          return;
        }
        // relâchement : on confirme si l'option est toujours la même.
        if (pressedItem !== null && pressedItem === item && item >= 0) {
          const list = filtered();
          const chosen = list[item];
          finish(chosen ? chosen.value : null);
        }
        pressedItem = null;
        return;
      }

      if (key.ctrl && key.name === "c") {
        finish(null);
        return;
      }
      if (key.name === "escape") {
        finish(null);
        return;
      }
      if (key.name === "return" || key.name === "enter") {
        const list = filtered();
        const chosen = list[index];
        finish(chosen ? chosen.value : null);
        return;
      }
      if (key.name === "up") {
        index = Math.max(0, index - 1);
        render();
        return;
      }
      if (key.name === "down") {
        index = Math.min(filtered().length - 1, index + 1);
        render();
        return;
      }
      if (key.name === "backspace") {
        if (query.length) {
          query = query.slice(0, -1);
          index = 0;
          offset = 0;
          render();
        }
        return;
      }
      if (key.sequence && key.sequence >= " " && !key.ctrl && !key.meta) {
        query += key.sequence;
        index = 0;
        offset = 0;
        render();
      }
    };

    const pop = input.push(onKey);

    // Traçabilité souris (tap sur tablette / PC tactile).
    input.enableMouse();

    // Redessin au redimensionnement du terminal (rotation d'un mobile).
    const onResize = () => render();
    process.stdout.on("resize", onResize);
    cleanupResize = () => process.stdout.off("resize", onResize);

    // Position du curseur AVANT le premier rendu : elle donne la ligne écran
    // du haut de la boîte (indispensable pour convertir un clic en option).
    void input
      .queryCursorPosition()
      .then((pos) => {
        baseRow = pos.row;
      })
      .finally(() => {
        render();
      });
  });

  return promise;
}

/** Tronque un texte long. */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

/* -------------------------------------------------------------------------- */
/* Confirmations                                                               */
/* -------------------------------------------------------------------------- */

/** Question oui/non (Entrée = oui par défaut). */
export async function confirm(question: string, defaultYes = true): Promise<boolean> {
  const hint = defaultYes ? "Y/n" : "y/N";
  return new Promise<boolean>((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
    rl.question(`${question} ${dim(`(${hint})`)} `, (answer) => {
      rl.close();
      const value = answer.trim().toLowerCase();
      if (!value) resolve(defaultYes);
      else resolve(value === "y" || value === "yes");
    });
  });
}

/** Message de succès (stderr). */
export function ok(message: string): void {
  process.stderr.write(`${green("✔")} ${message}\n`);
}

/** Message d'erreur (stderr). */
export function ko(message: string): void {
  process.stderr.write(`${red("✖")} ${message}\n`);
}

/** Message d'information (stderr). */
export function info(message: string): void {
  process.stderr.write(`${yellow("•")} ${message}\n`);
}
