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
  ArrowUp: 'Explain this code',
  ArrowDown: 'Optimize this',
  ArrowLeft: 'Fix this bug',
  ArrowRight: 'Translate to Chinese'
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

// Figma nev-flynn Button: labels per key
const FEEDBACK_LABELS: Record<ArrowKey, string> = {
  ArrowLeft: 'Fix this bug',
  ArrowRight: 'Translate to Chinese',
  ArrowUp: 'Explain this code',
  ArrowDown: 'Optimize this'
};

// Dotted arrow SVG: 7-dot shaft + 4-dot head (5.2px dots, #A8A8A8). Base arrow points right; rotation sets direction.
const ARROW_SVG = (rotateDeg: number) => `
  <svg class="arrowprompt-arrow" width="26" height="36" viewBox="0 0 34 36" fill="none" style="transform: rotate(${rotateDeg}deg)">
    <circle cx="4" cy="18" r="2.6" fill="#A8A8A8"/>
    <circle cx="9" cy="18" r="2.6" fill="#A8A8A8"/>
    <circle cx="14" cy="18" r="2.6" fill="#A8A8A8"/>
    <circle cx="19" cy="18" r="2.6" fill="#A8A8A8"/>
    <circle cx="24" cy="18" r="2.6" fill="#A8A8A8"/>
    <circle cx="29" cy="18" r="2.6" fill="#A8A8A8"/>
    <circle cx="34" cy="18" r="2.6" fill="#A8A8A8"/>
    <circle cx="0" cy="18" r="2.6" fill="#A8A8A8"/>
    <circle cx="4" cy="14" r="2.6" fill="#A8A8A8"/>
    <circle cx="4" cy="22" r="2.6" fill="#A8A8A8"/>
    <circle cx="4" cy="18" r="2.6" fill="#A8A8A8"/>
  </svg>
`;

// CSS for ArrowUp card only (used inside Shadow DOM to avoid page overrides)
const ARROWUP_SHADOW_CSS = `
  :host { display: inline-block; pointer-events: none; box-sizing: border-box; }
  .arrowprompt-figma-outer {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 3.54px;
    gap: 2.02px;
    position: relative;
    background: linear-gradient(180deg, #E9E9E9 0%, #E9E9E9 0.01%, #FFFFFF 100%);
    border-radius: 13.66px;
    width: 119.37px;
    height: 75.43px;
    box-sizing: border-box;
  }
  .arrowprompt-neo-button {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 8.1px;
    width: 112.29px;
    height: 68.35px;
    padding: 10.63px 12.14px;
    border: none;
    cursor: default;
    font: inherit;
    background: linear-gradient(180deg, #F4F4F4 0%, #FEFEFE 100%);
    box-shadow: 0px 0px 0.22px 0.22px rgba(0, 0, 0, 0.07), 0px 0px 0.22px 0.67px rgba(0, 0, 0, 0.05), 0px 2.7px 2.92px -1.35px rgba(0, 0, 0, 0.25), 0px 0.9px 3.6px 0.9px rgba(0, 0, 0, 0.12);
    border-radius: 10.12px;
  }
  .arrowprompt-neo-button svg { flex: none; display: block; }
  .arrowprompt-button-text {
    font-family: 'Product Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-weight: 400;
    font-size: 12.14px;
    line-height: 110%;
    color: #06071A;
    flex: none;
    white-space: nowrap;
  }
  @keyframes arrowprompt-slideIn {
    from { transform: translateY(6px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  @keyframes arrowprompt-fadeOut {
    to { opacity: 0; transform: translateY(-4px); }
  }
`;

// Show feedback at top-right of input box (Figma nev-flynn Button style)
function showFeedback(key: ArrowKey, prompt: string, _inputElement: HTMLElement): void {
  const label = prompt || FEEDBACK_LABELS[key];
  const isHorizontal = key === 'ArrowLeft' || key === 'ArrowRight';
  const arrowRotate = key === 'ArrowLeft' ? -90 : key === 'ArrowRight' ? 90 : key === 'ArrowUp' ? -90 : 180;

  const arrowSvg = ARROW_SVG(arrowRotate);
  const upArrowSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26" fill="none">
  <circle cx="13" cy="2.60001" r="2.60001" fill="#A8A8A8"/>
  <circle cx="13" cy="7.79996" r="2.60001" fill="#A8A8A8"/>
  <circle cx="13" cy="13.0002" r="2.60001" fill="#A8A8A8"/>
  <circle cx="13" cy="18.2001" r="2.60001" fill="#A8A8A8"/>
  <circle cx="13" cy="23.4001" r="2.60001" fill="#A8A8A8"/>
  <circle cx="7.79996" cy="7.79996" r="2.60001" fill="#A8A8A8"/>
  <circle cx="23.4001" cy="13.0002" r="2.60001" fill="#A8A8A8"/>
  <circle cx="2.60001" cy="13.0002" r="2.60001" fill="#A8A8A8"/>
  <circle cx="18.2" cy="7.79996" r="2.60001" fill="#A8A8A8"/>
</svg>`;
  const upKeyHtml = `
    <button type="button" class="arrowprompt-neo-button">
      ${upArrowSvg}
      <span class="arrowprompt-button-text">${label}</span>
    </button>
  `;
  const innerContent = key === 'ArrowUp'
    ? upKeyHtml
    : isHorizontal
      ? key === 'ArrowLeft'
        ? `<span class="arrowprompt-arrow-wrap">${arrowSvg}</span><span class="arrowprompt-label">${label}</span>`
        : `<span class="arrowprompt-label">${label}</span><span class="arrowprompt-arrow-wrap">${arrowSvg}</span>`
      : `<span class="arrowprompt-arrow-wrap">${arrowSvg}</span><span class="arrowprompt-label">${label}</span>`;

  const useShadow = key === 'ArrowUp';

  let feedback: HTMLElement;
  if (useShadow) {
    const host = document.createElement('div');
    host.className = 'arrowprompt-feedback';
    const sr = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = ARROWUP_SHADOW_CSS;
    sr.appendChild(style);
    const wrap = document.createElement('div');
    wrap.className = 'arrowprompt-figma-outer';
    wrap.setAttribute('data-key', key);
    wrap.innerHTML = upKeyHtml;
    sr.appendChild(wrap);
    feedback = host;
  } else {
    feedback = document.createElement('div');
    feedback.className = 'arrowprompt-feedback';
    feedback.innerHTML = `
    <div class="arrowprompt-figma-outer" data-key="${key}">
      <div class="arrowprompt-figma-button ${isHorizontal ? 'arrowprompt-row' : 'arrowprompt-col'}">
        ${innerContent}
      </div>
    </div>
  `;
  }

  document.body.appendChild(feedback);

  const gap = 60;
  // Use right/bottom so position does not depend on getBoundingClientRect (which can be wrong before layout)
  feedback.style.cssText = `
    position: fixed;
    right: ${gap}px;
    bottom: ${gap}px;
    z-index: 999999;
    animation: arrowprompt-slideIn 0.25s ease;
  `;

  // #region agent log
  const feedbackRect = feedback.getBoundingClientRect();
  fetch('http://127.0.0.1:7242/ingest/c99a099a-1890-430b-b9ee-af178d90891f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'content.ts:showFeedback',message:'Feedback position',data:{innerW:window.innerWidth,innerH:window.innerHeight,rectW:feedbackRect.width,rectH:feedbackRect.height,rectLeft:feedbackRect.left,rectTop:feedbackRect.top,usingRightBottom:true,gap},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
  // #endregion agent log

  const removeFeedback = (): void => {
    feedback.style.animation = 'arrowprompt-fadeOut 0.2s ease forwards';
    setTimeout(() => feedback.remove(), 200);
  };

  setTimeout(removeFeedback, 1800);
}

// Keyboard event handler
function handleKeyDown(event: KeyboardEvent): void {
  if (!ARROW_KEYS.includes(event.key)) return;
  if (!isEnabled) {
    console.log('[ArrowPrompt] Extension disabled');
    return;
  }

  const config = getCurrentSiteConfig();
  if (!config) {
    console.log('[ArrowPrompt] Unsupported website');
    return;
  }

  const inputElement = getInputElement();
  if (!inputElement) {
    console.log('[ArrowPrompt] Input field not found');
    return;
  }

  if (!isInputEmpty(inputElement, config)) {
    return; // Don't intercept if there's content
  }

  console.log('[ArrowPrompt] Arrow key detected:', event.key);
  
  event.preventDefault();
  event.stopPropagation();

  const prompt = currentConfig.prompts[event.key as ArrowKey];
  if (!prompt) return;

  const inserted = insertTextToInput(inputElement, prompt, config);
  if (inserted) {
    console.log('[ArrowPrompt] Prompt inserted:', prompt);
    showFeedback(event.key as ArrowKey, prompt, inputElement);
    setTimeout(() => clickSendButton(config), 200);
  }
}

// Add CSS for feedback cards (Figma nev-flynn Button)
function addStyles(): void {
  const style = document.createElement('style');
  style.textContent = `
    .arrowprompt-feedback {
      pointer-events: none;
      box-sizing: border-box;
    }
    .arrowprompt-figma-outer {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      padding: 3.54px;
      gap: 2.02px;
      position: relative;
      background: linear-gradient(180deg, #E9E9E9 0%, #E9E9E9 0.01%, #FFFFFF 100%);
      border-radius: 13.66px;
    }
    .arrowprompt-figma-outer[data-key="ArrowUp"] {
      width: 119.37px;
      height: 75.43px;
    }
    .arrowprompt-figma-outer[data-key="ArrowUp"] .arrowprompt-figma-button {
      width: 112.29px;
      height: 68.35px;
    }
    .arrowprompt-figma-outer[data-key="ArrowUp"] .arrowprompt-arrow-wrap {
      width: 26px;
      height: 26px;
    }
    .arrowprompt-figma-outer[data-key="ArrowUp"] .arrowprompt-arrow {
      width: 26px;
      height: 26px;
    }
    .arrowprompt-figma-outer[data-key="ArrowUp"] .arrowprompt-label {
      width: 88px;
      text-align: center;
    }
    .arrowprompt-neo-button {
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 8.1px;
      width: 112.29px;
      height: 68.35px;
      padding: 10.63px 12.14px;
      border: none;
      cursor: default;
      font: inherit;
      background: linear-gradient(180deg, #F4F4F4 0%, #FEFEFE 100%);
      box-shadow: 0px 0px 0.22px 0.22px rgba(0, 0, 0, 0.07), 0px 0px 0.22px 0.67px rgba(0, 0, 0, 0.05), 0px 2.7px 2.92px -1.35px rgba(0, 0, 0, 0.25), 0px 0.9px 3.6px 0.9px rgba(0, 0, 0, 0.12);
      border-radius: 10.12px;
    }
    .arrowprompt-neo-button svg {
      flex: none;
      display: block;
    }
    .arrowprompt-button-text {
      font-family: 'Product Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-weight: 400;
      font-size: 12.14px;
      line-height: 110%;
      color: #06071A;
      flex: none;
      white-space: nowrap;
    }
    .arrowprompt-figma-button {
      box-sizing: border-box;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 10.63px 12.14px;
      gap: 8.1px;
      background: linear-gradient(180deg, #F4F4F4 0%, #FEFEFE 100%);
      box-shadow: 0px 0px 0.22px 0.22px rgba(0, 0, 0, 0.07), 0px 0px 0.22px 0.67px rgba(0, 0, 0, 0.05), 0px 2.7px 2.92px -1.35px rgba(0, 0, 0, 0.25), 0px 0.9px 3.6px 0.9px rgba(0, 0, 0, 0.12);
      border-radius: 10.12px;
      flex: none;
    }
    .arrowprompt-figma-button.arrowprompt-row {
      flex-direction: row;
    }
    .arrowprompt-figma-button.arrowprompt-col {
      flex-direction: column;
    }
    .arrowprompt-arrow-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: none;
    }
    .arrowprompt-arrow {
      display: block;
      flex: none;
    }
    .arrowprompt-label {
      font-family: 'Product Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-style: normal;
      font-weight: 400;
      font-size: 12.14px;
      line-height: 110%;
      color: #06071A;
      flex: none;
      white-space: nowrap;
    }
    @keyframes arrowprompt-slideIn {
      from { transform: translateY(6px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    @keyframes arrowprompt-fadeOut {
      to { opacity: 0; transform: translateY(-4px); }
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
    console.error('[ArrowPrompt] Failed to load config:', error);
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
        console.log('[ArrowPrompt] Status updated:', isEnabled ? 'enabled' : 'disabled');
      }
      if (changes.prompts) {
        currentConfig.prompts = changes.prompts.newValue;
      }
    }
  });

  const siteConfig = getCurrentSiteConfig();
  console.log('✓ ArrowPrompt activated');
  console.log('[ArrowPrompt] Current site:', window.location.hostname);
  console.log('[ArrowPrompt] Site config:', siteConfig ? 'found' : 'not supported');
  console.log('[ArrowPrompt] Status:', isEnabled ? 'enabled' : 'disabled');
}

// Start
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})(); // End IIFE
