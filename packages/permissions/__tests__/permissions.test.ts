import { describe, expect, it } from "vitest";
import { permissionsManager } from "@soryos/permissions";

describe("PermissionsManager — matrice des modes", () => {
  it("build : accès total (écriture + shell destructif autorisés)", () => {
    expect(permissionsManager.checkPermission("build", "write_file").allowed).toBe(true);
    expect(permissionsManager.checkPermission("build", "edit_file").allowed).toBe(true);
    expect(permissionsManager.checkPermission("build", "delete_file").allowed).toBe(true);
    expect(
      permissionsManager.checkPermission("build", "shell_command", { command: "rm -rf ." }).allowed
    ).toBe(true);
  });

  it("plan : lecture seule, toute écriture refusée avec une raison explicite", () => {
    expect(permissionsManager.checkPermission("plan", "read_file").allowed).toBe(true);
    expect(permissionsManager.checkPermission("plan", "list_files").allowed).toBe(true);
    expect(permissionsManager.checkPermission("plan", "grep_search").allowed).toBe(true);

    for (const tool of ["write_file", "edit_file", "delete_file"]) {
      const res = permissionsManager.checkPermission("plan", tool);
      expect(res.allowed).toBe(false);
      expect(res.reason).toMatch(/lecture seule/);
    }
  });

  it("plan : shell limité aux commandes sûres (git status / ls / git log)", () => {
    expect(
      permissionsManager.checkPermission("plan", "shell_command", { command: "git status" }).allowed
    ).toBe(true);
    expect(
      permissionsManager.checkPermission("plan", "shell_command", { command: "git log -5" }).allowed
    ).toBe(true);
    expect(permissionsManager.checkPermission("plan", "shell_command", { command: "ls -la" }).allowed).toBe(true);
    expect(
      permissionsManager.checkPermission("plan", "shell_command", { command: "npm install" }).allowed
    ).toBe(false);
    expect(
      permissionsManager.checkPermission("plan", "shell_command", { command: "rm -rf ." }).allowed
    ).toBe(false);
  });

  it("explore : recherche seule, ni écriture ni shell", () => {
    expect(permissionsManager.checkPermission("explore", "read_file").allowed).toBe(true);
    expect(permissionsManager.checkPermission("explore", "glob_files").allowed).toBe(true);
    expect(permissionsManager.checkPermission("explore", "grep_search").allowed).toBe(true);
    expect(permissionsManager.checkPermission("explore", "write_file").allowed).toBe(false);
    expect(permissionsManager.checkPermission("explore", "shell_command").allowed).toBe(false);
    expect(permissionsManager.checkPermission("explore", "unknown_tool").allowed).toBe(false);
  });

  it("code-reviewer : lecture + shell (tests) autorisés, écriture refusée", () => {
    expect(permissionsManager.checkPermission("code-reviewer", "read_file").allowed).toBe(true);
    expect(
      permissionsManager.checkPermission("code-reviewer", "shell_command", { command: "npm test" }).allowed
    ).toBe(true);
    const denied = permissionsManager.checkPermission("code-reviewer", "write_file");
    expect(denied.allowed).toBe(false);
    expect(denied.reason).toMatch(/revues/);
  });

  it("mode vide = build ; mode inconnu = comportement explicite (autorisé)", () => {
    expect(permissionsManager.checkPermission("", "write_file").allowed).toBe(true);
    expect(permissionsManager.checkPermission(undefined as unknown as string, "shell_command").allowed).toBe(true);
    expect(permissionsManager.checkPermission("custom", "write_file").allowed).toBe(true);
  });
});
