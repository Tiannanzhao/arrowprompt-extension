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

interface ComboBinding {
  id: string;
  keys: ArrowKey[];
  prompt: string;
}

interface ExtensionConfig {
  enabled: boolean;
  prompts: PromptConfig;
  comboPrompts: ComboBinding[];
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
  comboPrompts: [],
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
    inputSelector: '#prompt-textarea, textarea[data-id="root"], [data-testid="composer-textarea"], textarea[placeholder*="Message"], form textarea, div[contenteditable="true"][data-id], [contenteditable="true"]',
    sendButtonSelector: 'button[data-testid="send-button"], button[aria-label*="Send"], button[type="submit"], [data-testid="send-button"]',
    type: 'textarea'
  },
  'chatgpt.com': {
    inputSelector: '#prompt-textarea, textarea[data-id="root"], [data-testid="composer-textarea"], textarea[placeholder*="Message"], form textarea, div[contenteditable="true"][data-id], [contenteditable="true"]',
    sendButtonSelector: 'button[data-testid="send-button"], button[aria-label*="Send"], button[type="submit"], [data-testid="send-button"]',
    type: 'textarea'
  },
  'perplexity.ai': {
    inputSelector: 'textarea[placeholder*="Ask"], textarea[placeholder*="Message"], textarea[placeholder*="Ask anything"], textarea, div[contenteditable="true"]',
    sendButtonSelector: 'button[type="submit"], button[aria-label*="Send"], button[aria-label*="发送"], button[data-testid="send-button"], [aria-label*="Send"], [role="button"][aria-label*="Send"], button[class*="send"], form button[type="submit"]',
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
const keysHeld = new Set<ArrowKey>();
let singleKeyTimerId: ReturnType<typeof setTimeout> | null = null;
const COMBO_DELAY_MS = 280;

function sortedKeys(set: Set<ArrowKey>): ArrowKey[] {
  return [...set].sort();
}

function findComboMatch(keys: ArrowKey[]): ComboBinding | null {
  if (keys.length < 2 || keys.length > 4) return null;
  const sorted = [...keys].sort();
  const keyStr = sorted.join(',');
  for (const combo of currentConfig.comboPrompts) {
    if (combo.keys.length < 2) continue;
    const comboStr = [...combo.keys].sort().join(',');
    if (comboStr === keyStr) return combo;
  }
  return null;
}

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

// Query selector in element and all descendant shadow roots (ChatGPT may put composer in Shadow DOM)
function querySelectorIncludingShadowRoots(root: Document | Element, selector: string): HTMLElement | null {
  const el = root.querySelector(selector);
  if (el) return el as HTMLElement;
  const walk = (node: Element): HTMLElement | null => {
    const shadow = node.shadowRoot;
    if (shadow) {
      const found = shadow.querySelector(selector);
      if (found) return found as HTMLElement;
      for (const child of shadow.querySelectorAll('*')) {
        const deep = walk(child);
        if (deep) return deep;
      }
    }
    return null;
  };
  for (const child of root.querySelectorAll('*')) {
    const found = walk(child);
    if (found) return found;
  }
  return null;
}

// Get documents to search (main + same-origin iframes) for ChatGPT
function getSearchDocuments(): Document[] {
  const docs: Document[] = [document];
  try {
    document.querySelectorAll('iframe').forEach((frame) => {
      try {
        const doc = frame.contentDocument;
        if (doc && doc !== document) docs.push(doc);
      } catch {
        /* same-origin only */
      }
    });
  } catch {
    /* ignore */
  }
  return docs;
}

// Get input element (searches document, iframes, and Shadow DOM for ChatGPT)
function getInputElement(): HTMLElement | null {
  const config = getCurrentSiteConfig();
  if (!config) return null;
  const hostname = window.location.hostname;
  const isChatGPT = hostname.includes('chatgpt.com') || hostname.includes('chat.openai.com');
  const selectors = config.inputSelector.split(',').map(s => s.trim());

  const searchInDoc = (doc: Document): HTMLElement | null => {
    for (const sel of selectors) {
      const el = doc.querySelector(sel) as HTMLElement | null;
      if (el) return el;
      if (doc.body) {
        const inShadow = querySelectorIncludingShadowRoots(doc.body, sel);
        if (inShadow) return inShadow;
      }
    }
    return null;
  };

  let el = searchInDoc(document);
  if (el) return el;
  const searchIframes = isChatGPT || hostname.includes('perplexity.ai');
  if (searchIframes) {
    for (const doc of getSearchDocuments()) {
      if (doc === document) continue;
      el = searchInDoc(doc);
      if (el) return el;
    }
  }
  return null;
}

// Detect input type from element (so one site can use textarea or contenteditable)
function getInputType(element: HTMLElement): 'contenteditable' | 'textarea' {
  if (element.tagName === 'TEXTAREA') return 'textarea';
  if (element.getAttribute?.('contenteditable') === 'true') return 'contenteditable';
  return 'textarea';
}

// Append text to input (supports multiple appends; newline before text when content exists)
function insertTextToInput(element: HTMLElement, text: string, _config: SiteConfig): boolean {
  if (!element) return false;

  const isPerplexity = window.location.hostname.includes('perplexity.ai');

  // Perplexity: re-query current input in next tick and defer write so React state can settle.
  if (isPerplexity) {
    setTimeout(() => {
      const target = getInputElement() ?? element;
      if (!target) return;
      target.focus();
      const inputType = getInputType(target);
      if (inputType === 'contenteditable') {
        const sel = window.getSelection();
        if (sel) {
          const range = document.createRange();
          range.selectNodeContents(target);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
          const current = (target.textContent || target.innerText || '').trimEnd();
          const toInsert = current.length > 0 ? '\n' + text : text;
          const inserted = document.execCommand('insertText', false, toInsert);
          if (!inserted) {
            const current = (target.textContent || target.innerText || '').trimEnd();
            const toSet = current ? current + '\n' + text : text;
            target.textContent = toSet;
            const range2 = document.createRange();
            range2.selectNodeContents(target);
            range2.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range2);
            target.dispatchEvent(new InputEvent('input', {
              bubbles: true,
              cancelable: true,
              inputType: 'insertText',
              data: text
            }));
          }
        }
      } else if (inputType === 'textarea') {
        const textarea = target as HTMLTextAreaElement;
        const current = textarea.value || '';
        const toSet = current.length > 0 ? current + '\n' + text : text;
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
        if (setter) setter.call(textarea, toSet);
        else textarea.value = toSet;
        textarea.setSelectionRange(toSet.length, toSet.length);
        target.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: text
        }));
      }
    }, 0);
    return true;
  }

  element.focus();

  const inputType = getInputType(element);
  const currentRaw = inputType === 'contenteditable'
    ? (element.textContent || element.innerText || '').trimEnd()
    : (element as HTMLTextAreaElement).value || '';
  if (inputType === 'contenteditable') {
    const current = currentRaw;
    const toSet = current ? current + '\n' + text : text;
    element.textContent = toSet;

    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(element);
    range.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(range);

    element.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: text
    }));
  } else {
    const textarea = element as HTMLTextAreaElement;
    const current = textarea.value || '';
    const toInsert = current.length > 0 ? '\n' + text : text;
    const toSet = current + toInsert;
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value'
    )?.set;
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(textarea, toSet);
    } else {
      textarea.value = toSet;
    }
    textarea.setSelectionRange(toSet.length, toSet.length);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }

  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new Event('keyup', { bubbles: true }));

  return true;
}

// Figma nev-flynn Button: labels per key
const FEEDBACK_LABELS: Record<ArrowKey, string> = {
  ArrowLeft: 'Fix this bug',
  ArrowRight: 'Translate to Chinese',
  ArrowUp: 'Explain this code',
  ArrowDown: 'Optimize this'
};

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
    padding: 4px;
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
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 104.29px;
  }
  .arrowprompt-neo-button-row .arrowprompt-button-text {
    max-width: 120px;
  }
  .arrowprompt-neo-button-row {
    flex-direction: row;
    width: auto;
    min-width: 112.29px;
    height: 68.35px;
  }
  .arrowprompt-figma-outer[data-key="ArrowRight"] {
    width: auto;
    height: auto;
    min-width: 112.29px;
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
  const leftArrowSvg = `<span style="display:inline-block;transform:rotate(-90deg);">${upArrowSvg}</span>`;
  const rightArrowSvg = `<span style="display:inline-block;transform:rotate(90deg);">${upArrowSvg}</span>`;
  const downArrowSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26" fill="none">
  <circle cx="13.0001" cy="23.4001" r="2.60001" transform="rotate(-180 13.0001 23.4001)" fill="#A8A8A8"/>
  <circle cx="13.0001" cy="18.2001" r="2.60001" transform="rotate(-180 13.0001 18.2001)" fill="#A8A8A8"/>
  <circle cx="13.0001" cy="12.9999" r="2.60001" transform="rotate(-180 13.0001 12.9999)" fill="#A8A8A8"/>
  <circle cx="13.0001" cy="7.79996" r="2.60001" transform="rotate(-180 13.0001 7.79996)" fill="#A8A8A8"/>
  <circle cx="13.0001" cy="2.60001" r="2.60001" transform="rotate(-180 13.0001 2.60001)" fill="#A8A8A8"/>
  <circle cx="18.2002" cy="18.2001" r="2.60001" transform="rotate(-180 18.2002 18.2001)" fill="#A8A8A8"/>
  <circle cx="2.60007" cy="12.9999" r="2.60001" transform="rotate(-180 2.60007 12.9999)" fill="#A8A8A8"/>
  <circle cx="23.4001" cy="12.9999" r="2.60001" transform="rotate(-180 23.4001 12.9999)" fill="#A8A8A8"/>
  <circle cx="7.80014" cy="18.2001" r="2.60001" transform="rotate(-180 7.80014 18.2001)" fill="#A8A8A8"/>
</svg>`;
  const upKeyHtml = `
    <button type="button" class="arrowprompt-neo-button">
      ${upArrowSvg}
      <span class="arrowprompt-button-text">${label}</span>
    </button>
  `;
  const leftKeyHtml = `
    <button type="button" class="arrowprompt-neo-button arrowprompt-neo-button-row">
      ${leftArrowSvg}
      <span class="arrowprompt-button-text">Fix this bug</span>
    </button>
  `;
  const rightKeyHtml = `
    <button type="button" class="arrowprompt-neo-button arrowprompt-neo-button-row">
      <span class="arrowprompt-button-text">${label}</span>
      ${rightArrowSvg}
    </button>
  `;
  const downKeyHtml = `
    <button type="button" class="arrowprompt-neo-button">
      <span class="arrowprompt-button-text">${label}</span>
      ${downArrowSvg}
    </button>
  `;

  const keyToHtml =
    key === 'ArrowUp' ? upKeyHtml
    : key === 'ArrowLeft' ? leftKeyHtml
    : key === 'ArrowRight' ? rightKeyHtml
    : downKeyHtml;

  const host = document.createElement('div');
  host.className = 'arrowprompt-feedback';
  const sr = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = ARROWUP_SHADOW_CSS;
  sr.appendChild(style);
  const wrap = document.createElement('div');
  wrap.className = 'arrowprompt-figma-outer';
  wrap.setAttribute('data-key', key);
  wrap.innerHTML = keyToHtml;
  sr.appendChild(wrap);
  const feedback: HTMLElement = host;

  document.body.appendChild(feedback);

  const gap = '1%';
  feedback.style.cssText = `
    position: fixed;
    right: ${gap};
    bottom: ${gap};
    z-index: 999999;
    animation: arrowprompt-slideIn 0.25s ease;
  `;

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

  console.log('[ArrowPrompt] Arrow key detected:', event.key);

  event.preventDefault();
  event.stopPropagation();

  keysHeld.add(event.key as ArrowKey);

  if (currentConfig.isPro && keysHeld.size >= 2) {
    if (singleKeyTimerId !== null) {
      clearTimeout(singleKeyTimerId);
      singleKeyTimerId = null;
    }
    const combo = findComboMatch(sortedKeys(keysHeld));
    if (combo && combo.prompt) {
      const inserted = insertTextToInput(inputElement, combo.prompt, config);
      if (inserted) {
        console.log('[ArrowPrompt] Combo prompt inserted:', combo.prompt);
        showFeedback(event.key as ArrowKey, combo.prompt, inputElement);
      }
      return;
    }
  }

  if (keysHeld.size === 1) {
    if (singleKeyTimerId !== null) clearTimeout(singleKeyTimerId);
    singleKeyTimerId = setTimeout(() => {
      singleKeyTimerId = null;
      if (keysHeld.size !== 1) return;
      const el = getInputElement();
      const cfg = getCurrentSiteConfig();
      if (!el || !cfg) return;
      const key = sortedKeys(keysHeld)[0];
      const prompt = currentConfig.prompts[key] || null;
      if (prompt) {
        const inserted = insertTextToInput(el, prompt, cfg);
        if (inserted) {
          console.log('[ArrowPrompt] Prompt inserted:', prompt);
          showFeedback(key, prompt, el);
        }
      }
    }, COMBO_DELAY_MS);
    return;
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

// Initialize: attach listeners immediately so arrow keys work before storage loads (store review)
function init(): void {
  addStyles();
  document.addEventListener('keydown', handleKeyDown, true);
  window.addEventListener('keydown', handleKeyDown, true);
  const hostname = window.location.hostname;
  if (hostname.includes('perplexity.ai') || hostname.includes('chatgpt.com') || hostname.includes('chat.openai.com')) {
    for (const doc of getSearchDocuments()) {
      if (doc !== document) {
        doc.addEventListener('keydown', handleKeyDown, true);
        doc.defaultView?.addEventListener?.('keydown', handleKeyDown, true);
      }
    }
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync') {
      if (changes.enabled !== undefined) isEnabled = changes.enabled.newValue;
      if (changes.prompts !== undefined) currentConfig.prompts = changes.prompts.newValue;
      if (changes.isPro !== undefined) currentConfig.isPro = changes.isPro.newValue;
      if (changes.comboPrompts !== undefined) {
        loadConfig().then((config) => {
          currentConfig.comboPrompts = Array.isArray(config.comboPrompts) ? config.comboPrompts : [];
        });
      }
    }
  });

  chrome.runtime.onMessage.addListener((msg: { type?: string }) => {
    if (msg?.type === 'arrowprompt-reload-config') {
      loadConfig().then((config) => {
        currentConfig = {
          ...DEFAULT_CONFIG,
          ...config,
          comboPrompts: Array.isArray(config.comboPrompts) ? config.comboPrompts : []
        };
        isEnabled = config.enabled;
      });
    }
  });
  function handleKeyUp(e: KeyboardEvent): void {
    if (ARROW_KEYS.includes(e.key)) keysHeld.delete(e.key as ArrowKey);
  }
  document.addEventListener('keyup', handleKeyUp, true);
  window.addEventListener('keyup', handleKeyUp, true);
  if (hostname.includes('perplexity.ai') || hostname.includes('chatgpt.com') || hostname.includes('chat.openai.com')) {
    for (const doc of getSearchDocuments()) {
      if (doc !== document) {
        doc.addEventListener('keyup', handleKeyUp, true);
        doc.defaultView?.addEventListener?.('keyup', handleKeyUp, true);
      }
    }
    setTimeout(() => {
      for (const doc of getSearchDocuments()) {
        if (doc !== document) {
          doc.addEventListener('keydown', handleKeyDown, true);
          doc.addEventListener('keyup', handleKeyUp, true);
          doc.defaultView?.addEventListener?.('keydown', handleKeyDown, true);
          doc.defaultView?.addEventListener?.('keyup', handleKeyUp, true);
        }
      }
    }, 2000);
  }

  loadConfig().then((config) => {
    currentConfig = {
      ...DEFAULT_CONFIG,
      ...config,
      comboPrompts: Array.isArray(config.comboPrompts) ? config.comboPrompts : []
    };
    isEnabled = config.enabled;
  }).catch(() => { /* keep defaults */ });
}

// Start
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})(); // End IIFE
