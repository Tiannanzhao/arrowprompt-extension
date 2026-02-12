import { PromptConfig } from './types';

// Default prompt configuration
export const DEFAULT_PROMPTS: PromptConfig = {
  ArrowUp: 'Explain this code',
  ArrowDown: 'Optimize this',
  ArrowLeft: 'Fix this bug',
  ArrowRight: 'Translate to Chinese'
};

// Default extension configuration
export const DEFAULT_CONFIG = {
  enabled: true,
  prompts: DEFAULT_PROMPTS,
  version: '1.0.0',
  isPro: false
};

// Supported arrow keys
export const ARROW_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
