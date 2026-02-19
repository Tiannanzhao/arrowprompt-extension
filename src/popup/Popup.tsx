import React, { useState, useEffect, useCallback } from 'react';
import { StorageManager } from '../utils/storage';
import { ExtensionConfig, ComboBinding, ArrowKey } from '../utils/types';
import { VERIFY_LICENSE_URL, GUMROAD_PRODUCT_URL, ARROW_KEYS } from '../utils/constants';
import './Popup.css';

const ARROW_LABELS: Record<ArrowKey, string> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→'
};

function comboKeysToLabel(keys: ArrowKey[]): string {
  return keys.map((k) => ARROW_LABELS[k]).join(' + ');
}

const Popup: React.FC = () => {
  const [config, setConfig] = useState<ExtensionConfig | null>(null);
  const [licenseInput, setLicenseInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [recordingComboId, setRecordingComboId] = useState<string | null>(null);
  const [recordingKeys, setRecordingKeys] = useState<ArrowKey[]>([]);

  const loadConfig = useCallback(async () => {
    const loaded = await StorageManager.loadConfig();
    const license = await StorageManager.getLicenseState();
    if (license?.isValid && !loaded.isPro) {
      await StorageManager.saveConfig({ isPro: true });
      setConfig({ ...loaded, isPro: true });
    } else {
      setConfig(loaded);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleToggle = async () => {
    if (!config) return;
    const newEnabled = await StorageManager.toggleEnabled();
    setConfig({ ...config, enabled: newEnabled });
  };

  const handleVerifyLicense = async () => {
    const key = licenseInput.trim();
    if (!key) {
      setVerifyError('Enter your license key');
      return;
    }
    setVerifying(true);
    setVerifyError(null);
    try {
      const res = await fetch(VERIFY_LICENSE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: key })
      });
      const data = (await res.json()) as { valid?: boolean; message?: string };
      if (data.valid) {
        await StorageManager.setLicenseState({
          licenseKey: key,
          isValid: true,
          checkedAt: Date.now()
        });
        await StorageManager.saveConfig({ isPro: true });
        setLicenseInput('');
        await loadConfig();
      } else {
        setVerifyError(data.message || 'Invalid license key');
      }
    } catch (e) {
      setVerifyError('Verification failed. Check your connection.');
    } finally {
      setVerifying(false);
    }
  };

  const handleDeactivate = async () => {
    await StorageManager.clearLicense();
    await StorageManager.saveConfig({ isPro: false });
    await loadConfig();
  };

  const handlePromptChange = async (key: keyof ExtensionConfig['prompts'], value: string) => {
    if (!config) return;
    await StorageManager.updatePrompts({ [key]: value });
    setConfig({ ...config, prompts: { ...config.prompts, [key]: value } });
  };

  const handleComboPromptChange = async (id: string, prompt: string) => {
    if (!config) return;
    const next = config.comboPrompts.map((c) => (c.id === id ? { ...c, prompt } : c));
    await StorageManager.updateComboPrompts(next);
    setConfig({ ...config, comboPrompts: next });
  };

  const handleAddCombo = async () => {
    if (!config) return;
    const newCombo: ComboBinding = {
      id: `combo-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      keys: [],
      prompt: ''
    };
    const next = [...config.comboPrompts, newCombo];
    await StorageManager.updateComboPrompts(next);
    setConfig({ ...config, comboPrompts: next });
    setRecordingComboId(newCombo.id);
    setRecordingKeys([]);
  };

  const handleRemoveCombo = async (id: string) => {
    if (!config) return;
    const next = config.comboPrompts.filter((c) => c.id !== id);
    await StorageManager.updateComboPrompts(next);
    setConfig({ ...config, comboPrompts: next });
    if (recordingComboId === id) setRecordingComboId(null);
  };

  const finishRecordingCombo = useCallback(
    (id: string, keys: ArrowKey[]) => {
      if (!config || keys.length < 2 || keys.length > 4) return;
      const next = config.comboPrompts.map((c) =>
        c.id === id ? { ...c, keys: [...keys].sort() } : c
      );
      StorageManager.updateComboPrompts(next).then(() => setConfig({ ...config, comboPrompts: next }));
      setRecordingComboId(null);
      setRecordingKeys([]);
    },
    [config]
  );

  useEffect(() => {
    if (!recordingComboId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!ARROW_KEYS.includes(e.key as ArrowKey)) return;
      e.preventDefault();
      const key = e.key as ArrowKey;
      setRecordingKeys((prev) => {
        if (prev.includes(key)) return prev;
        return prev.length < 4 ? [...prev, key] : prev;
      });
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [recordingComboId]);

  if (!config) return <div className="popup-loading">Loading...</div>;

  return (
    <div className="popup-container">
      <div className="header">
        <h1>⌨️ ArrowPrompt</h1>
        <label className="toggle">
          <input type="checkbox" checked={config.enabled} onChange={handleToggle} />
          <span className="slider"></span>
        </label>
      </div>

      {/* License / Standard */}
      <div className="license-section">
        {config.isPro ? (
          <div className="standard-badge-row">
            <span className="standard-badge">Standard</span>
            <button type="button" className="btn-deactivate" onClick={handleDeactivate}>
              Deactivate
            </button>
          </div>
        ) : (
          <div className="license-form">
            <input
              type="text"
              className="license-input"
              placeholder="License key"
              value={licenseInput}
              onChange={(e) => setLicenseInput(e.target.value)}
              disabled={verifying}
            />
            <button
              type="button"
              className="btn-verify"
              onClick={handleVerifyLicense}
              disabled={verifying}
            >
              {verifying ? 'Verifying…' : 'Verify'}
            </button>
            {verifyError && <div className="verify-error">{verifyError}</div>}
            <a
              href={GUMROAD_PRODUCT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="buy-standard-link"
            >
              Buy Standard ($2.99)
            </a>
          </div>
        )}
      </div>

      {/* Prompts: Standard = editable, Free = read-only */}
      <div className="prompt-section">
        <h3 className="section-title">Arrow keys</h3>
        {config.isPro ? (
          <div className="prompt-list editable">
            {(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const).map((key) => (
              <div key={key} className="prompt-item editable">
                <span className="key">{ARROW_LABELS[key]}</span>
                <input
                  type="text"
                  className="prompt-input"
                  value={config.prompts[key]}
                  onChange={(e) => handlePromptChange(key, e.target.value)}
                  onBlur={(e) => handlePromptChange(key, e.target.value)}
                />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="prompt-list">
              <PromptItem icon="↑" text={config.prompts.ArrowUp} />
              <PromptItem icon="↓" text={config.prompts.ArrowDown} />
              <PromptItem icon="←" text={config.prompts.ArrowLeft} />
              <PromptItem icon="→" text={config.prompts.ArrowRight} />
            </div>
            <p className="upgrade-hint">Upgrade to Standard to customize prompts and add combo keys.</p>
          </>
        )}
      </div>

      {/* Combo keys (Standard only) */}
      {config.isPro && (
        <div className="combo-section">
          <h3 className="section-title">Combo keys</h3>
          {config.comboPrompts.map((combo) => (
            <div key={combo.id} className="combo-row">
              <div className="combo-keys">
                {recordingComboId === combo.id ? (
                  <>
                    <span className="recording-hint">
                      {recordingKeys.length > 0 ? comboKeysToLabel(recordingKeys) : 'Press 2–4 arrow keys'}
                    </span>
                    {recordingKeys.length >= 2 && (
                      <button
                        type="button"
                        className="btn-done-combo"
                        onClick={() => finishRecordingCombo(combo.id, recordingKeys)}
                      >
                        Done
                      </button>
                    )}
                  </>
                ) : combo.keys.length >= 2 ? (
                  <span>{comboKeysToLabel(combo.keys)}</span>
                ) : (
                  <button
                    type="button"
                    className="btn-record"
                    onClick={() => {
                      setRecordingComboId(combo.id);
                      setRecordingKeys([]);
                    }}
                  >
                    Record
                  </button>
                )}
              </div>
              <input
                type="text"
                className="combo-prompt-input"
                placeholder="Prompt"
                value={combo.prompt}
                onChange={(e) => handleComboPromptChange(combo.id, e.target.value)}
              />
              <button
                type="button"
                className="btn-remove"
                onClick={() => handleRemoveCombo(combo.id)}
                aria-label="Remove"
              >
                ×
              </button>
            </div>
          ))}
          <button type="button" className="btn-add-combo" onClick={handleAddCombo}>
            + Add combo
          </button>
        </div>
      )}

      <div className={`status ${config.enabled ? 'active' : 'inactive'}`}>
        {config.enabled ? '✓ Extension enabled' : '✗ Extension disabled'}
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
