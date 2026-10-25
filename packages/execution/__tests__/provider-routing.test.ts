/**
 * Tests for Provider Routing and Execution
 * Tests that the correct provider is used based on providerId
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  executionManager,
  LocalExecutionProvider,
  E2BExecutionProvider,
  VercelExecutionProvider,
  GitHubCodespacesExecutionProvider,
  GitHubRepositoryExecutionProvider,
  GoogleCloudRunExecutionProvider,
} from "../src/index";

// Mock environment variables
const originalEnv = process.env;

describe("Provider Routing", () => {
  beforeEach(() => {
    // Reset environment
    process.env = { ...originalEnv };
    // Clear all providers
    executionManager.clearAll();
  });

  describe("Local Provider", () => {
    it("should create LocalExecutionProvider for 'local' providerId", async () => {
      const provider = await executionManager.getOrCreateProvider("session-1", "local");
      expect(provider).toBeInstanceOf(LocalExecutionProvider);
      expect(provider.id).toBe("local");
      expect(provider.name).toBe("Machine Locale");
    });

    it("should create LocalExecutionProvider by default", async () => {
      const provider = await executionManager.getOrCreateProvider("session-1");
      expect(provider).toBeInstanceOf(LocalExecutionProvider);
      expect(provider.id).toBe("local");
    });
  });

  describe("E2B Provider", () => {
    it("should create E2BExecutionProvider for 'e2b' providerId", async () => {
      process.env.E2B_API_KEY = "test-e2b-key";
      
      const provider = await executionManager.getOrCreateProvider("session-1", "e2b");
      expect(provider).toBeInstanceOf(E2BExecutionProvider);
      expect(provider.id).toBe("e2b");
      expect(provider.name).toBe("E2B Cloud Sandbox");
    });

    it("should throw error when E2B_API_KEY is not configured", async () => {
      // Ensure E2B_API_KEY is not set
      delete process.env.E2B_API_KEY;
      
      await expect(
        executionManager.getOrCreateProvider("session-1", "e2b")
      ).rejects.toThrow(/E2B provider is not configured/);
    });
  });

  describe("Vercel Provider", () => {
    it("should create VercelExecutionProvider for 'vercel' providerId", async () => {
      process.env.VERCEL_TOKEN = "test-vercel-token";
      
      const provider = await executionManager.getOrCreateProvider("session-1", "vercel");
      expect(provider).toBeInstanceOf(VercelExecutionProvider);
      expect(provider.id).toBe("vercel");
      expect(provider.name).toBe("Vercel Sandbox");
    });

    it("should throw error when VERCEL_TOKEN is not configured", async () => {
      delete process.env.VERCEL_TOKEN;
      
      await expect(
        executionManager.getOrCreateProvider("session-1", "vercel")
      ).rejects.toThrow(/Vercel provider is not configured/);
    });
  });

  describe("GitHub Codespaces Provider", () => {
    it("should create GitHubCodespacesExecutionProvider for 'github-codespaces' providerId", async () => {
      process.env.GITHUB_TOKEN = "test-github-token";
      
      const provider = await executionManager.getOrCreateProvider("session-1", "github-codespaces");
      expect(provider).toBeInstanceOf(GitHubCodespacesExecutionProvider);
      expect(provider.id).toBe("github-codespaces");
      expect(provider.name).toBe("GitHub Codespaces");
    });

    it("should throw error when GITHUB_TOKEN is not configured", async () => {
      delete process.env.GITHUB_TOKEN;
      
      await expect(
        executionManager.getOrCreateProvider("session-1", "github-codespaces")
      ).rejects.toThrow(/GitHub Codespaces provider is not configured/);
    });
  });

  describe("GitHub Repository Provider", () => {
    it("should create GitHubRepositoryExecutionProvider for 'github-repository' providerId", async () => {
      process.env.GITHUB_TOKEN = "test-github-token";
      
      const provider = await executionManager.getOrCreateProvider("session-1", "github-repository");
      expect(provider).toBeInstanceOf(GitHubRepositoryExecutionProvider);
      expect(provider.id).toBe("github-repository");
      expect(provider.name).toBe("GitHub Repository");
    });

    it("should throw error when GITHUB_TOKEN is not configured for github-repository", async () => {
      delete process.env.GITHUB_TOKEN;
      
      await expect(
        executionManager.getOrCreateProvider("session-1", "github-repository")
      ).rejects.toThrow(/GitHub Repository provider is not configured/);
    });
  });

  describe("Google Cloud Run Provider", () => {
    it("should create GoogleCloudRunExecutionProvider for 'google-cloud-run' providerId", async () => {
      process.env.GOOGLE_CLOUD_CREDENTIALS = "test-gcp-credentials";
      
      const provider = await executionManager.getOrCreateProvider("session-1", "google-cloud-run");
      expect(provider).toBeInstanceOf(GoogleCloudRunExecutionProvider);
      expect(provider.id).toBe("google-cloud-run");
      expect(provider.name).toBe("Google Cloud Run");
    });

    it("should throw error when GOOGLE_CLOUD_CREDENTIALS is not configured", async () => {
      delete process.env.GOOGLE_CLOUD_CREDENTIALS;
      
      await expect(
        executionManager.getOrCreateProvider("session-1", "google-cloud-run")
      ).rejects.toThrow(/Google Cloud Run provider is not configured/);
    });
  });

  describe("Provider Caching", () => {
    it("should cache provider instances per session", async () => {
      process.env.E2B_API_KEY = "test-e2b-key";
      
      const provider1 = await executionManager.getOrCreateProvider("session-1", "e2b");
      const provider2 = await executionManager.getOrCreateProvider("session-1", "e2b");
      
      // Same session and provider should return the same instance
      expect(provider1).toBe(provider2);
    });

    it("should create different instances for different sessions", async () => {
      process.env.E2B_API_KEY = "test-e2b-key";
      
      const provider1 = await executionManager.getOrCreateProvider("session-1", "e2b");
      const provider2 = await executionManager.getOrCreateProvider("session-2", "e2b");
      
      // Different sessions should get different instances
      expect(provider1).not.toBe(provider2);
    });

    it("should create different instances for different providers in same session", async () => {
      process.env.E2B_API_KEY = "test-e2b-key";
      process.env.VERCEL_TOKEN = "test-vercel-token";
      
      const provider1 = await executionManager.getOrCreateProvider("session-1", "e2b");
      const provider2 = await executionManager.getOrCreateProvider("session-1", "vercel");
      
      expect(provider1).not.toBe(provider2);
      expect(provider1).toBeInstanceOf(E2BExecutionProvider);
      expect(provider2).toBeInstanceOf(VercelExecutionProvider);
    });
  });

  describe("isProviderConfigured", () => {
    it("should return true for local provider", async () => {
      const isConfigured = await executionManager.isProviderConfigured("local");
      expect(isConfigured).toBe(true);
    });

    it("should return true for E2B when API key is set", async () => {
      process.env.E2B_API_KEY = "test-e2b-key";
      const isConfigured = await executionManager.isProviderConfigured("e2b");
      expect(isConfigured).toBe(true);
    });

    it("should return false for E2B when API key is not set", async () => {
      delete process.env.E2B_API_KEY;
      const isConfigured = await executionManager.isProviderConfigured("e2b");
      expect(isConfigured).toBe(false);
    });
  });

  describe("Cleanup", () => {
    it("should cleanup providers for a specific session", async () => {
      process.env.E2B_API_KEY = "test-e2b-key";
      
      await executionManager.getOrCreateProvider("session-1", "e2b");
      await executionManager.getOrCreateProvider("session-2", "e2b");
      
      executionManager.cleanupSession("session-1");
      
      // After cleanup, session-1 should get a new instance
      const newProvider = await executionManager.getOrCreateProvider("session-1", "e2b");
      expect(newProvider).toBeInstanceOf(E2BExecutionProvider);
    });

    it("should clear all providers", async () => {
      process.env.E2B_API_KEY = "test-e2b-key";
      
      await executionManager.getOrCreateProvider("session-1", "e2b");
      await executionManager.getOrCreateProvider("session-2", "e2b");
      
      executionManager.clearAll();
      
      // After clearAll, all sessions should get new instances
      const provider1 = await executionManager.getOrCreateProvider("session-1", "e2b");
      const provider2 = await executionManager.getOrCreateProvider("session-2", "e2b");
      
      expect(provider1).not.toBe(provider2);
    });
  });

  describe("Invalid Provider", () => {
    it("should throw error for unknown provider ID", async () => {
      await expect(
        executionManager.getOrCreateProvider("session-1", "unknown-provider" as any)
      ).rejects.toThrow(/Provider.*is not supported/);
    });
  });
});
