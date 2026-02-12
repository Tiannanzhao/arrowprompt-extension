// Prompt configuration type
export interface PromptConfig {
  ArrowUp: string;
  ArrowDown: string;
  ArrowLeft: string;
  ArrowRight: string;
}

// Extension configuration type
export interface ExtensionConfig {
  enabled: boolean;
  prompts: PromptConfig;
  version: string;
  isPro: boolean;
}

// Site configuration type
export interface SiteConfig {
  inputSelector: string;
  sendButtonSelector: string;
  type: 'contenteditable' | 'textarea';
}

// Arrow key type
export type ArrowKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';
