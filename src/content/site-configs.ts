import { SiteConfig } from '../utils/types';

// 支持的网站配置
export const SITE_CONFIGS: Record<string, SiteConfig> = {
  'claude.ai': {
    inputSelector: 'div[contenteditable="true"][data-placeholder]',
    sendButtonSelector: 'button[aria-label*="发送"], button[aria-label*="Send"]',
    type: 'contenteditable'
  },
  'chat.openai.com': {
    inputSelector: '#prompt-textarea',
    sendButtonSelector: 'button[data-testid="send-button"]',
    type: 'textarea'
  },
  'chatgpt.com': {
    inputSelector: '#prompt-textarea',
    sendButtonSelector: 'button[data-testid="send-button"]',
    type: 'textarea'
  },
  'gemini.google.com': {
    inputSelector: 'rich-textarea .ql-editor',
    sendButtonSelector: 'button[aria-label*="Send"]',
    type: 'contenteditable'
  }
};

// 获取当前网站配置
export function getCurrentSiteConfig(): SiteConfig | null {
  const hostname = window.location.hostname;
  for (const [site, config] of Object.entries(SITE_CONFIGS)) {
    if (hostname.includes(site)) {
      return config;
    }
  }
  return null;
}
