/**
 * Session list — affiche les sessions disque (CLI only, in-memory sessions non stockés).
 */
import { cliSessionStore } from "../../cli-session-store";
import { println, red, green } from "../../framework/ui";
import { EXIT_OK } from "../../framework/ui";

export async function sessionListHandler(): Promise<number> {
  const sessions = await cliSessionStore.list();
  if (sessions.length === 0) {
    println("No sessions found on disk.");
    return EXIT_OK;
  }

  const width = Math.max(...sessions.map((s) => s.id.length));
  println(`  ID${" ".repeat(width - 2)}  Title`);
  println("-".repeat(width + 10));
  for (const s of sessions) {
    const title = s.title || "(untitled)";
    println(`  ${s.id.padEnd(width)}  ${title}`);
  }
  return EXIT_OK;
}