import { ExtensionConfig } from './types';
import { DEFAULT_CONFIG } from './constants';

export class StorageManager {
  // 保存配置
  static async saveConfig(config: Partial<ExtensionConfig>): Promise<void> {
    try {
      await chrome.storage.sync.set(config);
    } catch (error) {
      console.error('保存配置失败:', error);
      throw error;
    }
  }

  // 读取配置
  static async loadConfig(): Promise<ExtensionConfig> {
    try {
      const config = await chrome.storage.sync.get(null);
      return {
        ...DEFAULT_CONFIG,
        ...config
      } as ExtensionConfig;
    } catch (error) {
      console.error('读取配置失败:', error);
      return DEFAULT_CONFIG;
    }
  }

  // 更新提示词
  static async updatePrompts(prompts: Partial<ExtensionConfig['prompts']>): Promise<void> {
    const config = await this.loadConfig();
    await this.saveConfig({
      prompts: {
        ...config.prompts,
        ...prompts
      }
    });
  }

  // 切换开关
  static async toggleEnabled(): Promise<boolean> {
    const config = await this.loadConfig();
    const newEnabled = !config.enabled;
    await this.saveConfig({ enabled: newEnabled });
    return newEnabled;
  }

  // 监听配置变化
  static onConfigChange(callback: (changes: Record<string, chrome.storage.StorageChange>) => void): void {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync') {
        callback(changes);
      }
    });
  }
}
