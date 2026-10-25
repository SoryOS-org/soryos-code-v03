/**
 * Debug paths — chemins utiles du CLI / repo.
 */
import { println, EXIT_OK } from "../../framework/ui";
import { CLI_SESSIONS_DIR } from "../../cli-session-store";
import { resolve } from "node:path";

export async function debugPathsHandler(): Promise<number> {
  const cwd = process.cwd();
  const dir = resolve(cwd, CLI_SESSIONS_DIR);
  println("Paths:");
  println(`  cwd:                    ${cwd}`);
  println(`  cli sessions dir:       ${dir}`);
  return EXIT_OK;
}