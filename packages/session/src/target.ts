/**
 * Session Target — résolution UNIQUEMENT partagée du « où est ma session ? ».
 *
 * Mécanisme adapté du pattern opencode (`session-target.ts`), réécrit en
 * TypeScript pur pour notre architecture : la cible est résolue par un
 * `SessionSource` abstrait, donc la même implémentation sert le store
 * in-memory (@soryos/session) et le store disque du CLI.
 *
 * Règles :
 *  - `--fork` sans `--session`/`--continue`  → erreur honnête
 *  - `--session <id>` sur une session absente → cette id devient la nouvelle session
 *  - `--continue` → session la plus récente (filtre `cwd` optionnel)
 *  - `--fork` → copie de la session source avec un nouvel id et le même historique
 */

import { SessionData } from "@soryos/schema";

/** Source de sessions : abstrait le stockage (in-memory ou disque). */
export interface SessionSource {
  /** Récupère une session par id (null si absente). */
  get(id: string): Promise<SessionData | null>;
  /** Liste toutes les sessions. */
  list(): Promise<SessionData[]>;
  /** Crée une session (l'écriture disque, si_any, se fait via `persist`). */
  create(data: Partial<SessionData>): SessionData;
  /**
   * Persiste la session créée. Optionnel : les sources in-memory n'en ont pas
   * besoin. DOIT être attendu avant de poursuivre (pas de fire-and-forget :
   * une écriture concurrente sur le même fichier perdrait des données).
   */
  persist?(session: SessionData): Promise<void>;
}

/** Cible de session résolue. */
export type SessionTarget =
  | { kind: "new"; id: string }
  | { kind: "resume"; id: string }
  | { kind: "fork"; sourceId: string; id: string };

export interface ResolveSessionTargetOptions {
  /** `--session <id>` */
  sessionId?: string;
  /** `--continue` */
  continueLast?: boolean;
  /** `--fork` */
  fork?: boolean;
  /** `--title` */
  title?: string;
  /** Filtre de localisation pour `--continue` (cwd). */
  cwd?: string;
  /** Champs par défaut de la session créée (modèle, provider, titre…). */
  template?: Partial<SessionData>;
  /** Fabrique d'id pour les nouvelles sessions / forks. */
  generateId?: () => string;
}

export interface ResolvedSessionTarget {
  target: SessionTarget;
  session: SessionData;
}

/** Fabrique d'id par défaut (lisible, unique, sans dépendance). */
export function defaultSessionId(): string {
  return `cli-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Timestamp de dernière activité d'une session (pour trier). */
function activityTime(session: SessionData): number {
  const last = session.messages[session.messages.length - 1];
  const parsed = Date.parse(last?.created_at ?? session.created_at);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Résout la session cible selon les options et la source.
 * @throws Error (honnête) si les options sont contradictoires.
 */
export async function resolveSessionTarget(
  opts: ResolveSessionTargetOptions,
  source: SessionSource,
): Promise<ResolvedSessionTarget> {
  const generateId = opts.generateId ?? defaultSessionId;
  const template = opts.template ?? {};

  const newSession = async (explicitId?: string): Promise<SessionData> => {
    const id = explicitId ?? generateId();
    const created = source.create({
      ...template,
      id,
      ...(opts.title ? { title: opts.title } : {}),
    });
    // Persistance AWAITÉE (jamais en fire-and-forget : sinon l'écriture
    // concurrente peut écraser l'état final de la session).
    await source.persist?.(created);
    return created;
  };

  // `--fork` sans source explicite → erreur honnête (jamais de fork fantôme).
  if (opts.fork && !opts.sessionId && !opts.continueLast) {
    throw new Error("--fork requires --session or --continue");
  }

  // `--fork` : copie de la source, nouvel id, même historique.
  if (opts.fork) {
    const sourceId = opts.sessionId
      ? opts.sessionId
      : (await newestSession(source, opts.cwd))?.id;

    if (!sourceId) {
      throw new Error("No source session to fork");
    }

    const origin = await source.get(sourceId);
    if (!origin) {
      throw new Error(`Session not found: ${sourceId}`);
    }

    const id = generateId();
    const forked: SessionData = {
      ...origin,
      id,
      sandbox_id: `sandbox-${id}`,
      title: opts.title ?? `${origin.title} (fork)`,
      created_at: new Date().toISOString(),
      messages: origin.messages.slice(),
      agent_running: false,
    };
    source.create(forked);
    await source.persist?.(forked);
    return { target: { kind: "fork", sourceId, id }, session: forked };
  }

  // `--session <id>` : reprise si elle existe, sinon création avec CETTE id.
  if (opts.sessionId) {
    const existing = await source.get(opts.sessionId);
    if (existing) {
      return { target: { kind: "resume", id: existing.id }, session: existing };
    }
    const created = await newSession(opts.sessionId);
    return { target: { kind: "new", id: created.id }, session: created };
  }

  // `--continue` : la session la plus récente (filtrée par cwd si fourni).
  if (opts.continueLast) {
    const latest = await newestSession(source, opts.cwd);
    if (latest) {
      return { target: { kind: "resume", id: latest.id }, session: latest };
    }
  }

  // Défaut : nouvelle session.
  const created = await newSession();
  return { target: { kind: "new", id: created.id }, session: created };
}

/** Session la plus récemment active (optionnellement filtrée par cwd). */
export async function newestSession(
  source: SessionSource,
  cwd?: string,
): Promise<SessionData | null> {
  const all = await source.list();
  const filtered = cwd ? all.filter((s) => !s.cwd || s.cwd === cwd) : all;
  const sorted = filtered.sort((a, b) => activityTime(b) - activityTime(a));
  return sorted[0] ?? null;
}
