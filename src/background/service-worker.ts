// ArrowPrompt Background Service Worker (Self-contained)

(function() {
'use strict';

const DEFAULT_PROMPTS = {
  ArrowUp: '解释这段代码',
  ArrowDown: '优化一下',
  ArrowLeft: '修复这个bug',
  ArrowRight: '换成中文'
};

const DEFAULT_CONFIG = {
  enabled: true,
  prompts: DEFAULT_PROMPTS,
  version: '1.0.0',
  isPro: false
};

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set(DEFAULT_CONFIG);
  console.log('ArrowPrompt 已安装');
});

})(); // End IIFE
