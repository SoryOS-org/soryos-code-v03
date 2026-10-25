/**
 * Plugin list — liste les skills markdowne existants (packages/tool/skills/*.md).
 */
import { println, green, dim, EXIT_OK } from "../framework/ui";
import { BUILTIN_SKILLS } from "@soryos/tool";
import { skillDirectoryCandidates } from "@soryos/tool";
import { existsSync } from "node:fs";

export async function pluginHandler(): Promise<number> {
  println("Available skills (packages/tool/skills/*.md):");
  for (const skill of BUILTIN_SKILLS) {
    const found = skillDirectoryCandidates()
      .map((d) => require("path").join(d, `${skill.id}.md`))
      .find(existsSync);
    const status = found ? green("✔") : dim("✗ missing");
    println(`  ${skill.id.padEnd(22)} ${status}  ${skill.name}`);
  }
  return EXIT_OK;
}