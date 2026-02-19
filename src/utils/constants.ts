import { PromptConfig, ComboBinding } from './types';

// Default prompt configuration
export const DEFAULT_PROMPTS: PromptConfig = {
  ArrowUp: 'Explain this code',
  ArrowDown: 'Optimize this',
  ArrowLeft: 'Fix this bug',
  ArrowRight: 'Translate to Chinese'
};

// Default combo prompts (Standard; empty for free)
export const DEFAULT_COMBO_PROMPTS: ComboBinding[] = [];

// Default extension configuration
export const DEFAULT_CONFIG = {
  enabled: true,
  prompts: DEFAULT_PROMPTS,
  comboPrompts: DEFAULT_COMBO_PROMPTS,
  version: '1.0.0',
  isPro: false
};

// Supported arrow keys
export const ARROW_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

// Firebase Cloud Function URL for license verification (replace with your deployed URL)
export const VERIFY_LICENSE_URL = 'https://verifylicense-wwtljwi5dq-uc.a.run.app';

// Gumroad product page for "Buy Standard" link
export const GUMROAD_PRODUCT_URL = 'https://tiannan8.gumroad.com/l/wcxgdk';
