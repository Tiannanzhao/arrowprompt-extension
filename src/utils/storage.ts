import { ExtensionConfig } from './types';
import { DEFAULT_CONFIG } from './constants';

export class StorageManager {
  // Save configuration
  static async saveConfig(config: Partial<ExtensionConfig>): Promise<void> {
    try {
      await chrome.storage.sync.set(config);
    } catch (error) {
      console.error('Failed to save config:', error);
      throw error;
    }
  }

  // Load configuration
  static async loadConfig(): Promise<ExtensionConfig> {
    try {
      const config = await chrome.storage.sync.get(null);
      return {
        ...DEFAULT_CONFIG,
        ...config
      } as ExtensionConfig;
    } catch (error) {
      console.error('Failed to load config:', error);
      return DEFAULT_CONFIG;
    }
  }

  // Update prompts
  static async updatePrompts(prompts: Partial<ExtensionConfig['prompts']>): Promise<void> {
    const config = await this.loadConfig();
    await this.saveConfig({
      prompts: {
        ...config.prompts,
        ...prompts
      }
    });
  }

  // Toggle enabled state
  static async toggleEnabled(): Promise<boolean> {
    const config = await this.loadConfig();
    const newEnabled = !config.enabled;
    await this.saveConfig({ enabled: newEnabled });
    return newEnabled;
  }

  // Listen for config changes
  static onConfigChange(callback: (changes: Record<string, chrome.storage.StorageChange>) => void): void {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync') {
        callback(changes);
      }
    });
  }
}
