/**
 * Session delete — supprime une session du disque.
 */
import { cliSessionStore } from "../../cli-session-store";
import { println, red, green, EXIT_OK, EXIT_ERROR } from "../../framework/ui";

export async function sessionDeleteHandler(sessionId: string): Promise<number> {
  const ok = await cliSessionStore.remove(sessionId);
  if (!ok) {
    println(red(`Session "${sessionId}" not found.`));
    return EXIT_ERROR;
  }
  println(green(`Session "${sessionId}" deleted.`));
  return EXIT_OK;
}