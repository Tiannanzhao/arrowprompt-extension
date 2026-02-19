import { ExtensionConfig, LicenseState } from './types';
import { DEFAULT_CONFIG } from './constants';

const LICENSE_STORAGE_KEYS: string[] = ['licenseKey', 'licenseValid', 'licenseCheckedAt'];

export class StorageManager {
  // Save configuration (sync: enabled, prompts, comboPrompts, isPro)
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
        ...config,
        comboPrompts: Array.isArray(config.comboPrompts) ? config.comboPrompts : DEFAULT_CONFIG.comboPrompts
      } as ExtensionConfig;
    } catch (error) {
      console.error('Failed to load config:', error);
      return DEFAULT_CONFIG as ExtensionConfig;
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

  // Update combo prompts (Standard only)
  static async updateComboPrompts(comboPrompts: ExtensionConfig['comboPrompts']): Promise<void> {
    await this.saveConfig({ comboPrompts });
  }

  // Toggle enabled state
  static async toggleEnabled(): Promise<boolean> {
    const config = await this.loadConfig();
    const newEnabled = !config.enabled;
    await this.saveConfig({ enabled: newEnabled });
    return newEnabled;
  }

  // --- License (chrome.storage.local only) ---

  static async getLicenseState(): Promise<LicenseState | null> {
    try {
      const raw = await chrome.storage.local.get(LICENSE_STORAGE_KEYS);
      if (raw.licenseKey == null || raw.licenseValid == null) return null;
      return {
        licenseKey: String(raw.licenseKey),
        isValid: Boolean(raw.licenseValid),
        checkedAt: Number(raw.licenseCheckedAt) || 0
      };
    } catch {
      return null;
    }
  }

  static async setLicenseState(state: LicenseState): Promise<void> {
    await chrome.storage.local.set({
      licenseKey: state.licenseKey,
      licenseValid: state.isValid,
      licenseCheckedAt: state.checkedAt
    });
  }

  static async clearLicense(): Promise<void> {
    await chrome.storage.local.remove(LICENSE_STORAGE_KEYS);
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
