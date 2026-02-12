// ArrowPrompt Background Service Worker (Self-contained)

(function() {
'use strict';

const DEFAULT_PROMPTS = {
  ArrowUp: 'Explain this code',
  ArrowDown: 'Optimize this',
  ArrowLeft: 'Fix this bug',
  ArrowRight: 'Translate to Chinese'
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
  console.log('ArrowPrompt installed');
});

})(); // End IIFE
