/**
 * Filesystem-backed key-value storage for plugins.
 * One JSON file per namespace at `.soryos/plugin-storage/<namespace>.json`.
 * NO fake storage — every operation physically reads/writes disk.
 */

import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { PluginStorageDomain } from "./index.js";

/** Root directory (relative to cwd) holding plugin storage files. */
const STORAGE_DIR = ".soryos/plugin-storage";

function sanitizeNamespace(namespace: string): string {
  return namespace.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100) || "default";
}

function storageFile(root: string, namespace: string): string {
  return join(root, `${sanitizeNamespace(namespace)}.json`);
}

async function readAll(root: string, namespace: string): Promise<Record<string, unknown>> {
  const file = storageFile(root, namespace);
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

async function writeAll(
  root: string,
  namespace: string,
  data: Record<string, unknown>,
): Promise<void> {
  await mkdir(root, { recursive: true });
  await writeFile(storageFile(root, namespace), JSON.stringify(data, null, 2), "utf8");
}

/**
 * Create a filesystem-backed PluginStorageDomain.
 * @param namespace Plugin id (or any namespace) — isolates storage per plugin.
 * @param baseDir Override the storage root (defaults to `<cwd>/.soryos/plugin-storage`).
 */
export function createPluginStorage(
  namespace: string,
  baseDir?: string,
): PluginStorageDomain {
  const root = baseDir ? resolve(baseDir) : resolve(process.cwd(), STORAGE_DIR);

  return {
    async get(key: string) {
      const data = await readAll(root, namespace);
      return key in data ? data[key] : null;
    },

    async set(key: string, value: unknown) {
      const data = await readAll(root, namespace);
      data[key] = value;
      await writeAll(root, namespace, data);
    },

    async remove(key: string) {
      const data = await readAll(root, namespace);
      if (!(key in data)) return;
      delete data[key];
      if (Object.keys(data).length === 0) {
        await rm(storageFile(root, namespace), { force: true });
        return;
      }
      await writeAll(root, namespace, data);
    },

    async scan() {
      const data = await readAll(root, namespace);
      return Object.keys(data);
    },
  };
}

/** No-op storage used when no namespace is provided (isolated from disk). */
export function createMemoryStorage(): PluginStorageDomain {
  const store = new Map<string, unknown>();
  return {
    async get(key) {
      return store.has(key) ? store.get(key)! : null;
    },
    async set(key, value) {
      store.set(key, value);
    },
    async remove(key) {
      store.delete(key);
    },
    async scan() {
      return Array.from(store.keys());
    },
  };
}
