/**
 * Session import — importe un JSON de session (écrase ou créé nouvel ID).
 */
import { cliSessionStore } from "../../cli-session-store";
import { println, red, EXIT_OK, EXIT_ERROR } from "../../framework/ui";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export async function sessionImportHandler(jsonPath: string): Promise<number> {
  const abs = resolve(process.cwd(), jsonPath);
  let raw: string;
  try {
    raw = await readFile(abs, "utf8");
  } catch {
    println(red(`Cannot read "${jsonPath}".`));
    return EXIT_ERROR;
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    println(red("Invalid JSON."));
    return EXIT_ERROR;
  }
  const session = await cliSessionStore.importSession(data);
  if (!session) {
    println(red("Invalid session JSON."));
    return EXIT_ERROR;
  }
  println(`Imported session: ${session.id}`);
  return EXIT_OK;
}