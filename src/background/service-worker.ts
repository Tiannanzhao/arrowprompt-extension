import { DEFAULT_CONFIG } from '../utils/constants';

// 安装时初始化
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set(DEFAULT_CONFIG);
  console.log('ArrowPrompt 已安装');
});
