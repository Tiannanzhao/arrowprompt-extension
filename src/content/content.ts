// ============================================
// ArrowPrompt Content Script (Self-contained)
// ============================================

(function() {
'use strict';

// Types
interface PromptConfig {
  ArrowUp: string;
  ArrowDown: string;
  ArrowLeft: string;
  ArrowRight: string;
}

interface ExtensionConfig {
  enabled: boolean;
  prompts: PromptConfig;
  version: string;
  isPro: boolean;
}

interface SiteConfig {
  inputSelector: string;
  sendButtonSelector: string;
  type: 'contenteditable' | 'textarea';
}

type ArrowKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

// Constants
const DEFAULT_PROMPTS: PromptConfig = {
  ArrowUp: '解释这段代码',
  ArrowDown: '优化一下',
  ArrowLeft: '修复这个bug',
  ArrowRight: '换成中文'
};

const DEFAULT_CONFIG: ExtensionConfig = {
  enabled: true,
  prompts: DEFAULT_PROMPTS,
  version: '1.0.0',
  isPro: false
};

const ARROW_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

// Site configurations
const SITE_CONFIGS: Record<string, SiteConfig> = {
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
    sendButtonSelector: 'button[aria-label*="Send"], button[aria-label*="发送"], button.send-button',
    type: 'contenteditable'
  }
};

// State
let isEnabled = true;
let currentConfig: ExtensionConfig = DEFAULT_CONFIG;

// Get current site config
function getCurrentSiteConfig(): SiteConfig | null {
  const hostname = window.location.hostname;
  for (const [site, config] of Object.entries(SITE_CONFIGS)) {
    if (hostname.includes(site)) {
      return config;
    }
  }
  return null;
}

// Get input element
function getInputElement(): HTMLElement | null {
  const config = getCurrentSiteConfig();
  if (!config) return null;
  return document.querySelector(config.inputSelector);
}

// Check if input is empty
function isInputEmpty(element: HTMLElement, config: SiteConfig): boolean {
  if (config.type === 'contenteditable') {
    const text = element.textContent || element.innerText || '';
    return text.trim() === '';
  } else {
    const value = (element as HTMLTextAreaElement).value || '';
    return value.trim() === '';
  }
}

// Insert text into input
function insertTextToInput(element: HTMLElement, text: string, config: SiteConfig): boolean {
  if (!element) return false;

  element.focus();

  if (config.type === 'contenteditable') {
    element.innerHTML = '';
    element.textContent = text;
    
    // Move cursor to end
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(element);
    range.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(range);
    
    // Trigger input event
    element.dispatchEvent(new InputEvent('input', { 
      bubbles: true, 
      cancelable: true,
      inputType: 'insertText',
      data: text
    }));
  } else if (config.type === 'textarea') {
    const textarea = element as HTMLTextAreaElement;
    
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value'
    )?.set;
    
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(textarea, text);
    } else {
      textarea.value = text;
    }
    
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }

  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new Event('keyup', { bubbles: true }));

  return true;
}

// Click send button
function clickSendButton(config: SiteConfig): boolean {
  const sendButton = document.querySelector(config.sendButtonSelector) as HTMLButtonElement;
  if (sendButton && !sendButton.disabled) {
    setTimeout(() => sendButton.click(), 100);
    return true;
  }
  return false;
}

// Show feedback
function showFeedback(key: ArrowKey, prompt: string): void {
  const feedback = document.createElement('div');
  feedback.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #4CAF50;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    z-index: 999999;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    animation: arrowprompt-slideIn 0.3s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  `;
  feedback.textContent = `✓ ${key.replace('Arrow', '')}键: ${prompt}`;

  document.body.appendChild(feedback);

  setTimeout(() => {
    feedback.style.animation = 'arrowprompt-slideOut 0.3s ease';
    setTimeout(() => feedback.remove(), 300);
  }, 2000);
}

// Keyboard event handler
function handleKeyDown(event: KeyboardEvent): void {
  if (!ARROW_KEYS.includes(event.key)) return;
  if (!isEnabled) {
    console.log('[ArrowPrompt] 插件已禁用');
    return;
  }

  const config = getCurrentSiteConfig();
  if (!config) {
    console.log('[ArrowPrompt] 不支持的网站');
    return;
  }

  const inputElement = getInputElement();
  if (!inputElement) {
    console.log('[ArrowPrompt] 找不到输入框');
    return;
  }

  if (!isInputEmpty(inputElement, config)) {
    return; // Don't intercept if there's content
  }

  console.log('[ArrowPrompt] 检测到方向键:', event.key);
  
  event.preventDefault();
  event.stopPropagation();

  const prompt = currentConfig.prompts[event.key as ArrowKey];
  if (!prompt) return;

  const inserted = insertTextToInput(inputElement, prompt, config);
  if (inserted) {
    console.log('[ArrowPrompt] 已插入提示词:', prompt);
    showFeedback(event.key as ArrowKey, prompt);
    setTimeout(() => clickSendButton(config), 200);
  }
}

// Add CSS animations
function addStyles(): void {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes arrowprompt-slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes arrowprompt-slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

// Load config from storage
async function loadConfig(): Promise<ExtensionConfig> {
  try {
    const config = await chrome.storage.sync.get(null);
    return {
      ...DEFAULT_CONFIG,
      ...config
    } as ExtensionConfig;
  } catch (error) {
    console.error('[ArrowPrompt] 读取配置失败:', error);
    return DEFAULT_CONFIG;
  }
}

// Initialize
async function init(): Promise<void> {
  addStyles();
  
  currentConfig = await loadConfig();
  isEnabled = currentConfig.enabled;

  // Listen for keyboard events
  document.addEventListener('keydown', handleKeyDown, true);
  window.addEventListener('keydown', handleKeyDown, true);

  // Listen for config changes
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync') {
      if (changes.enabled) {
        isEnabled = changes.enabled.newValue;
        console.log('[ArrowPrompt] 状态已更新:', isEnabled ? '启用' : '禁用');
      }
      if (changes.prompts) {
        currentConfig.prompts = changes.prompts.newValue;
      }
    }
  });

  const siteConfig = getCurrentSiteConfig();
  console.log('✓ ArrowPrompt 已激活');
  console.log('[ArrowPrompt] 当前网站:', window.location.hostname);
  console.log('[ArrowPrompt] 网站配置:', siteConfig ? '已找到' : '不支持');
  console.log('[ArrowPrompt] 插件状态:', isEnabled ? '启用' : '禁用');
}

// Start
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})(); // End IIFE
