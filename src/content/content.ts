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
    (element as HTMLDivElement).textContent = text;
  } else if (config.type === 'textarea') {
    (element as HTMLTextAreaElement).value = text;
    
    // 触发React的onChange
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value'
    )?.set;
    nativeInputValueSetter?.call(element, text);
  }

  // 触发事件
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));

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

// 键盘事件处理
function handleKeyDown(event: KeyboardEvent): void {
  if (!ARROW_KEYS.includes(event.key)) return;
  if (!isEnabled) return;

  const config = getCurrentSiteConfig();
  if (!config) return;

  const inputElement = getInputElement();
  if (!inputElement) return;

  // 检查输入框是否为空
  const isEmpty = 
    (inputElement as HTMLDivElement).textContent?.trim() === '' ||
    (inputElement as HTMLTextAreaElement).value?.trim() === '';

  if (!isEmpty) return; // 有内容时不拦截

  event.preventDefault();
  event.stopPropagation();

  const prompt = currentConfig.prompts[event.key as ArrowKey];
  if (!prompt) return;

  const inserted = insertTextToInput(inputElement, prompt, config);
  if (inserted) {
    clickSendButton(config);
    showFeedback(event.key as ArrowKey, prompt);
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

  document.addEventListener('keydown', handleKeyDown, true);

  // 监听配置变化
  StorageManager.onConfigChange((changes) => {
    if (changes.enabled) {
      isEnabled = changes.enabled.newValue;
    }
    if (changes.prompts) {
      currentConfig.prompts = changes.prompts.newValue;
    }
  });

  console.log('✓ ArrowPrompt 已激活');
}

// 启动
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
