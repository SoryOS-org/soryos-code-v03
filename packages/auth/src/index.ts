/**
 * @soryos/auth
 * Secure credential store and token handling for AI and GitHub OAuth.
 */

export interface UserCredentials {
  githubToken?: string;
  geminiApiKey?: string;
  openAiApiKey?: string;
  openCodeApiKey?: string;
}

export class AuthManager {
  private credentials: Map<string, UserCredentials> = new Map();

  public setCredentials(userId = "default", creds: Partial<UserCredentials>): void {
    const current = this.credentials.get(userId) || {};
    this.credentials.set(userId, { ...current, ...creds });
  }

  public getCredentials(userId = "default"): UserCredentials {
    return this.credentials.get(userId) || {};
  }
}

export const authManager = new AuthManager();
