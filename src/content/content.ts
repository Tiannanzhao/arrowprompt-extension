import { StorageManager } from '../utils/storage';
import { getCurrentSiteConfig } from './site-configs';
import { ArrowKey, ExtensionConfig, SiteConfig } from '../utils/types';
import { ARROW_KEYS } from '../utils/constants';

let isEnabled = true;
let currentConfig: ExtensionConfig;

// 获取输入框元素
function getInputElement(): HTMLElement | null {
  const config = getCurrentSiteConfig();
  if (!config) return null;
  return document.querySelector(config.inputSelector);
}

// 插入文本到输入框
function insertTextToInput(element: HTMLElement, text: string, config: SiteConfig): boolean {
  if (!element) return false;

  element.focus();

  if (config.type === 'contenteditable') {
    // 清空并插入新内容
    element.innerHTML = '';
    element.textContent = text;
    
    // 将光标移到末尾
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(element);
    range.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(range);
    
    // 触发输入事件
    element.dispatchEvent(new InputEvent('input', { 
      bubbles: true, 
      cancelable: true,
      inputType: 'insertText',
      data: text
    }));
  } else if (config.type === 'textarea') {
    const textarea = element as HTMLTextAreaElement;
    
    // 触发React的onChange - 使用原生setter
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value'
    )?.set;
    
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(textarea, text);
    } else {
      textarea.value = text;
    }
    
    // 触发事件
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // 通用事件触发
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new Event('keyup', { bubbles: true }));

  return true;
}

// 点击发送按钮
function clickSendButton(config: SiteConfig): boolean {
  const sendButton = document.querySelector(config.sendButtonSelector) as HTMLButtonElement;
  if (sendButton && !sendButton.disabled) {
    setTimeout(() => sendButton.click(), 100);
    return true;
  }
  return false;
}

// 显示反馈
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
    animation: slideIn 0.3s ease;
  `;
  feedback.textContent = `✓ ${key.replace('Arrow', '')}键: ${prompt}`;

  document.body.appendChild(feedback);

  setTimeout(() => {
    feedback.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => feedback.remove(), 300);
  }, 2000);
}

// 检查输入框是否为空
function isInputEmpty(element: HTMLElement, config: SiteConfig): boolean {
  if (config.type === 'contenteditable') {
    const text = element.textContent || element.innerText || '';
    return text.trim() === '';
  } else {
    const value = (element as HTMLTextAreaElement).value || '';
    return value.trim() === '';
  }
}

// 键盘事件处理
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
    console.log('[ArrowPrompt] 找不到输入框，选择器:', config.inputSelector);
    return;
  }

  // 检查输入框是否为空
  if (!isInputEmpty(inputElement, config)) {
    // 有内容时不拦截，让正常的方向键功能工作
    return;
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
    // 延迟点击发送按钮，给页面时间更新状态
    setTimeout(() => clickSendButton(config), 200);
  }
}

// 添加CSS动画
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
`;
document.head.appendChild(style);

// 初始化
async function init() {
  currentConfig = await StorageManager.loadConfig();
  isEnabled = currentConfig.enabled;

  // 使用capture阶段捕获键盘事件
  document.addEventListener('keydown', handleKeyDown, true);
  
  // 也监听window级别的事件
  window.addEventListener('keydown', handleKeyDown, true);

  // 监听配置变化
  StorageManager.onConfigChange((changes) => {
    if (changes.enabled) {
      isEnabled = changes.enabled.newValue;
      console.log('[ArrowPrompt] 状态已更新:', isEnabled ? '启用' : '禁用');
    }
    if (changes.prompts) {
      currentConfig.prompts = changes.prompts.newValue;
    }
  });

  const siteConfig = getCurrentSiteConfig();
  console.log('✓ ArrowPrompt 已激活');
  console.log('[ArrowPrompt] 当前网站:', window.location.hostname);
  console.log('[ArrowPrompt] 网站配置:', siteConfig ? '已找到' : '不支持');
  console.log('[ArrowPrompt] 插件状态:', isEnabled ? '启用' : '禁用');
}

// 启动
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
