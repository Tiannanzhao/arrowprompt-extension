import { SiteConfig } from '../utils/types';

// Supported site configurations
export const SITE_CONFIGS: Record<string, SiteConfig> = {
  'claude.ai': {
    inputSelector: 'div[contenteditable="true"], fieldset div[contenteditable="true"]',
    sendButtonSelector: 'button[aria-label*="发送"], button[aria-label*="Send"], button[type="submit"]',
    type: 'contenteditable'
  },
  'chat.openai.com': {
    inputSelector: '#prompt-textarea, textarea[data-id="root"]',
    sendButtonSelector: 'button[data-testid="send-button"], button[aria-label*="Send"]',
    type: 'textarea'
  },
  'chatgpt.com': {
    inputSelector: '#prompt-textarea, textarea[data-id="root"]',
    sendButtonSelector: 'button[data-testid="send-button"], button[aria-label*="Send"]',
    type: 'textarea'
  },
  'gemini.google.com': {
    inputSelector: '.ql-editor[contenteditable="true"], div[contenteditable="true"][aria-label], rich-textarea div[contenteditable="true"]',
    sendButtonSelector: 'button[aria-label*="Send"], button[aria-label*="发送"], button.send-button, button[data-test-id="send-button"]',
    type: 'contenteditable'
  }
};

// Get current site configuration
export function getCurrentSiteConfig(): SiteConfig | null {
  const hostname = window.location.hostname;
  for (const [site, config] of Object.entries(SITE_CONFIGS)) {
    if (hostname.includes(site)) {
      return config;
    }
  }
  return null;
}
