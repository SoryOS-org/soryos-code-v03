/**
 * Terminal input — UNIQUE propriétaire de stdin en mode raw.
 *
 * Le REPL et les pickers (modèle, provider…) partagent le même gestionnaire :
 * une pile de handlers, le dernier actif reçoit les touches. Plus de conflit
 * entre `readline` et un picker (readline garde stdin pour lui).
 *
 * Le décodage des touches est fait ICI, sur les octets bruts, et non par
 * `readline.emitKeypressEvents` : le parseur de Node ne connaît pas les
 * séquences de souris SGR (`\x1b[<button;col;rowM`) et les découplait en
 * caractères individuels. Notre décodeur les reconnaît → le tap (tablette,
 * PC tactile) peut sélectionner un élément.
 */

export interface TerminalKey {
  name?: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  sequence: string;
}

export type KeyHandler = (key: TerminalKey) => void;

/** Événement souris/tactile décodé. */
export interface MouseEvent {
  type: "press" | "release" | "wheel";
  /** 0 = gauche, 1 = milieu, 2 = droit, 64+ = molette. */
  button: number;
  /** Colonne (1-based, comme le terminal). */
  col: number;
  /** Ligne (1-based, comme le terminal). */
  row: number;
}

const SGR_MOUSE = /^\x1b\[<(\d+);(\d+);(\d+)([Mm])$/;

/** Décode une séquence souris SGR (null si ce n'en est pas une). */
export function parseMouseEvent(sequence: string): MouseEvent | null {
  const match = SGR_MOUSE.exec(sequence);
  if (!match) return null;
  const button = Number(match[1]);
  const col = Number(match[2]);
  const row = Number(match[3]);
  const type = match[4] === "M" ? "press" : "release";
  // 64..67 : molette (les boutons étendus encodent des bits).
  const isWheel = button >= 64 && button <= 67;
  return {
    type: isWheel ? "wheel" : type,
    button: isWheel ? button - 64 : button,
    col,
    row,
  };
}

/** Touches speciales (noms opencode/readline), indexées par "params+final". */
const NAMED_KEYS: Record<string, string> = {
  A: "up",
  B: "down",
  C: "right",
  D: "left",
  H: "home",
  F: "end",
  "1~": "home",
  "3~": "delete",
  "4~": "end",
  "5~": "pageup",
  "6~": "pagedown",
  Z: "tab",
};

/**
 * Décode la première touche d'un buffer.
 * @returns la touche + sa longueur, ou null si la séquence est incomplète
 */
export function decodeKey(text: string): { key: TerminalKey; length: number } | null {
  const first = text[0];

  // --- séquences ESC ---------------------------------------------------
  if (first === "\x1b") {
    if (text.length === 1) {
      // ESC seul : on le considère comme la touche Échap.
      return { key: { name: "escape", sequence: "\x1b" }, length: 1 };
    }

    // Mode application : ESC O <lettre> (flèches d'un vieux terminal)
    if (text[1] === "O" && text.length >= 3) {
      const name = NAMED_KEYS[text[2]];
      return { key: { name, sequence: text.slice(0, 3) }, length: 3 };
    }

    // SOURIS SGR : \x1b[<button;col;rowM|m  (et autres séquences CSI)
    if (text[1] === "[") {
      // Les octets de paramètres sont 0x30-0x3F, l'octet final 0x40-0x7E.
      let i = 2;
      while (i < text.length) {
        const code = text.charCodeAt(i);
        if (code < 0x30 || code > 0x3f) break;
        i++;
      }
      if (i >= text.length) {
        // séquence incomplète : on attend la suite
        if (text.length > 64) {
          return { key: { name: "escape", sequence: text }, length: text.length };
        }
        return null;
      }
      const params = text.slice(2, i);
      const sequence = text.slice(0, i + 1);
      if (params.startsWith("<")) {
        // SOURIS : la séquence complète est transmise telle quelle.
        return { key: { name: undefined, sequence }, length: i + 1 };
      }
      const name = NAMED_KEYS[`${params}${text[i]}`] ?? NAMED_KEYS[text[i]];
      return { key: { name, sequence }, length: i + 1 };
    }

    // ESC + caractère (alt+touche)
    return {
      key: { name: text[1].toLowerCase(), meta: true, sequence: text.slice(0, 2) },
      length: 2,
    };
  }

  // --- caractères de contrôle -----------------------------------------
  if (first === "\r" || first === "\n") {
    return { key: { name: "return", sequence: first }, length: 1 };
  }
  if (first === "\x7f" || first === "\b") {
    return { key: { name: "backspace", sequence: first }, length: 1 };
  }
  if (first === "\t") {
    return { key: { name: "tab", sequence: first }, length: 1 };
  }
  if (first === "\x03") {
    return { key: { name: "c", ctrl: true, sequence: first }, length: 1 };
  }
  if (first === "\x04") {
    return { key: { name: "d", ctrl: true, sequence: first }, length: 1 };
  }
  if (first < " ") {
    // autre contrôle : ignoré
    return { key: { name: undefined, sequence: first }, length: 1 };
  }

  // --- caractère imprimable -------------------------------------------
  return { key: { name: first, sequence: first }, length: 1 };
}

export class TerminalInput {
  private stack: KeyHandler[] = [];
  private started = false;
  private wasRaw = false;
  private mouseEnabled = false;
  private pending = "";
  private cursorWaiters: Array<(pos: { row: number; col: number }) => void> = [];

  /** Démarre la capture clavier (mode raw). */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.wasRaw = Boolean(process.stdin.isRaw);
    if (process.stdin.isTTY) process.stdin.setRawMode?.(true);
    process.stdin.resume();
    process.stdin.on("data", (chunk: Buffer) => this.onData(chunk));
  }

  /** Relâche stdin (et vide la pile de handlers). */
  stop(): void {
    this.stack = [];
    this.pending = "";
    this.disableMouse();
    if (!this.started) return;
    this.started = false;
    if (process.stdin.isTTY) process.stdin.setRawMode?.(this.wasRaw);
    process.stdin.pause();
  }

  /** Empile un handler ; renvoie la fonction pour le dépiler. */
  push(handler: KeyHandler): () => void {
    this.stack.push(handler);
    return () => {
      const index = this.stack.indexOf(handler);
      if (index >= 0) this.stack.splice(index, 1);
    };
  }

  /** Nombre de handlers actifs. */
  get depth(): number {
    return this.stack.length;
  }

  /* ------------------------------------------------------------------ */
  /* Souris / tactile                                                     */
  /* ------------------------------------------------------------------ */

  /**
   * Active la traçabilité de la souris (mode SGR 1006 + bouton 1000).
   * Les terminaux mobiles et tactiles émettent alors des événements
   * interpretables comme des clics.
   */
  enableMouse(): void {
    if (this.mouseEnabled) return;
    this.mouseEnabled = true;
    process.stdout.write("\x1b[?1000h\x1b[?1006h");
  }

  /** Désactive la traçabilité de la souris. */
  disableMouse(): void {
    if (!this.mouseEnabled) return;
    this.mouseEnabled = false;
    process.stdout.write("\x1b[?1006l\x1b[?1000l");
  }

  /** La traçabilité souris est-elle active ? */
  get mouseActive(): boolean {
    return this.mouseEnabled;
  }

  /* ------------------------------------------------------------------ */
  /* Position du curseur (DPR)                                            */
  /* ------------------------------------------------------------------ */

  /**
   * Demande la position du curseur à l'écran (séquence DPR).
   * @returns la ligne (1-based) et la colonne du curseur
   */
  queryCursorPosition(timeoutMs = 500): Promise<{ row: number; col: number }> {
    return new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        resolve({ row: 0, col: 0 });
      }, timeoutMs);

      this.cursorWaiters.push((pos) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(pos);
      });

      process.stdout.write("\x1b[6n");
    });
  }

  /* ------------------------------------------------------------------ */
  /* Décodage                                                             */
  /* ------------------------------------------------------------------ */

  private onData(chunk: Buffer): void {
    this.pending += chunk.toString("utf8");

    while (this.pending.length) {
      const parsed = decodeKey(this.pending);
      if (!parsed) break; // séquence incomplète : on attend la suite
      this.pending = this.pending.slice(parsed.length);
      this.dispatch(parsed.key);
    }
  }

  private dispatch(key: TerminalKey): void {
    // Réponse à une interrogation de position du curseur (DPR).
    const report = /^\x1b\[(\d+);(\d+)R$/.exec(key.sequence);
    if (report) {
      const pos = { row: Number(report[1]), col: Number(report[2]) };
      this.cursorWaiters.shift()?.(pos);
      return;
    }

    const handler = this.stack[this.stack.length - 1];
    if (!handler) return;
    try {
      handler(key);
    } catch {
      /* une erreur de handler ne doit pas casser la boucle */
    }
  }

}
