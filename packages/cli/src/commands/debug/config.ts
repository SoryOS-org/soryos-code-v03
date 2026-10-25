/**
 * Debug config — résumé de la configuration du CLI / providers.
 */
import { println, EXIT_OK } from "../../framework/ui";
import { detectProviderAndKey } from "../run";

export async function debugConfigHandler(): Promise<number> {
  const creds = await detectProviderAndKey();
  println("Config summary:");
  println(`  Active provider:  ${creds?.provider ?? "none (set GEMINI_API_KEY etc.)"}`);
  println(`  Default model:    gemini-2.5-flash`);
  println(`  Agent roles:      build, plan, explore, code-reviewer`);
  return EXIT_OK;
}