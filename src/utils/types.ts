// 提示词配置类型
export interface PromptConfig {
  ArrowUp: string;
  ArrowDown: string;
  ArrowLeft: string;
  ArrowRight: string;
}

// 扩展配置类型
export interface ExtensionConfig {
  enabled: boolean;
  prompts: PromptConfig;
  version: string;
  isPro: boolean;
}

// 网站配置类型
export interface SiteConfig {
  inputSelector: string;
  sendButtonSelector: string;
  type: 'contenteditable' | 'textarea';
}

// 键盘按键类型
export type ArrowKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';
