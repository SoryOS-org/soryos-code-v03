/**
 * Provider state — le provider IA ACTIF du CLI (celui utilisé par défaut).
 *
 * C'est une préférence UTILISATEUR : elle est stockée globalement
 * (`~/.soryos/credentials.json`) pour que le CLI installé globalement se
 * comporte pareil depuis n'importe quel dossier. Un fichier projet peut
 * surcharger le choix global (même mécanique de couches que les clés).
 */

import { readFile, writeFile, mkdir, rename, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";

const ACTIVE_KEY = "activeProvider";

function projectFile(cwd: string = process.cwd()): string {
  return resolve(cwd, ".soryos", "credentials.json");
}

function globalFile(): string {
  return join(homedir(), ".soryos", "credentials.json");
}

async function readJson(file: string): Promise<Record<string, unknown>> {
  if (!existsSync(file)) return {};
  try {
    const raw = await readFile(file, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

async function writeJson(file: string, data: Record<string, unknown>): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Math.random().toString(36).slice(2, 8)}.tmp`;
  try {
    await writeFile(tmp, JSON.stringify(data, null, 2), { encoding: "utf8", mode: 0o600 });
    await rename(tmp, file);
  } catch (err) {
    await rm(tmp, { force: true });
    throw err;
  }
}

/**
 * Provider actif : le projet surcharge le global.
 */
export async function getActiveProvider(cwd: string = process.cwd()): Promise<string | undefined> {
  for (const file of [projectFile(cwd), globalFile()]) {
    const data = await readJson(file);
    const value = data[ACTIVE_KEY];
    if (typeof value === "string" && value.length) return value;
  }
  return undefined;
}

/**
 * Définit le provider actif.
 * @param scope "global" (défaut, préférence utilisateur) ou "project"
 */
export async function setActiveProvider(
  providerId: string,
  scope: "global" | "project" = "global",
  cwd: string = process.cwd(),
): Promise<void> {
  const file = scope === "global" ? globalFile() : projectFile(cwd);
  const data = await readJson(file);
  data[ACTIVE_KEY] = providerId;
  await writeJson(file, data);
}

/** Retire le provider actif. */
export async function clearActiveProvider(cwd: string = process.cwd()): Promise<void> {
  for (const file of [projectFile(cwd), globalFile()]) {
    const data = await readJson(file);
    if (ACTIVE_KEY in data) {
      delete data[ACTIVE_KEY];
      await writeJson(file, data);
    }
  }
}
