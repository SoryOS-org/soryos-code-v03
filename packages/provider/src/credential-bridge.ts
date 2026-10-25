export interface LiveCredential {
  apiKey?: string;
  source?: string;
}

export type CredentialResolver = (
  providerId: string,
  sessionId?: string
) => LiveCredential | undefined;

let credentialResolver: CredentialResolver | undefined;

/**
 * Installed by @soryos/credentials so every provider picks up keys saved in
 * the UI (session override → settings store) before falling back to env vars.
 */
export function setCredentialResolver(resolver: CredentialResolver): void {
  credentialResolver = resolver;
}

export function resolveLiveCredential(
  providerId: string,
  sessionId?: string
): LiveCredential | undefined {
  if (!credentialResolver) return undefined;
  try {
    return credentialResolver(providerId, sessionId);
  } catch {
    return undefined;
  }
}
