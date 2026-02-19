// Prompt configuration type
export interface PromptConfig {
  ArrowUp: string;
  ArrowDown: string;
  ArrowLeft: string;
  ArrowRight: string;
}

// Combo binding: 2–4 arrow keys → prompt (Standard only)
export interface ComboBinding {
  id: string;
  keys: ArrowKey[];
  prompt: string;
}

// License state (stored in chrome.storage.local only)
export interface LicenseState {
  licenseKey: string;
  isValid: boolean;
  checkedAt: number;
}

// Extension configuration type
export interface ExtensionConfig {
  enabled: boolean;
  prompts: PromptConfig;
  comboPrompts: ComboBinding[];
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
