import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import {
  SkillTool,
  BUILTIN_SKILLS,
  getSkillDefinition,
  resolveSkillFile,
  skillDirectoryCandidates,
} from "../src/skill-tools";

describe("skill tool (real disk loading)", () => {
  it("resolves a candidate skills directory that physically exists", () => {
    const candidates = skillDirectoryCandidates();
    expect(candidates.length).toBeGreaterThanOrEqual(2);
    expect(candidates.some((dir) => existsSync(dir))).toBe(true);
  });

  it("every registered skill has a real markdown file on disk", () => {
    for (const skill of BUILTIN_SKILLS) {
      const file = resolveSkillFile(skill);
      expect(file, `skill ${skill.id} must resolve to a file`).not.toBeNull();
      expect(existsSync(file!)).toBe(true);
    }
  });

  it("loadSkill returns the real file contents, not a placeholder", async () => {
    const tool = new SkillTool();
    const result = await tool.loadSkill("typescript-expert");

    expect(result.success).toBe(true);
    const skill = getSkillDefinition("typescript-expert")!;
    const file = resolveSkillFile(skill)!;
    const onDisk = await readFile(file, "utf8");

    expect(result.output).toBe(onDisk);
    expect(result.output).toContain("# TypeScript Expert");
    expect(result.output).not.toContain("would be loaded from");
    expect(result.metadata?.bytes).toBe(Buffer.byteLength(onDisk, "utf8"));
  });

  it("rejects an unknown skill with the available ids listed", async () => {
    const tool = new SkillTool();
    const result = await tool.loadSkill("does-not-exist");

    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
    expect(result.error).toContain("typescript-expert");
  });

  it("rejects an empty skill id", async () => {
    const tool = new SkillTool();
    const result = await tool.loadSkill("   ");
    expect(result.success).toBe(false);
    expect(result.error).toContain("must not be empty");
  });

  it("lists all registered skills", () => {
    const tool = new SkillTool();
    const result = tool.listSkills();
    expect(result.success).toBe(true);
    expect(result.metadata?.count).toBe(BUILTIN_SKILLS.length);
    expect(result.output).toContain("typescript-expert");
    expect(result.output).toContain("security-audit");
  });
});
