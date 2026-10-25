/**
 * skill — charge des instructions de compétences spécialisées dans la conversation.
 * Les skills sont des fichiers markdown réels sur disque (packages/tool/skills/*.md),
 * lus octet par octet — aucune instruction n'est simulée ou inventée à l'exécution.
 */

import { globalEventBus } from "@soryos/bus";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  /** Optional resources associated with this skill */
  resources?: string[];
  /** Tags for categorization */
  tags?: string[];
}

export interface SkillLoadResult {
  success: boolean;
  output?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Built-in skill registry. The instructions body is NOT inlined here: each id
 * maps to a real markdown file at `packages/tool/skills/<id>.md`, physically
 * read from disk at load time.
 */
export const BUILTIN_SKILLS: SkillDefinition[] = [
  {
    id: "typescript-expert",
    name: "TypeScript Expert",
    description:
      "Expert guidance for TypeScript development including type patterns, generics, decorators, and best practices.",
    tags: ["typescript", "javascript", "types"],
  },
  {
    id: "react-specialist",
    name: "React Specialist",
    description:
      "Specialized knowledge for React development including hooks, performance optimization, and component patterns.",
    tags: ["react", "frontend", "components"],
  },
  {
    id: "api-design",
    name: "API Design",
    description:
      "Guidelines for designing RESTful and GraphQL APIs including versioning, pagination, and error handling.",
    tags: ["api", "rest", "graphql", "backend"],
  },
  {
    id: "testing-strategy",
    name: "Testing Strategy",
    description:
      "Comprehensive testing strategies including unit, integration, and e2e testing patterns.",
    tags: ["testing", "jest", "vitest", "e2e"],
  },
  {
    id: "security-audit",
    name: "Security Audit",
    description:
      "Security best practices for code review including OWASP top 10, authentication, and data protection.",
    tags: ["security", "owasp", "authentication"],
  },
];

export function getSkillDefinition(id: string): SkillDefinition | undefined {
  return BUILTIN_SKILLS.find((s) => s.id === id);
}

export function listSkills(): SkillDefinition[] {
  return BUILTIN_SKILLS;
}

export function searchSkills(query: string): SkillDefinition[] {
  const lower = query.toLowerCase();
  return BUILTIN_SKILLS.filter(
    (s) =>
      s.id.toLowerCase().includes(lower) ||
      s.name.toLowerCase().includes(lower) ||
      s.description.toLowerCase().includes(lower) ||
      s.tags?.some((t) => t.toLowerCase().includes(lower))
  );
}

/** Candidate directories holding the skill markdown files, in resolution order. */
export function skillDirectoryCandidates(): string[] {
  const candidates: string[] = [];
  // 1) Module-relative: <repo>/packages/tool/skills (independent of cwd)
  try {
    candidates.push(join(dirname(fileURLToPath(import.meta.url)), "..", "skills"));
  } catch {
    // import.meta unavailable (non-ESM host) — fall through to cwd candidates
  }
  // 2) cwd-relative (repo root or packages/tool)
  candidates.push(join(process.cwd(), "packages", "tool", "skills"));
  candidates.push(join(process.cwd(), "skills"));
  return candidates.map((p) => resolve(p));
}

/** Resolve a skill's markdown file on disk, or null if no candidate exists. */
export function resolveSkillFile(skill: SkillDefinition): string | null {
  for (const dir of skillDirectoryCandidates()) {
    const file = join(dir, `${skill.id}.md`);
    if (existsSync(file)) return file;
  }
  return null;
}

export class SkillTool {
  /**
   * Load a skill by ID and return its instructions.
   */
  async loadSkill(id: string): Promise<SkillLoadResult> {
    const callId = `skill-${Date.now()}`;
    const trimmed = id.trim();

    if (!trimmed) {
      return { success: false, error: "Skill ID must not be empty." };
    }

    globalEventBus.emit("tool.started", { toolName: "skill", input: { id: trimmed }, callId });

    const skill = getSkillDefinition(trimmed);
    if (!skill) {
      const available = BUILTIN_SKILLS.map((s) => s.id).join(", ");
      const message = `Skill "${trimmed}" not found. Available skills: ${available}`;
      globalEventBus.emit("tool.failed", { toolName: "skill", error: message, callId });
      return { success: false, error: message };
    }

    // Physical disk read of the real skill markdown file — never invented text.
    const file = resolveSkillFile(skill);
    if (!file) {
      const tried = skillDirectoryCandidates().map((d) => join(d, `${skill.id}.md`));
      const message = `Skill file for "${skill.id}" not found on disk. Tried: ${tried.join(", ")}`;
      globalEventBus.emit("tool.failed", { toolName: "skill", error: message, callId });
      return { success: false, error: message };
    }

    const instructions = await readFile(file, "utf8");
    if (!instructions.trim()) {
      const message = `Skill file for "${skill.id}" is empty: ${file}`;
      globalEventBus.emit("tool.failed", { toolName: "skill", error: message, callId });
      return { success: false, error: message };
    }

    const output = instructions;
    const metadata = {
      skillId: skill.id,
      skillName: skill.name,
      tags: skill.tags ?? [],
      file,
      bytes: Buffer.byteLength(instructions, "utf8"),
    };

    globalEventBus.emit("tool.completed", { toolName: "skill", output, callId, metadata });
    return { success: true, output, metadata };
  }

  /**
   * List all available skills.
   */
  listSkills(): SkillLoadResult {
    const callId = `skill-list-${Date.now()}`;
    globalEventBus.emit("tool.started", { toolName: "skill_list", input: {}, callId });

    const skills = BUILTIN_SKILLS.map(
      (s, i) =>
        `${i + 1}. **${s.name}** (${s.id})\n   ${s.description}\n   Tags: ${s.tags?.join(", ") ?? "none"}`
    ).join("\n\n");

    const output = `Available skills:\n\n${skills}`;
    const metadata = { count: BUILTIN_SKILLS.length };

    globalEventBus.emit("tool.completed", { toolName: "skill_list", output, callId, metadata });
    return { success: true, output, metadata };
  }
}
