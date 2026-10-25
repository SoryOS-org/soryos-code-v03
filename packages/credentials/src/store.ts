/**
 * Disk-backed credential persistence.
 *
 * The in-memory store of `CredentialManager` is lost on restart: this module
 * persists the provider keys on disk so a stored key survives a new process.
 *
 * Two locations (project wins over global, like opencode's config layering):
 *  - `<cwd>/.soryos/credentials.json`   (project scope, gitignored)
 *  - `~/.soryos/credentials.json`       (global scope)
 *
 * The file holds SECRETS: it is written with mode 600 and never logged.
 */

import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

export type CredentialMap = Record<string, Record<string, string>>;

const PROJECT_DIR = ".soryos";
const FILE_NAME = "credentials.json";

/** Fichier global (~/.soryos/credentials.json). */
export function globalCredentialFile(): string {
  return join(homedir(), PROJECT_DIR, FILE_NAME);
}

/** Fichier projet (<cwd>/.soryos/credentials.json). */
export function projectCredentialFile(cwd: string = process.cwd()): string {
  return resolve(cwd, PROJECT_DIR, FILE_NAME);
}

/** Tous les fichiers lus (projet d'abord, global ensuite). */
export function credentialFiles(cwd: string = process.cwd()): string[] {
  return [projectCredentialFile(cwd), globalCredentialFile()];
}

async function readFileSafe(file: string): Promise<CredentialMap> {
  if (!existsSync(file)) return {};
  try {
    const raw = await readFile(file, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: CredentialMap = {};
    for (const [providerId, fields] of Object.entries(parsed as Record<string, unknown>)) {
      if (!fields || typeof fields !== "object" || Array.isArray(fields)) continue;
      const clean: Record<string, string> = {};
      for (const [key, value] of Object.entries(fields as Record<string, unknown>)) {
        if (typeof value === "string" && value.length) clean[key] = value;
      }
      if (Object.keys(clean).length) out[providerId] = clean;
    }
    return out;
  } catch {
    return {};
  }
}

/** Écriture atomique avec permissions 600 (le fichier contient des secrets). */
async function writeFileSafe(file: string, data: CredentialMap): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Math.random().toString(36).slice(2, 8)}.tmp`;
  try {
    await writeFile(tmp, JSON.stringify(data, null, 2), { encoding: "utf8", mode: 0o600 });
    await chmod(tmp, 0o600);
    await rename(tmp, file);
    await chmod(file, 0o600);
  } catch (err) {
    await rm(tmp, { force: true });
    throw err;
  }
}

/**
 * Charge les identifiants depuis le disque (projet puis global).
 * Le projet écrase le global pour un même provider.
 */
export async function readPersistedCredentials(cwd: string = process.cwd()): Promise<CredentialMap> {
  const merged: CredentialMap = {};
  // Global d'abord, projet ensuite (le projet écrase).
  for (const file of credentialFiles(cwd).reverse()) {
    const data = await readFileSafe(file);
    for (const [providerId, fields] of Object.entries(data)) {
      merged[providerId] = { ...(merged[providerId] ?? {}), ...fields };
    }
  }
  return merged;
}

/**
 * Écrit les identifiants d'un provider dans le fichier de portée donné.
 * @param scope "project" (défaut) ou "global"
 */
export async function writePersistedCredentials(
  providerId: string,
  fields: Record<string, string>,
  scope: "project" | "global" = "project",
  cwd: string = process.cwd(),
): Promise<string> {
  const file = scope === "global" ? globalCredentialFile() : projectCredentialFile(cwd);
  const data = await readFileSafe(file);
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === "string" && value.trim()) clean[key] = value.trim();
  }
  data[providerId] = clean;
  await writeFileSafe(file, data);
  return file;
}

/** Supprime les identifiants d'un provider du fichier de portée donné. */
export async function removePersistedCredentials(
  providerId: string,
  scope: "project" | "global" = "project",
  cwd: string = process.cwd(),
): Promise<boolean> {
  const file = scope === "global" ? globalCredentialFile() : projectCredentialFile(cwd);
  if (!existsSync(file)) return false;
  const data = await readFileSafe(file);
  if (!(providerId in data)) return false;
  delete data[providerId];
  if (Object.keys(data).length === 0) {
    await rm(file, { force: true });
    return true;
  }
  await writeFileSafe(file, data);
  return true;
}
