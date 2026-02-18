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
  if (isChatGPT) {
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

// Check if input is empty
function isInputEmpty(element: HTMLElement, _config: SiteConfig): boolean {
  const inputType = getInputType(element);
  if (inputType === 'contenteditable') {
    const text = element.textContent || element.innerText || '';
    return text.trim() === '';
  } else {
    const value = (element as HTMLTextAreaElement).value || '';
    return value.trim() === '';
  }
}

// Insert text into input
function insertTextToInput(element: HTMLElement, text: string, _config: SiteConfig): boolean {
  if (!element) return false;

  element.focus();

  const inputType = getInputType(element);
  if (inputType === 'contenteditable') {
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
  } else {
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

// Click send button (tries each selector; for ChatGPT also searches Shadow DOM and same doc as inputEl)
function clickSendButton(config: SiteConfig, inputDoc?: Document): boolean {
  const doc = inputDoc ?? document;
  const hostname = window.location.hostname;
  const isChatGPT = hostname.includes('chatgpt.com') || hostname.includes('chat.openai.com');
  const selectors = config.sendButtonSelector.split(',').map(s => s.trim());
  const searchDoc = (d: Document): HTMLButtonElement | null => {
    for (const sel of selectors) {
      let btn = d.querySelector(sel) as HTMLButtonElement | null;
      if (!btn && d.body && isChatGPT) btn = querySelectorIncludingShadowRoots(d.body, sel) as HTMLButtonElement | null;
      if (btn && !btn.disabled) return btn;
    }
    return null;
  };
  let btn = searchDoc(doc);
  if (btn) {
    btn.click();
    return true;
  }
  if (isChatGPT && doc === document) {
    for (const d of getSearchDocuments()) {
      if (d === document) continue;
      btn = searchDoc(d);
      if (btn) {
        btn.click();
        return true;
      }
    }
  }
  return false;
}

// Try to send: click send button; if none found (or on Perplexity), use Enter on input
function triggerSend(config: SiteConfig, inputElement: HTMLElement): void {
  const hostname = window.location.hostname;
  const isPerplexity = hostname.includes('perplexity.ai');
  // #region agent log
  const _h5b = {location:'content.ts:triggerSend',message:'send path',data:{hostname,isPerplexity},hypothesisId:'H5'};
  fetch('http://127.0.0.1:7242/ingest/c99a099a-1890-430b-b9ee-af178d90891f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({..._h5b,timestamp:Date.now()})}).catch(()=>{});
  console.log('[ArrowPrompt:debug]', _h5b);
  // #endregion agent log
  const sendWithEnter = (): void => {
    inputElement.focus();
    inputElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
    inputElement.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
    // #region agent log
    const _h5c = {location:'content.ts:triggerSend:sendWithEnter',message:'enter dispatched',data:{tagName:inputElement.tagName},hypothesisId:'H5'};
    fetch('http://127.0.0.1:7242/ingest/c99a099a-1890-430b-b9ee-af178d90891f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({..._h5c,timestamp:Date.now()})}).catch(()=>{});
    console.log('[ArrowPrompt:debug]', _h5c);
    // #endregion agent log
  };
  if (isPerplexity) {
    // Perplexity: prefer Enter (their send control is often not a standard button)
    setTimeout(sendWithEnter, 220);
    return;
  }
  const clicked = clickSendButton(config, inputElement.ownerDocument);
  // #region agent log
  const _h5d = {location:'content.ts:triggerSend',message:'button click result',data:{clicked},hypothesisId:'H5'};
  fetch('http://127.0.0.1:7242/ingest/c99a099a-1890-430b-b9ee-af178d90891f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({..._h5d,timestamp:Date.now()})}).catch(()=>{});
  console.log('[ArrowPrompt:debug]', _h5d);
  // #endregion agent log
  if (clicked) return;
  setTimeout(sendWithEnter, 200);
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
  // #region agent log
  console.log('[ArrowPrompt:debug] handleKeyDown', event.key, window.location.hostname);
  // #endregion agent log

  const config = getCurrentSiteConfig();
  // #region agent log
  const _h1 = {location:'content.ts:handleKeyDown',message:'site check',data:{hostname:window.location.hostname,hasConfig:!!config,key:event.key},hypothesisId:'H1'};
  fetch('http://127.0.0.1:7242/ingest/c99a099a-1890-430b-b9ee-af178d90891f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({..._h1,timestamp:Date.now()})}).catch(()=>{});
  console.log('[ArrowPrompt:debug]', _h1);
  // #endregion agent log
  if (!config) {
    console.log('[ArrowPrompt] Unsupported website');
    return;
  }

  const inputElement = getInputElement();
  // #region agent log
  const _h2 = {location:'content.ts:handleKeyDown',message:'input element',data:{hasInput:!!inputElement,inputSelector:config.inputSelector,tagName:inputElement?.tagName},hypothesisId:'H2'};
  fetch('http://127.0.0.1:7242/ingest/c99a099a-1890-430b-b9ee-af178d90891f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({..._h2,timestamp:Date.now()})}).catch(()=>{});
  console.log('[ArrowPrompt:debug]', _h2);
  // #endregion agent log
  if (!inputElement) {
    console.log('[ArrowPrompt] Input field not found');
    return;
  }

  const isEmpty = isInputEmpty(inputElement, config);
  const valuePreview = getInputType(inputElement) === 'textarea'
    ? (inputElement as HTMLTextAreaElement).value?.slice(0, 80) ?? ''
    : (inputElement.textContent || inputElement.innerText || '').slice(0, 80);
  // #region agent log
  const _h3 = {location:'content.ts:handleKeyDown',message:'input empty check',data:{isEmpty,tagName:inputElement.tagName,valueLength:valuePreview.length,valuePreview},hypothesisId:'H3'};
  fetch('http://127.0.0.1:7242/ingest/c99a099a-1890-430b-b9ee-af178d90891f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({..._h3,timestamp:Date.now()})}).catch(()=>{});
  console.log('[ArrowPrompt:debug]', _h3);
  // #endregion agent log
  if (!isEmpty) {
    return; // Don't intercept if there's content
  }

  console.log('[ArrowPrompt] Arrow key detected:', event.key);
  
  event.preventDefault();
  event.stopPropagation();

  const prompt = currentConfig.prompts[event.key as ArrowKey];
  if (!prompt) return;

  const inserted = insertTextToInput(inputElement, prompt, config);
  // #region agent log
  const _h4 = {location:'content.ts:handleKeyDown',message:'insert result',data:{inserted,key:event.key},hypothesisId:'H4'};
  fetch('http://127.0.0.1:7242/ingest/c99a099a-1890-430b-b9ee-af178d90891f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({..._h4,timestamp:Date.now()})}).catch(()=>{});
  console.log('[ArrowPrompt:debug]', _h4);
  // #endregion agent log
  if (inserted) {
    console.log('[ArrowPrompt] Prompt inserted:', prompt);
    showFeedback(event.key as ArrowKey, prompt, inputElement);
    // #region agent log
    const sendBtn = document.querySelector(config.sendButtonSelector);
    const _h5a = {location:'content.ts:handleKeyDown',message:'send button',data:{sendButtonFound:!!sendBtn,sendSelector:config.sendButtonSelector},hypothesisId:'H5'};
    fetch('http://127.0.0.1:7242/ingest/c99a099a-1890-430b-b9ee-af178d90891f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({..._h5a,timestamp:Date.now()})}).catch(()=>{});
    console.log('[ArrowPrompt:debug]', _h5a);
    // #endregion agent log
    setTimeout(() => triggerSend(config, inputElement), 200);
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
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync') {
      if (changes.enabled) isEnabled = changes.enabled.newValue;
      if (changes.prompts) currentConfig.prompts = changes.prompts.newValue;
    }
  });
  loadConfig().then((config) => {
    currentConfig = config;
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
