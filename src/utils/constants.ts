import { PromptConfig } from './types';

// 默认提示词配置
export const DEFAULT_PROMPTS: PromptConfig = {
  ArrowUp: '解释这段代码',
  ArrowDown: '优化一下',
  ArrowLeft: '修复这个bug',
  ArrowRight: '换成中文'
};

// 默认扩展配置
export const DEFAULT_CONFIG = {
  enabled: true,
  prompts: DEFAULT_PROMPTS,
  version: '1.0.0',
  isPro: false
};

// 支持的方向键
export const ARROW_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
