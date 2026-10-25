/**
 * Session export — exporte une session JSON (exportable vers autre CLI, ou backup).
 */
import { cliSessionStore } from "../../cli-session-store";
import { println, red, EXIT_OK, EXIT_ERROR } from "../../framework/ui";

export async function sessionExportHandler(sessionId: string): Promise<number> {
  const session = await cliSessionStore.exportSession(sessionId);
  if (!session) {
    println(red(`Session "${sessionId}" not found.`));
    return EXIT_ERROR;
  }
  println(JSON.stringify(session, null, 2));
  return EXIT_OK;
}