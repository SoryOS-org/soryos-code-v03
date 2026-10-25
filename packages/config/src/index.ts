/**
 * @soryos/config
 * Global settings, project configurations, and theme persistence.
 */

export interface GlobalSettings {
  defaultModel: string;
  defaultProviderId: string;
  telemetryEnabled: boolean;
  theme: "dark" | "light" | "system";
}

export const DEFAULT_CONFIG: GlobalSettings = {
  defaultModel: "gemini-3.8-flash",
  defaultProviderId: "google",
  telemetryEnabled: false,
  theme: "dark",
};

export class ConfigManager {
  private config: GlobalSettings = { ...DEFAULT_CONFIG };

  public getConfig(): GlobalSettings {
    return { ...this.config };
  }

  public updateConfig(partial: Partial<GlobalSettings>): void {
    this.config = { ...this.config, ...partial };
  }
}

export const configManager = new ConfigManager();

// Re-export template system
export * from './templates';

