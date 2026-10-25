/**
 * Tests for Path Security in LocalExecutionProvider
 * Tests that path traversal attacks are prevented
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LocalExecutionProvider, __setModuleResolver } from "../src/index";
import * as path from "node:path";

// Mock fs/promises
const mockFs = {
  mkdir: vi.fn().mockResolvedValue(undefined),
  readdir: vi.fn().mockResolvedValue([]),
  readFile: vi.fn().mockResolvedValue("test content"),
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockResolvedValue({ size: 100, mtime: new Date() }),
  // Resolves to a path outside the workspace by default, simulating a symlink
  // that escapes the sandbox, so the containment check is exercised.
  realpath: vi.fn().mockImplementation((p: string) => Promise.resolve(p)),
};

// LocalExecutionProvider resolves native modules through dynamicRequire()'s
// eval("require"), which test runners cannot intercept via vi.mock. Install a
// resolver so the provider reads through the mock instead of the real disk.
beforeEach(() => {
  __setModuleResolver((name: string) => {
    if (name === "fs/promises") return mockFs;
    return require(name);
  });
});

afterEach(() => {
  __setModuleResolver(null);
});

describe("Path Security in LocalExecutionProvider", () => {
  let provider: LocalExecutionProvider;
  const workspaceDir = "/tmp/test-workspace";

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new LocalExecutionProvider(workspaceDir);
  });

  describe("Path Traversal Prevention", () => {
    it("should prevent path traversal with ../", async () => {
      await expect(
        provider.readFile("../etc/passwd")
      ).rejects.toThrow(/Path traversal detected/);
    });

    it("should prevent path traversal with ..\..", async () => {
      await expect(
        provider.readFile("../../etc/passwd")
      ).rejects.toThrow(/Path traversal detected/);
    });

    it("should prevent absolute paths outside workspace", async () => {
      await expect(
        provider.readFile("/etc/passwd")
      ).rejects.toThrow(/Path traversal detected/);
    });

    it("should prevent Windows-style path traversal", async () => {
      await expect(
        provider.readFile("..\\windows\\system32")
      ).rejects.toThrow(/Path traversal detected/);
    });

    it("should allow paths within workspace", async () => {
      mockFs.readFile.mockResolvedValueOnce("test content");
      
      const result = await provider.readFile("src/index.ts");
      expect(result).toBe("test content");
      expect(mockFs.readFile).toHaveBeenCalledWith(
        path.resolve(workspaceDir, "src/index.ts"),
        "utf-8"
      );
    });

    it("should allow relative paths within workspace", async () => {
      mockFs.readFile.mockResolvedValueOnce("test content");
      
      const result = await provider.readFile("./src/index.ts");
      expect(result).toBe("test content");
    });

    it("should normalize multiple slashes", async () => {
      mockFs.readFile.mockResolvedValueOnce("test content");
      
      const result = await provider.readFile("src//index.ts");
      expect(result).toBe("test content");
    });
  });

  describe("writeFile Path Security", () => {
    it("should prevent path traversal in writeFile", async () => {
      await expect(
        provider.writeFile("../etc/malicious", "malicious content")
      ).rejects.toThrow(/Path traversal detected/);
    });

    it("should prevent absolute paths in writeFile", async () => {
      await expect(
        provider.writeFile("/etc/malicious", "malicious content")
      ).rejects.toThrow(/Path traversal detected/);
    });

    it("should allow writing to workspace", async () => {
      await provider.writeFile("src/new-file.ts", "content");
      
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.resolve(workspaceDir, "src/new-file.ts"),
        "content",
        "utf-8"
      );
    });
  });

  describe("deleteFile Path Security", () => {
    it("should prevent path traversal in deleteFile", async () => {
      await expect(
        provider.deleteFile("../etc/passwd")
      ).rejects.toThrow(/Path traversal detected/);
    });

    it("should allow deleting files in workspace", async () => {
      await provider.deleteFile("src/old-file.ts");
      
      expect(mockFs.unlink).toHaveBeenCalledWith(
        path.resolve(workspaceDir, "src/old-file.ts")
      );
    });
  });

  describe("listFiles Path Security", () => {
    it("should prevent path traversal in listFiles", async () => {
      await expect(
        provider.listFiles("../etc")
      ).rejects.toThrow(/Path traversal detected/);
    });

    it("should allow listing files in workspace", async () => {
      mockFs.readdir.mockResolvedValueOnce([]);
      
      await provider.listFiles("src");
      
      expect(mockFs.readdir).toHaveBeenCalledWith(
        path.resolve(workspaceDir, "src"),
        { withFileTypes: true }
      );
    });
  });

  describe("executeCommand Path Security", () => {
    it("should prevent path traversal in cwd option", async () => {
      await expect(
        provider.executeCommand("ls", { cwd: "../etc" })
      ).rejects.toThrow(/Path traversal detected/);
    });

    it("should prevent absolute path in cwd option", async () => {
      await expect(
        provider.executeCommand("ls", { cwd: "/etc" })
      ).rejects.toThrow(/Path traversal detected/);
    });

    it("should allow cwd within workspace", async () => {
      // Mock execAsync to avoid actual execution
      const mockExecAsync = vi.fn().mockResolvedValue({ stdout: "", stderr: "", code: 0 });
      
      // getNodeExecAsync is a module-internal function, so it is intercepted
      // through the module resolver rather than by spying on the instance.
      const realResolver = __setModuleResolver;
      realResolver((name: string) => {
        if (name === "fs/promises") return mockFs;
        if (name === "child_process") return { exec: mockExecAsync };
        if (name === "util") return { promisify: (fn: unknown) => fn };
        return require(name);
      });
      
      await provider.executeCommand("ls", { cwd: "src" });
      
      expect(mockExecAsync).toHaveBeenCalledWith(
        "ls",
        expect.objectContaining({
          cwd: path.resolve(workspaceDir, "src"),
        })
      );
    });
  });

  describe("Workspace Isolation", () => {
    it("should prevent access to other sessions' workspaces", async () => {
      const otherWorkspaceDir = "/tmp/other-workspace";
      const otherProvider = new LocalExecutionProvider(otherWorkspaceDir);
      
      // Try to access other workspace's file through this provider
      await expect(
        provider.readFile(`${otherWorkspaceDir}/secret.txt`)
      ).rejects.toThrow(/Path traversal detected/);
    });

    it("should prevent symlink attacks", async () => {
      // Create a symlink that points outside the workspace
      const symlinkPath = path.resolve(workspaceDir, "symlink-to-etc");
      
      // Simulate a filesystem where that symlink resolves outside the
      // workspace; the lexical path alone looks harmless.
      mockFs.realpath.mockImplementation((p: string) =>
        p.startsWith(workspaceDir + path.sep + "symlink-to-etc")
          ? Promise.resolve("/etc/passwd")
          : Promise.resolve(p)
      );
      
      // Even if the symlink exists, we should prevent following it outside
      await expect(
        provider.readFile("symlink-to-etc/passwd")
      ).rejects.toThrow(/Path traversal detected/);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty path", async () => {
      mockFs.readdir.mockResolvedValueOnce([]);
      
      await provider.listFiles("");
      
      expect(mockFs.readdir).toHaveBeenCalledWith(
        workspaceDir,
        { withFileTypes: true }
      );
    });

    it("should handle root path", async () => {
      mockFs.readdir.mockResolvedValueOnce([]);
      
      await provider.listFiles(".");
      
      expect(mockFs.readdir).toHaveBeenCalledWith(
        workspaceDir,
        { withFileTypes: true }
      );
    });

    it("should handle path with leading slashes", async () => {
      // A leading slash makes the path absolute, so it is validated against the
      // workspace and rejected when it points outside. Reading workspace files
      // is done with workspace-relative paths.
      await expect(
        provider.readFile("/src/index.ts")
      ).rejects.toThrow(/Path traversal detected/);
    });

    it("should allow absolute path that stays inside the workspace", async () => {
      mockFs.readFile.mockResolvedValueOnce("test content");

      const result = await provider.readFile(
        path.resolve(workspaceDir, "src/index.ts")
      );
      expect(result).toBe("test content");
      expect(mockFs.readFile).toHaveBeenCalledWith(
        path.resolve(workspaceDir, "src/index.ts"),
        "utf-8"
      );
    });

    it("should handle path with multiple leading slashes", async () => {
      // Multiple leading separators normalize to the same absolute location,
      // so the containment check still applies.
      await expect(
        provider.readFile("///src///index.ts")
      ).rejects.toThrow(/Path traversal detected/);
    });
  });
});
