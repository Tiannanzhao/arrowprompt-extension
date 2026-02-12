import React, { useState, useEffect } from 'react';
import { StorageManager } from '../utils/storage';
import { ExtensionConfig } from '../utils/types';
import './Popup.css';

const Popup: React.FC = () => {
  const [config, setConfig] = useState<ExtensionConfig | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    const loadedConfig = await StorageManager.loadConfig();
    setConfig(loadedConfig);
  };

  const handleToggle = async () => {
    if (!config) return;
    const newEnabled = await StorageManager.toggleEnabled();
    setConfig({ ...config, enabled: newEnabled });
  };

  if (!config) return <div>加载中...</div>;

  return (
    <div className="popup-container">
      <div className="header">
        <h1>⌨️ ArrowPrompt</h1>
        <label className="toggle">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={handleToggle}
          />
          <span className="slider"></span>
        </label>
      </div>

      <div className="prompt-list">
        <PromptItem icon="↑" text={config.prompts.ArrowUp} />
        <PromptItem icon="↓" text={config.prompts.ArrowDown} />
        <PromptItem icon="←" text={config.prompts.ArrowLeft} />
        <PromptItem icon="→" text={config.prompts.ArrowRight} />
      </div>

      <div className={`status ${config.enabled ? 'active' : 'inactive'}`}>
        {config.enabled ? '✓ 插件已启用' : '✗ 插件已禁用'}
      </div>
    </div>
  );
};

interface PromptItemProps {
  icon: string;
  text: string;
}

const PromptItem: React.FC<PromptItemProps> = ({ icon, text }) => (
  <div className="prompt-item">
    <span className="key">{icon}</span>
    <span className="prompt-text">{text}</span>
  </div>
);

export default Popup;
