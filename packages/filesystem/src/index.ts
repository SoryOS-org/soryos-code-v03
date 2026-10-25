
/**
 * @soryos/filesystem
 * Filesystem operations including remote providers.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as fsSync from "node:fs";

export class FileSystem {
  public async readFile(filePath: string): Promise<string> {
    try {
      return await fs.readFile(filePath, "utf-8");
    } catch {
      return "";
    }
  }

  public async listFiles(dirPath: string = "."): Promise<Array<{ path: string; name: string }>> {
    try {
      if (!fsSync.existsSync(dirPath)) return [];
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      return entries.map((e) => ({
        path: path.join(dirPath, e.name),
        name: e.name,
      }));
    } catch {
      return [];
    }
  }
}

export const fileManager = new FileSystem();

export * from "./remote-provider";
